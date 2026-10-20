import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  blogIndexInkTargets,
  contrast,
  freshInk,
  glowFor,
  inkGlow,
  inkMargin,
  type InkRange,
  inkScores,
  inkTargets,
  liftedLuminance,
  liftFor,
  litLift,
  litSky,
  luminance,
  nextInk,
  nextLift,
  postInkTargets,
  sharedScores,
  skyRange,
  tintLuminance,
  wantedInk,
} from "./sky-ink.ts";
import { inkPalette } from "./theme.ts";

describe("luminance", () => {
  it("follows the WCAG relative luminance", () => {
    assert.equal(luminance(0, 0, 0), 0);
    assert.equal(luminance(255, 255, 255), 1);
    assert.ok(Math.abs(luminance(119, 119, 119) - 0.184) < 0.001);
  });

  it("gives white on black a ratio of 21", () => {
    assert.equal(contrast(1, 0), 21);
    assert.equal(contrast(0, 1), 21);
  });
});

describe("liftedLuminance", () => {
  it("runs from the base color to white", () => {
    const [red, green, blue] = [0xc3, 0xc7, 0xd6];
    assert.equal(
      liftedLuminance(inkPalette.soft, 0),
      luminance(red, green, blue)
    );
    assert.equal(liftedLuminance(inkPalette.soft, 1), 1);
    assert.ok(
      liftedLuminance(inkPalette.soft, 0.5) >
        liftedLuminance(inkPalette.soft, 0)
    );
  });
});

describe("liftFor", () => {
  it("keeps the base color on a dark sky", () => {
    assert.equal(liftFor(inkPalette.soft, 0.01, 4.5), 0);
  });

  it("lifts just enough to clear the target with the margin", () => {
    const sky = 0.09;
    const lift = liftFor(inkPalette.soft, sky, 4.5);
    assert.ok(lift > 0 && lift < 1);
    assert.ok(
      contrast(liftedLuminance(inkPalette.soft, lift), sky) >= 4.5 * inkMargin
    );
    assert.ok(
      contrast(liftedLuminance(inkPalette.soft, lift - 0.05), sky) <
        4.5 * inkMargin
    );
  });

  it("goes to white when nothing else clears the target", () => {
    assert.equal(liftFor(inkPalette.muted, 0.5, 4.5), 1);
  });
});

describe("inkGlow", () => {
  it("is off while the ink reaches the target with the margin", () => {
    assert.equal(inkGlow(4.5 * inkMargin, 4.5), 0);
    assert.equal(inkGlow(9, 4.5), 0);
  });

  it("grows with the gap and tops out at a contrast of 1", () => {
    const near = inkGlow(4.5 * inkMargin - 0.5, 4.5);
    const far = inkGlow(2, 4.5);
    assert.ok(near > 0 && near < far && far < 1);
    assert.equal(inkGlow(1, 4.5), 1);
    assert.equal(inkGlow(0.5, 3), 1);
  });
});

describe("glowFor", () => {
  const night: InkRange = { bright: 0.02, dark: 0.001 };
  const grey: InkRange = { bright: 0.35, dark: 0.2 };

  it("is zero where the chosen ink passes", () => {
    assert.equal(glowFor("light", inkPalette.soft, 0, night, 4.5), 0);
    assert.equal(
      glowFor("dark", inkPalette.soft, 0, { bright: 0.9, dark: 0.9 }, 4.5),
      0
    );
  });

  it("grows over a mid grey sky for either ink", () => {
    assert.ok(glowFor("light", inkPalette.soft, 1, grey, 4.5) > 0);
    assert.ok(glowFor("dark", inkPalette.soft, 0, grey, 4.5) > 0);
  });
});

describe("litSky", () => {
  it("is lit only for light ink lifted at least litLift", () => {
    assert.equal(litSky("light", litLift), true);
    assert.equal(litSky(undefined, 1), true);
    assert.equal(litSky("light", litLift - 0.05), false);
    assert.equal(litSky("dark", 1), false);
  });
});

describe("nextLift", () => {
  it("raises at once and lowers only past a dead band", () => {
    assert.equal(nextLift(0.2, 0.5), 0.5);
    assert.equal(nextLift(0.5, 0.45), 0.5);
    assert.equal(nextLift(0.5, 0.3), 0.3);
  });
});

describe("inkTargets", () => {
  it("lists every text that sits on the sky with its target", () => {
    assert.deepEqual(
      inkTargets.map((target) => target.need),
      [4.5, 4.5, 4.5]
    );
  });

  it("puts the name and the bio in one ink group", () => {
    assert.deepEqual(
      inkTargets.map((target) => target.group),
      ["card", "card", undefined]
    );
  });
});

describe("sharedScores", () => {
  it("scores a group by its weakest part against each need", () => {
    const shared = sharedScores([
      { need: 3, scores: { dark: 9, light: 3 } },
      { need: 4.5, scores: { dark: 9, light: 9 } },
    ]);
    assert.deepEqual(shared, { dark: 2, light: 1 });
    assert.equal(nextInk(freshInk, shared, 1).mode, "dark");
  });

  it("picks one ink for both parts even when they alone would differ", () => {
    const name = { need: 3, scores: { dark: 2, light: 8 } };
    const bio = { need: 4.5, scores: { dark: 7, light: 5 } };
    assert.equal(wantedInk(name.scores, name.need), "light");
    assert.equal(wantedInk(bio.scores, bio.need), "dark");
    const shared = sharedScores([name, bio]);
    assert.equal(wantedInk(shared, 1), "light");
  });
});

