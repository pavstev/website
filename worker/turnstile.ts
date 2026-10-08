const siteverifyUrl =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export const verifyTurnstile = async (
  token: string,
  ip: string,
  secret: string,
  fetchImpl: typeof fetch
): Promise<boolean> => {
  if (!token || !secret) {
    return false;
  }
  try {
    const form = new FormData();
    form.append("secret", secret);
    form.append("response", token);
    if (ip !== "" && ip !== "unknown") {
      form.append("remoteip", ip);
    }
    const res = await fetchImpl(siteverifyUrl, {
      body: form,
      method: "POST",
      signal: AbortSignal.timeout(5000),
    });
    if (res.status !== 200) {
      await res.body?.cancel();
      return false;
    }
    const answer: unknown = await res.json();
    return (
      typeof answer === "object" &&
      answer !== null &&
      "success" in answer &&
      answer.success === true
    );
  } catch {
    return false;
  }
};
