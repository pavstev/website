import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { servedCv } from "./cv-sample.ts";
import { parseCv } from "./cv.ts";
import {
  buildSnapshot,
  changeTitle,
  diffSnapshots,
  type LinkedinInput,
  parseStateBody,
  renderChanges,
  renderChecklist,
  stateBody,
} from "./linkedin-fields.ts";

const baseCv = parseCv(
  {
    ...servedCv,
    education: {
      items: [
        {
          area: "Software Engineering",
          contributions: [],
          degree: "Bachelor's Degree",
          from: "2016",
          location: "Belgrade",
          overview: "Distributed systems.",
          school: "Example University",
          skills: [],
          to: "2020",
          websiteUrl: "",
        },
      ],
    },
    experience: {
      items: [
        {
          company: "Example",
          contributions: [
            { description: "Led a team of five.", title: "Leadership" },
          ],
          from: "2020",
          location: "Vienna",
          overview: "Built the platform.",
          position: "Lead",
          skills: ["Node.js"],
          to: "",
          websiteUrl: "",
        },
      ],
    },
    languages: {
      items: [{ fluency: "Native speaker", language: "Serbian" }],
    },
    skills: { items: [{ keywords: ["Node.js", "NestJS"], name: "Backend" }] },
  },
  "test"
);

const baseInput: LinkedinInput = {
  cv: baseCv,
  hashes: { cover: "aa", portrait: "bb", portraitJpeg: "cc" },
  person: {
    city: "Vienna",
    country: "Austria",
    githubHandle: "ada",
    name: "Ada Example",
    summary: "Hi! I build quiet systems.",
    title: "Engineer",
    website: "https://example.com",
  },
  products: [
    {
      line: "Scores every job.",
      name: "Hirista",
      period: "2026",
      role: "Founder",
      url: "https://hirista.example",
    },
  ],
};

const changedFields = (input: LinkedinInput): string[] => {
  const before = buildSnapshot(baseInput);
  const after = buildSnapshot(input);
  return diffSnapshots(before, after).map((change) => change.field);
};

describe("buildSnapshot", () => {
  it("gives the same snapshot and key order for the same input", () => {
    const first = buildSnapshot(baseInput);
    const second = buildSnapshot(structuredClone(baseInput));
    assert.equal(JSON.stringify(first), JSON.stringify(second));
  });

  it("lists the fixed fields first, then the résumé and the products", () => {
    assert.deepEqual(Object.keys(buildSnapshot(baseInput).fields), [
      "cover",
      "photo",
      "name",
      "headline",
      "location",
      "website",
      "about",
      "experience:Example",
      "education:Example University",
      "skills:Backend",
      "languages",
      "projects:Ledger",
      "featured:Hirista",
    ]);
  });

  it("never holds the phone", () => {
    const withPhone = {
      ...baseInput,
      cv: { ...baseCv, basics: { ...baseCv.basics, phone: "+43 999 1234" } },
    };
    assert.ok(!JSON.stringify(buildSnapshot(withPhone)).includes("999"));
  });

  it("keeps two stints at one company apart", () => {
    const [first] = baseCv.experience.items;
    assert.ok(first);
    const twice = {
      ...baseInput,
      cv: {
        ...baseCv,
        experience: { items: [first, { ...first, from: "2018", to: "2019" }] },
      },
    };
    const keys = Object.keys(buildSnapshot(twice).fields);
    assert.ok(keys.includes("experience:Example"));
    assert.ok(keys.includes("experience:Example#2"));
  });
});

