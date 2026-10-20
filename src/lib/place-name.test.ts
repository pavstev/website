import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  countryName,
  decodePlaces,
  nearestPlace,
  placeRadiusKm,
} from "./place-name.ts";

const table = decodePlaces(
  [
    "-448,1,AU,Hobart",
    "0,2,XX,Same",
    "919,160,AT,Graz, East",
    "10,164,AT,Vienna",
  ].join("\n")
);

describe("decodePlaces", () => {
  it("adds each latitude step and reads tenths of a degree", () => {
    assert.deepEqual(table[0], {
      country: "AU",
      lat: -44.8,
      lon: 0.1,
      name: "Hobart",
    });
    assert.deepEqual(table[2], {
      country: "AT",
      lat: 47.1,
      lon: 16,
      name: "Graz, East",
    });
    assert.equal(table[3]?.lat, 48.1);
  });

  it("skips broken rows and keeps the running latitude", () => {
    const rows = decodePlaces(
      "5,1,DE,Berlin\nnope\n,,,\n5,x,DE,Bad\n5,2,DE,Bonn"
    );
    assert.deepEqual(
      rows.map((row) => [row.name, row.lat]),
      [
        ["Berlin", 0.5],
        ["Bonn", 1],
      ]
    );
  });
});

describe("nearestPlace", () => {
  it("returns the closest place within the radius", () => {
    assert.deepEqual(nearestPlace(table, { lat: 47.1, lon: 16 }), {
      country: "AT",
      name: "Graz, East",
    });
    assert.equal(nearestPlace(table, { lat: 48.1, lon: 16.5 })?.name, "Vienna");
  });

  it("returns nothing when no place is near", () => {
    assert.equal(nearestPlace(table, { lat: 30, lon: 100 }), undefined);
    assert.equal(nearestPlace(table, { lat: 47.1, lon: 20 }), undefined);
    assert.equal(nearestPlace([], { lat: 47, lon: 15 }), undefined);
  });

  it("holds to the radius", () => {
    const near = nearestPlace(table, { lat: 47.1, lon: 15.6 }, 5);
    assert.equal(near, undefined);
    assert.ok(placeRadiusKm >= 20 && placeRadiusKm <= 50);
  });

  it("wraps across the date line", () => {
    const wrapped = decodePlaces("-170,1799,FJ,Taveuni");
    assert.equal(
      nearestPlace(wrapped, { lat: -17, lon: -179.9 })?.name,
      "Taveuni"
    );
  });
});

describe("countryName", () => {
  it("spells out the ISO code", () => {
    assert.equal(countryName("AT"), "Austria");
    assert.equal(countryName("ZZZZ"), "ZZZZ");
  });
});
