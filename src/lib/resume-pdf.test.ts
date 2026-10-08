import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { inflateSync } from "node:zlib";

import { servedCv } from "./cv-sample.ts";
import { type Cv, cvSchema } from "./cv.ts";
import { en } from "./i18n.ts";
import { renderResumePdf } from "./resume-pdf.ts";

interface PdfObject {
  dictionary: string;
  stream: string;
}

const sample = cvSchema.parse(servedCv);

const withCv = (overrides: Record<string, unknown>): Cv =>
  cvSchema.parse({ ...servedCv, ...overrides });

const pixel = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);

const latin1 = (pdf: Uint8Array): string => Buffer.from(pdf).toString("latin1");

const readObjects = (pdf: Uint8Array): Map<string, PdfObject> => {
  const raw = Buffer.from(pdf);
  const text = raw.toString("latin1");
  const objects = new Map<string, PdfObject>();
  for (const match of text.matchAll(/^(\d+) 0 obj\r?\n/gm)) {
    const bodyStart = match.index + match[0].length;
    const body = text.slice(bodyStart, text.indexOf("endobj", bodyStart));
    const marker = /(?<!end)stream\r?\n/.exec(body);
    if (marker === null) {
      objects.set(match[1] ?? "", { dictionary: body, stream: "" });
      continue;
    }
    const dataStart = bodyStart + marker.index + marker[0].length;
    const data = raw.subarray(dataStart, text.indexOf("endstream", dataStart));
    const dictionary = body.slice(0, marker.index);
    objects.set(match[1] ?? "", {
      dictionary,
      stream: (dictionary.includes("/FlateDecode")
        ? inflateSync(data)
        : data
      ).toString("latin1"),
    });
  }
  return objects;
};

const codesOf = (hex: string): string[] => hex.match(/.{4}/g) ?? [];

const glyphMap = (cmap: string): Map<number, string> => {
  const glyphs = new Map<number, string>();
  for (const range of cmap.matchAll(
    /<([\da-f]{4})>\s*<[\da-f]{4}>\s*\[([^\]]*)\]/g
  )) {
    const first = Number.parseInt(range[1] ?? "", 16);
    const entries = (range[2] ?? "").matchAll(/<[\da-f]+>/g).toArray();
    for (const [offset, entry] of entries.entries()) {
      const characters = codesOf(entry[0].slice(1, -1)).map((code) =>
        String.fromCodePoint(Number.parseInt(code, 16))
      );
      glyphs.set(first + offset, characters.join(""));
    }
  }
  return glyphs;
};

const textOf = (pdf: Uint8Array): string => {
  const objects = readObjects(pdf);
  const fonts = new Map<string, Map<number, string>>();
  for (const { dictionary } of objects.values()) {
    for (const font of dictionary.matchAll(/\/(F\d+) (\d+) 0 R/g)) {
      const cmap = /\/ToUnicode (\d+) 0 R/.exec(
        objects.get(font[2] ?? "")?.dictionary ?? ""
      )?.[1];
      if (cmap !== undefined) {
        fonts.set(font[1] ?? "", glyphMap(objects.get(cmap)?.stream ?? ""));
      }
    }
  }
  const runs: string[] = [];
  for (const { stream } of objects.values()) {
    let glyphs = new Map<number, string>();
    for (const operation of stream.matchAll(
      /\/(F\d+) [\d.]+ Tf|\[([^\]]*)\]\s*TJ/g
    )) {
      if (operation[1] !== undefined) {
        glyphs = fonts.get(operation[1]) ?? new Map<number, string>();
        continue;
      }
      const strings = (operation[2] ?? "").matchAll(/<([\da-f]+)>/g);
      const characters = strings
        .flatMap((string) => codesOf(string[1] ?? ""))
        .map((code) => glyphs.get(Number.parseInt(code, 16)) ?? "");
      runs.push(characters.toArray().join(""));
    }
  }
  return runs.join(" ").replaceAll(/\s+/g, " ");
};

const linksOf = (pdf: Uint8Array): string[] =>
  latin1(pdf)
    .matchAll(/\/URI \(([^)]*)\)/g)
    .map((match) => match[1] ?? "")
    .toArray();

