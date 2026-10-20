import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { distanceKm, roundPlace, sameSpot, vienna } from "./geo.ts";
import {
  choosePlace,
  chosenPlace,
  clearPlace,
  coordinateLabel,
  defaultStore,
  isPlace,
  namePlace,
  nearText,
  placeEvent,
  placeKey,
  placeNamedEvent,
  placeOverride,
  type PlaceStore,
  readPlace,
  savePlace,
  type SkyPlace,
  startPlace,
  viennaPlace,
} from "./sky-place.ts";

const memoryStore = (entries: Record<string, string> = {}): PlaceStore => {
  const map = new Map(Object.entries(entries));
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

const berlin: SkyPlace = {
  kind: "visitor",
  label: "Berlin",
  lat: 52.5,
  lon: 13.4,
};

const storeWithBerlin = (): PlaceStore => {
  const store = memoryStore();
  savePlace(berlin, store);
  return store;
};

const stored = (value: unknown): PlaceStore =>
  memoryStore({
    [placeKey]: typeof value === "string" ? value : JSON.stringify(value),
  });

describe("geo", () => {
  it("rounds to 0.1 degree", () =>
    assert.deepEqual(roundPlace({ lat: 52.5163, lon: 13.3777 }), {
      lat: 52.5,
      lon: 13.4,
    }));
  it("wraps the date line", () =>
    assert.deepEqual(roundPlace({ lat: 12.34, lon: 179.97 }), {
      lat: 12.3,
      lon: -180,
    }));
  it("compares two spots by value", () => {
    assert.equal(sameSpot({ lat: 1.5, lon: 2 }, { lat: 1.5, lon: 2 }), true);
    assert.equal(sameSpot({ lat: 1.5, lon: 2 }, { lat: 1.6, lon: 2 }), false);
    assert.equal(sameSpot({ lat: 1.5, lon: 2 }, { lat: 1.5, lon: 2.1 }), false);
  });
  it("clamps the poles", () =>
    assert.equal(roundPlace({ lat: 95, lon: 0 }).lat, 90));
  it("never gives -0", () => {
    const rounded = roundPlace({ lat: -0.04, lon: -0.04 });
    assert.ok(Object.is(rounded.lat, 0));
    assert.ok(Object.is(rounded.lon, 0));
  });
  it("measures Vienna to Berlin", () => {
    const km = distanceKm(vienna, { lat: 52.52, lon: 13.405 });
    assert.ok(km > 520 && km < 530);
  });
});

describe("place labels and overrides", () => {
  it("labels coordinates", () => {
    assert.equal(coordinateLabel({ lat: 52.5, lon: 13.4 }), "52.5° N, 13.4° E");
    assert.equal(
      coordinateLabel({ lat: -33.9, lon: -70.7 }),
      "33.9° S, 70.7° W"
    );
  });
  it("says near a city with its country", () => {
    assert.equal(
      nearText({ country: "AT", name: "Graz" }),
      "Near Graz, Austria"
    );
  });
  it("reads ?place=", () =>
    assert.deepEqual(placeOverride("?place=52.52,13.40"), {
      kind: "visitor",
      label: "52.5° N, 13.4° E",
      lat: 52.5,
      lon: 13.4,
    }));
  it("ignores a broken ?place=", () => {
    assert.equal(placeOverride("?place=abc"), undefined);
    assert.equal(placeOverride("?place=91,0"), undefined);
  });
});

describe("storage", () => {
  it("round-trips a saved place", () => {
    const store = memoryStore();
    savePlace(berlin, store);
    assert.deepEqual(readPlace(store), berlin);
    const raw = store.getItem(placeKey);
    const data = JSON.parse(raw ?? "{}") as Record<string, unknown>;
    assert.deepEqual(
      Object.keys(data).toSorted((a, b) => a.localeCompare(b)),
      ["label", "lat", "lon"]
    );
  });
  it("rounds a place when saving", () => {
    const store = memoryStore();
    savePlace({ ...berlin, lat: 52.5163, lon: 13.3777 }, store);
    assert.deepEqual(readPlace(store), berlin);
  });
  it("clears a saved place", () => {
    const store = storeWithBerlin();
    clearPlace(store);
    assert.equal(readPlace(store), undefined);
  });
  it("survives a throwing store", () => {
    assert.equal(readPlace(throwingStore), undefined);
    assert.doesNotThrow(() => savePlace(berlin, throwingStore));
    assert.doesNotThrow(() => clearPlace(throwingStore));
  });
  it("gives no store when the storage getter itself throws", () => {
    const saved = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get: () => {
        throw new DOMException("denied", "SecurityError");
      },
    });
    try {
      assert.equal(defaultStore(), undefined);
      assert.equal(readPlace(), undefined);
      assert.doesNotThrow(() => savePlace(berlin));
      assert.doesNotThrow(() => clearPlace());
    } finally {
      if (saved) Object.defineProperty(globalThis, "localStorage", saved);
      else Reflect.deleteProperty(globalThis, "localStorage");
    }
  });
  it("rejects junk", () => {
    const junk: unknown[] = [
      "{",
      "null",
      { label: "x", lat: 999, lon: 0 },
      { label: "x", lat: 0, lon: 181 },
      { label: "x".repeat(81), lat: 1, lon: 1 },
      { label: "", lat: 1, lon: 1 },
      { label: 5, lat: 1, lon: 1 },
      { label: "x", lat: "1", lon: 1 },
    ];
    for (const value of junk) {
      assert.equal(readPlace(stored(value)), undefined);
    }
  });
  it("rounds a stored place again", () => {
    const place = readPlace(stored({ label: "x", lat: 52.5163, lon: 13.3777 }));
    assert.deepEqual(place, {
      kind: "visitor",
      label: "x",
      lat: 52.5,
      lon: 13.4,
    });
  });
});

