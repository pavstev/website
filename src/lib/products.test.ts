import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";

import { en } from "./i18n.ts";
import { productMarks } from "./product-marks.ts";
import {
  isProductUrl,
  productHost,
  productLlmsLines,
  productMeta,
  productMetaParts,
  products,
} from "./products.ts";
import { countHeading } from "./template.ts";

describe("products", () => {
  it("lists Safety Real Time", () => {
    assert.deepEqual(
      products.map((product) => [
        product.key,
        product.name,
        product.schemaType,
        product.url,
      ]),
      [
        [
          "safety-real-time",
          "Safety Real Time",
          "SoftwareApplication",
          "https://safetyrealtime.com",
        ],
      ]
    );
  });
  it("counts in the singular", () => {
    assert.equal(countHeading(products.length, en.products), "1 product");
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
      ["Co-founder & CTO · since 2022"]
    );
  });
  it("splits the meta after the dot, so a tile wraps it only there", () => {
    assert.deepEqual(
      products.map((product) => productMetaParts(product)),
      [["Co-founder & CTO ·", "since 2022"]]
    );
    for (const product of products) {
      assert.equal(productMetaParts(product).join(" "), productMeta(product));
    }
  });
  it("writes one llms.txt line per product", () => {
    assert.deepEqual(productLlmsLines(products), [
      "- [Safety Real Time](https://safetyrealtime.com): Co-founder & CTO · since 2022. Keeps trucking fleets inspected, compliant and visible in real time.",
    ]);
  });
  it("matches a product host with or without www", () => {
    for (const url of [
      "https://safetyrealtime.com",
      "https://www.safetyrealtime.com/",
      "https://www.safetyrealtime.com/fleet",
    ]) {
      assert.equal(isProductUrl(url), true, url);
    }
    for (const url of [
      "https://app.safetyrealtime.com",
      "https://example.com/safetyrealtime.com",
      "safetyrealtime.com",
      "",
    ]) {
      assert.equal(isProductUrl(url), false, url);
    }
  });
  it("shows the bare domain", () => {
    assert.deepEqual(
      products.map((product) => productHost(product)),
      ["safetyrealtime.com"]
    );
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
