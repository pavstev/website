import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { pageRobots } from "./build-env.ts";

describe("pageRobots", () => {
  it("asks for large image previews in a production build", () => {
    for (const env of [{}, { WORKERS_CI_BRANCH: "main" }]) {
      const robots = pageRobots(env);
      assert.deepEqual(robots, {
        follow: true,
        googleBot: {
          follow: true,
          index: true,
          "max-image-preview": "large",
          "max-snippet": -1,
          "max-video-preview": -1,
        },
        index: true,
      });
    }
  });

  it("keeps preview builds out of search", () => {
    assert.deepEqual(pageRobots({ WORKERS_CI_BRANCH: "blog" }), {
      follow: false,
      index: false,
    });
  });
});
