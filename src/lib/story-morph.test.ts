import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { storyMorph } from "./story-morph.ts";

describe("storyMorph", () => {
  it("morphs between the work page and a story page, both ways", () => {
    assert.equal(storyMorph("/work", "/work/dotfiles"), true);
    assert.equal(storyMorph("/work/dotfiles", "/work"), true);
  });
  it("reads paths with a slash or an html ending", () => {
    assert.equal(storyMorph("/work/", "/work/dotfiles.html"), true);
    assert.equal(storyMorph("/work/dotfiles/", "/work.html"), true);
  });
  it("leaves every other trip alone", () => {
    assert.equal(storyMorph("/", "/work/dotfiles"), false);
    assert.equal(storyMorph("/about", "/work/dotfiles"), false);
    assert.equal(storyMorph("/work/dotfiles", "/about"), false);
    assert.equal(storyMorph("/work", "/about"), false);
    assert.equal(storyMorph("/work", "/work"), false);
    assert.equal(storyMorph("/work/dotfiles", "/work/dotfiles"), false);
    assert.equal(storyMorph("/work", "/work/other"), false);
  });
});