describe("start place", () => {
  it("gives crawlers Vienna", () =>
    assert.deepEqual(
      startPlace("?place=52.5,13.4", true, storeWithBerlin()),
      viennaPlace
    ));
  it("prefers ?place=, then the saved place, then Vienna", () => {
    const store = storeWithBerlin();
    assert.equal(startPlace("?place=-33.9,-70.7", false, store).lat, -33.9);
    assert.deepEqual(startPlace("", false, store), berlin);
    assert.deepEqual(startPlace("?place=abc", false, store), berlin);
    assert.deepEqual(startPlace("", false, memoryStore()), viennaPlace);
  });
});

describe("choose place", () => {
  it("saves and announces a place", () => {
    const store = memoryStore();
    const target = new EventTarget();
    const seen: unknown[] = [];
    target.addEventListener(placeEvent, (event) => {
      seen.push(event instanceof CustomEvent ? event.detail : undefined);
    });
    choosePlace(berlin, store, target);
    assert.equal(seen.length, 1);
    assert.deepEqual(seen[0], berlin);
    assert.deepEqual(readPlace(store), berlin);
    choosePlace(undefined, store, target);
    assert.equal(seen.length, 2);
    assert.deepEqual(seen[1], viennaPlace);
    assert.equal(readPlace(store), undefined);
  });
});

describe("chosen place", () => {
  it("remembers the last choice even when storage fails", () => {
    const target = new EventTarget();
    choosePlace(berlin, throwingStore, target);
    assert.deepEqual(chosenPlace(), berlin);
    choosePlace(undefined, throwingStore, target);
    assert.deepEqual(chosenPlace(), viennaPlace);
  });
});

describe("isPlace", () => {
  it("accepts a place and the Vienna place", () => {
    assert.equal(isPlace(berlin), true);
    assert.equal(isPlace({ ...berlin, country: "DE" }), true);
    assert.equal(isPlace(viennaPlace), true);
  });
  it("rejects junk", () => {
    for (const value of [
      undefined,
      null,
      "Berlin",
      {},
      { ...berlin, lat: 95 },
      { ...berlin, lon: NaN },
      { ...berlin, label: undefined },
      { ...berlin, label: "" },
      { ...berlin, label: "x".repeat(81) },
      { ...berlin, country: "Austria" },
      { ...berlin, country: 5 },
    ]) {
      assert.equal(isPlace(value), false);
    }
  });
});

describe("name place", () => {
  const graz = { lat: 47.1, lon: 15.4 };
  const found = { country: "AT", name: "Graz" };

  it("keeps the country in storage", () => {
    const store = memoryStore();
    savePlace({ ...berlin, country: "DE" }, store);
    assert.equal(readPlace(store)?.country, "DE");
    savePlace(berlin, store);
    assert.equal(readPlace(store)?.country, undefined);
    assert.equal(
      readPlace(stored({ country: "bad", label: "x", lat: 1, lon: 2 }))
        ?.country,
      undefined
    );
  });

  it("names the chosen place, saves it and sends only the named event", () => {
    const store = memoryStore();
    const target = new EventTarget();
    const seen: string[] = [];
    target.addEventListener(placeEvent, () => {
      seen.push("place");
    });
    target.addEventListener(placeNamedEvent, () => {
      seen.push("named");
    });
    choosePlace(
      { kind: "visitor", label: coordinateLabel(graz), ...graz },
      store,
      target
    );
    namePlace(graz, found, store, target);
    assert.deepEqual(seen, ["place", "named"]);
    assert.equal(chosenPlace()?.label, "Graz");
    assert.equal(chosenPlace()?.country, "AT");
    assert.deepEqual(readPlace(store), {
      country: "AT",
      kind: "visitor",
      label: "Graz",
      ...graz,
    });
  });

  it("leaves a pinned place out of storage", () => {
    const store = memoryStore();
    choosePlace(undefined, store, new EventTarget());
    namePlace(graz, found, store, new EventTarget());
    assert.equal(chosenPlace()?.kind, "vienna");
    assert.equal(readPlace(store), undefined);
  });

  it("ignores a name for a place that is no longer chosen", () => {
    const store = memoryStore();
    const target = new EventTarget();
    choosePlace(berlin, store, target);
    namePlace(graz, found, store, target);
    assert.equal(chosenPlace()?.label, "Berlin");
    assert.equal(readPlace(store)?.label, "Berlin");
  });
});
