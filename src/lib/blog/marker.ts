import { execFileSync } from "node:child_process";

const shaPattern = /^[\da-f]{40}$/;

export const commitSha = (env: Record<string, string | undefined>): string => {
  const fromCi = env["WORKERS_CI_COMMIT_SHA"] ?? "";
  const sha =
    fromCi === ""
      ? execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim()
      : fromCi;
  if (!shaPattern.test(sha)) {
    throw new Error(`build.json: "${sha}" is not a full commit sha`);
  }
  return sha;
};

export const markerText = (sha: string, builtAt: Date): string =>
  `{"sha": ${JSON.stringify(sha)}, "builtAt": ${JSON.stringify(builtAt.toISOString())}}\n`;
