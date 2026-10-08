import { handleAsk } from "./ask.ts";
import { handleMcp } from "./mcp.ts";

const isApiPath = (pathname: string): boolean => pathname.startsWith("/api/");

const isMcpPath = (pathname: string): boolean =>
  pathname === "/mcp" || pathname.startsWith("/mcp/");

const notFound = (): Response =>
  Response.json({ error: "not_found" }, { status: 404 });

const handler = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname === "/api/ask") {
      return handleAsk(request, env);
    }

    if (isMcpPath(pathname)) {
      return handleMcp(request, env);
    }

    return isApiPath(pathname) ? notFound() : env.ASSETS.fetch(request);
  },
};

export default handler;
