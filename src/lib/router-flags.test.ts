import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { carriedFlags } from "./router-flags.ts";

describe("carriedFlags", () => {
  it("keeps the page flags with their values", () => {
    const flags = carriedFlags([
      { name: "data-js", value: "" },
      { name: "data-motion-paused", value: "" },
      { name: "data-privacy-ack", value: "" },
      { name: "data-privacy-closed", value: "1" },
    ]);
    assert.deepEqual(flags, [
      { name: "data-js", value: "" },
      { name: "data-motion-paused", value: "" },
      { name: "data-privacy-ack", value: "" },
      { name: "data-privacy-closed", value: "1" },
    ]);
  });

  it("drops attributes that are not data flags", () => {
    const flags = carriedFlags([
      { name: "lang", value: "en" },
      { name: "class", value: "x" },
      { name: "style", value: "color: red" },
      { name: "data-js", value: "" },
    ]);
    assert.deepEqual(flags, [{ name: "data-js", value: "" }]);
  });

  it("leaves the data-astro attributes to the router", () => {
    const flags = carriedFlags([
      { name: "data-astro-transition", value: "forward" },
      { name: "data-astro-transition-fallback", value: "old" },
      { name: "data-astro-reload", value: "" },
    ]);
    assert.deepEqual(flags, []);
  });

  it("accepts any iterable", () => {
    const flags = carriedFlags(new Set([{ name: "data-js", value: "" }]));
    assert.equal(flags.length, 1);
  });
});
