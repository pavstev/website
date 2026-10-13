import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { countHeading, fillCount, pluralForm } from "./template.ts";

describe("fillCount", () => {
  it("replaces the count placeholder once", () => {
    assert.equal(fillCount("{count} items", 3), "3 items");
    assert.equal(fillCount("{count} and {count}", 2), "2 and {count}");
  });

  it("leaves a template without a placeholder alone", () => {
    assert.equal(fillCount("none", 4), "none");
  });

  it("fills zero", () => {
    assert.equal(fillCount("a{count}b", 0), "a0b");
  });
});

describe("pluralForm", () => {
  it("picks the one form for 1 and the other form otherwise", () => {
    assert.equal(pluralForm(1, "one", "other"), "one");
    assert.equal(pluralForm(0, "one", "other"), "other");
    assert.equal(pluralForm(2, "one", "other"), "other");
    assert.equal(pluralForm(11, "one", "other"), "other");
  });
});

describe("countHeading", () => {
  const forms = { headingOne: "{count} thing", headingOther: "{count} things" };

  it("fills the right form", () => {
    assert.equal(countHeading(1, forms), "1 thing");
    assert.equal(countHeading(0, forms), "0 things");
    assert.equal(countHeading(5, forms), "5 things");
  });
});
