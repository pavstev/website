import * as z from "zod";

import { type Cv } from "./cv.ts";

export interface Change {
  after: null | string;
  before: null | string;
  field: string;
  linkedinPlace: string;
}

export interface LinkedinInput {
  cv: Cv;
  hashes: FileHashes;
  person: LinkedinPerson;
  products: readonly LinkedinProduct[];
}

export type Notes = ReadonlyMap<string, string>;

export interface Snapshot {
  fields: Record<string, string>;
  version: 1;
}

interface Contribution {
  description: string;
  title: string;
}

type Entry = [key: string, value: string];

interface FieldDescription {
  group: string;
  label: string;
  place: string;
}

interface FileHashes {
  cover: string;
  portrait: string;
  portraitJpeg: string;
}

interface LinkedinPerson {
  city: string;
  country: string;
  githubHandle: string;
  name: string;
  summary: string;
  title: string;
  website: string;
}

interface LinkedinProduct {
  line: string;
  name: string;
  period: string;
  role: string;
  url: string;
}

const root = "Me > View profile";

const fixedFields = new Map<string, { label: string; place: string }>([
  ["about", { label: "About", place: `${root} > pencil on the About section` }],
  [
    "cover",
    {
      label: "Cover image",
      place: `${root} > camera on the cover > Upload photo > Apply > Save`,
    },
  ],
  [
    "headline",
    {
      label: "Headline",
      place: `${root} > pencil on the top card > Headline`,
    },
  ],
  [
    "languages",
    {
      label: "Languages",
      place: `${root} > Add profile section > Additional > Add languages`,
    },
  ],
  [
    "location",
    {
      label: "Location",
      place: `${root} > pencil on the top card > Country/Region and City`,
    },
  ],
  [
    "name",
    {
      label: "Name",
      place: `${root} > pencil on the top card > First name and Last name`,
    },
  ],
  [
    "photo",
    {
      label: "Profile photo",
      place: `${root} > your photo > Update photo or Add photo > Save`,
    },
  ],
  [
    "website",
    {
      label: "Website",
      place: `${root} > pencil on the top card > Edit contact info > Website`,
    },
  ],
]);

const itemFields = new Map<
  string,
  { group: string; place: (name: string) => string }
>([
  [
    "education",
    {
      group: "Education",
      place: (name) => `${root} > Education > pencil on "${name}"`,
    },
  ],
  [
    "experience",
    {
      group: "Experience",
      place: (name) => `${root} > Experience > pencil on "${name}"`,
    },
  ],
  [
    "featured",
    {
      group: "Featured",
      place: (name) =>
        `${root} > Add profile section > Recommended > Add featured, then "${name}"`,
    },
  ],
  [
    "projects",
    {
      group: "Projects",
      place: (name) =>
        `${root} > Add profile section > Additional > Add projects, then "${name}"`,
    },
  ],
  [
    "skills",
    {
      group: "Skills",
      place: (name) =>
        `${root} > Skills > Add skill, one per keyword in "${name}"`,
    },
  ],
]);

const stateSchema = z.object({
  fields: z.record(z.string(), z.string()),
  version: z.literal(1),
});

const stateIntro =
  "The LinkedIn sync keeps the last snapshot it reported here. Do not edit this issue.";

const stateOpen = "```json\n";

const stateClose = "\n```";

const unknownField: FieldDescription = {
  group: "Other",
  label: "Other",
  place: root,
};

const describeField = (key: string): FieldDescription => {
  const separator = key.indexOf(":");
  const kind = separator === -1 ? key : key.slice(0, separator);
  const name = separator === -1 ? "" : key.slice(separator + 1);
  const fixed = fixedFields.get(kind);
  if (fixed) {
    return { group: fixed.label, label: fixed.label, place: fixed.place };
  }
  const item = itemFields.get(kind);
  if (item) {
    return {
      group: item.group,
      label: `${item.group}: ${name}`,
      place: item.place(name),
    };
  }
  return unknownField;
};

const present = (value: string | undefined): value is string =>
  value !== undefined && value.trim() !== "";

const lines = (rows: ReadonlyArray<string | undefined>): string =>
  rows
    .filter(present)
    .map((row) => row.trim())
    .join("\n");

