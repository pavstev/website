import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { type ReadmeBase, sanitizeReadme } from "./readme-html.ts";

const base: ReadmeBase = { branch: "main", owner: "pavstev", repo: "sapat" };

const clean = (html: string): string => sanitizeReadme(html, base);

const raw = "https://raw.githubusercontent.com/pavstev/sapat/main/";

const blob = "https://github.com/pavstev/sapat/blob/main/";

describe("sanitizeReadme", () => {
  it("removes a script tag and keeps the paragraph after it", () => {
    assert.equal(clean("<script>alert(1)</script><p>kept</p>"), "<p>kept</p>");
  });

  it("keeps an img without its onerror attribute", () => {
    const out = clean('<img src="x" onerror="alert(1)">');
    assert.ok(out.startsWith("<img"));
    assert.ok(!out.includes("onerror"));
  });

  it("keeps the text of a javascript: link and drops the href", () => {
    assert.equal(clean('<a href="javascript:alert(1)">x</a>'), "<a>x</a>");
  });

  it("drops the first h1 and keeps a later h2", () => {
    assert.equal(
      clean("<h1>Title</h1><h2>Second</h2><p>body</p>"),
      "<h2>Second</h2><p>body</p>"
    );
  });

  it("drops a shields badge and rewrites a relative image to the raw URL", () => {
    const out = clean(
      '<img src="https://img.shields.io/npm/v/x"><img src="src/logo.svg" alt="logo">'
    );
    assert.ok(!out.includes("shields.io"));
    assert.ok(out.includes(`src="${raw}src/logo.svg"`));
  });

  it("rewrites a relative link to the blob URL", () => {
    assert.ok(
      clean('<a href="docs/guide.md">g</a>').includes(
        `href="${blob}docs/guide.md"`
      )
    );
  });

  it("adds rel and target to an external link", () => {
    const out = clean('<a href="https://example.com">e</a>');
    assert.ok(out.includes('rel="noopener noreferrer"'));
    assert.ok(out.includes('target="_blank"'));
    assert.ok(out.includes('href="https://example.com"'));
  });

  it("removes align from a paragraph", () => {
    assert.equal(clean('<p align="center">x</p>'), "<p>x</p>");
  });
});

