const defaultTimeoutMs = 15_000;

export const reachable = async (
  url: string,
  timeoutMs: number = defaultTimeoutMs
): Promise<string[]> => {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(timeoutMs),
    });
    return response.ok ? [] : [`${url} answered ${String(response.status)}`];
  } catch {
    return [`${url} did not answer`];
  }
};