const labelled = (label: string, value: string): string | undefined =>
  value.trim() === "" ? undefined : `${label}: ${value.trim()}`;

const dates = (from: string, to: string): string => {
  const start = from.trim();
  const end = to.trim();
  if (start === "" && end === "") return "";
  return `${start} to ${end === "" ? "present" : end}`;
};

const description = (
  overview: string,
  contributions: readonly Contribution[]
): string | undefined => {
  const bullets = contributions
    .map(({ description: text, title }) =>
      [title.trim(), text.trim()].filter((part) => part !== "").join(": ")
    )
    .filter((text) => text !== "")
    .map((text) => `- ${text}`);
  const body = [overview.trim(), ...bullets]
    .filter((part) => part !== "")
    .join("\n");
  return body === "" ? undefined : `Description:\n${body}`;
};

const nameOrFallback = (name: string): string =>
  name.trim() === "" ? "untitled" : name.trim();

const uniqueNames = (names: readonly string[]): string[] => {
  const seen = new Map<string, number>();
  return names.map((name) => {
    const count = (seen.get(name) ?? 0) + 1;
    seen.set(name, count);
    return count === 1 ? name : `${name}#${String(count)}`;
  });
};

const itemEntries = <T>(
  kind: string,
  list: readonly T[],
  nameOf: (item: T) => string,
  valueOf: (item: T) => string
): Entry[] => {
  const names = uniqueNames(list.map((item) => nameOrFallback(nameOf(item))));
  return list.map((item, index): Entry => {
    const name = names[index] ?? "untitled";
    return [`${kind}:${name}`, valueOf(item)];
  });
};

const experienceValue = (item: Cv["experience"]["items"][number]): string =>
  lines([
    labelled("Title", item.position),
    labelled("Company", item.company),
    labelled("Dates", dates(item.from, item.to)),
    labelled("Location", item.location),
    description(item.overview, item.contributions),
    labelled("Skills", item.skills.join(", ")),
  ]);

const educationValue = (item: Cv["education"]["items"][number]): string =>
  lines([
    labelled("School", item.school),
    labelled("Degree", item.degree),
    labelled("Field of study", item.area),
    labelled("Dates", dates(item.from, item.to)),
    description(item.overview, item.contributions),
    labelled("Skills", item.skills.join(", ")),
  ]);

const projectValue = (item: Cv["projects"]["items"][number]): string =>
  lines([
    labelled("Name", item.name),
    labelled("Dates", dates(item.from, item.to)),
    labelled("Link", item.websiteUrl),
    description(item.overview, item.contributions),
    labelled("Skills", item.skills.join(", ")),
  ]);

const skillValue = (item: Cv["skills"]["items"][number]): string =>
  `${item.name.trim()}: ${item.keywords.join(", ")}`;

const featuredValue = (product: LinkedinProduct): string =>
  lines([
    labelled("Title", product.name),
    labelled("Link", product.url),
    labelled(
      "Description",
      `${product.role}, ${product.period}. ${product.line}`
    ),
  ]);

const languagesEntry = (cv: Cv): Entry[] => {
  const value = lines(
    cv.languages.items.map((item) =>
      labelled(item.language.trim() || "Language", item.fluency)
    )
  );
  return value === "" ? [] : [["languages", value]];
};

export const buildSnapshot = (input: LinkedinInput): Snapshot => {
  const { cv, hashes, person, products } = input;
  const entries: Entry[] = [
    ["cover", `linkedin-cover.png sha256:${hashes.cover}`],
    [
      "photo",
      lines([
        `portrait-800.webp sha256:${hashes.portrait}`,
        `stevan-pavlovic.jpeg sha256:${hashes.portraitJpeg}`,
      ]),
    ],
    ["name", person.name],
    ["headline", person.title],
    ["location", `${person.city}, ${person.country}`],
    ["website", person.website],
    ["about", person.summary],
    ...itemEntries(
      "experience",
      cv.experience.items,
      (item) => item.company,
      experienceValue
    ),
    ...itemEntries(
      "education",
      cv.education.items,
      (item) => item.school,
      educationValue
    ),
    ...itemEntries("skills", cv.skills.items, (item) => item.name, skillValue),
    ...languagesEntry(cv),
    ...itemEntries(
      "projects",
      cv.projects.items,
      (item) => item.name,
      projectValue
    ),
    ...itemEntries(
      "featured",
      products,
      (product) => product.name,
      featuredValue
    ),
  ];
  return { fields: Object.fromEntries(entries), version: 1 };
};

