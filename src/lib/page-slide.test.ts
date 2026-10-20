import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { slideFrom, slideSection } from "./page-slide.ts";

describe("slideSection", () => {
  it("orders About, Work and Blog", () => {
    assert.equal(slideSection("/about"), 0);
    assert.equal(slideSection("/work"), 1);
    assert.equal(slideSection("/blog"), 2);
  });

  it("counts posts and listings as Blog", () => {
    assert.equal(slideSection("/blog/how-i-use-ai"), 2);
    assert.equal(slideSection("/blog/page/2"), 2);
    assert.equal(slideSection("/blog/tag/ai"), 2);
  });

  it("reads file style and slash paths", () => {
    assert.equal(slideSection("/about.html"), 0);
    assert.equal(slideSection("/work/"), 1);
  });

  it("leaves the home page and the 404 out", () => {
    assert.equal(slideSection("/"), undefined);
    assert.equal(slideSection("/404"), undefined);
    assert.equal(slideSection("/blog/feed.xml"), undefined);
  });
});

describe("slideFrom", () => {
  it("slides in from the right when the menu order goes right", () => {
    assert.equal(slideFrom("/about", "/work", "forward"), "right");
    assert.equal(slideFrom("/work", "/blog", "forward"), "right");
    assert.equal(slideFrom("/about", "/blog/how-i-use-ai", "forward"), "right");
  });

  it("slides in from the left when the menu order goes left", () => {
    assert.equal(slideFrom("/work", "/about", "forward"), "left");
    assert.equal(slideFrom("/blog", "/work", "forward"), "left");
    assert.equal(slideFrom("/blog/how-i-use-ai", "/about", "forward"), "left");
  });

  it("uses the order even when the browser goes back", () => {
    assert.equal(slideFrom("/work", "/about", "back"), "left");
    assert.equal(slideFrom("/about", "/work", "back"), "right");
  });

  it("uses the browser direction inside one section", () => {
    assert.equal(slideFrom("/blog", "/blog/how-i-use-ai", "forward"), "right");
    assert.equal(slideFrom("/blog/how-i-use-ai", "/blog", "back"), "left");
    assert.equal(slideFrom("/blog", "/blog/page/2", "forward"), "right");
  });

  it("does not slide to or from the home page or the 404", () => {
    assert.equal(slideFrom("/", "/work", "forward"), undefined);
    assert.equal(slideFrom("/blog", "/", "forward"), undefined);
    assert.equal(slideFrom("/about", "/404", "forward"), undefined);
  });
});
