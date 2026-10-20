import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { withSecurityHeaders } from "./http.ts";
import { handleWhere, whereAnswer } from "./where.ts";

describe("whereAnswer", () => {
  it("answers Berlin as far", () =>
    assert.deepEqual(
      whereAnswer({
        city: "Berlin",
        latitude: "52.52000",
        longitude: "13.40500",
      }),
      { city: "Berlin", far: true, lat: 52.5, lon: 13.4 }
    ));
  it("answers a Vienna suburb as near", () =>
    assert.equal(
      whereAnswer({ city: "Schwechat", latitude: "48.14", longitude: "16.48" })
        .far,
      false
    ));
  it("answers nulls without data", () =>
    assert.deepEqual(whereAnswer(undefined), {
      city: null,
      far: null,
      lat: null,
      lon: null,
    }));
  it("keeps the city with a broken spot", () =>
    assert.deepEqual(
      whereAnswer({ city: "Graz", latitude: "abc", longitude: "15.4" }),
      { city: "Graz", far: null, lat: null, lon: null }
    ));
  it("rejects a spot out of range", () =>
    assert.deepEqual(
      whereAnswer({ city: "Nowhere", latitude: "95", longitude: "15.4" }),
      { city: "Nowhere", far: null, lat: null, lon: null }
    ));
  it("trims the city and drops an empty one", () => {
    assert.equal(whereAnswer({ city: "  Linz " }).city, "Linz");
    assert.equal(whereAnswer({ city: " ".repeat(3) }).city, null);
  });
});

describe("handleWhere", () => {
  it("sends private, noindex headers", () => {
    const response = handleWhere(
      new Request("https://stevanpavlovic.com/where"),
      { city: "Berlin", latitude: "52.52", longitude: "13.4" }
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    assert.equal(response.headers.get("X-Robots-Tag"), "noindex");
  });
  it("answers HEAD", () =>
    assert.equal(
      handleWhere(
        new Request("https://stevanpavlovic.com/where", { method: "HEAD" }),
        undefined
      ).status,
      200
    ));
  it("refuses POST", () => {
    const response = handleWhere(
      new Request("https://stevanpavlovic.com/where", { method: "POST" }),
      undefined
    );
    assert.equal(response.status, 405);
    assert.equal(response.headers.get("Allow"), "GET, HEAD");
  });
});

describe("Permissions-Policy", () => {
  it("keeps one Permissions-Policy", () => {
    const headers = path.join(import.meta.dirname, "..", "public", "_headers");
    const line = readFileSync(headers, "utf8")
      .split("\n")
      .find((row) => row.trimStart().startsWith("Permissions-Policy:"));
    assert.equal(
      line?.split(": ", 2)[1],
      withSecurityHeaders(new Response()).headers.get("Permissions-Policy")
    );
    assert.match(line ?? "", /geolocation=\(self\)/);
  });
});
