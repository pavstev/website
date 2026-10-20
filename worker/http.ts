const noStore = { "Cache-Control": "no-store" };

const securityHeaders = {
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(self)",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000",
  "X-Content-Type-Options": "nosniff",
};

export const withSecurityHeaders = (response: Response): Response => {
  const secured = new Response(response.body, response);

  for (const [name, value] of Object.entries(securityHeaders)) {
    secured.headers.set(name, value);
  }

  return secured;
};

export const failure = (
  status: number,
  error: string,
  headers: Record<string, string> = {}
): Response =>
  withSecurityHeaders(
    Response.json({ error }, { headers: { ...noStore, ...headers }, status })
  );

export const clientIp = (request: Request): string =>
  request.headers.get("CF-Connecting-IP") ?? "unknown";