export const diffSnapshots = (before: Snapshot, after: Snapshot): Change[] => {
  const was = new Map(Object.entries(before.fields));
  const now = new Map(Object.entries(after.fields));
  const removed = was
    .keys()
    .filter((key) => !now.has(key))
    .toArray();
  const keys = [...now.keys(), ...removed];
  return keys.flatMap((key): Change[] => {
    const oldValue = was.get(key) ?? null;
    const newValue = now.get(key) ?? null;
    if (oldValue === newValue) return [];
    return [
      {
        after: newValue,
        before: oldValue,
        field: key,
        linkedinPlace: describeField(key).place,
      },
    ];
  });
};

const fence = (text: string): string => {
  const runs = text
    .matchAll(/`+/g)
    .map((run) => run[0].length)
    .toArray();
  const ticks = "`".repeat(Math.max(2, ...runs) + 1);
  return `${ticks}text\n${text}\n${ticks}`;
};

const taskItem = (text: string): string =>
  text
    .split("\n")
    .map((line, index) => {
      if (index === 0) return `- [ ] ${line}`;
      return line === "" ? "" : `  ${line}`;
    })
    .join("\n");

const section = (change: Change, notes: Notes): string => {
  const { label } = describeField(change.field);
  const note = notes.get(change.field);
  const head = [`### ${label}`, `**Where:** ${change.linkedinPlace}`];
  if (note !== undefined) head.push(note);
  if (change.after === null) {
    return [
      ...head,
      "Removed from the site. Delete it on LinkedIn. Old value:",
      fence(change.before ?? ""),
    ].join("\n\n");
  }
  if (change.before === null) {
    return [
      ...head,
      "New on the site. Add it on LinkedIn. Value:",
      fence(change.after),
    ].join("\n\n");
  }
  return [
    ...head,
    "**Before**",
    fence(change.before),
    "**After**",
    fence(change.after),
  ].join("\n\n");
};

export const changeTitle = (changes: readonly Change[]): string => {
  const groups = [
    ...new Set(changes.map((change) => describeField(change.field).group)),
  ];
  const shown = groups.slice(0, 3).join(", ");
  const rest = groups.length - 3;
  return `Update LinkedIn: ${shown}${rest > 0 ? ` and ${String(rest)} more` : ""}`;
};

export const renderChanges = (
  changes: readonly Change[],
  notes: Notes,
  handle: string
): string =>
  [
    `@${handle} LinkedIn is out of date. Change ${String(changes.length)} ${changes.length === 1 ? "place" : "places"} by hand. Close this issue when you are done.`,
    ...changes.map((change) => section(change, notes)),
  ].join("\n\n");

export const renderChecklist = (
  snapshot: Snapshot,
  notes: Notes,
  handle: string
): string =>
  [
    `@${handle} This is the first LinkedIn sync. Check each box once so LinkedIn matches stevanpavlovic.com. Close this issue when you are done. After that, GitHub opens an issue only when something changes.`,
    ...Object.entries(snapshot.fields).map(([key, value]) => {
      const { label, place } = describeField(key);
      const note = notes.get(key);
      return taskItem(
        [
          `**${label}**`,
          `**Where:** ${place}`,
          ...(note === undefined ? [] : [note]),
          fence(value),
        ].join("\n\n")
      );
    }),
  ].join("\n\n");

export const stateBody = (snapshot: Snapshot): string =>
  `${stateIntro}\n\n${stateOpen}${JSON.stringify(snapshot, null, 1)}${stateClose}`;

export const parseStateBody = (body: string): Snapshot => {
  const start = body.indexOf(stateOpen);
  const end = body.lastIndexOf(stateClose);
  if (start === -1 || end <= start) {
    throw new Error("The state issue holds no JSON block");
  }
  let data: unknown;
  try {
    data = JSON.parse(body.slice(start + stateOpen.length, end));
  } catch {
    throw new Error("The state issue JSON does not parse");
  }
  const parsed = stateSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("The state issue JSON is not a LinkedIn snapshot");
  }
  return parsed.data;
};