describe("blog header targets", () => {
  it("lifts the title to 3 and the meta line to 4.5 in the sky header", () => {
    for (const targets of [blogIndexInkTargets, postInkTargets]) {
      assert.deepEqual(
        targets.map((target) => [target.paint, target.need]),
        [
          ["[data-sky-header] .blog-title", 3],
          ["[data-sky-header] .blog-header-meta", 4.5],
        ]
      );
    }
  });
});

describe("skyRange", () => {
  it("gives the bright and the dark end of one slot", () => {
    const columns = 10;
    const rows = 10;
    const pixels = new Uint8Array(columns * rows * 4);
    for (let at = 0; at < columns * rows; at += 1)
      pixels.set(
        [at < 50 ? 0 : 255, at < 50 ? 0 : 255, at < 50 ? 0 : 255, 255],
        at * 4
      );
    const range = skyRange(pixels, { columns, rows, slot: 0, stride: columns });
    assert.equal(range.dark, 0);
    assert.equal(range.bright, 1 + tintLuminance);
  });

  it("ignores one bright and one dark sample", () => {
    const columns = 24;
    const rows = 6;
    const pixels = new Uint8Array(columns * rows * 4);
    for (let at = 0; at < columns * rows; at += 1)
      pixels.set([128, 128, 128, 255], at * 4);
    pixels.set([255, 255, 255, 255], 0);
    pixels.set([0, 0, 0, 255], 4);
    const range = skyRange(pixels, { columns, rows, slot: 0, stride: columns });
    const mid = luminance(128, 128, 128);
    assert.equal(range.dark, mid);
    assert.equal(range.bright, mid + tintLuminance);
  });
});

describe("inkScores", () => {
  it("scores dark ink on the darkest sample and white on the brightest", () => {
    const scores = inkScores({ bright: 0.5, dark: 0.4 });
    assert.equal(
      scores.dark,
      contrast(liftedLuminance(inkPalette.dark, 0), 0.4)
    );
    assert.equal(scores.light, contrast(1, 0.5));
  });
});

describe("wantedInk", () => {
  const need = 4.5;
  const floor = need * inkMargin;

  it("takes dark ink on a bright sky", () => {
    assert.equal(wantedInk({ dark: floor, light: 1.2 }, need), "dark");
  });

  it("takes white ink on a dark sky", () => {
    assert.equal(wantedInk({ dark: 1.1, light: floor }, need), "light");
  });

  it("prefers dark ink when both clear the target", () => {
    assert.equal(
      wantedInk({ dark: floor + 1, light: floor + 5 }, need),
      "dark"
    );
  });

  it("takes the ink with the better contrast when neither clears the target", () => {
    assert.equal(wantedInk({ dark: 3, light: 2 }, need), "dark");
    assert.equal(wantedInk({ dark: 2, light: 3 }, need), "light");
  });
});

describe("nextInk", () => {
  const need = 4.5;
  const floor = need * inkMargin;

  it("decides at once on the first read", () => {
    assert.deepEqual(nextInk(freshInk, { dark: floor + 1, light: 1 }, need), {
      mode: "dark",
      pending: undefined,
    });
    assert.deepEqual(nextInk(freshInk, { dark: 2, light: 3 }, need), {
      mode: "light",
      pending: undefined,
    });
  });

  it("needs two reads in a row to switch away from an ink that fails", () => {
    const state = { mode: "dark", pending: undefined } as const;
    const scores = { dark: floor - 1, light: floor + 1 };
    const first = nextInk(state, scores, need);
    assert.deepEqual(first, { mode: "dark", pending: "light" });
    assert.deepEqual(nextInk(first, scores, need), {
      mode: "light",
      pending: undefined,
    });
  });

  it("switches on one firm read of the goal sky", () => {
    const state = { mode: "dark", pending: undefined } as const;
    const scores = { dark: floor - 1, light: floor + 1 };
    assert.deepEqual(nextInk(state, scores, need, true), {
      mode: "light",
      pending: undefined,
    });
  });

  it("keeps a held ink on a firm read when leaving is not allowed", () => {
    const state = { mode: "light", pending: undefined } as const;
    const close = { dark: floor + 0.8, light: floor + 0.5 };
    assert.deepEqual(nextInk(state, close, need, true), {
      mode: "light",
      pending: undefined,
    });
  });

  it("drops a pending switch when the next read agrees with the mode", () => {
    const pending = { mode: "dark", pending: "light" } as const;
    assert.deepEqual(nextInk(pending, { dark: floor + 1, light: 1 }, need), {
      mode: "dark",
      pending: undefined,
    });
  });

  it("holds an ink that still clears the target unless the other wins by 0.5", () => {
    const state = { mode: "light", pending: undefined } as const;
    const close = { dark: floor + 0.8, light: floor + 0.5 };
    assert.deepEqual(nextInk(state, close, need), {
      mode: "light",
      pending: undefined,
    });
    const clear = { dark: floor + 1.2, light: floor + 0.5 };
    assert.deepEqual(nextInk(state, clear, need), {
      mode: "light",
      pending: "dark",
    });
  });

  it("moves toward the better ink when the held one fails its target", () => {
    const state = { mode: "dark", pending: undefined } as const;
    const scores = { dark: 3, light: 3.4 };
    assert.deepEqual(nextInk(state, scores, need), {
      mode: "dark",
      pending: "light",
    });
  });

  it("switches after two reads when the other ink wins by 0.5 and both fail", () => {
    const state = { mode: "dark", pending: undefined } as const;
    const scores = { dark: 2.5, light: 3.1 };
    const first = nextInk(state, scores, need);
    assert.deepEqual(first, { mode: "dark", pending: "light" });
    assert.deepEqual(nextInk(first, scores, need), {
      mode: "light",
      pending: undefined,
    });
  });
});
