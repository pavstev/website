import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  arcPoint,
  arriveDelay,
  easeInOut,
  heldProgress,
  holdAt,
  linkMode,
  offScreen,
  paintsSky,
  routeMode,
  tweenMs,
  tweenPose,
  tweenProgress,
} from "./sky-tween.ts";

const sun = { radius: 30, x: 1100, y: 260 };
const corner = { x: -280, y: -280 };
const screen = { height: 900, width: 1440 };

describe("routeMode", () => {
  it("maps blog, work and about routes to the blog sky", () => {
    assert.equal(routeMode("/blog", false), "blog");
    assert.equal(routeMode("/blog/how-i-use-ai", false), "blog");
    assert.equal(routeMode("/blog/tag/ai/page/2", false), "blog");
    assert.equal(routeMode("/work", false), "blog");
    assert.equal(routeMode("/about", false), "blog");
  });

  it("maps everything else to the home sky", () => {
    assert.equal(routeMode("/", false), "home");
    assert.equal(routeMode("/blog/feed.xml", false), "home");
    assert.equal(routeMode("/workshop", false), "home");
  });

  it("gives any page the blog layout marks the blog sky, the 404 included", () => {
    assert.equal(routeMode("/nope", true), "blog");
    assert.equal(routeMode("/404", true), "blog");
    assert.equal(routeMode("/", true), "blog");
  });
});

describe("linkMode", () => {
  it("names the sky of a link target, or none", () => {
    assert.equal(linkMode("/"), "home");
    assert.equal(linkMode("/blog/page/2"), "blog");
    assert.equal(linkMode("/work"), "blog");
    assert.equal(linkMode("/about"), "blog");
    assert.equal(linkMode("/resume.pdf"), undefined);
    assert.equal(linkMode("/blog/feed.xml"), undefined);
  });
  it("gives the story page no sky, so no glide starts", () => {
    assert.equal(linkMode("/work/dotfiles"), undefined);
    assert.equal(linkMode("/work"), "blog");
  });
  it("names the website story its own sky", () => {
    assert.equal(linkMode("/work/website"), "story");
    assert.equal(linkMode("/work/website/"), "story");
    assert.equal(linkMode("/work/website.html"), "story");
    assert.equal(linkMode("/work/websites"), undefined);
  });
});

describe("routeMode for the website story", () => {
  it("gives the story path the story sky", () => {
    assert.equal(routeMode("/work/website", false), "story");
    assert.equal(routeMode("/work/website/", false), "story");
    assert.equal(routeMode("/work/website.html", false), "story");
  });
  it("checks the story path before the blog marker", () => {
    assert.equal(routeMode("/work/website", true), "story");
  });
  it("leaves the other pages as they were", () => {
    assert.equal(routeMode("/work/dotfiles", false), "home");
    assert.equal(routeMode("/work", false), "blog");
    assert.equal(routeMode("/work/websites", false), "home");
  });
});

describe("paintsSky", () => {
  it("is true for the home and the story, false for the blog", () => {
    assert.equal(paintsSky("home"), true);
    assert.equal(paintsSky("story"), true);
    assert.equal(paintsSky("blog"), false);
  });
});

describe("tweenProgress", () => {
  it("runs forward and back over the same time", () => {
    assert.equal(tweenProgress(0, true), 0);
    assert.equal(tweenProgress(tweenMs, true), 1);
    assert.equal(tweenProgress(0, false), 1);
    assert.equal(tweenProgress(tweenMs * 2, false), 0);
  });
});

describe("arriveDelay", () => {
  it("waits for the arrival mark and never goes negative", () => {
    assert.equal(arriveDelay(400), 200);
    assert.equal(arriveDelay(1200), 0);
  });
});

describe("heldProgress", () => {
  it("reads a progress to hold for tests", () => {
    assert.equal(heldProgress("?tween=0.25"), 0.25);
    assert.equal(heldProgress("?tween=4"), 1);
    assert.equal(heldProgress("?at=2026-10-14T13:00:00Z"), undefined);
    assert.equal(heldProgress("?tween=x"), undefined);
    assert.equal(heldProgress("?tween="), undefined);
  });

  it("stops the shot at the held progress", () => {
    assert.equal(holdAt(0.9, 0.5, true), 0.5);
    assert.equal(holdAt(0.1, 0.5, false), 0.5);
    assert.equal(holdAt(0.3, undefined, true), 0.3);
  });
});

describe("easeInOut", () => {
  it("is symmetric and pinned at both ends", () => {
    assert.equal(easeInOut(0), 0);
    assert.equal(easeInOut(1), 1);
    assert.equal(easeInOut(0.5), 0.5);
    assert.ok(Math.abs(easeInOut(0.2) + easeInOut(0.8) - 1) < 1e-12);
  });
});

describe("arcPoint", () => {
  it("starts at the sun and ends at the corner", () => {
    assert.deepEqual(arcPoint(sun, corner, 0), [sun.x, sun.y]);
    const [x, y] = arcPoint(sun, corner, 1);
    assert.ok(Math.abs(x - corner.x) < 1e-9);
    assert.ok(Math.abs(y - corner.y) < 1e-9);
  });

  it("sags below the straight line, so the light stays in view", () => {
    const [, y] = arcPoint(sun, corner, 0.5);
    assert.ok(y > (sun.y + corner.y) / 2);
    assert.ok(y > 0);
  });
});

describe("offScreen", () => {
  it("measures how far a point sits outside the screen", () => {
    assert.equal(offScreen(100, 100, screen), 0);
    assert.equal(offScreen(-30, 100, screen), 30);
    assert.equal(offScreen(-30, -40, screen), 50);
    assert.equal(offScreen(1500, 950, screen), Math.hypot(60, 50));
  });
});

describe("tweenPose", () => {
  it("starts on the home sun with its disk lit", () => {
    const pose = tweenPose(0, sun, corner, screen);
    assert.equal(pose.disk, 1);
    assert.deepEqual(pose.sun, sun);
  });

  it("ends on the corner with the disk out", () => {
    const pose = tweenPose(1, sun, corner, screen);
    assert.equal(pose.disk, 0);
    assert.ok(pose.sun);
    assert.ok(Math.abs(pose.sun.x - corner.x) < 1e-9);
    assert.ok(Math.abs(pose.sun.y - corner.y) < 1e-9);
  });

  it("keeps the sun its own size along the way", () => {
    for (let step = 0; step <= 20; step += 1)
      assert.equal(tweenPose(step / 20, sun, corner, screen).sun?.radius, 30);
  });

  it("puts the disk out once the sun has left the screen", () => {
    for (let step = 0; step <= 40; step += 1) {
      const pose = tweenPose(step / 40, sun, corner, screen);
      assert.ok(pose.sun);
      const room = offScreen(pose.sun.x, pose.sun.y, screen);
      if (room >= sun.radius * 2) assert.equal(pose.disk, 0);
      if (room === 0 && step / 40 <= 0.75) assert.equal(pose.disk, 1);
    }
  });

  it("has no sun to move when none is up", () => {
    assert.deepEqual(tweenPose(0.5, undefined, corner, screen), {
      disk: 0,
      sun: undefined,
    });
  });
});
