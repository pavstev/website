import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { diagramText } from "./diagrams.ts";
import { toFeedHtml, toMarkdown } from "./plain.ts";
import { type PostSource } from "./posts.ts";

const sourceFor = (
  body: string,
  title = "A post",
  dir = "/nowhere"
): PostSource => ({
  body,
  dir,
  meta: {
    date: "2026-10-13",
    description: "About a post.",
    draft: false,
    readingMinutes: 1,
    sky: { phase: "night", weather: "clear" },
    slug: "a-post",
    tags: ["Test"],
    title,
    url: "https://stevanpavlovic.com/blog/a-post",
    wordCount: 3,
  },
  slug: "a-post",
});

describe("toMarkdown", () => {
  it("starts with the title, the URL and the date", () => {
    const markdown = toMarkdown(sourceFor("Hello."));
    assert.ok(markdown.startsWith("# A post\n"));
    assert.ok(markdown.includes("https://stevanpavlovic.com/blog/a-post"));
    assert.ok(markdown.includes("2026-10-13"));
    assert.ok(markdown.trimEnd().endsWith("Hello."));
  });

  it("turns a Note into a blockquote", () => {
    const markdown = toMarkdown(sourceFor("<Note>Hi & bye</Note>"));
    assert.ok(markdown.includes("> Hi & bye"));
    assert.ok(!markdown.includes("<Note"));
  });

  it("turns a multi-line Note into a quoted block", () => {
    const markdown = toMarkdown(
      sourceFor("<Note>\n  First line.\n\n  Second **line**.\n</Note>")
    );
    assert.ok(markdown.includes("> First line.\n>\n> Second **line**."));
  });

  it("turns a Figure into an absolute image and an italic caption", () => {
    const markdown = toMarkdown(
      sourceFor('<Figure src="./sky.png" alt="The sky" caption="At night" />')
    );
    assert.ok(
      markdown.includes(
        "![The sky](https://stevanpavlovic.com/blog-media/a-post/sky.png)"
      )
    );
    assert.ok(markdown.includes("*At night*"));
  });

  it("makes a relative Markdown image absolute", () => {
    const markdown = toMarkdown(sourceFor("![A photo](./photo.png)"));
    assert.ok(
      markdown.includes(
        "![A photo](https://stevanpavlovic.com/blog-media/a-post/photo.png)"
      )
    );
  });

  it("makes relative links absolute and keeps absolute ones", () => {
    const markdown = toMarkdown(
      sourceFor(
        [
          "See [the other post](/blog/other) and [a **section**](#notes).",
          "",
          "Also [this site](https://example.com/a) and https://example.com/b too.",
          "",
          "[ref]: /blog/third",
        ].join("\n")
      )
    );
    assert.ok(
      markdown.includes(
        "[the other post](https://stevanpavlovic.com/blog/other)"
      )
    );
    assert.ok(
      markdown.includes(
        "[a **section**](https://stevanpavlovic.com/blog/a-post#notes)"
      )
    );
    assert.ok(markdown.includes("[this site](https://example.com/a)"));
    assert.ok(markdown.includes("and https://example.com/b too."));
    assert.ok(
      markdown.includes("[ref]: https://stevanpavlovic.com/blog/third")
    );
  });

  it("turns a Diagram into its caption and its description", () => {
    const markdown = toMarkdown(
      sourceFor('<Diagram name="work-loop" caption="How a change ships" />')
    );
    assert.ok(markdown.includes("How a change ships"));
    assert.ok(markdown.includes(diagramText("work-loop")));
    assert.ok(!markdown.includes("<Diagram"));
  });

  it("fails on an unknown diagram or chart type", () => {
    assert.throws(
      () => toMarkdown(sourceFor('<Diagram name="nope" caption="x" />')),
      /Unknown diagram/
    );
    assert.throws(
      () =>
        toMarkdown(
          sourceFor(
            '<Chart type="pie" src="data/a.json" title="t" caption="c" />'
          )
        ),
      /unknown chart type/
    );
  });

  it("turns a Chart into its caption and its data as a list", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "blog-plain-"));
    mkdirSync(path.join(dir, "data"));
    writeFileSync(
      path.join(dir, "data", "runs.json"),
      JSON.stringify({
        series: [{ name: "Hours", values: [4, 10] }],
        unit: "h",
        x: ["Monday", "Tuesday"],
      })
    );
    const markdown = toMarkdown(
      sourceFor(
        '<Chart type="bar" src="data/runs.json" title="Runs" caption="Hours per day" />',
        "A post",
        dir
      )
    );
    assert.ok(markdown.includes("Hours per day"));
    assert.ok(markdown.includes("- Monday: 4\u{A0}h"));
    assert.ok(markdown.includes("- Tuesday: 10\u{A0}h"));
  });

  it("keeps code blocks untouched", () => {
    const body = "```tsx\nconst a = <Note>x</Note>;\n```";
    assert.ok(toMarkdown(sourceFor(body)).includes(body));
  });
});

describe("toFeedHtml", () => {
  it("renders the fallbacks to HTML with absolute URLs", () => {
    const html = toFeedHtml(
      sourceFor(
        "See [the blog](/blog) and [a note](#notes).\n\n![A photo](./photo.png)\n\n<Note>Hi & bye</Note>"
      )
    );
    assert.ok(html.includes('href="https://stevanpavlovic.com/blog"'));
    assert.ok(
      html.includes('href="https://stevanpavlovic.com/blog/a-post#notes"')
    );
    assert.ok(
      html.includes(
        'src="https://stevanpavlovic.com/blog-media/a-post/photo.png"'
      )
    );
    assert.ok(html.includes("<blockquote>"));
    assert.ok(html.includes("Hi &#x26; bye") || html.includes("Hi &amp; bye"));
  });

  it("keeps a title and text with ]]> safe for CDATA", () => {
    const source = sourceFor("Close ]]> it.", "Odd ]]> & <title>");
    assert.ok(toMarkdown(source).startsWith("# Odd ]]> & <title>\n"));
    const html = toFeedHtml(source);
    assert.ok(!html.includes("]]>"));
    assert.ok(html.includes("]]&#x3E;") || html.includes("]]&gt;"));
  });

  it("renders footnotes", () => {
    const html = toFeedHtml(sourceFor("A claim.[^1]\n\n[^1]: The source."));
    assert.ok(html.includes("The source."));
    assert.ok(html.includes("https://stevanpavlovic.com/blog/a-post#"));
  });
});
