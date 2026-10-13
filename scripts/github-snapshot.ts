import { writeFile } from "node:fs/promises";

import {
  getContact,
  getRepos,
  type GitHubSnapshot,
  githubSnapshotPath,
  requestKey,
} from "../src/lib/github.ts";
import { personalData } from "../src/lib/personal.ts";

const answers: GitHubSnapshot = {};

const recording: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  const text = await response.text();
  if (typeof input === "string" && response.status === 200) {
    answers[requestKey(input, init)] = response.headers
      .get("Content-Type")
      ?.includes("json")
      ? JSON.parse(text)
      : text;
  }
  return new Response(text, {
    headers: response.headers,
    status: response.status,
  });
};

const source = { env: {}, fetch: recording };

await Promise.all([
  getRepos(personalData.githubHandle, source),
  getContact(personalData.githubHandle, source),
]);

const sorted = Object.fromEntries(
  Object.entries(answers).toSorted(([a], [b]) => a.localeCompare(b))
);
await writeFile(githubSnapshotPath, `${JSON.stringify(sorted, null, 2)}\n`);
console.warn(
  `Wrote ${String(Object.keys(sorted).length)} GitHub answers to ${githubSnapshotPath}`
);
