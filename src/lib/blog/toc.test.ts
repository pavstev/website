import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { branchOf, spySection, type TocItem, tocOf } from "./toc.ts";

describe("tocOf", () => {
  it("keeps h2 and h3 with their ids and drops the anchor mark", () => {
    assert.deepEqual(
      tocOf([
        { depth: 1, slug: "d", text: "D#" },
        { depth: 2, slug: "a", text: "A#" },
        { depth: 3, slug: "b", text: "B#" },
        { depth: 4, slug: "c", text: "C#" },
      ]),
      [
        { depth: 2, id: "a", text: "A" },
        { depth: 3, id: "b", text: "B" },
      ]
    );
  });

  it("removes only the one mark the anchor adds", () => {
    assert.deepEqual(tocOf([{ depth: 2, slug: "c", text: "  C##\n " }]), [
      { depth: 2, id: "c", text: "C#" },
    ]);
  });

  it("leaves the footnote heading out", () => {
    assert.deepEqual(
      tocOf([{ depth: 2, slug: "footnote-label", text: "Footnotes" }]),
      []
    );
  });

  it("returns an empty list without headings", () => {
    assert.deepEqual(tocOf([]), []);
  });
});

describe("spySection", () => {
  it("picks the last heading at or above the line at the top of the page", () => {
    assert.equal(spySection([-900, -200, 90, 700], 92, 800, 0), 2);
    assert.equal(spySection([-900, -200, 300, 700], 92, 800, 0), 1);
    assert.equal(spySection([-900, -200, 93], 92, 800, 0), 2);
  });

  it("returns -1 above the first heading", () => {
    assert.equal(spySection([400, 900], 92, 800, 0), -1);
    assert.equal(spySection([], 92, 800, 0), -1);
  });

  it("lowers the line as the page scrolls, so the last short sections count", () => {
    assert.equal(spySection([-300, 200, 500, 700], 92, 800, 0), 0);
    assert.equal(spySection([-300, 200, 500, 700], 92, 800, 0.5), 1);
    assert.equal(spySection([-300, 200, 500, 700], 92, 800, 0.7), 2);
    assert.equal(spySection([-300, 200, 500, 700], 92, 800, 0.9), 3);
  });

  it("takes the last heading at the end of the page", () => {
    assert.equal(spySection([-300, 200, 900], 92, 800, 1), 2);
    assert.equal(spySection([], 92, 800, 1), -1);
  });

  it("treats an overscroll above the top as the top", () => {
    assert.equal(spySection([-300, 200], 92, 800, -0.2), 0);
  });
});

describe("branchOf", () => {
  const items: TocItem[] = [
    { depth: 2, id: "a", text: "A" },
    { depth: 3, id: "b", text: "B" },
    { depth: 3, id: "c", text: "C" },
    { depth: 2, id: "d", text: "D" },
    { depth: 3, id: "e", text: "E" },
  ];

  it("joins a sub-heading to its trunk, and ends the trunk at the last one", () => {
    assert.deepEqual(
      items.map((_, index) => branchOf(items, index)),
      [undefined, "mid", "last", undefined, "last"]
    );
  });
});
