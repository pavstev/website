import assert from "node:assert/strict";
import { statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import sharp from "sharp";

import {
  blurMask,
  fillRings,
  landMap,
  landMapHeight,
  landMapPath,
  landMapWidth,
  landRings,
  projectRing,
  type Ring,
} from "./land-map.ts";

const square: Ring = [
  [1, 1],
  [3, 1],
  [3, 3],
  [1, 3],
  [1, 1],
];

describe("landRings", () => {
  it("reads polygons and multipolygons from a collection", () => {
    const rings = landRings({
      features: [
        { geometry: { coordinates: [square], type: "Polygon" } },
        {
          geometry: { coordinates: [[square], [square]], type: "MultiPolygon" },
        },
        { geometry: { coordinates: [0, 0], type: "Point" } },
        { geometry: null },
      ],
      type: "FeatureCollection",
    });
    assert.equal(rings.length, 3);
  });

  it("gives nothing for other input", () => {
    assert.deepEqual(landRings(undefined), []);
    assert.deepEqual(landRings("land"), []);
    assert.deepEqual(landRings({ features: [] }), []);
  });
});

describe("projectRing", () => {
  it("maps longitude and latitude to pixels", () => {
    assert.deepEqual(
      projectRing(
        [
          [-180, 90],
          [0, 0],
          [180, -90],
        ],
        2048,
        1024
      ),
      [
        [0, 0],
        [1024, 512],
        [2048, 1024],
      ]
    );
  });
});

describe("fillRings", () => {
  it("covers whole pixels fully and edge pixels by their share", () => {
    const rows = fillRings(
      [
        [
          [1.5, 1],
          [3, 1],
          [3, 3],
          [1.5, 3],
          [1.5, 1],
        ],
      ],
      5,
      4
    );
    const at = (x: number, y: number): number => rows[y * 5 + x] ?? -1;
    assert.equal(at(0, 1), 0);
    assert.ok(Math.abs(at(1, 1) - 0.5) < 1e-6);
    assert.ok(Math.abs(at(2, 2) - 1) < 1e-6);
    assert.equal(at(3, 1), 0);
    assert.equal(at(1, 0), 0);
    assert.equal(at(1, 3), 0);
  });

  it("leaves a hole empty with the even-odd rule", () => {
    const outer: Ring = [
      [0, 0],
      [6, 0],
      [6, 6],
      [0, 6],
      [0, 0],
    ];
    const rows = fillRings([outer, square], 6, 6);
    assert.equal(rows[0], 1);
    assert.equal(rows[2 * 6 + 2], 0);
    assert.equal(rows[4 * 6 + 4], 1);
  });

  it("covers a slanted edge by half at its middle", () => {
    const rows = fillRings(
      [
        [
          [0, 0],
          [4, 0],
          [0, 4],
          [0, 0],
        ],
      ],
      4,
      4
    );
    assert.ok(Math.abs((rows[0] ?? 0) - 1) < 1e-6);
    assert.ok(Math.abs((rows[5] ?? 0) - 1) < 1e-6);
    assert.ok(Math.abs((rows[6] ?? 0) - 0.5) < 0.07);
    assert.equal(rows[15], 0);
  });
});

describe("blurMask", () => {
  it("keeps the total and wraps across the sides", () => {
    const mask = new Float32Array(8 * 12);
    mask[6 * 8] = 1;
    const soft = blurMask(mask, 8, 12, 1);
    const total = soft.reduce((sum, value) => sum + value, 0);
    assert.ok(Math.abs(total - 1) < 1e-5);
    assert.ok((soft[6 * 8 + 7] ?? 0) > 0.05);
    assert.ok((soft[6 * 8 + 1] ?? 0) > 0.05);
  });
});

describe("landMap", () => {
  it("draws the same map every run", () => {
    const geojson = {
      geometry: { coordinates: [square], type: "Polygon" },
      type: "Feature",
    };
    assert.deepEqual(landMap(geojson, 32, 16), landMap(geojson, 32, 16));
  });
});

describe("committed land map", () => {
  const file = path.join(import.meta.dirname, "..", landMapPath);

  it("stays small", () => {
    assert.ok(statSync(file).size < 80_000);
  });

  it("is the shared size and puts land where land is", async () => {
    const { data, info } = await sharp(file)
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    assert.deepEqual([info.width, info.height], [landMapWidth, landMapHeight]);
    const at = (lat: number, lon: number): number => {
      const x = Math.min(
        info.width - 1,
        Math.floor(((lon + 180) / 360) * info.width)
      );
      const y = Math.min(
        info.height - 1,
        Math.floor(((90 - lat) / 180) * info.height)
      );
      return data[y * info.width * info.channels + x * info.channels] ?? -1;
    };
    assert.ok(at(25, 10) > 220);
    assert.ok(at(-80, 0) > 220);
    assert.ok(at(50, 15) > 220);
    assert.ok(at(0, -150) < 30);
    assert.ok(at(-40, -20) < 30);
    assert.ok(at(30, -40) < 30);
  });
});
