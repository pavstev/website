import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  type AskContext,
  askedKey,
  askPosition,
  bubbleBox,
  chooseBox,
  currentSpot,
  type Fetcher,
  fetchWhere,
  forcedCity,
  hintLabel,
  markAsked,
  mayAsk,
  parseWhere,
  placeFromWhere,
  publishSpot,
  type Rect,
  skySpot,
  spotEvent,
  wasAsked,
} from "./sky-ask.ts";
import { coordinateLabel, type PlaceStore } from "./sky-place.ts";

const memoryStore = (): PlaceStore => {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    removeItem: (key) => {
      map.delete(key);
    },
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
};

const throwingStore: PlaceStore = {
  getItem: () => {
    throw new Error("blocked");
  },
  removeItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
};

const fresh: AskContext = {
  asked: false,
  crawler: false,
  home: true,
  lightLoad: false,
  pinned: false,
  saved: false,
};

const geoAnswer = (latitude: number, longitude: number) => ({
  getCurrentPosition: (ok: PositionCallback): void => {
    ok({
      coords: {
        accuracy: 1,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        latitude,
        longitude,
        speed: null,
        toJSON: () => ({}),
      },
      timestamp: 0,
      toJSON: () => ({}),
    });
  },
});

describe("mayAsk", () => {
  it("asks only a fresh visitor on home", () => {
    assert.equal(mayAsk(fresh), true);
    assert.equal(mayAsk({ ...fresh, home: false }), false);
    for (const flag of [
      "asked",
      "crawler",
      "lightLoad",
      "pinned",
      "saved",
    ] as const) {
      assert.equal(mayAsk({ ...fresh, [flag]: true }), false, flag);
    }
  });
});

describe("forcedCity", () => {
  it("reads ?bubble=", () => {
    assert.equal(forcedCity("?bubble=Berlin"), "Berlin");
    assert.equal(forcedCity("?bubble="), undefined);
    assert.equal(forcedCity(""), undefined);
  });
  it("trims and limits the city", () => {
    assert.equal(forcedCity("?bubble=%20Graz%20"), "Graz");
    assert.equal(forcedCity("?bubble=%20%20"), undefined);
    assert.equal(forcedCity(`?bubble=${"a".repeat(61)}`), undefined);
    assert.equal(forcedCity(`?bubble=${"a".repeat(60)}`), "a".repeat(60));
  });
});

describe("hintLabel", () => {
  const berlin = { city: "Berlin", lat: 52.52, lon: 13.4 };
  it("labels by the hint city within 50 km", () =>
    assert.equal(hintLabel({ lat: 52.5, lon: 13.4 }, berlin), "Berlin"));
  it("uses the coordinates away from the hint", () =>
    assert.equal(
      hintLabel({ lat: 48.2, lon: 16.4 }, berlin),
      "48.2° N, 16.4° E"
    ));
  it("uses the coordinates without a hint", () => {
    assert.equal(
      hintLabel({ lat: 48.2, lon: 16.4 }, undefined),
      "48.2° N, 16.4° E"
    );
    assert.equal(
      hintLabel(
        { lat: 52.5, lon: 13.4 },
        { city: "Berlin", lat: null, lon: null }
      ),
      "52.5° N, 13.4° E"
    );
    assert.equal(
      hintLabel(
        { lat: 52.5, lon: 13.4 },
        { city: null, lat: 52.52, lon: 13.4 }
      ),
      "52.5° N, 13.4° E"
    );
  });
  it("keeps the label between 1 and 80 characters", () => {
    const long = hintLabel(
      { lat: 52.5, lon: 13.4 },
      { city: ` ${"b".repeat(120)} `, lat: 52.52, lon: 13.4 }
    );
    assert.equal(long.length, 80);
    assert.equal(
      hintLabel(
        { lat: 52.5, lon: 13.4 },
        { city: " ".repeat(3), lat: 52.52, lon: 13.4 }
      ),
      "52.5° N, 13.4° E"
    );
  });
});

describe("skySpot", () => {
  const sun = [300, 700, 30] as const;
  const moon = [1000, 600, 40, 1] as const;
  it("prefers the sun when its disk is on screen", () =>
    assert.deepEqual(skySpot(moon, sun, 900), {
      kind: "sun",
      radius: 30,
      x: 300,
      y: 200,
    }));
  it("falls back to the moon", () =>
    assert.deepEqual(skySpot(moon, [300, -80, 30], 900), {
      kind: "moon",
      radius: 40,
      x: 1000,
      y: 300,
    }));
  it("gives none without a visible moon", () => {
    assert.equal(skySpot([1000, 600, 40, 0], [300, -80, 30], 900).kind, "none");
    assert.equal(skySpot(moon, [300, -80, 30], 900, 800).kind, "none");
  });
});

