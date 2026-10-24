import { HtmlValidate } from "html-validate";

import type { Check } from "./types.ts";

import { baselineMetrics, fetchText, newResult, note } from "./lib.ts";

const validator = new HtmlValidate({
  extends: ["html-validate:recommended"],
  rules: {
    "aria-label-misuse": "off",
    "attr-case": "off",
    "attribute-boolean-style": "off",
    "attribute-empty-style": "off",
    "doctype-style": "off",
    "long-title": "off",
    "no-inline-style": "off",
    "no-raw-characters": "off",
    "no-redundant-role": "off",
    "no-trailing-whitespace": "off",
    "prefer-native-element": "off",
    "script-type": "off",
    "valid-id": ["error", { relaxed: true }],
    "void-style": "off",
    "wcag/h30": "off",
  },
});

const check: Check = async (context) => {
  const result = newResult("html");
  const byRule = new Map<string, string[]>();
  let total = 0;
  for (const page of context.pages) {
    const { body } = await fetchText(page.url);
    const report = await validator.validateString(body, page.path);
    const messages = report.results
      .flatMap((entry) => entry.messages)
      .filter((message) => message.severity === 2);
    total += messages.length;
    for (const message of messages) {
      const selector = message.selector ? ` (${message.selector})` : "";
      const list = byRule.get(message.ruleId) ?? [];
      list.push(
        `${page.path}:${String(message.line)} ${message.message}${selector}`
      );
      byRule.set(message.ruleId, list);
    }
  }
  const old = baselineMetrics(context, "html");
  const rules = byRule
    .entries()
    .toArray()
    .toSorted((a, b) => b[1].length - a[1].length);
  for (const [rule, list] of rules) {
    const isNew = context.baseline && !Object.hasOwn(old, `rule_${rule}`);
    note(
      result,
      isNew ? "fail" : "warn",
      `${rule} x${String(list.length)}${isNew ? " (new since the baseline)" : ""}`
    );
    for (const line of list.slice(0, 4)) result.lines.push(`       ${line}`);
    result.metrics[`rule_${rule}`] = list.length;
  }
  result.metrics["errors"] = total;
  const count = String(context.pages.length);
  result.summary = total
    ? `${String(total)} markup errors in ${String(byRule.size)} rules over ${count} pages`
    : `no markup errors on ${count} pages`;
  return result;
};

export default check;
