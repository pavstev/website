export const noStore = { "Cache-Control": "no-store" };

export const failure = (
  status: number,
  error: string,
  headers: Record<string, string> = {}
): Response =>
  Response.json({ error }, { headers: { ...noStore, ...headers }, status });

export const clientIp = (request: Request): string =>
  request.headers.get("CF-Connecting-IP") ?? "unknown";
