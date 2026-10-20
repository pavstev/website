import assert from "node:assert/strict";
import { statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { decodePlaces } from "../src/lib/place-name.ts";
import { encodePlaces, parseGeoNames, placesPath } from "./places-data.ts";

const row = (
  name: string,
  lat: number,
  lon: number,
  population: number,
  featureClass = "P",
  country = "AT"
): string =>
  [
    "1",
    name,
    name,
    "",
    String(lat),
    String(lon),
    featureClass,
    "PPL",
    country,
    "",
    "",
    "",
    "",
    "",
    String(population),
  ].join("\t");

describe("places data", () => {
  it("reads only populated places over the cut", () => {
    const cities = parseGeoNames(
      [
        row("Graz", 47.06667, 15.45, 280_000),
        row("Tiny", 47, 15, 900),
        row("Lake", 47.5, 15.5, 90_000, "H"),
        row("Odd", 47.5, 15.5, 90_000, "P", "Austria"),
      ].join("\n")
    );
    assert.deepEqual(
      cities.map((city) => city.name),
      ["Graz"]
    );
  });

  it("round-trips through the browser decoder", () => {
    const text = encodePlaces(
      parseGeoNames(
        [
          row("Vienna", 48.20849, 16.37208, 1_900_000),
          row("Graz", 47.06667, 15.45, 280_000),
          row("Vienna Twin", 48.2111, 16.3711, 20_000),
          row("Hobart", -42.87936, 147.32941, 200_000, "P", "AU"),
        ].join("\n")
      )
    );
    assert.deepEqual(
      decodePlaces(text).map((place) => [
        place.name,
        place.country,
        place.lat,
        place.lon,
      ]),
      [
        ["Hobart", "AU", -42.9, 147.3],
        ["Graz", "AT", 47.1, 15.5],
        ["Vienna", "AT", 48.2, 16.4],
      ]
    );
  });

  it("keeps the committed file small and near Vienna", () => {
    const file = path.join(import.meta.dirname, "..", placesPath);
    assert.ok(statSync(file).size < 600_000);
  });
});
