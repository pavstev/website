import { z } from "zod";

import { buildSystemPrompt, loadFacts } from "./facts.ts";
import { clientIp, failure, noStore } from "./http.ts";
import { verifyTurnstile } from "./turnstile.ts";

export const askModel = "@cf/meta/llama-3.1-8b-instruct-fp8";
export const maxQuestionChars = 500;

const maxBodyBytes = 8192;
const maxTokenChars = 2048;

const specialToken = /<\|[^>|]*\|>/g;

const stripSpecialTokens = (text: string): string => {
  let current = text;
  let previous = "";

  while (current !== previous) {
    previous = current;
    current = current.replaceAll(specialToken, "");
  }

  return current.trim();
};

const bodySchema = z.object({
  question: z
    .string()
    .transform(stripSpecialTokens)
    .pipe(z.string().min(1).max(maxQuestionChars)),
  turnstileToken: z.string().min(1).max(maxTokenChars),
});

const readCapped = async (request: Request): Promise<string | undefined> => {
  const declared = Number(request.headers.get("Content-Length") ?? 0);

  if (!request.body) {
    return "";
  }

  if (declared > maxBodyBytes) {
    await request.body.cancel();
    return undefined;
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;

  for (;;) {
    const result: ReadableStreamReadResult<unknown> = await reader.read();

    if (result.done) {
      break;
    }

    const { value } = result;

    if (!(value instanceof Uint8Array)) {
      await reader.cancel();
      return undefined;
    }

    size += value.byteLength;

    if (size > maxBodyBytes) {
      await reader.cancel();
      return undefined;
    }

    chunks.push(value);
  }

  const joined = new Uint8Array(size);
  let offset = 0;

  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder().decode(joined);
};

const readBody = async (
  request: Request
): Promise<undefined | z.infer<typeof bodySchema>> => {
  try {
    const text = await readCapped(request);

    if (text === undefined) {
      return undefined;
    }

    const parsed = bodySchema.safeParse(JSON.parse(text));

    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
};

export const handleAsk = async (
  request: Request,
  env: Env,
  fetchImpl: typeof fetch = fetch
): Promise<Response> => {
  if (request.method !== "POST") {
    return failure(405, "method", { Allow: "POST" });
  }

  const body = await readBody(request);

  if (!body) {
    return failure(400, "question");
  }

  try {
    const ip = clientIp(request);
    const { success } = await env.ASK_LIMITER.limit({ key: ip });

    if (!success) {
      return failure(429, "limit");
    }

    const human = await verifyTurnstile(
      body.turnstileToken,
      ip,
      env.TURNSTILE_SECRET_KEY,
      fetchImpl
    );

    if (!human) {
      return failure(403, "bot");
    }

    const facts = await loadFacts(env.ASSETS, new URL(request.url).origin);
    const stream = await env.AI.run(askModel, {
      max_tokens: 400,
      messages: [
        { content: buildSystemPrompt(facts), role: "system" },
        { content: body.question, role: "user" },
      ],
      stream: true,
    });

    return new Response(stream, {
      headers: {
        ...noStore,
        "Content-Type": "text/event-stream; charset=utf-8",
      },
    });
  } catch {
    return failure(502, "failed");
  }
};
