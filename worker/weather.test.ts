import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  handleWeather,
  type WeatherCache,
  type WeatherDeps,
} from "./weather.ts";

const upstreamSample = {
  current: {
    cloud_cover: 84,
    cloud_cover_high: 0,
    cloud_cover_low: 13,
    cloud_cover_mid: 83,
    interval: 900,
    rain: 0,
    showers: 0,
    snowfall: 0,
    time: "2026-10-12T16:30",
    visibility: 44_520,
    weather_code: 2,
    wind_direction_10m: 342,
    wind_speed_10m: 12.5,
  },
};

const viennaSample = {
  code: 2,
  cover: 84,
  high: 0,
  low: 13,
  mid: 83,
  rain: 0,
  showers: 0,
  snow: 0,
  time: "2026-10-12T16:30",
  visibility: 44_520,
  windDirection: 342,
  windSpeed: 12.5,
};

interface Harness {
  deps: WeatherDeps;
  fetches: Array<{ signal: AbortSignal; url: string }>;
  stored: Stored[];
}

interface Stored {
  body: unknown;
  cacheControl: null | string;
  key: string;
}

const memoryCache = (stored: Stored[], initial?: Response): WeatherCache => {
  let entry = initial;

  return {
    match: () => Promise.resolve(entry?.clone()),
    put: async (key, response) => {
      stored.push({
        body: await response.clone().json(),
        cacheControl: response.headers.get("Cache-Control"),
        key: key.url,
      });
      entry = response;
    },
  };
};

const harness = (
  upstream: () => Promise<Response>,
  cached?: Response
): Harness => {
  const fetches: Harness["fetches"] = [];
  const stored: Stored[] = [];

  return {
    deps: {
      cache: memoryCache(stored, cached),
      fetch: (url, init) => {
        fetches.push({ signal: init.signal, url });
        return upstream();
      },
    },
    fetches,
    stored,
  };
};

const get = (path = "/weather"): Request =>
  new Request(`https://example.test${path}`);

const ok = (): Promise<Response> =>
  Promise.resolve(Response.json(upstreamSample));

const assertFailure = async (response: Response): Promise<void> => {
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await response.json(), { weather: null });
};

describe("handleWeather", () => {
  it("fetches, stores and answers on a miss", async () => {
    const { deps, fetches, stored } = harness(ok);
    const response = await handleWeather(get(), deps);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "public, max-age=300");
    assert.match(
      response.headers.get("Content-Type") ?? "",
      /^application\/json/
    );
    assert.deepEqual(await response.json(), { weather: viennaSample });
    assert.equal(fetches.length, 1);
    assert.match(fetches[0]?.url ?? "", /^https:\/\/api\.open-meteo\.com\//);
    assert.ok(fetches[0]?.signal instanceof AbortSignal);
    assert.deepEqual(stored, [
      {
        body: { weather: viennaSample },
        cacheControl: "public, max-age=900",
        key: "https://example.test/weather",
      },
    ]);
  });

  it("serves a cache hit without calling upstream", async () => {
    const cached = Response.json(
      { weather: viennaSample },
      { headers: { "Cache-Control": "public, max-age=900" } }
    );
    const { deps, fetches, stored } = harness(ok, cached);
    const response = await handleWeather(get(), deps);

    assert.equal(response.headers.get("Cache-Control"), "public, max-age=300");
    assert.deepEqual(await response.json(), { weather: viennaSample });
    assert.equal(fetches.length, 0);
    assert.equal(stored.length, 0);
  });

  it("serves a cached failure without calling upstream", async () => {
    const cached = Response.json({ weather: null });
    const { deps, fetches } = harness(ok, cached);

    await assertFailure(await handleWeather(get(), deps));
    assert.equal(fetches.length, 0);
  });

  it("uses one cache key for any query string", async () => {
    const { deps, stored } = harness(ok);
    await handleWeather(get("/weather?x=1"), deps);

    assert.equal(stored[0]?.key, "https://example.test/weather");
  });

  const failures: Array<[string, () => Promise<Response>]> = [
    [
      "upstream 500",
      () => Promise.resolve(new Response("down", { status: 500 })),
    ],
    ["a network error", () => Promise.reject(new TypeError("fetch failed"))],
    [
      "a timeout",
      () =>
        Promise.reject(
          new DOMException("The operation timed out.", "TimeoutError")
        ),
    ],
    ["bad JSON", () => Promise.resolve(new Response("{not json"))],
    [
      "a bad shape",
      () => Promise.resolve(Response.json({ current: { time: "x" } })),
    ],
    ["a missing current block", () => Promise.resolve(Response.json([]))],
  ];

  for (const [name, upstream] of failures) {
    it(`answers null and caches it for 60 s on ${name}`, async () => {
      const { deps, stored } = harness(upstream);

      await assertFailure(await handleWeather(get(), deps));
      assert.deepEqual(stored, [
        {
          body: { weather: null },
          cacheControl: "public, max-age=60",
          key: "https://example.test/weather",
        },
      ]);
    });
  }

  it("still answers when the cache throws", async () => {
    const { deps } = harness(ok);
    const broken: WeatherDeps = {
      ...deps,
      cache: {
        match: () => Promise.reject(new Error("cache down")),
        put: () => Promise.reject(new Error("cache down")),
      },
    };
    const response = await handleWeather(get(), broken);

    assert.deepEqual(await response.json(), { weather: viennaSample });
  });

  it("sends the security headers on a hit, a miss and a refusal", async () => {
    const expected = {
      "permissions-policy": "camera=(), microphone=(), geolocation=()",
      "referrer-policy": "strict-origin-when-cross-origin",
      "strict-transport-security": "max-age=31536000",
      "x-content-type-options": "nosniff",
    };
    const cached = Response.json({ weather: viennaSample });
    const responses = [
      await handleWeather(get(), harness(ok).deps),
      await handleWeather(get(), harness(ok, cached).deps),
      await handleWeather(
        new Request("https://example.test/weather", { method: "POST" }),
        harness(ok).deps
      ),
    ];

    for (const response of responses) {
      for (const [name, value] of Object.entries(expected)) {
        assert.equal(response.headers.get(name), value, name);
      }
    }
  });

  it("rejects other methods", async () => {
    const { deps, fetches } = harness(ok);
    const response = await handleWeather(
      new Request("https://example.test/weather", { method: "POST" }),
      deps
    );

    assert.equal(response.status, 405);
    assert.equal(response.headers.get("Allow"), "GET");
    assert.equal(fetches.length, 0);
  });
});
