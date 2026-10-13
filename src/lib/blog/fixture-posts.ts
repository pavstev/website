export const fixtureRoot = ".blog/fixtures";
export const fixtureCount = 30;
export const fixtureImageSource = "content/blog/how-i-built-this-website";

export interface FixturePost {
  image: string | undefined;
  mdx: string;
  slug: string;
}

const tagSet = [
  "AI",
  "Claude Code",
  "Cloudflare",
  "Next.js",
  "Performance",
  "TypeScript",
  "WebGL",
  "Workflow",
] as const;

const images = ["sky-rain.webp", "sky-snow.webp", "sky-storm.webp"] as const;

const subjects = [
  "a static site",
  "the build",
  "a shader",
  "the cache",
  "a worker",
  "the test suite",
  "a feed",
  "the deploy hook",
  "a small tool",
  "the sitemap",
] as const;

const openers = [
  "What I learned from",
  "Notes on",
  "Measuring",
  "Rebuilding",
  "Two weeks with",
  "Fixing",
  "Why I keep",
  "A closer look at",
] as const;

const words = [
  "build",
  "cache",
  "check",
  "clear",
  "client",
  "cloud",
  "code",
  "data",
  "deploy",
  "edge",
  "fast",
  "file",
  "frame",
  "guard",
  "light",
  "list",
  "measure",
  "number",
  "page",
  "plain",
  "query",
  "render",
  "route",
  "rule",
  "server",
  "shader",
  "simple",
  "sky",
  "small",
  "static",
  "step",
  "test",
  "time",
  "tool",
  "value",
  "worker",
] as const;

const lengths = [300, 450, 600, 800, 1000, 1300, 1600, 2000, 2500] as const;
const startMs = Date.UTC(2023, 0, 1);
const spanMs = Date.UTC(2025, 11, 31) - startMs;
const viennaOffset = new Intl.DateTimeFormat("en", {
  timeZone: "Europe/Vienna",
  timeZoneName: "longOffset",
});

const random = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d_2b_79_f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
  };
};

const pick = <T>(next: () => number, list: readonly T[]): T => {
  const item = list[Math.floor(next() * list.length)];
  if (item === undefined) throw new Error("pick from an empty list");
  return item;
};

const pad = (value: number): string => String(value).padStart(2, "0");

const viennaIso = (ms: number): string => {
  const name =
    viennaOffset
      .formatToParts(new Date(ms))
      .find((part) => part.type === "timeZoneName")?.value ?? "";
  const offset = name === "GMT" ? "+00:00" : name.replace("GMT", "");
  const sign = offset.startsWith("-") ? -1 : 1;
  const [hours = 0, minutes = 0] = offset.slice(1).split(":").map(Number);
  const wall = new Date(ms + sign * (hours * 60 + minutes) * 60_000);
  return `${String(wall.getUTCFullYear())}-${pad(wall.getUTCMonth() + 1)}-${pad(wall.getUTCDate())}T${pad(wall.getUTCHours())}:${pad(wall.getUTCMinutes())}:00${offset}`;
};

const sentence = (next: () => number): string => {
  const size = 6 + Math.floor(next() * 10);
  const list: string[] = Array.from({ length: size }, () => pick(next, words));
  const first = list[0] ?? "";
  list[0] = first.charAt(0).toUpperCase() + first.slice(1);
  return `${list.join(" ")}.`;
};

const paragraph = (next: () => number): string =>
  Array.from({ length: 3 + Math.floor(next() * 3) }, () => sentence(next)).join(
    " "
  );

const codeBlock = [
  "```ts",
  "export const pageCount = (total: number, size: number): number =>",
  "  Math.max(1, Math.ceil(total / size));",
  "```",
].join("\n");

const body = (
  next: () => number,
  target: number,
  image: string | undefined,
  withCode: boolean
): string => {
  const blocks: string[] = [];
  let count = 0;
  let section = 1;
  while (count < target) {
    if (blocks.length % 4 === 3) {
      blocks.push(`## Part ${String(section)}`);
      section += 1;
    }
    const text = paragraph(next);
    count += text.split(" ").length;
    blocks.push(text);
    if (image !== undefined && blocks.length === 3) {
      blocks.push(
        `<Figure src="${image}" alt="A frame of the sky shader, used as a test image." caption="A test figure." />`
      );
    }
    if (withCode && blocks.length === 6) blocks.push(codeBlock);
  }
  return blocks.join("\n\n");
};

const fixturePost = (index: number): FixturePost => {
  const next = random(index * 7919 + 17);
  const subject = pick(next, subjects);
  const title = `${pick(next, openers)} ${subject}`;
  const tags = [...tagSet]
    .map((tag) => ({ order: next(), tag }))
    .toSorted((a, b) => a.order - b.order)
    .slice(0, 2 + Math.floor(next() * 3))
    .map((entry) => entry.tag);
  const date = viennaIso(startMs + Math.floor(next() * spanMs));
  const image = index % 6 === 0 ? pick(next, images) : undefined;
  const withCode = index % 4 === 1;
  const target = pick(next, lengths);
  const slug = `sample-${pad(index + 1)}-${subject.replace(/^(?:a|the) /u, "").replaceAll(" ", "-")}`;
  const mdx = [
    "---",
    `title: ${title} (sample ${String(index + 1)})`,
    `description: A generated test post about ${subject}, about ${String(target)} words long.`,
    `date: ${date}`,
    "draft: false",
    `tags: [${tags.join(", ")}]`,
    "---",
    "",
    body(next, target, image, withCode),
    "",
  ].join("\n");
  return { image, mdx, slug };
};

export const fixturePosts = (): FixturePost[] =>
  Array.from({ length: fixtureCount }, (_, index) => fixturePost(index));
