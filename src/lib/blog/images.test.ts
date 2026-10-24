import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { shareImageUrl } from "./images.ts";

const meta = { readingMinutes: 4, slug: "alpha", title: "First post" };

describe("shareImageUrl", () => {
  it("versions the share image by the fields it draws", () => {
    const url = shareImageUrl(meta);
    assert.match(url, /^\/blog\/alpha\/share\.png\?v=[\w-]{10}$/u);
    assert.equal(shareImageUrl({ ...meta }), url);
    assert.notEqual(shareImageUrl({ ...meta, title: "First post!" }), url);
    assert.notEqual(shareImageUrl({ ...meta, readingMinutes: 5 }), url);
    assert.notEqual(
      shareImageUrl({ ...meta, updated: "2026-10-22T09:00:00+02:00" }),
      url
    );
  });
});
