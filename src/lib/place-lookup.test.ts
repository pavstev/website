import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createPlaceLookup } from "./place-lookup.ts";

const file = "471,154,AT,Graz\n11,164,AT,Vienna";

describe("createPlaceLookup", () => {
  it("loads the file once and names a place", async () => {
    let loads = 0;
    const lookup = createPlaceLookup(() => {
      loads += 1;
      return Promise.resolve(file);
    });
    assert.deepEqual(await lookup({ lat: 47.07, lon: 15.44 }), {
      country: "AT",
      name: "Graz",
    });
    const second = await lookup({ lat: 48.2, lon: 16.4 });
    assert.equal(second?.name, "Vienna");
    assert.equal(loads, 1);
  });

  it("gives nothing far from every place", async () => {
    const lookup = createPlaceLookup(() => Promise.resolve(file));
    assert.equal(await lookup({ lat: 0, lon: 0 }), undefined);
  });

  it("tries again after a failed load", async () => {
    let loads = 0;
    const lookup = createPlaceLookup(() => {
      loads += 1;
      return loads === 1
        ? Promise.reject(new Error("offline"))
        : Promise.resolve(file);
    });
    assert.equal(await lookup({ lat: 47.1, lon: 15.4 }), undefined);
    const again = await lookup({ lat: 47.1, lon: 15.4 });
    assert.equal(again?.name, "Graz");
  });
});
