import assert from "node:assert/strict";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { after, before, test } from "node:test";

import type { Context } from "./types.ts";

import check, { mcpTools } from "./check-worker.ts";

interface Call {
  method: string;
  session: string | undefined;
}

type Handler = (
  request: IncomingMessage,
  body: string,
  response: ServerResponse
) => void;

const routes = new Map<string, Handler>();
const seen: Call[] = [];
let base = "";
let server: ReturnType<typeof createServer> | undefined;

const secure = {
  "content-security-policy": "default-src 'self'",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
};

const goodWhere = {
  "cache-control": "private, no-store",
  "x-robots-tag": "noindex",
};

const nullWhere = { city: null, far: null, lat: null, lon: null };

const json = (
  response: ServerResponse,
  body: unknown,
  headers: Record<string, string> = {}
): void => {
  response.writeHead(200, {
    "content-type": "application/json",
    ...headers,
  });
  response.end(JSON.stringify(body));
};

const readMessage = (body: string): { id: number; method: string } => {
  const parsed: unknown = JSON.parse(body);
  if (
    typeof parsed === "object" &&
    parsed !== null &&
    "method" in parsed &&
    typeof parsed.method === "string"
  ) {
    const id = "id" in parsed && typeof parsed.id === "number" ? parsed.id : 0;
    return { id, method: parsed.method };
  }
  throw new TypeError("not a JSON-RPC message");
};

const mcp: Handler = (request, body, response) => {
  const message = readMessage(body);
  seen.push({
    method: message.method,
    session: request.headers["mcp-session-id"]?.toString(),
  });
  if (message.method === "initialize") {
    json(
      response,
      { id: message.id, jsonrpc: "2.0", result: { capabilities: {} } },
      { "mcp-session-id": "s1" }
    );
    return;
  }
  if (message.method === "notifications/initialized") {
    response.writeHead(202).end();
    return;
  }
  const answer = {
    id: message.id,
    jsonrpc: "2.0",
    result: { tools: [{ name: "a" }, { name: "b" }] },
  };
  response.writeHead(200, { "content-type": "text/event-stream" });
  response.end(`event: message\ndata: ${JSON.stringify(answer)}\n\n`);
};

const html =
  (headers: Record<string, string>, body: string): Handler =>
  (_request, _body, response) => {
    response
      .writeHead(200, { "content-type": "text/html", ...headers })
      .end(body);
  };

const context = (pages: Context["pages"]): Context => ({
  base,
  baseline: undefined,
  baselineDir: undefined,
  fast: false,
  local: false,
  out: "",
  pages,
  sitemap: "",
});

const page = (kind: string, path: string): Context["pages"][number] => ({
  kind,
  live: undefined,
  path,
  url: "",
});

before(async () => {
  routes.set("/mcp", mcp);
  routes.set("/where", (_request, _body, response) => {
    json(response, nullWhere, goodWhere);
  });
  routes.set(
    "/",
    html(secure, '<html><script src="/_astro/app.js"></script></html>')
  );
  routes.set("/bare", html({}, ""));
  routes.set("/_astro/app.js", (_request, _body, response) => {
    response.writeHead(200, { "cache-control": "public, max-age=60" }).end("");
  });
  server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk: Buffer) => {
      body += chunk.toString();
    });
    request.on("end", () => {
      const handler = routes.get(
        new URL(request.url ?? "/", "http://x").pathname
      );
      if (handler) handler(request, body, response);
      else response.writeHead(404).end();
    });
  });
  const listening = server;
  await new Promise<void>((resolve) => {
    listening.listen(0, "127.0.0.1", resolve);
  });
  const address = listening.address();
  if (address === null || typeof address === "string")
    throw new TypeError("no port");
  base = `http://127.0.0.1:${String(address.port)}`;
});

after(() => server?.close());

test("mcpTools does the handshake, sends the session id and reads an SSE answer", async () => {
  seen.length = 0;
  assert.deepEqual(await mcpTools(`${base}/mcp`), ["a", "b"]);
  assert.deepEqual(seen, [
    { method: "initialize", session: undefined },
    { method: "notifications/initialized", session: "s1" },
    { method: "tools/list", session: "s1" },
  ]);
});

test("mcpTools names the step that failed", async () => {
  await assert.rejects(mcpTools(`${base}/nope`), /initialize: HTTP 404/u);
});

test("the check passes on a good Worker and fails on missing headers", async () => {
  const result = await check(
    context([
      page("home", "/"),
      page("other", "/bare"),
      page("404", "/missing"),
    ])
  );
  assert.equal(result.metrics["mcp_tools"], 2);
  assert.ok(
    result.lines.includes("INFO /where: city null, far null"),
    result.lines.join("\n")
  );
  assert.ok(
    result.lines.includes("FAIL /bare: no Content-Security-Policy header")
  );
  assert.ok(
    result.lines.some((line) =>
      line.startsWith("WARN /_astro/app.js: cache-control")
    ),
    result.lines.join("\n")
  );
  assert.ok(
    result.lines.every((line) => !line.startsWith("FAIL /:")),
    "the secure page has no FAIL"
  );
  assert.ok(
    result.lines.every((line) => !line.includes("/missing")),
    "the 404 probe is not header-checked"
  );
  assert.equal(result.status, "fail");
  assert.equal(result.summary, "/mcp and headers on 2 pages: 1 problems");
});

test("wrong /where headers are FAIL lines", async () => {
  routes.set("/where", (_request, _body, response) => {
    json(response, nullWhere);
  });
  const result = await check(context([]));
  assert.ok(
    result.lines.includes('FAIL /where has no X-Robots-Tag noindex (got "")'),
    result.lines.join("\n")
  );
  assert.ok(
    result.lines.includes('FAIL /where cache-control is "", want no-store'),
    result.lines.join("\n")
  );
});

test("a /where answer without the four keys is a FAIL line", async () => {
  routes.set("/where", (_request, _body, response) => {
    json(response, { city: "x" }, goodWhere);
  });
  const result = await check(context([]));
  assert.ok(
    result.lines.some((line) =>
      line.startsWith("FAIL /where lacks city, far, lat, lon")
    ),
    result.lines.join("\n")
  );
});

test("a missing /where is a FAIL line, not a crash", async () => {
  routes.delete("/where");
  const result = await check(context([]));
  assert.ok(
    result.lines.includes("FAIL /where answers 404"),
    result.lines.join("\n")
  );
});
