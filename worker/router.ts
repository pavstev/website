import { handleMcp } from "./mcp.ts";
import { handleWhere, wherePath } from "./where.ts";

const isMcpPath = (pathname: string): boolean =>
  pathname === "/mcp" || pathname.startsWith("/mcp/");

export const router = {
  async fetch(
    request: Request<unknown, IncomingRequestCfProperties>,
    env: Env
  ): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname === wherePath) {
      return handleWhere(request, request.cf);
    }

    return isMcpPath(pathname)
      ? handleMcp(request, env)
      : env.ASSETS.fetch(request);
  },
};
