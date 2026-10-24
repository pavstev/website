import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { type ChartData } from "./chart-data.ts";
import {
  barRows,
  fractionOf,
  lineLayout,
  type MeterRow,
  pairRows,
} from "./chart-layout.ts";

const meters = (rows: ReturnType<typeof barRows>): MeterRow[] =>
  rows.filter((row): row is MeterRow => row.kind === "meter");

const zeros: ChartData = {
  series: [{ name: "a", values: [0, 0, 0] }],
  unit: "ms",
  x: ["a", "b", "c"],
};

describe("barRows", () => {
  it("draws no bar for an all-zero chart", () => {
    assert.deepEqual(
      meters(barRows(zeros)).map((row) => row.fraction),
      [0, 0, 0]
    );
  });

  it("keeps a tiny value visible next to a huge one", () => {
    const rows = meters(
      barRows({
        series: [{ name: "a", values: [0.5, 9000] }],
        unit: "",
        x: ["small", "big"],
      })
    );
    assert.deepEqual(
      rows.map((row) => row.fraction),
      [0.01, 1]
    );
  });

  it("groups several series under one head per x label", () => {
    const rows = barRows({
      series: [
        { name: "Opus", values: [3, 4] },
        { name: "Sonnet", values: [1, 2] },
      ],
      unit: "",
      x: ["Mon", "Tue"],
    });
    assert.deepEqual(
      rows.map((row) => row.kind),
      ["head", "meter", "meter", "head", "meter", "meter"]
    );
    assert.equal(new Set(rows.map((row) => row.key)).size, rows.length);
  });
});

describe("pairRows", () => {
  it("puts the change in the head and the before bar in gray", () => {
    const rows = pairRows({
      series: [{ name: "Long tasks", values: [955, 67] }],
      unit: "ms",
      x: ["Before", "After"],
    });
    assert.equal(rows[0]?.kind === "head" && rows[0].aside, "\u{2212}93%");
    const [before, after] = meters(rows);
    assert.equal(before?.tone, "before");
    assert.equal(after?.tone, 0);
  });
});

describe("lineLayout", () => {
  it("centers a single x label", () => {
    const layout = lineLayout({
      series: [{ name: "a", values: [5] }],
      unit: "",
      x: ["only"],
    });
    assert.deepEqual(
      layout.series[0]?.points.map((point) => point.x),
      [0.5]
    );
    assert.deepEqual(layout.xLabels, [
      { anchor: "middle", label: "only", x: 0.5 },
    ]);
  });

  it("keeps an all-zero line on the base line", () => {
    const layout = lineLayout(zeros);
    const ys = new Set(layout.series[0]?.points.map((point) => point.y));
    assert.deepEqual([...ys], [layout.bottom]);
    assert.deepEqual(
      layout.ticks.map((tick) => tick.value),
      [0, 1]
    );
  });

  it("names each series in its end label and gives it its own dash", () => {
    const layout = lineLayout({
      series: [
        { name: "Planned", values: [10, 60] },
        { name: "Shipped", values: [6, 62] },
      ],
      unit: "%",
      x: ["Week 1", "Week 2"],
    });
    assert.deepEqual(
      layout.series.map((series) => series.end.text),
      ["Planned 60%", "Shipped 62%"]
    );
    const [first, second] = layout.series;
    assert.notEqual(first?.dash, second?.dash);
    assert.ok(Math.abs((first?.end.y ?? 0) - (second?.end.y ?? 0)) >= 15);
  });

  it("scales mixed magnitudes to one nice top", () => {
    const layout = lineLayout({
      series: [{ name: "a", values: [0.2, 955] }],
      unit: "ms",
      x: ["a", "b"],
    });
    assert.equal(layout.ticks.at(-1)?.value, 1000);
    assert.equal(layout.ticks.at(-1)?.label, "1,000");
    assert.equal(layout.unit, "ms");
    assert.ok(layout.gutter >= 5 * 7);
  });

  it("keeps the unit on percent ticks", () => {
    const layout = lineLayout({
      series: [{ name: "a", values: [10, 60] }],
      unit: "%",
      x: ["a", "b"],
    });
    assert.equal(layout.ticks.at(-1)?.label, "60%");
    assert.equal(layout.unit, "");
  });

  it("puts the highest end label above its line and the lowest below", () => {
    const layout = lineLayout({
      series: [
        { name: "Context", values: [338, 967, 622, 342, 836, 359] },
        { name: "Hand-off line", values: [300, 300, 300, 300, 300, 300] },
      ],
      unit: "K tokens",
      x: ["1", "2", "3", "4", "5", "6"],
    });
    const [context, handOff] = layout.series;
    const contextY = context?.points.at(-1)?.y ?? 0;
    const handOffY = handOff?.points.at(-1)?.y ?? 0;
    assert.deepEqual(context?.end.lines, ["Context", "359\u{A0}K tokens"]);
    const tailTop = Math.min(
      ...(context?.points ?? [])
        .filter((point) => point.x >= 0.7)
        .map((point) => point.y)
    );
    assert.ok((context?.end.y ?? 0) + 14 < Math.min(contextY, tailTop));
    assert.ok((handOff?.end.y ?? 0) - 12 > handOffY);
  });
});

describe("fractionOf", () => {
  it("is zero for zero values and a zero maximum", () => {
    assert.equal(fractionOf(0, 10), 0);
    assert.equal(fractionOf(5, 0), 0);
  });
});
