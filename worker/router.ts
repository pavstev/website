import { failure, withSecurityHeaders } from "./http.ts";
import { handleMcp } from "./mcp.ts";
import { handleWhere, wherePath } from "./where.ts";

const isMcpPath = (pathname: string): boolean =>
  pathname === "/mcp" || pathname.startsWith("/mcp/");

const errorPagePath = "/500";

const wantsPage = (request: Request): boolean =>
  request.headers.get("Sec-Fetch-Mode") === "navigate" ||
  (request.headers.get("Accept") ?? "").includes("text/html");

const errorPage = async (request: Request, env: Env): Promise<Response> => {
  if (wantsPage(request)) {
    try {
      const page = await env.ASSETS.fetch(
        new Request(new URL(errorPagePath, request.url))
      );
      if (page.ok) {
        const headers = new Headers(page.headers);
        headers.set("Cache-Control", "no-store");
        return withSecurityHeaders(
          new Response(page.body, { headers, status: 500 })
        );
      }
    } catch (error) {
      console.error("error page failed", error);
    }
  }
  return failure(500, "internal");
};

const route = (
  request: Request<unknown, IncomingRequestCfProperties>,
  env: Env
): Promise<Response> | Response => {
  const { pathname } = new URL(request.url);

  if (pathname === wherePath) {
    return handleWhere(request, request.cf);
  }

  return isMcpPath(pathname)
    ? handleMcp(request, env)
    : env.ASSETS.fetch(request);
};

export const router = {
  async fetch(
    request: Request<unknown, IncomingRequestCfProperties>,
    env: Env
  ): Promise<Response> {
    try {
      return await route(request, env);
    } catch (error) {
      console.error("request failed", error);
      return errorPage(request, env);
    }
  },
};
