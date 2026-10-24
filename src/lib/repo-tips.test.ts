import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { dismissRepoTips, restoreRepoTip } from "./repo-tips.ts";

const fakeKey = (
  active: boolean
): {
  dataset: Record<string, string | undefined>;
  matches: () => boolean;
} => ({ dataset: {}, matches: () => active });

describe("dismissRepoTips", () => {
  it("hides only the tips that are shown", () => {
    const shown = fakeKey(true);
    const idle = fakeKey(false);
    dismissRepoTips([shown, idle]);
    assert.equal(shown.dataset["dismissed"], "");
    assert.equal(idle.dataset["dismissed"], undefined);
  });
});

describe("restoreRepoTip", () => {
  it("clears the dismissed mark", () => {
    const key = fakeKey(true);
    dismissRepoTips([key]);
    restoreRepoTip(key);
    assert.equal(key.dataset["dismissed"], undefined);
  });

  it("ignores a target outside a key", () => {
    assert.doesNotThrow(() => {
      restoreRepoTip(null);
    });
  });
});
