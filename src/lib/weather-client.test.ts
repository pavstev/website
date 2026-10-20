import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { vienna } from "./geo.ts";
import {
  loadWeather,
  samePlace,
  weatherAllowed,
  type WeatherDeps,
  weatherUrl,
} from "./weather-client.ts";

const sampleBody = {
  current: {
    cloud_cover: 100,
    cloud_cover_high: 100,
    cloud_cover_low: 0,
    cloud_cover_mid: 0,
    interval: 900,
    precipitation: 0,
    relative_humidity_2m: 66,
    time: "2026-10-19T19:15",
    visibility: 24_140,
    weather_code: 3,
    wind_direction_10m: 290,
    wind_speed_10m: 9.4,
  },
};

const now = 1_800_000_000_000;
const minute = 60_000;
const cacheKey = "sky-weather:48.2,16.4";

interface Rig {
  calls: () => number;
  deps: WeatherDeps;
  items: Map<string, string>;
}

const rig = (
  answer: () => Promise<Response> = () =>
    Promise.resolve(Response.json(sampleBody)),
  timeoutMs?: number
): Rig => {
  const items = new Map<string, string>();
  let count = 0;
  return {
    calls: () => count,
    deps: {
      fetch: () => {
        count += 1;
        return answer();
      },
      now: () => now,
      store: {
        getItem: (key) => items.get(key) ?? null,
        setItem: (key, value) => {
          items.set(key, value);
        },
      },
      ...(timeoutMs !== undefined && { timeoutMs }),
    },
    items,
  };
};

const boom = (): never => {
  throw new Error("denied");
};

const entry = (age: number): string =>
  JSON.stringify({ at: now - age, body: sampleBody });

describe("weather client", () => {
  it("builds the request", () =>
    assert.equal(
      weatherUrl(vienna),
      "https://api.open-meteo.com/v1/forecast?latitude=48.2&longitude=16.4&current=cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,weather_code,wind_speed_10m,wind_direction_10m,visibility,relative_humidity_2m,precipitation&timezone=auto"
    ));

  it("uses a cache entry younger than 15 minutes", async () => {
    const r = rig();
    r.items.set(cacheKey, entry(14 * minute));
    const report = await loadWeather(vienna, r.deps);
    assert.ok(report);
    assert.equal(r.calls(), 0);
  });

  it("asks again after 15 minutes", async () => {
    const r = rig();
    r.items.set(cacheKey, entry(16 * minute));
    const report = await loadWeather(vienna, r.deps);
    assert.ok(report);
    assert.equal(r.calls(), 1);
    assert.equal(r.items.get(cacheKey), entry(0));
  });

  it("ignores a junk cache entry", async () => {
    const r = rig();
    r.items.set(cacheKey, "{not json");
    assert.ok(await loadWeather(vienna, r.deps));
    r.items.set(cacheKey, JSON.stringify({ at: "x", body: 4 }));
    assert.ok(await loadWeather(vienna, r.deps));
    assert.equal(r.calls(), 2);
  });

  it("survives a throwing store", async () => {
    const r = rig();
    const report = await loadWeather(vienna, {
      ...r.deps,
      store: { getItem: boom, setItem: boom },
    });
    assert.ok(report);
    assert.equal(r.calls(), 1);
  });

  it("works without a store", async () => {
    const r = rig();
    assert.ok(await loadWeather(vienna, { ...r.deps, store: undefined }));
  });

  it("shares one request per place", async () => {
    const r = rig();
    const [a, b] = await Promise.all([
      loadWeather(vienna, r.deps),
      loadWeather({ lat: 48.21, lon: 16.37 }, r.deps),
    ]);
    assert.equal(r.calls(), 1);
    assert.ok(a);
    assert.deepEqual(a, b);
    await loadWeather(vienna, { ...r.deps, store: undefined });
    assert.equal(r.calls(), 2);
  });

  it("gives undefined on a 429, an HTML page and a timeout", async () => {
    const limited = rig(() =>
      Promise.resolve(new Response("slow down", { status: 429 }))
    );
    assert.equal(await loadWeather(vienna, limited.deps), undefined);
    assert.equal(limited.items.size, 0);

    const page = rig(() =>
      Promise.resolve(new Response("<html>oops</html>", { status: 200 }))
    );
    assert.equal(await loadWeather(vienna, page.deps), undefined);
    assert.equal(page.items.size, 0);

    const down = rig(() => Promise.reject(new Error("offline")));
    assert.equal(await loadWeather(vienna, down.deps), undefined);
    assert.equal(down.items.size, 0);

    const slow: Rig = rig(undefined, 20);
    const waiting: WeatherDeps = {
      ...slow.deps,
      fetch: (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal.addEventListener("abort", () => {
            reject(new Error("aborted"));
          });
        }),
    };
    assert.equal(await loadWeather(vienna, waiting), undefined);
    assert.equal(slow.items.size, 0);
  });

  it("knows the same place", () => {
    assert.equal(samePlace(vienna, { lat: 48.21, lon: 16.37 }), true);
    assert.equal(samePlace(vienna, { lat: 52.52, lon: 13.4 }), false);
  });

  it("lets only live visitors ask", () => {
    const open = {
      crawler: false,
      home: true,
      lightLoad: false,
      pinned: false,
    };
    assert.equal(weatherAllowed(open), true);
    assert.equal(weatherAllowed({ ...open, home: false }), false);
    assert.equal(weatherAllowed({ ...open, crawler: true }), false);
    assert.equal(weatherAllowed({ ...open, lightLoad: true }), false);
    assert.equal(weatherAllowed({ ...open, pinned: true }), false);
  });
});
