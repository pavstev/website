import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import {
  chartId,
  chartLines,
  formatValue,
  niceTicks,
  pairChange,
  parseChartData,
  readChartFile,
  spreadLabels,
  tickLabels,
} from "./chart-data.ts";

const sample = {
  series: [{ name: "Long tasks", values: [955, 67] }],
  unit: "ms",
  x: ["three.js", "raw WebGL"],
};

const withSeries = (count: number): unknown => ({
  ...sample,
  series: Array.from({ length: count }, (_, index) => ({
    name: `s${String(index)}`,
    values: [1, 2],
  })),
});

describe("niceTicks", () => {
  it("rounds the top up to a nice step", () => {
    assert.deepEqual(niceTicks(37, 4), [0, 10, 20, 30, 40]);
  });

  it("uses 1, 2, 2.5 or 5 times a power of ten", () => {
    assert.deepEqual(niceTicks(955, 4), [0, 250, 500, 750, 1000]);
    assert.deepEqual(niceTicks(7, 4), [0, 2, 4, 6, 8]);
    assert.deepEqual(niceTicks(0.8, 4), [0, 0.2, 0.4, 0.6, 0.8]);
  });

  it("gives a unit scale for a zero or negative maximum", () => {
    assert.deepEqual(niceTicks(0, 4), [0, 1]);
    assert.deepEqual(niceTicks(-3, 4), [0, 1]);
  });
});

describe("parseChartData", () => {
  it("accepts the documented format", () => {
    assert.deepEqual(parseChartData(sample, "bar", "data/a.json"), sample);
  });

  it("fails a series whose length differs from x, naming the file and field", () => {
    const bad = {
      ...sample,
      series: [{ name: "Long tasks", values: [955] }],
    };
    assert.throws(
      () => parseChartData(bad, "bar", "content/blog/x/data/a.json"),
      /content\/blog\/x\/data\/a\.json: series\.0\.values: /
    );
  });

  it("allows one to four series", () => {
    assert.doesNotThrow(() => parseChartData(withSeries(4), "line", "a.json"));
    assert.throws(
      () => parseChartData(withSeries(0), "line", "a.json"),
      /series/
    );
    assert.throws(
      () => parseChartData(withSeries(5), "line", "a.json"),
      /series/
    );
  });

  it("needs exactly two x labels for a pair", () => {
    const three = {
      series: [{ name: "a", values: [1, 2, 3] }],
      unit: "",
      x: ["a", "b", "c"],
    };
    assert.doesNotThrow(() => parseChartData(three, "bar", "a.json"));
    assert.throws(
      () => parseChartData(three, "pair", "a.json"),
      /a\.json: x: /
    );
  });

  it("rejects a repeated x label and a repeated series name", () => {
    assert.throws(
      () => parseChartData({ ...sample, x: ["a", "a"] }, "bar", "a.json"),
      /a\.json: x\.1: repeats the label "a"/
    );
    const names = {
      ...sample,
      series: [
        { name: "a", values: [1, 2] },
        { name: "a", values: [3, 4] },
      ],
    };
    assert.throws(
      () => parseChartData(names, "bar", "a.json"),
      /series\.1\.name: repeats the series name "a"/
    );
  });

  it("rejects negative and non-finite values", () => {
    const negative = { ...sample, series: [{ name: "a", values: [1, -2] }] };
    assert.throws(
      () => parseChartData(negative, "bar", "a.json"),
      /series\.0\.values\.1/
    );
  });
});

describe("readChartFile", () => {
  it("reads a JSON file from the post folder", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "chart-data-"));
    mkdirSync(path.join(dir, "data"), { recursive: true });
    writeFileSync(path.join(dir, "data/speed.json"), JSON.stringify(sample));
    assert.deepEqual(readChartFile(dir, "data/speed.json", "pair"), sample);
  });

  it("refuses paths that leave the post folder", () => {
    assert.throws(
      () => readChartFile("/post", "../other/data.json", "bar"),
      /chart src/
    );
    assert.throws(
      () => readChartFile("/post", "/etc/data.json", "bar"),
      /chart src/
    );
  });
});

describe("formatValue", () => {
  it("joins number and unit, with no space before a percent sign", () => {
    assert.equal(formatValue(955, "ms"), "955\u{A0}ms");
    assert.equal(formatValue(12_400, "tokens"), "12,400\u{A0}tokens");
    assert.equal(formatValue(42.25, "%"), "42.3%");
    assert.equal(formatValue(3, ""), "3");
  });
});

describe("tickLabels", () => {
  it("keeps every label up to six and thins longer axes", () => {
    assert.deepEqual(tickLabels(4), [0, 1, 2, 3]);
    assert.deepEqual(tickLabels(10), [0, 2, 4, 6, 9]);
  });

  it("takes a smaller budget for long labels", () => {
    assert.deepEqual(tickLabels(6, 4), [0, 2, 5]);
  });
});

describe("spreadLabels", () => {
  it("leaves labels that do not touch where they are", () => {
    assert.deepEqual(spreadLabels([40, 10, 80], 15, 0), [40, 10, 80]);
  });

  it("spreads touching labels evenly around where they want to be", () => {
    assert.deepEqual(spreadLabels([50, 52], 15, 0), [43.5, 58.5]);
    assert.deepEqual(spreadLabels([52, 50], 15, 0), [58.5, 43.5]);
  });

  it("never places a label above the minimum", () => {
    assert.deepEqual(spreadLabels([2, 4], 15, 12), [12, 27]);
  });
});

describe("pairChange", () => {
  it("returns the signed change from the first to the second value", () => {
    assert.equal(pairChange(955, 67), "\u{2212}93%");
    assert.equal(pairChange(10, 25), "+150%");
    assert.equal(pairChange(0, 5), "");
  });
});

describe("chartLines", () => {
  it("lists each x label with its values for the plain text copy", () => {
    assert.deepEqual(chartLines(sample), [
      "three.js: 955\u{A0}ms",
      "raw WebGL: 67\u{A0}ms",
    ]);
    assert.deepEqual(
      chartLines({
        series: [
          { name: "Opus", values: [3, 4] },
          { name: "Sonnet", values: [1, 2] },
        ],
        unit: "",
        x: ["Mon", "Tue"],
      }),
      ["Mon: Opus 3, Sonnet 1", "Tue: Opus 4, Sonnet 2"]
    );
  });
});

describe("chartId", () => {
  it("is stable and safe for an id attribute", () => {
    assert.equal(
      chartId("sky-post", {
        src: "data/long-tasks.json",
        title: "Long tasks, three.js vs raw WebGL",
        type: "pair",
      }),
      "chart-sky-post-pair-long-tasks-three-js-vs-raw-webgl-data-long-tasks-json"
    );
  });

  it("differs when one post charts the same file twice", () => {
    const src = "data/long-tasks.json";
    const ids = [
      chartId("sky-post", { src, title: "Long tasks", type: "pair" }),
      chartId("sky-post", { src, title: "Long tasks by run", type: "pair" }),
      chartId("sky-post", { src, title: "Long tasks", type: "bar" }),
    ];
    assert.equal(new Set(ids).size, ids.length);
  });

  it("keeps ids of other posts apart", () => {
    const chart = { src: "data/a.json", title: "A", type: "bar" } as const;
    assert.notEqual(chartId("one", chart), chartId("two", chart));
  });
});
