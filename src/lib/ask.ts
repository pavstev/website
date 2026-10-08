import type { en } from "@/lib/i18n";

export type AskBlock = "checkFirst" | "questionFirst";

export type AskErrorKey = keyof typeof en.ask.errors;

interface AskState {
  busy: boolean;
  hasToken: boolean;
  question: string;
}

export const askPanelId = "ask-panel";

export const askEndpoint = "/api/ask";

export const askMaxChars = 500;

const testSiteKey = "1x00000000000000000000AA";

const isConfigured = (siteKey: string | undefined): siteKey is string =>
  siteKey !== undefined && siteKey !== "";

export const askSiteKeyOf = (siteKey: string | undefined): string =>
  isConfigured(siteKey) ? siteKey : testSiteKey;

export const askEnabled = (
  siteKey: string | undefined,
  workersCi: string | undefined
): boolean => isConfigured(siteKey) || workersCi !== "1";

export const askSiteKey: string = askSiteKeyOf(
  process.env["NEXT_PUBLIC_TURNSTILE_SITE_KEY"]
);

export const turnstileScript =
  "https://challenges.cloudflare.com/turnstile/v0/api.js";

const dataPrefix = "data:";
const doneMarker = "[DONE]";

const keyByCode = new Map<string, AskErrorKey>([
  ["bot", "bot"],
  ["limit", "limit"],
  ["question", "question"],
]);

const keyByStatus = new Map<number, AskErrorKey>([
  [400, "question"],
  [403, "bot"],
  [429, "limit"],
]);

const responseOf = (payload: string): string => {
  try {
    const parsed: unknown = JSON.parse(payload);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "response" in parsed &&
      typeof parsed.response === "string"
    ) {
      return parsed.response;
    }
  } catch {
    return "";
  }
  return "";
};

export const readAnswerStream = async (
  body: ReadableStream<Uint8Array>,
  onText: (chunk: string) => void
): Promise<void> => {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const finished = (line: string): boolean => {
    const trimmed = line.trim();
    if (!trimmed.startsWith(dataPrefix)) return false;
    const payload = trimmed.slice(dataPrefix.length).trim();
    if (payload === doneMarker) return true;
    const text = responseOf(payload);
    if (text !== "") onText(text);
    return false;
  };

  for (;;) {
    const result = await reader.read();
    buffer += result.done
      ? decoder.decode()
      : decoder.decode(result.value, { stream: true });
    const lines = buffer.split("\n");
    buffer = result.done ? "" : (lines.pop() ?? "");
    for (const line of lines) {
      if (finished(line)) {
        await reader.cancel();
        return;
      }
    }
    if (result.done) return;
  }
};

export const readErrorCode = async (
  response: Response
): Promise<string | undefined> => {
  try {
    const body: unknown = await response.json();
    if (
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof body.error === "string"
    ) {
      return body.error;
    }
  } catch {
    return undefined;
  }
  return undefined;
};

export const askErrorKey = (
  status: number,
  code: string | undefined
): AskErrorKey =>
  (code === undefined ? undefined : keyByCode.get(code)) ??
  keyByStatus.get(status) ??
  "failed";

export const askBlock = ({
  busy,
  hasToken,
  question,
}: AskState): AskBlock | null => {
  if (busy) return null;
  if (question.trim() === "") return "questionFirst";
  return hasToken ? null : "checkFirst";
};