describe("bubbleBox", () => {
  it("places the bubble under the moon", () =>
    assert.deepEqual(
      bubbleBox(
        { kind: "moon", radius: 40, x: 1000, y: 200 },
        { height: 900, width: 1440 },
        { height: 120, width: 300 }
      ),
      { arrow: true, left: 850, top: 252 }
    ));
  it("moves the bubble bottom right without a spot", () =>
    assert.deepEqual(
      bubbleBox(
        { kind: "none", radius: 0, x: 0, y: 0 },
        { height: 900, width: 1440 },
        { height: 120, width: 300 }
      ),
      { arrow: false, left: 1124, top: 684 }
    ));
  it("keeps the bubble inside the side margins", () => {
    const viewport = { height: 900, width: 1440 };
    const bubble = { height: 120, width: 300 };
    assert.equal(
      bubbleBox({ kind: "sun", radius: 30, x: 1430, y: 200 }, viewport, bubble)
        .left,
      1124
    );
    assert.equal(
      bubbleBox({ kind: "sun", radius: 30, x: 4, y: 200 }, viewport, bubble)
        .left,
      16
    );
  });
  it("moves to the corner when the footer room is short", () =>
    assert.deepEqual(
      bubbleBox(
        { kind: "sun", radius: 30, x: 700, y: 700 },
        { height: 900, width: 1440 },
        { height: 120, width: 300 }
      ),
      { arrow: false, left: 1124, top: 684 }
    ));
});

const block = (
  left: number,
  top: number,
  right: number,
  bottom: number
): Rect => ({ bottom, left, right, top });

describe("chooseBox", () => {
  const viewport = { height: 900, width: 1440 };
  const bubble = { height: 120, width: 300 };
  const moon = { kind: "moon", radius: 40, x: 1000, y: 400 } as const;
  it("goes under the body when that is free", () =>
    assert.deepEqual(chooseBox(moon, viewport, bubble, []), {
      arrow: "up",
      left: 850,
      top: 452,
    }));
  it("goes above the body when under is blocked", () =>
    assert.deepEqual(
      chooseBox(moon, viewport, bubble, [block(800, 460, 1200, 600)]),
      { arrow: "down", left: 850, top: 228 }
    ));
  it("takes the spot with the least text under it when all are blocked", () =>
    assert.deepEqual(
      chooseBox(moon, viewport, bubble, [
        block(0, 452, 1440, 572),
        block(0, 228, 1440, 248),
        block(1124, 684, 1424, 804),
        block(1124, 16, 1424, 136),
      ]),
      { arrow: "none", left: 1124, top: 248 }
    ));
  it("finds a free gap on the right edge when every named spot is blocked", () =>
    assert.deepEqual(
      chooseBox(
        { kind: "none", radius: 0, x: 0, y: 0 },
        { height: 568, width: 320 },
        { height: 105, width: 288 },
        [block(20, 200, 300, 306), block(20, 312, 300, 497)],
        [block(93, 40, 227, 174), block(80, 513, 240, 549)]
      ),
      { arrow: "none", left: 16, top: 176 }
    ));
  it("weighs a control more than text", () =>
    assert.deepEqual(
      chooseBox(
        { kind: "none", radius: 0, x: 0, y: 0 },
        { height: 500, width: 320 },
        { height: 100, width: 288 },
        [block(0, 200, 320, 400)],
        [block(0, 16, 320, 116)]
      ),
      { arrow: "none", left: 16, top: 120 }
    ));
  it("goes to the top edge when the body spots and the corner are blocked", () =>
    assert.deepEqual(
      chooseBox(moon, viewport, bubble, [
        block(0, 452, 1440, 572),
        block(0, 228, 1440, 348),
        block(1124, 684, 1424, 804),
      ]),
      { arrow: "none", left: 1124, top: 16 }
    ));
  it("goes to the corner when the body is blocked both ways", () =>
    assert.deepEqual(
      chooseBox(moon, viewport, bubble, [
        block(0, 452, 1440, 572),
        block(0, 228, 1440, 348),
      ]),
      { arrow: "none", left: 1124, top: 684 }
    ));
  it("goes to the corner without a body on screen", () =>
    assert.deepEqual(
      chooseBox({ kind: "none", radius: 0, x: 0, y: 0 }, viewport, bubble, []),
      { arrow: "none", left: 1124, top: 684 }
    ));
  it("skips above when it would leave the screen", () =>
    assert.deepEqual(
      chooseBox({ kind: "sun", radius: 30, x: 700, y: 100 }, viewport, bubble, [
        block(0, 0, 1440, 300),
      ]),
      { arrow: "none", left: 1124, top: 684 }
    ));
});

