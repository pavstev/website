import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { router } from "./router.ts";

const env = {
  ASSETS: { fetch: () => Promise.resolve(new Response("asset")) },
} as unknown as Env;

const withCf = (
  url: string,
  cf: unknown,
  init: RequestInit = {}
): Request<unknown, IncomingRequestCfProperties> =>
  Object.assign(new Request(url, init), { cf }) as Request<
    unknown,
    IncomingRequestCfProperties
  >;

describe("router", () => {
  it("passes request.cf to /where", async () => {
    const response = await router.fetch(
      withCf("https://stevanpavlovic.com/where", {
        city: "Berlin",
        latitude: "52.52",
        longitude: "13.405",
      }),
      env
    );
    assert.deepEqual(await response.json(), {
      city: "Berlin",
      far: true,
      lat: 52.5,
      lon: 13.4,
    });
  });
  it("answers /where without cf data", async () => {
    const response = await router.fetch(
      withCf("https://stevanpavlovic.com/where", undefined),
      env
    );
    assert.deepEqual(await response.json(), {
      city: null,
      far: null,
      lat: null,
      lon: null,
    });
  });
  it("hands other paths to the assets", async () => {
    const response = await router.fetch(
      withCf("https://stevanpavlovic.com/about", undefined),
      env
    );
    assert.equal(await response.text(), "asset");
  });
});

const brokenAssets = (errorPage: () => Promise<Response>): Env =>
  ({
    ASSETS: {
      fetch: (request: Request) =>
        new URL(request.url).pathname === "/500"
          ? errorPage()
          : Promise.reject(new Error("assets down")),
    },
  }) as unknown as Env;

const page = (accept: string): Request<unknown, IncomingRequestCfProperties> =>
  withCf("https://stevanpavlovic.com/about", undefined, {
    headers: { accept },
  });

describe("router errors", () => {
  it("serves the 500 page with status 500 to a browser", async () => {
    const response = await router.fetch(
      page("text/html,application/xhtml+xml"),
      brokenAssets(() =>
        Promise.resolve(
          new Response("<h1>500</h1>", {
            headers: { "Content-Type": "text/html" },
          })
        )
      )
    );
    assert.equal(response.status, 500);
    assert.equal(await response.text(), "<h1>500</h1>");
    assert.equal(response.headers.get("Content-Type"), "text/html");
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  });
  it("answers JSON to a client that does not want a page", async () => {
    const response = await router.fetch(
      page("application/json"),
      brokenAssets(() => Promise.resolve(new Response("page")))
    );
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: "internal" });
  });
  it("falls back to JSON when the 500 page is missing", async () => {
    const response = await router.fetch(
      page("text/html"),
      brokenAssets(() => Promise.resolve(new Response("gone", { status: 404 })))
    );
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: "internal" });
  });
  it("falls back to JSON when the 500 page throws too", async () => {
    const response = await router.fetch(
      page("text/html"),
      brokenAssets(() => Promise.reject(new Error("still down")))
    );
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: "internal" });
  });
});
