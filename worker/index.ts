import { handleMcp } from "./mcp.ts";
import { handleWeather } from "./weather.ts";

const isMcpPath = (pathname: string): boolean =>
  pathname === "/mcp" || pathname.startsWith("/mcp/");

const handler = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (isMcpPath(pathname)) {
      return handleMcp(request, env);
    }

    return pathname === "/weather"
      ? handleWeather(request, {
          cache: caches.default,
          fetch: (url, init) => fetch(url, init),
        })
      : env.ASSETS.fetch(request);
  },
};

export default handler;