describe("askPosition", () => {
  it("gives up when the browser never answers", async () =>
    assert.equal(
      await askPosition({ getCurrentPosition: () => undefined }, 20),
      undefined
    ));
  it("rounds the answer", async () =>
    assert.deepEqual(await askPosition(geoAnswer(52.5163, 13.3777)), {
      lat: 52.5,
      lon: 13.4,
    }));
  it("answers undefined on an error", async () =>
    assert.equal(
      await askPosition({
        getCurrentPosition: (_ok, fail) => {
          fail?.({
            code: 1,
            message: "denied",
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
          });
        },
      }),
      undefined
    ));
  it("answers undefined without geolocation or when it throws", async () => {
    assert.equal(await askPosition(undefined), undefined);
    assert.equal(
      await askPosition({
        getCurrentPosition: () => {
          throw new Error("blocked");
        },
      }),
      undefined
    );
  });
  it("answers undefined for a broken position", async () =>
    assert.equal(await askPosition(geoAnswer(NaN, 13)), undefined));
});

describe("parseWhere", () => {
  it("reads the Worker answer", () =>
    assert.deepEqual(
      parseWhere({ city: "Berlin", far: true, lat: 52.5, lon: 13.4 }),
      { city: "Berlin", far: true, lat: 52.5, lon: 13.4 }
    ));
  it("nulls every field of the wrong type", () =>
    assert.deepEqual(
      parseWhere({ city: 7, far: "yes", lat: "52.5", lon: NaN }),
      { city: null, far: null, lat: null, lon: null }
    ));
  it("rejects a body that is not an object", () => {
    assert.equal(parseWhere(null), undefined);
    assert.equal(parseWhere("far"), undefined);
  });
});

const answer =
  (body: unknown, ok = true): Fetcher =>
  () =>
    Promise.resolve({ json: () => Promise.resolve(body), ok });

describe("fetchWhere", () => {
  it("reads the rough city from /where", async () => {
    const reply = await fetchWhere(
      undefined,
      answer({ city: "Graz", far: false, lat: 47.1, lon: 15.4 })
    );
    assert.deepEqual(reply, { city: "Graz", far: false, lat: 47.1, lon: 15.4 });
  });
  it("answers undefined when the Worker says no", async () =>
    assert.equal(await fetchWhere(undefined, answer({}, false)), undefined));
  it("answers undefined when the request throws", async () =>
    assert.equal(
      await fetchWhere(undefined, () => Promise.reject(new Error("offline"))),
      undefined
    ));
  it("answers undefined for a body that is not an object", async () =>
    assert.equal(await fetchWhere(undefined, answer("far")), undefined));
});

describe("placeFromWhere", () => {
  it("makes a visitor place named by the city", () =>
    assert.deepEqual(
      placeFromWhere({ city: "Graz", far: false, lat: 47.07, lon: 15.44 }),
      { kind: "visitor", label: "Graz", lat: 47.1, lon: 15.4 }
    ));
  it("falls back to the coordinates without a city", () =>
    assert.deepEqual(
      placeFromWhere({ city: null, far: null, lat: 47.07, lon: 15.44 }),
      {
        kind: "visitor",
        label: coordinateLabel({ lat: 47.1, lon: 15.4 }),
        lat: 47.1,
        lon: 15.4,
      }
    ));
  it("gives nothing without a position", () => {
    assert.equal(
      placeFromWhere({ city: "Graz", far: false, lat: null, lon: 15.4 }),
      undefined
    );
    assert.equal(placeFromWhere(undefined), undefined);
  });
});

describe("asked flag", () => {
  it("reads and writes the flag", () => {
    const store = memoryStore();
    assert.equal(wasAsked(store), false);
    markAsked(store);
    assert.equal(store.getItem(askedKey), "1");
    assert.equal(wasAsked(store), true);
  });
  it("remembers the answer in memory when storage throws", () => {
    assert.equal(wasAsked(throwingStore), false);
    assert.equal(wasAsked(undefined), false);
    assert.doesNotThrow(() => markAsked(throwingStore));
    assert.equal(wasAsked(throwingStore), true);
    assert.equal(wasAsked(undefined), true);
  });
});

describe("published spot", () => {
  it("keeps the last spot and tells listeners", () => {
    const target = new EventTarget();
    let heard = 0;
    target.addEventListener(spotEvent, () => {
      heard += 1;
    });
    const spot = { kind: "moon", radius: 40, x: 10, y: 20 } as const;
    publishSpot(spot, target);
    assert.equal(heard, 1);
    assert.deepEqual(currentSpot(), spot);
  });
  it("stays quiet while the spot keeps the same whole pixels", () => {
    const target = new EventTarget();
    let heard = 0;
    target.addEventListener(spotEvent, () => {
      heard += 1;
    });
    publishSpot({ kind: "sun", radius: 30.2, x: 100.2, y: 50.4 }, target);
    publishSpot({ kind: "sun", radius: 30.4, x: 99.8, y: 50.1 }, target);
    assert.equal(heard, 1);
    publishSpot({ kind: "sun", radius: 30.4, x: 101.2, y: 50.1 }, target);
    publishSpot({ kind: "moon", radius: 30.4, x: 101.2, y: 50.1 }, target);
    assert.equal(heard, 3);
  });
});
