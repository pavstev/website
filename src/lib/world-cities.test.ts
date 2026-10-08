import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { personalData } from "./personal.ts";
import { worldCities } from "./world-cities.ts";

const interRanges = async (): Promise<Array<[number, number]>> => {
  const css = await readFile("src/styles/globals.css", "utf8");
  const ranges: Array<[number, number]> = [];
  for (const [face] of css.matchAll(/@font-face\s*\{[^}]*\}/gu)) {
    if (!face.includes('font-family: "Inter Variable"')) continue;
    const list = /unicode-range:([^;]+);/u.exec(face)?.[1] ?? "";
    for (const part of list.split(",")) {
      const [low = "", high = low] = part.trim().slice(2).split("-", 2);
      ranges.push([Number.parseInt(low, 16), Number.parseInt(high, 16)]);
    }
  }
  return ranges;
};

describe("worldCities", () => {
  it("lists the 100 largest metro areas", () => {
    assert.equal(worldCities.length, 100);
  });

  it("keeps at most three cities per country", () => {
    const counts = new Map<string, number>();
    for (const city of worldCities) {
      counts.set(city.countryCode, (counts.get(city.countryCode) ?? 0) + 1);
    }
    for (const [country, count] of counts) {
      assert.ok(count <= 3, `${country} has ${String(count)} cities`);
    }
  });

  it("places every city on the globe", () => {
    for (const city of worldCities) {
      assert.ok(
        Number.isFinite(city.latitude) && Math.abs(city.latitude) <= 90,
        `${city.name} latitude ${String(city.latitude)}`
      );
      assert.ok(
        Number.isFinite(city.longitude) && Math.abs(city.longitude) <= 180,
        `${city.name} longitude ${String(city.longitude)}`
      );
    }
  });

  it("names every city once", () => {
    const names = worldCities.map((city) => city.name);
    for (const name of names) assert.equal(name, name.trim());
    assert.ok(names.every((name) => name.length > 0));
    assert.equal(new Set(names).size, names.length);
    assert.ok(!names.includes(personalData.city));
  });

  it("draws every name with the Inter faces from globals.css", async () => {
    const ranges = await interRanges();
    assert.ok(ranges.length > 0);
    for (const { name } of worldCities) {
      for (const char of name) {
        const code = char.codePointAt(0) ?? 0;
        assert.ok(
          ranges.some(([low, high]) => code >= low && code <= high),
          `${name}: U+${code.toString(16).toUpperCase().padStart(4, "0")}`
        );
      }
    }
  });

  it("is sorted by population, largest first", () => {
    for (const [index, city] of worldCities.entries()) {
      assert.ok(Number.isSafeInteger(city.population) && city.population > 0);
      const next = worldCities[index + 1];
      if (next) {
        assert.ok(
          city.population >= next.population,
          `${city.name} before ${next.name}`
        );
      }
    }
  });
});
