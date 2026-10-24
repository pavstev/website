import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { timelineShorthands } from "./timeline-guard.ts";

describe("timelineShorthands", () => {
  it("flags a scroll, view or named timeline inside the shorthand", () => {
    const css = [
      ".a{animation:linear both sway scroll(root)}",
      ".b{animation:linear both dwell --story-text;color:red}",
      ".c{animation:linear both reveal view()}",
    ].join("");
    assert.deepEqual(timelineShorthands(css), [
      "animation:linear both sway scroll(root)",
      "animation:linear both dwell --story-text",
      "animation:linear both reveal view()",
    ]);
  });

  it("accepts a timeline set on its own longhand", () => {
    const css =
      ".a{animation:linear both sway;animation-timeline:scroll(root)}" +
      ".b{animation:8s ease-in-out infinite wave,linear both sway;animation-range:contain}";
    assert.deepEqual(timelineShorthands(css), []);
  });

  it("does not read a custom property inside var() as a timeline", () => {
    assert.deepEqual(
      timelineShorthands(".a{animation:var(--pop-ease) both pop}"),
      []
    );
  });
});
