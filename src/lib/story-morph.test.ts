import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { storyMorph } from "./story-morph.ts";

describe("storyMorph", () => {
  it("morphs in from the work page and out from a story page", () => {
    assert.equal(storyMorph("/work", "/work/dotfiles"), "in");
    assert.equal(storyMorph("/work/dotfiles", "/work"), "out");
  });
  it("reads paths with a slash or an html ending", () => {
    assert.equal(storyMorph("/work/", "/work/dotfiles.html"), "in");
    assert.equal(storyMorph("/work/dotfiles/", "/work.html"), "out");
  });
  it("leaves every other trip alone", () => {
    assert.equal(storyMorph("/", "/work/dotfiles"), undefined);
    assert.equal(storyMorph("/about", "/work/dotfiles"), undefined);
    assert.equal(storyMorph("/work/dotfiles", "/about"), undefined);
    assert.equal(storyMorph("/work", "/about"), undefined);
    assert.equal(storyMorph("/work", "/work"), undefined);
    assert.equal(storyMorph("/work/dotfiles", "/work/dotfiles"), undefined);
    assert.equal(storyMorph("/work", "/work/other"), undefined);
  });
});
