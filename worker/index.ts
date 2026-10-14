import { handleMcp } from "./mcp.ts";

const isMcpPath = (pathname: string): boolean =>
  pathname === "/mcp" || pathname.startsWith("/mcp/");

const handler = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);

    return isMcpPath(pathname)
      ? handleMcp(request, env)
      : env.ASSETS.fetch(request);
  },
};

export default handler;