describe("renderResumePdf", () => {
  it("starts with %PDF", async () => {
    const pdf = await renderResumePdf(sample, null);
    assert.equal(latin1(pdf).slice(0, 5), "%PDF-");
  });

  it("has at least one page", async () => {
    const pdf = await renderResumePdf(sample, null);
    assert.match(latin1(pdf), /\/Type\s*\/Page(?![A-Za-z])/);
  });

  it("prints the page number and the page count", async () => {
    const pdf = await renderResumePdf(sample, null);
    assert.ok(
      textOf(pdf).includes(
        en.resumePdf.page.replace("{page}", "1").replace("{pages}", "1")
      )
    );
  });

  it("keeps ć", async () => {
    const pdf = await renderResumePdf(
      withCv({ basics: { name: "Ana Petrović" } }),
      null
    );
    const maps = readObjects(pdf)
      .values()
      .map((object) => object.stream)
      .filter((stream) => stream.includes("beginbfrange"));
    assert.ok(maps.some((map) => map.includes("<0107>")));
    assert.ok(textOf(pdf).includes("ć"));
  });

  it("renders with no photo", async () => {
    const pdf = await renderResumePdf(sample, null);
    assert.equal(latin1(pdf).slice(0, 5), "%PDF-");
    assert.ok(!latin1(pdf).includes("/Subtype /Image"));
  });

  it("draws a photo it can read", async () => {
    const pdf = await renderResumePdf(sample, pixel);
    assert.ok(latin1(pdf).includes("/Subtype /Image"));
  });

  it("leaves out a photo it cannot read", async () => {
    const pdf = await renderResumePdf(sample, Buffer.from("not an image"));
    assert.equal(latin1(pdf).slice(0, 5), "%PDF-");
    assert.ok(!latin1(pdf).includes("/Subtype /Image"));
  });

  it("skips an empty Projects section", async () => {
    const without = textOf(
      await renderResumePdf(withCv({ projects: { items: [] } }), null)
    );
    const included = textOf(await renderResumePdf(sample, null));
    assert.ok(included.includes(en.resumePdf.projects.toUpperCase()));
    assert.ok(without.includes(en.resumePdf.experience.toUpperCase()));
    assert.ok(!without.includes(en.resumePdf.projects.toUpperCase()));
  });

  it("skips every empty section", async () => {
    const pdf = await renderResumePdf(
      withCv({
        experience: { items: [] },
        projects: { items: [] },
        summary: "  ",
      }),
      null
    );
    const text = textOf(pdf);
    for (const heading of [
      en.resumePdf.education,
      en.resumePdf.experience,
      en.resumePdf.languages,
      en.resumePdf.projects,
      en.resumePdf.skills,
      en.resumePdf.summary,
    ]) {
      assert.ok(!text.includes(heading.toUpperCase()));
    }
  });

  it("links only http(s) addresses", async () => {
    const pdf = await renderResumePdf(
      withCv({
        basics: {
          email: "ada@example.com",
          name: "Ada Example",
          websiteUrl: "javascript:alert(1)",
        },
        education: {
          items: [
            { degree: "BSc", school: "Uni", websiteUrl: "ftp://example.com/u" },
          ],
        },
        experience: {
          items: [
            {
              company: "Example",
              position: "Lead",
              websiteUrl: "data:text/html,x",
            },
            {
              company: "Other",
              position: "Dev",
              websiteUrl: "https://example.com/o",
            },
          ],
        },
        projects: {
          items: [{ name: "Ledger", websiteUrl: "https://example.com/l" }],
        },
      }),
      null
    );
    assert.deepEqual(
      linksOf(pdf).toSorted((a, b) => a.localeCompare(b)),
      [
        "https://example.com/l",
        "https://example.com/o",
        "mailto:ada@example.com",
      ]
    );
    assert.ok(textOf(pdf).includes("Example"));
  });

  it("never prints a phone number or links one", async () => {
    const pdf = await renderResumePdf(
      withCv({
        basics: {
          email: "ada@example.com",
          name: "Ada Example",
          phone: "+1 202 555 0123",
        },
      }),
      null
    );
    const text = textOf(pdf);
    assert.ok(text.includes("ada@example.com"));
    assert.ok(!text.includes("202 555"));
    assert.ok(!text.includes("555 0123"));
    assert.ok(!latin1(pdf).includes("tel:"));
    assert.ok(linksOf(pdf).includes("mailto:ada@example.com"));
    assert.ok(linksOf(pdf).every((link) => !link.startsWith("tel:")));
  });

  it("prints the profile address labels from en.resumePdf", async () => {
    const pdf = await renderResumePdf(
      withCv({
        basics: {
          githubHandle: "ada",
          linkedinHandle: "ada-example",
          name: "Ada Example",
        },
      }),
      null
    );
    const text = textOf(pdf);
    assert.ok(text.includes(`${en.resumePdf.linkedinPrefix}ada-example`));
    assert.ok(text.includes(`${en.resumePdf.githubPrefix}ada`));
    assert.ok(linksOf(pdf).includes("https://github.com/ada"));
    assert.ok(
      linksOf(pdf).includes("https://www.linkedin.com/in/ada-example/")
    );
  });

  it("prints the length of a period in whole years and months", async () => {
    const pdf = await renderResumePdf(
      withCv({
        experience: {
          items: [
            {
              company: "Example",
              from: "Jan 2020",
              position: "Lead",
              to: "Mar 2021",
            },
          ],
        },
      }),
      null
    );
    const text = textOf(pdf);
    assert.ok(text.includes("Jan 2020 - Mar 2021"));
    assert.ok(text.includes("(1 year 3 months)"));
  });

  it("prints Technology after the bullets of an entry", async () => {
    const pdf = await renderResumePdf(
      withCv({
        experience: {
          items: [
            {
              company: "Example",
              contributions: [{ description: "Shipped it.", title: "Ledger" }],
              position: "Lead",
              skills: ["Node.js", "Redis"],
            },
          ],
        },
      }),
      null
    );
    const text = textOf(pdf);
    assert.ok(text.includes(`${en.resumePdf.technology}: `));
    assert.ok(text.includes("Node.js"));
    assert.ok(text.includes("Shipped it."));
  });
});