describe("diffSnapshots", () => {
  it("returns nothing for equal snapshots", () => {
    assert.deepEqual(
      diffSnapshots(buildSnapshot(baseInput), buildSnapshot(baseInput)),
      []
    );
  });

  it("sees a new cover", () => {
    assert.deepEqual(
      changedFields({
        ...baseInput,
        hashes: { ...baseInput.hashes, cover: "zz" },
      }),
      ["cover"]
    );
  });

  it("sees a new profile photo in either file", () => {
    assert.deepEqual(
      changedFields({
        ...baseInput,
        hashes: { ...baseInput.hashes, portrait: "zz" },
      }),
      ["photo"]
    );
    assert.deepEqual(
      changedFields({
        ...baseInput,
        hashes: { ...baseInput.hashes, portraitJpeg: "zz" },
      }),
      ["photo"]
    );
  });

  it("sees a new name, headline, location, website and about", () => {
    const person = { ...baseInput.person };
    assert.deepEqual(
      changedFields({ ...baseInput, person: { ...person, name: "Ada L." } }),
      ["name"]
    );
    assert.deepEqual(
      changedFields({ ...baseInput, person: { ...person, title: "Lead" } }),
      ["headline"]
    );
    assert.deepEqual(
      changedFields({ ...baseInput, person: { ...person, city: "Graz" } }),
      ["location"]
    );
    assert.deepEqual(
      changedFields({
        ...baseInput,
        person: { ...person, website: "https://example.org" },
      }),
      ["website"]
    );
    assert.deepEqual(
      changedFields({ ...baseInput, person: { ...person, summary: "New." } }),
      ["about"]
    );
  });

  it("sees a changed experience, education, skill, language and project", () => {
    const [job] = baseCv.experience.items;
    const [school] = baseCv.education.items;
    const [group] = baseCv.skills.items;
    const [project] = baseCv.projects.items;
    assert.ok(job && school && group && project);
    const withCv = (cv: Partial<typeof baseCv>): LinkedinInput => ({
      ...baseInput,
      cv: { ...baseCv, ...cv },
    });
    assert.deepEqual(
      changedFields(
        withCv({
          experience: { items: [{ ...job, position: "Principal" }] },
        })
      ),
      ["experience:Example"]
    );
    assert.deepEqual(
      changedFields(
        withCv({ education: { items: [{ ...school, to: "2021" }] } })
      ),
      ["education:Example University"]
    );
    assert.deepEqual(
      changedFields(
        withCv({
          skills: { items: [{ ...group, keywords: ["Node.js", "Go"] }] },
        })
      ),
      ["skills:Backend"]
    );
    assert.deepEqual(
      changedFields(
        withCv({
          languages: {
            items: [{ fluency: "Fluent", language: "Serbian" }],
          },
        })
      ),
      ["languages"]
    );
    assert.deepEqual(
      changedFields(
        withCv({
          projects: { items: [{ ...project, overview: "Moved to Go." }] },
        })
      ),
      ["projects:Ledger"]
    );
  });

  it("sees a changed product", () => {
    const [product] = baseInput.products;
    assert.ok(product);
    assert.deepEqual(
      changedFields({
        ...baseInput,
        products: [{ ...product, line: "Scores every job twice." }],
      }),
      ["featured:Hirista"]
    );
  });

  it("reports an added item with no before and a removed one with no after", () => {
    const added = diffSnapshots(
      buildSnapshot({ ...baseInput, products: [] }),
      buildSnapshot(baseInput)
    );
    assert.equal(added.length, 1);
    assert.equal(added[0]?.before, null);
    assert.ok(added[0]?.after?.includes("Hirista"));
    const removed = diffSnapshots(
      buildSnapshot(baseInput),
      buildSnapshot({ ...baseInput, products: [] })
    );
    assert.equal(removed.length, 1);
    assert.equal(removed[0]?.after, null);
    assert.ok(removed[0]?.before?.includes("Hirista"));
  });

  it("names the place to click for each change", () => {
    const [change] = diffSnapshots(
      buildSnapshot(baseInput),
      buildSnapshot({
        ...baseInput,
        hashes: { ...baseInput.hashes, cover: "zz" },
      })
    );
    assert.ok(change?.linkedinPlace.includes("cover"));
  });
});

describe("renderChanges", () => {
  const longAbout = `${"A long sentence about systems. ".repeat(40)}\n\nSecond paragraph with \`code\` and \`\`\`fences\`\`\`.`;
  const changes = diffSnapshots(
    buildSnapshot(baseInput),
    buildSnapshot({
      ...baseInput,
      hashes: { ...baseInput.hashes, cover: "zz" },
      person: { ...baseInput.person, summary: longAbout },
    })
  );
  const body = renderChanges(
    changes,
    new Map([["cover", "Download: https://example.com/cover.png"]]),
    "ada"
  );

  it("mentions the owner", () => {
    assert.ok(body.startsWith("@ada "));
  });

  it("shows a long text in full inside a fence longer than any backtick run", () => {
    assert.ok(body.includes(longAbout));
    assert.ok(body.endsWith(`\n\`\`\`\`text\n${longAbout}\n\`\`\`\``));
  });

  it("shows the before and the after", () => {
    assert.ok(body.includes("Hi! I build quiet systems."));
    assert.ok(body.includes("**Before**"));
    assert.ok(body.includes("**After**"));
  });

  it("adds the note for the cover", () => {
    assert.ok(body.includes("Download: https://example.com/cover.png"));
  });
});

describe("renderChecklist", () => {
  it("lists every field as a box with its value", () => {
    const snapshot = buildSnapshot(baseInput);
    const checklist = renderChecklist(snapshot, new Map(), "ada");
    assert.equal(
      checklist.split("\n").filter((line) => line.startsWith("- [ ] ")).length,
      Object.keys(snapshot.fields).length
    );
    assert.ok(checklist.includes("Hi! I build quiet systems."));
    assert.ok(checklist.includes("  **Where:** "));
  });
});

describe("changeTitle", () => {
  it("lists each place once and cuts a long list", () => {
    const change = (
      field: string
    ): Parameters<typeof changeTitle>[0][number] => ({
      after: "a",
      before: "b",
      field,
      linkedinPlace: "",
    });
    assert.equal(
      changeTitle([
        change("experience:A"),
        change("experience:B"),
        change("about"),
      ]),
      "Update LinkedIn: Experience, About"
    );
    assert.equal(
      changeTitle([
        change("cover"),
        change("photo"),
        change("name"),
        change("headline"),
        change("about"),
      ]),
      "Update LinkedIn: Cover image, Profile photo, Name and 2 more"
    );
  });
});

describe("state body", () => {
  it("reads back the snapshot it wrote", () => {
    const snapshot = buildSnapshot({
      ...baseInput,
      person: { ...baseInput.person, summary: "Line one\n```\nLine two" },
    });
    assert.deepEqual(parseStateBody(stateBody(snapshot)), snapshot);
  });

  it("refuses a body that is not a snapshot", () => {
    assert.throws(() => parseStateBody("hello"));
    assert.throws(() => parseStateBody("```json\n{\n```"));
    assert.throws(() => parseStateBody('```json\n{"version":2}\n```'));
  });
});
