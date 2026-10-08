import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { personalData } from "./personal.ts";
import { worldCities } from "./world-cities.ts";

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
