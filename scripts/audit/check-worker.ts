import type { Check, Result } from "./types.ts";

import {
  count,
  fetchText,
  newResult,
  pageOf,
  reporter,
  type Say,
} from "./lib.ts";

interface Head {
  get: (name: string) => null | string;
  status: number;
}

type JsonObject = Record<string, unknown>;

const mcpProtocol = "2025-06-18";
const whereKeys = ["city", "far", "lat", "lon"];

const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const headOf = async (url: string): Promise<Head | undefined> => {
  try {
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(20_000),
    });
    await response.body?.cancel();
    return {
      get: (name) => response.headers.get(name),
      status: response.status,
    };
  } catch {
    return undefined;
  }
};

const parseRpc = (body: string, type: string): unknown => {
  if (!type.includes("text/event-stream")) return JSON.parse(body);
  const data = body.split("\n").find((line) => line.startsWith("data:"));
  if (!data) throw new Error("event stream has no data line");
  return JSON.parse(data.slice(5));
};

const isNamed = (value: unknown): value is { name: string } =>
  isObject(value) && typeof value["name"] === "string";

const toolNames = (answer: unknown): string[] => {
  if (!isObject(answer)) return [];
  const { error, result } = answer;
  if (isObject(error))
    throw new Error(`tools/list: ${String(error["message"])}`);
  const tools = isObject(result) ? result["tools"] : undefined;
  return Array.isArray(tools)
    ? tools.filter(isNamed).map((tool) => tool.name)
    : [];
};

export const mcpTools = async (endpoint: string): Promise<string[]> => {
  const headers: Record<string, string> = {
    accept: "application/json, text/event-stream",
    "content-type": "application/json",
  };
  const call = async (body: object, step: string) => {
    const response = await fetchText(endpoint, {
      body: JSON.stringify(body),
      headers,
      method: "POST",
    });
    if (response.status >= 400)
      throw new Error(
        `${step}: HTTP ${String(response.status)} ${response.body.slice(0, 160)}`
      );
    return response;
  };
  const init = await call(
    {
      id: 1,
      jsonrpc: "2.0",
      method: "initialize",
      params: {
        capabilities: {},
        clientInfo: { name: "site-audit", version: "1" },
        protocolVersion: mcpProtocol,
      },
    },
    "initialize"
  );
  const session = init.headers.get("mcp-session-id");
  if (session) headers["mcp-session-id"] = session;
  headers["mcp-protocol-version"] = mcpProtocol;
  await call(
    { jsonrpc: "2.0", method: "notifications/initialized" },
    "initialized"
  );
  const list = await call(
    { id: 2, jsonrpc: "2.0", method: "tools/list" },
    "tools/list"
  );
  return toolNames(parseRpc(list.body, list.headers.get("content-type") ?? ""));
};

const checkWhere = async (say: Say, base: string): Promise<void> => {
  let answer: Awaited<ReturnType<typeof fetchText>>;
  try {
    answer = await fetchText(`${base}/where`);
  } catch {
    say.fail("/where answers nothing (network error)");
    return;
  }
  if (answer.status !== 200) {
    say.fail(`/where answers ${String(answer.status)}`);
    return;
  }
  try {
    const where: unknown = JSON.parse(answer.body);
    if (!isObject(where) || whereKeys.some((key) => !Object.hasOwn(where, key)))
      say.fail(
        `/where lacks ${whereKeys.join(", ")}: ${answer.body.slice(0, 160)}`
      );
    else
      say.info(
        `/where: city ${String(where["city"])}, far ${String(where["far"])}`
      );
  } catch {
    say.fail("/where is not JSON");
  }
  const robots = answer.headers.get("x-robots-tag") ?? "";
  if (!robots.includes("noindex"))
    say.fail(`/where has no X-Robots-Tag noindex (got "${robots}")`);
  const cache = answer.headers.get("cache-control") ?? "";
  if (!cache.includes("no-store"))
    say.fail(`/where cache-control is "${cache}", want no-store`);
};

const checkMcp = async (
  result: Result,
  say: Say,
  base: string
): Promise<void> => {
  try {
    const tools = await mcpTools(`${base}/mcp`);
    result.metrics["mcp_tools"] = tools.length;
    if (tools.length === 0) say.fail("/mcp lists no tools");
    else say.info(`/mcp tools: ${tools.join(", ")}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    say.fail(`/mcp tools/list failed: ${message.slice(0, 300)}`);
  }
};

const checkHead = (
  result: Result,
  path: string,
  head: Head | undefined
): void => {
  if (!head) return;
  const say = reporter(result, path);
  if (!head.get("content-security-policy"))
    say.fail("no Content-Security-Policy header");
  if (head.get("x-content-type-options") !== "nosniff")
    say.warn("no X-Content-Type-Options: nosniff");
  if (!head.get("referrer-policy")) say.warn("no Referrer-Policy");
};

const checkScript = async (say: Say, base: string): Promise<void> => {
  let html = "";
  try {
    const home = await fetchText(`${base}/`);
    html = home.body;
  } catch {
    return;
  }
  const script = /(?:src|component-url)="(\/_astro\/[^"]+\.js)"/u.exec(
    html
  )?.[1];
  if (!script) return;
  const head = await headOf(`${base}${script}`);
  const cache = head?.get("cache-control") ?? "";
  if (!cache.includes("immutable"))
    say.warn(`${script}: cache-control is "${cache}", want immutable`);
  if (head?.get("content-security-policy"))
    say.warn(
      `${script}: a script file carries a CSP (the _headers detach rule did not apply)`
    );
};

const checkMarkdown = async (
  say: Say,
  base: string,
  postPath: string | undefined
): Promise<void> => {
  if (!postPath) return;
  const head = await headOf(`${base}${postPath}.md`);
  if (head?.status !== 200)
    say.warn(`${postPath}.md answers ${String(head?.status)}`);
  else if (!/rel="?canonical"?/u.test(head.get("link") ?? ""))
    say.warn(`${postPath}.md has no Link rel=canonical header`);
};

const check: Check = async (context) => {
  const result = newResult("worker");
  const say = reporter(result, "");
  const { base } = context;
  const paths = context.pages
    .filter((page) => page.kind !== "404")
    .map((page) => page.path);
  await checkWhere(say, base);
  await checkMcp(result, say, base);
  const heads = await Promise.all(
    paths.map((path) => headOf(`${base}${path}`))
  );
  for (const [index, path] of paths.entries())
    checkHead(result, path, heads[index]);
  await checkScript(say, base);
  await checkMarkdown(say, base, pageOf(context.pages, "post")?.path);
  result.summary = `/mcp and headers on ${String(paths.length)} pages: ${String(count(result, "fail"))} problems`;
  return result;
};

export default check;
