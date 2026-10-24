import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { skyStorySteps, storyInstant } from "../lib/sky-story.ts";
import { lintCopy } from "../lib/story/copy-rules.ts";
import {
  clockOf,
  skyStoryCopy,
  skyStoryMeta,
  skyStorySlides,
} from "./website-story.ts";

describe("skyStoryCopy", () => {
  it("has one entry per engine step, in the same order", () => {
    assert.deepEqual(
      skyStoryCopy.map((item) => item.id),
      [...skyStorySteps]
    );
  });
  it("passes the copy rules with numbers allowed", () => {
    for (const item of skyStoryCopy) {
      assert.deepEqual(lintCopy(item, { numbers: true }), [], item.id);
    }
  });
  it("names no city anywhere", () => {
    assert.doesNotMatch(JSON.stringify(skyStoryCopy), /vienna|wien/iu);
  });
  it("says the place is rounded before anything sees it", () => {
    const yours = skyStoryCopy.find((item) => item.id === "yours");
    assert.match(yours?.note ?? "", /rounded to about ten kilometers/u);
    assert.doesNotMatch(yours?.note ?? "", /stays in your browser/u);
  });
});

describe("skyStoryMeta", () => {
  it("moves the page date", () => {
    assert.match(skyStoryMeta.updatedAt, /^\d{4}-\d{2}-\d{2}$/u);
  });
});

describe("clockOf", () => {
  const wall = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    timeZone: "Europe/Vienna",
  });

  it("prints the wall clock of the painted instant", () => {
    for (const index of skyStorySteps.keys()) {
      const clock = clockOf(index);
      assert.match(clock, /^\d{2}:\d{2}$/u);
      assert.equal(clock, wall.format(storyInstant(index)));
    }
  });
});

describe("skyStorySlides", () => {
  const slides = skyStorySlides();

  it("opens every eyebrow with its clock and its chapter word", () => {
    assert.equal(slides[0]?.clock, clockOf(0));
    assert.equal(slides[0]?.chapter, "Blue hour");
    assert.deepEqual(
      slides.slice(0, 8).map((slide) => slide.chapter),
      [
        "Blue hour",
        "Sunrise",
        "Morning",
        "Solar noon",
        "Rain front",
        "Sunset",
        "Moon at its highest",
        "Late night",
      ]
    );
  });
  it("shows a sun by day and a moon before dawn and after dusk", () => {
    assert.deepEqual(
      slides.map((slide) => slide.lamp),
      ["moon", "sun", "sun", "sun", "sun", "sun", "moon", "moon", "moon"]
    );
  });
  it("ends on Now, without a clock", () => {
    assert.equal(slides.at(-1)?.chapter, "Now");
    assert.equal(slides.at(-1)?.clock, undefined);
  });
  it("gives the rain front the longest step", () => {
    const longest = Math.max(...slides.map((slide) => slide.screens));
    assert.equal(
      slides.find((slide) => slide.id === "weather")?.screens,
      longest
    );
  });
});
