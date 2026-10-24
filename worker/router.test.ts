import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { router } from "./router.ts";

const env = {
  ASSETS: { fetch: () => Promise.resolve(new Response("asset")) },
} as unknown as Env;

const withCf = (
  url: string,
  cf: unknown
): Request<unknown, IncomingRequestCfProperties> =>
  Object.assign(new Request(url), { cf }) as Request<
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
