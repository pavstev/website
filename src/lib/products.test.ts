import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";

import { productMarks } from "./product-marks.ts";
import {
  isProductUrl,
  productLlmsLines,
  productMeta,
  productMetaParts,
  products,
} from "./products.ts";

describe("products", () => {
  it("lists hirista, then Safety Real Time", () => {
    assert.deepEqual(
      products.map((product) => [
        product.key,
        product.name,
        product.schemaType,
        product.url,
      ]),
      [
        ["hirista", "hirista", "WebApplication", "https://hirista.app"],
        [
          "safety-real-time",
          "Safety Real Time",
          "SoftwareApplication",
          "https://safetyrealtime.com",
        ],
      ]
    );
  });
  it("has unique keys, https links and lines of at most 80 characters", () => {
    assert.equal(
      new Set(products.map((product) => product.key)).size,
      products.length
    );
    for (const product of products) {
      assert.equal(new URL(product.url).protocol, "https:", product.key);
      assert.ok(
        product.line.length > 0 && product.line.length <= 80,
        product.key
      );
    }
  });
  it("joins role and period", () => {
    assert.deepEqual(
      products.map((product) => productMeta(product)),
      ["Solo founder · 2026", "Co-founder & CTO · since 2022"]
    );
  });
  it("splits the meta after the dot, so a tile wraps it only there", () => {
    assert.deepEqual(
      products.map((product) => productMetaParts(product)),
      [
        ["Solo founder ·", "2026"],
        ["Co-founder & CTO ·", "since 2022"],
      ]
    );
    for (const product of products) {
      assert.equal(productMetaParts(product).join(" "), productMeta(product));
    }
  });
  it("writes one llms.txt line per product", () => {
    assert.deepEqual(productLlmsLines(products), [
      "- [hirista](https://hirista.app): Solo founder · 2026. Every saved job scored, every application prepared. You press send.",
      "- [Safety Real Time](https://safetyrealtime.com): Co-founder & CTO · since 2022. Keeps trucking fleets inspected, compliant and visible in real time.",
    ]);
  });
  it("matches a product host with or without www", () => {
    for (const url of [
      "https://hirista.app",
      "https://www.hirista.app/jobs",
      "https://www.safetyrealtime.com/",
    ]) {
      assert.equal(isProductUrl(url), true, url);
    }
    for (const url of [
      "https://app.hirista.app",
      "https://example.com/hirista.app",
      "hirista.app",
      "",
    ]) {
      assert.equal(isProductUrl(url), false, url);
    }
  });
  it("has a mark for every product", () => {
    assert.deepEqual(
      Object.entries(productMarks).map(([key, mark]) => [
        key,
        mark.viewBox,
        mark.transform,
        mark.layers.map((layer) => layer.ink),
      ]),
      [
        [
          "hirista",
          "0 0 24 24",
          { scale: 0.88, x: 1.22, y: 2.06 },
          ["mark", "accent"],
        ],
        [
          "safety-real-time",
          "0 0 100 100",
          { scale: 0.74, x: 13, y: 28.91 },
          ["mark", "mark", "mark", "mark", "mark", "mark"],
        ],
      ]
    );
  });
  it("keeps the Safety Real Time paths byte for byte", () => {
    const paths = productMarks["safety-real-time"].layers
      .map((layer) => layer.d)
      .join("\n");
    assert.equal(
      createHash("sha256").update(paths).digest("hex"),
      "f69a555b29079352378538e935b6ada790f5f96308f036d1c919d8fa76bbc17a"
    );
  });
});
