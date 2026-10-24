import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { commitSha, markerText } from "./marker.ts";

describe("markerText", () => {
  it("writes the instant it is given", () => {
    const sha = "a".repeat(40);
    const text = markerText(sha, new Date("2026-10-13T21:59:59.123Z"));
    assert.deepEqual(JSON.parse(text), {
      builtAt: "2026-10-13T21:59:59.123Z",
      sha,
    });
  });
});

describe("commitSha", () => {
  it("takes the Cloudflare commit when it is set", () => {
    const sha = "b".repeat(40);
    assert.equal(commitSha({ WORKERS_CI_COMMIT_SHA: sha }), sha);
  });

  it("rejects a sha that is not 40 hex characters", () => {
    assert.throws(
      () => commitSha({ WORKERS_CI_COMMIT_SHA: "abc" }),
      /not a full commit sha/u
    );
  });
});