describe("sanitizeReadme attacks", () => {
  it("removes data:, vbscript: and blob: URLs from links and images", () => {
    const out = clean(
      [
        '<a href="data:text/html,<script>alert(1)</script>">a</a>',
        '<a href="vbscript:msgbox(1)">b</a>',
        '<img src="data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=">',
        '<img src="javascript:alert(1)">',
        '<a href="blob:https://example.com/1">c</a>',
        '<img src="blob:https://example.com/2">',
      ].join("")
    );
    assert.ok(!out.includes("data:"));
    assert.ok(!out.includes("vbscript"));
    assert.ok(!out.includes("javascript"));
    assert.ok(!out.includes("blob:"));
    assert.ok(!out.includes("<img"));
  });

  it("removes javascript: schemes hidden by case, whitespace, control characters and entities", () => {
    const out = clean(
      [
        '<a href="JaVaScRiPt:alert(1)">a</a>',
        '<a href="  javascript:alert(1)">b</a>',
        '<a href="java\tscript:alert(1)">c</a>',
        '<a href="java&#x0A;script:alert(1)">d</a>',
        '<a href="&#106;avascript:alert(1)">e</a>',
        '<a href="\u{1}javascript:alert(1)">f</a>',
        '<a href="javascript&colon;alert(1)">g</a>',
      ].join("")
    );
    assert.ok(!out.toLowerCase().includes("javascript"));
    assert.ok(!/href="[^"]*script/i.test(out));
  });

  it("strips svg and math payloads", () => {
    const out = clean(
      '<svg onload="alert(1)"><script>alert(2)</script><a href="javascript:alert(3)"><text>t</text></a></svg><math><mtext><style><img src=x onerror=alert(4)></style></mtext></math><p>ok</p>'
    );
    assert.ok(!out.includes("<svg"));
    assert.ok(!out.includes("<math"));
    assert.ok(!out.includes("<style"));
    assert.ok(!out.includes("<script"));
    assert.ok(!out.includes("onerror="));
    assert.ok(!out.includes("onload"));
    assert.ok(!out.includes("javascript"));
    assert.ok(out.includes("<p>ok</p>"));
  });

  it("removes srcset, style, class, id and event handlers", () => {
    const out = clean(
      '<img src="a.png" srcset="javascript:alert(1) 1x" style="x:y" class="c" id="i" onclick="a()" loading="lazy"><picture><source srcset="b.png"><img src="c.png"></picture>'
    );
    assert.ok(!out.includes("srcset"));
    assert.ok(!out.includes("source"));
    assert.ok(!out.includes("picture"));
    assert.ok(!out.includes("style"));
    assert.ok(!out.includes("class"));
    assert.ok(!out.includes("id="));
    assert.ok(!out.includes("onclick"));
    assert.ok(!out.includes("loading"));
  });

  it("treats a protocol-relative URL as external, not as a repo path", () => {
    const out = clean(
      String.raw`<a href="//evil.example/x">a</a><img src="//evil.example/p.png"><a href="/\evil.example/y">b</a>`
    );
    assert.ok(!out.includes(`${blob}/`));
    assert.ok(!out.includes(`${raw}/`));
    assert.ok(!out.includes('href="//'));
    assert.ok(!out.includes('src="//'));
    assert.ok(out.includes('href="https://evil.example/x"'));
    assert.ok(out.includes('rel="noopener noreferrer"'));
    assert.ok(!out.includes("<img"));
  });

  it("leaves anchors and mailto links alone", () => {
    const out = clean('<a href="#install">i</a><a href="mailto:a@b.co">m</a>');
    assert.ok(out.includes('href="#install"'));
    assert.ok(out.includes('href="mailto:a@b.co"'));
    assert.ok(!out.includes("github.com"));
    assert.ok(!out.includes("target="));
    assert.ok(!out.includes("rel="));
  });

  it("drops a relative path that climbs out of the repo", () => {
    const out = clean(
      '<a href="../../../other/repo/blob/main/x">a</a><img src="../../../../evil/repo/main/x.png"><a href="docs/../../../x">b</a>'
    );
    assert.ok(!out.includes("href="));
    assert.ok(!out.includes("<img"));
  });

  it("removes author-set target and rel from non-external links", () => {
    const out = clean('<a href="#x" target="_top" rel="opener">x</a>');
    assert.equal(out, '<a href="#x">x</a>');
  });

  it("keeps only disabled checkboxes and drops other input types", () => {
    const out = clean(
      '<input type="checkbox" checked onclick="a()"><input type="image" src="x.png"><input type="text" value="v"><input type="submit"><input>'
    );
    assert.equal(out, '<input checked disabled type="checkbox" />');
  });

  it("escapes markup that is not allowed instead of passing it through", () => {
    const out = clean(
      '<iframe src="https://evil.example"></iframe><object data="x"></object><embed src="x"><form action="/x"><button>b</button></form><base href="https://evil.example/"><meta http-equiv="refresh" content="0"><link rel="stylesheet" href="x"><textarea><script>alert(1)</script></textarea>'
    );
    assert.ok(
      !/<(?:iframe|object|embed|form|base|meta|link|textarea|script)/i.test(out)
    );
  });

  it("resolves relative paths against a branch name that contains a slash", () => {
    const out = sanitizeReadme('<a href="./a b/c.md?x=1#h">a</a>', {
      branch: "feat/x",
      owner: "o",
      repo: "r",
    });
    assert.ok(
      out.includes('href="https://github.com/o/r/blob/feat/x/a%20b/c.md?x=1#h"')
    );
  });

  it("drops images from the other badge hosts", () => {
    const out = clean(
      '<img src="https://badge.fury.io/js/x.svg"><img src="https://shields.io/badge/a-b-c"><img src="https://IMG.SHIELDS.IO/x"><p>k</p>'
    );
    assert.equal(out, "<p>k</p>");
  });

  it("drops a proxied badge by its data-canonical-src", () => {
    const out = clean(
      '<p><img src="https://camo.githubusercontent.com/abc" data-canonical-src="https://img.shields.io/x" alt="b">k</p>'
    );
    assert.equal(out, "<p>k</p>");
  });

  it("keeps a proxied image that is not a badge", () => {
    const out = clean(
      '<img src="https://camo.githubusercontent.com/abc" data-canonical-src="https://example.com/shot.png" alt="s">'
    );
    assert.ok(out.includes('src="https://camo.githubusercontent.com/abc"'));
    assert.ok(!out.includes("data-canonical-src"));
  });

  it("drops an empty link left behind by a dropped badge", () => {
    const out = clean(
      '<a href="https://example.com"><img src="https://camo.githubusercontent.com/abc" data-canonical-src="https://img.shields.io/x"></a><p>k</p>'
    );
    assert.equal(out, "<p>k</p>");
  });

  it("keeps a link whose only content is a surviving image or text", () => {
    const out = clean(
      '<a href="https://example.com"><img src="https://camo.githubusercontent.com/abc" alt="a"></a><a href="https://example.com/2">t</a>'
    );
    assert.equal(out.match(/<a /g)?.length, 2);
  });

  it("drops a link that holds only whitespace", () => {
    assert.equal(clean('<a href="#x"> </a><p>k</p>'), "<p>k</p>");
  });

  it("allows images only from GitHub hosts", () => {
    const out = clean(
      [
        '<img src="https://evil.example/t.gif">',
        `<img src="${["http", "raw.githubusercontent.com/o/r/main/a.png"].join("://")}">`,
        '<img src="https://github.com/o/r/raw/main/a.png">',
        '<img src="https://github.com/user-attachments/assets/abc">',
        '<img src="https://user-images.githubusercontent.com/1/a.png">',
        '<img src="https://private-user-images.githubusercontent.com/1/a.png">',
        '<img src="https://raw.githubusercontent.com/o/r/main/b.png">',
        '<img src="https://camo.githubusercontent.com/abc">',
      ].join("")
    );
    assert.equal(out.match(/<img /g)?.length, 5);
    assert.ok(!out.includes("evil.example"));
    assert.ok(!out.includes("http://"));
    assert.ok(!out.includes("github.com/o/r/raw"));
  });

  it("normalizes whitespace around a URL before classifying it", () => {
    const out = clean(
      '<a href="  https://example.com/a">a</a><a href="\thttps://example.com/b\n">b</a><a href="ht tps://example.com">c</a>'
    );
    assert.equal(out.match(/rel="noopener noreferrer"/g)?.length, 2);
    assert.ok(out.includes('href="https://example.com/a"'));
    assert.ok(out.includes('href="https://example.com/b"'));
    assert.ok(!out.includes("ht tps"));
  });

  it("removes landmark elements but keeps their content", () => {
    const out = clean(
      "<main><nav>n</nav><header>h</header><section><aside>a</aside></section><footer>f</footer></main>"
    );
    assert.equal(out, "nhaf");
  });

  it("keeps a link around an image nested in picture, span or p", () => {
    const img =
      '<img src="https://raw.githubusercontent.com/o/r/main/l.png" alt="l">';
    const out = clean(
      [
        `<a href="https://x.example/1"><picture><source srcset="a.png">${img}</picture></a>`,
        `<a href="https://x.example/2"><span>${img}</span></a>`,
        `<a href="https://x.example/3"><p>${img}</p></a>`,
      ].join("")
    );
    assert.equal(out.match(/<a /g)?.length, 3);
    assert.equal(out.match(/<img /g)?.length, 3);
  });

  it("keeps a link whose text sits in a nested element", () => {
    assert.ok(
      clean('<a href="https://x.example"><span><em>t</em></span></a>').includes(
        "<a "
      )
    );
  });

  it("drops a link around a nested dropped badge but keeps a sibling link", () => {
    const badge =
      '<img src="https://camo.githubusercontent.com/abc" data-canonical-src="https://img.shields.io/x">';
    const out = clean(
      `<a href="https://x.example/1"><span>${badge}</span></a><a href="https://x.example/2">t</a>`
    );
    assert.equal(out.match(/<a /g)?.length, 1);
    assert.ok(out.includes("x.example/2"));
  });

  it("recognizes a protocol-relative badge URL in data-canonical-src", () => {
    const out = clean(
      '<img src="https://camo.githubusercontent.com/abc" data-canonical-src="//img.shields.io/x"><p>k</p>'
    );
    assert.equal(out, "<p>k</p>");
  });
});
