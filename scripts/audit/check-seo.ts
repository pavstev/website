import type { Check, Page, Result } from "./types.ts";

import {
  count,
  fetchText,
  newResult,
  openPage,
  reporter,
  type Say,
  sitemapTags,
  toBase,
} from "./lib.ts";
import { expectedLd, indexNowKey, live, profileHosts } from "./pages.ts";

interface ImageInfo {
  dims: [number, number] | undefined;
  ok: boolean;
}

type JsonNode = Record<string, unknown>;

interface Shared {
  alternates: Array<{ href: string; type: string }>;
  descs: Map<string, string[]>;
  icons: Set<string>;
  images: Map<string, ImageInfo>;
  internal: Map<string, string[]>;
  manifest: string | undefined;
  titles: Map<string, string[]>;
}

const timePattern = /^\d{2}:\d{2}$|^\d{2}:\d{2}:\d{2}$/u;

const isIso = (value: string): boolean => {
  const [day = "", time, extra] = value.split("T", 3);
  return (
    extra === undefined &&
    /^\d{4}-\d{2}-\d{2}$/u.test(day) &&
    (time === undefined ||
      timePattern.test(
        time.replace(/(?:Z|[+-]\d{2}:\d{2})$/u, "").replace(/\.\d+/u, "")
      ))
  );
};

const collect = () => ({
  alternates: [
    ...document.querySelectorAll<HTMLLinkElement>('link[rel="alternate"]'),
  ].map((link) => ({
    href: link.href,
    type: link.getAttribute("type") ?? "",
  })),
  anchors: [...document.querySelectorAll('a[href^="#"]')]
    .map((anchor) => anchor.getAttribute("href") ?? "")
    .filter((href) => {
      const id = CSS.escape(decodeURIComponent(href.slice(1)));
      return (
        href.length > 1 && !document.querySelector(`[id="${CSS.escape(id)}"]`)
      );
    }),
  canonical:
    document.querySelector('link[rel="canonical"]')?.getAttribute("href") ??
    null,
  desc:
    document
      .querySelector('meta[name="description"]')
      ?.getAttribute("content") ?? null,
  headings: [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].map(
    (heading): [number, string] => [
      Number(heading.tagName.slice(1)),
      (heading.textContent ?? "").trim().replaceAll(/\s+/gu, " ").slice(0, 50),
    ]
  ),
  icons: [
    ...document.querySelectorAll<HTMLLinkElement>(
      'link[rel~="icon"], link[rel="apple-touch-icon"]'
    ),
  ].map((link) => link.href),
  images: [...document.images].map((image) => ({
    alt: image.getAttribute("alt"),
    h: image.getAttribute("height"),
    src: (
      image.getAttribute("src") ??
      image.getAttribute("srcset") ??
      ""
    ).slice(0, 60),
    w: image.getAttribute("width"),
  })),
  lang: document.documentElement.getAttribute("lang"),
  ld: [...document.querySelectorAll('script[type="application/ld+json"]')].map(
    (script) => script.textContent ?? ""
  ),
  links: [...document.querySelectorAll<HTMLAnchorElement>("a[href]")].map(
    (anchor) => ({
      href: anchor.href,
      rel: anchor.getAttribute("rel") ?? "",
    })
  ),
  manifest:
    document.querySelector<HTMLLinkElement>('link[rel="manifest"]')?.href ??
    null,
  metas: [
    ...document.querySelectorAll(
      'meta[property^="og:"], meta[name^="twitter:"]'
    ),
  ].map((meta): [string, null | string] => [
    meta.getAttribute("property") ?? meta.getAttribute("name") ?? "",
    meta.getAttribute("content"),
  ]),
  robots:
    document.querySelector('meta[name="robots"]')?.getAttribute("content") ??
    null,
  title: document.title,
});

type Data = ReturnType<typeof collect> & { tags: Map<string, null | string> };

const isNode = (value: unknown): value is JsonNode =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const flatten = (node: unknown, found: JsonNode[] = []): JsonNode[] => {
  if (Array.isArray(node)) for (const item of node) flatten(item, found);
  else if (isNode(node)) {
    found.push(node);
    for (const value of Object.values(node)) flatten(value, found);
  }
  return found;
};

const push = (map: Map<string, string[]>, key: string, value: string): void => {
  map.set(key, [...(map.get(key) ?? []), value]);
};

const maybe = async <T>(promise: Promise<T>): Promise<T | undefined> => {
  try {
    return await promise;
  } catch {
    return undefined;
  }
};

const loadImage = async (url: string): Promise<ImageInfo> => {
  const opened = await maybe(openPage({ url }));
  if (!opened) return { dims: undefined, ok: false };
  const dims = await opened.page.evaluate(() => {
    const [image] = document.images;
    return image
      ? { h: image.naturalHeight, w: image.naturalWidth }
      : undefined;
  });
  await opened.context.close();
  return {
    dims: dims && dims.w > 0 ? [dims.w, dims.h] : undefined,
    ok: Boolean(opened.response?.ok()),
  };
};

const outOfRange = (value: number, low: number, high: number): boolean =>
  value < low || value > high;

const checkMeta = (say: Say, page: Page, data: Data, shared: Shared): void => {
  const { path: where } = page;
  if (!data.lang) say.fail("<html> has no lang");
  if (!data.title) say.fail("no <title>");
  else if (outOfRange(data.title.length, 15, 60))
    say.warn(
      `title is ${String(data.title.length)} characters (15 to 60 reads best): "${data.title}"`
    );
  push(shared.titles, data.title, where);
  if (data.desc) {
    if (outOfRange(data.desc.length, 50, 160))
      say.warn(
        `description is ${String(data.desc.length)} characters (50 to 160 reads best)`
      );
    push(shared.descs, data.desc, where);
  } else say.fail("no meta description");
  if (!data.canonical) say.fail("no canonical link");
  else if (data.canonical !== page.live)
    say.fail(
      `canonical ${data.canonical} is not the sitemap URL ${String(page.live)}`
    );
  if ((data.robots ?? "").includes("noindex"))
    say.fail(`robots meta says ${String(data.robots)}`);
  for (const key of [
    "og:title",
    "og:description",
    "og:url",
    "og:image",
    "og:type",
  ])
    if (!data.tags.get(key)) say.fail(`no ${key}`);
  const ogUrl = data.tags.get("og:url");
  if (ogUrl && data.canonical && ogUrl !== data.canonical)
    say.warn(`og:url ${ogUrl} differs from the canonical`);
  if (!data.tags.get("twitter:card")) say.warn("no twitter:card");
};

const checkOgImage = async (
  say: Say,
  data: Data,
  shared: Shared,
  base: string
): Promise<void> => {
  const ogImage = data.tags.get("og:image");
  if (!ogImage) return;
  if (!ogImage.startsWith("https://"))
    say.fail(`og:image is not an absolute https URL: ${ogImage}`);
  if (!shared.images.has(ogImage)) {
    const local =
      ogImage.startsWith(live) || ogImage.startsWith("/")
        ? toBase(ogImage, base)
        : ogImage;
    shared.images.set(ogImage, await loadImage(local));
  }
  const image = shared.images.get(ogImage);
  if (!image?.ok) say.fail(`og:image does not load: ${ogImage}`);
  else if (image.dims && (image.dims[0] < 1200 || image.dims[1] < 630))
    say.warn(`og:image is ${image.dims.join("x")}, under 1200x630`);
};

const parseLd = (say: Say, raw: string[]): JsonNode[] =>
  raw.flatMap((text) => {
    if (text.includes("<"))
      say.fail('JSON-LD holds a raw "<" (must be escaped as <)');
    try {
      return flatten(JSON.parse(text));
    } catch (error) {
      say.fail(
        `JSON-LD does not parse: ${error instanceof Error ? error.message : String(error)}`
      );
      return [];
    }
  });

const clashOf = (list: JsonNode[]): [string, unknown] | undefined =>
  list
    .flatMap((node) =>
      Object.entries(node).filter(([, value]) => typeof value !== "object")
    )
    .find(([key, value]) =>
      list.some(
        (other) =>
          Object.hasOwn(other, key) &&
          typeof other[key] !== "object" &&
          other[key] !== value
      )
    );

const checkDefinitions = (say: Say, nodes: JsonNode[]): void => {
  const defs = new Map<string, JsonNode[]>();
  for (const node of nodes) {
    const id = node["@id"];
    if (typeof id !== "string" || Object.keys(node).length < 2) continue;
    defs.set(id, [...(defs.get(id) ?? []), node]);
  }
  for (const [id, list] of defs) {
    if (list.length < 2) continue;
    const clash = clashOf(list);
    if (clash) say.fail(`JSON-LD gives ${id} two different ${clash[0]} values`);
    else
      say.info(
        `JSON-LD repeats ${id} ${String(list.length)} times with the same values`
      );
  }
};

const checkJsonLd = (
  result: Result,
  say: Say,
  page: Page,
  data: Data
): void => {
  const nodes = parseLd(say, data.ld);
  const types = new Set(
    nodes.flatMap((node) => [node["@type"]].flat()).filter(Boolean)
  );
  const wanted = expectedLd[page.kind] ?? [];
  for (const anyOf of wanted)
    if (anyOf.every((type) => !types.has(type)))
      say.fail(`JSON-LD has no ${anyOf.join(" or ")}`);
  checkDefinitions(say, nodes);
  if (nodes.some((node) => Object.hasOwn(node, "worksFor")))
    say.fail("JSON-LD has worksFor (owner rule: never)");
  for (const node of nodes)
    for (const key of ["datePublished", "dateModified", "dateCreated"]) {
      const value = node[key];
      if (typeof value === "string" && !isIso(value))
        say.fail(`${key} "${value}" is not ISO 8601`);
    }
  result.metrics[`jsonld_nodes_${page.kind}`] = nodes.length;
};

const checkProfiles = (say: Say, data: Data): void => {
  for (const host of profileHosts) {
    const link = data.links.find((entry) => {
      const url = new URL(entry.href);
      return (
        url.hostname.endsWith(host) &&
        /^\/(?:in\/)?[\w-]+\/?$/u.test(url.pathname)
      );
    });
    if (!link) say.warn(`no profile link to ${host}`);
    else if (!/\bme\b/u.test(link.rel))
      say.warn(`the ${host} profile link has no rel="me"`);
  }
};

const checkBody = (
  say: Say,
  page: Page,
  data: Data,
  base: string,
  shared: Shared
): void => {
  const h1 = data.headings.filter(([level]) => level === 1).length;
  if (h1 !== 1) say.fail(`${String(h1)} h1 elements, want 1`);
  for (const [index, current] of data.headings.entries()) {
    const previous = data.headings[index - 1];
    if (previous && current[0] > previous[0] + 1)
      say.warn(
        `heading jumps from h${String(previous[0])} to h${String(current[0])} at "${current[1]}"`
      );
  }
  for (const image of data.images) {
    if (image.alt === null) say.fail(`img without alt: ${image.src}`);
    if (!image.w || !image.h)
      say.info(`img without width/height attributes: ${image.src}`);
  }
  for (const anchor of data.anchors)
    say.fail(`in-page link ${anchor} has no target`);
  for (const link of data.links) {
    const url = new URL(link.href);
    if (url.origin !== new URL(base).origin) continue;
    url.hash = "";
    push(shared.internal, url.href, page.path);
  }
  if (page.kind === "home") checkProfiles(say, data);
};

const checkPage = async (
  result: Result,
  page: Page,
  base: string,
  shared: Shared
): Promise<void> => {
  const opened = await openPage({ js: false, url: page.url });
  const status = opened.response?.status();
  const collected = await opened.page.evaluate(collect);
  await opened.context.close();
  const say = reporter(result, page.path);
  if (page.kind === "404") {
    if (status !== 404) say.fail(`answered ${String(status)}, want 404`);
    return;
  }
  const data: Data = { ...collected, tags: new Map(collected.metas) };
  if (status !== 200) say.fail(`answered ${String(status)}`);
  checkMeta(say, page, data, shared);
  await checkOgImage(say, data, shared, base);
  checkJsonLd(result, say, page, data);
  checkBody(say, page, data, base, shared);
  shared.alternates.push(...data.alternates);
  shared.manifest ??= data.manifest ?? undefined;
  for (const icon of data.icons) shared.icons.add(icon);
};

const checkSitemap = (say: Say, sitemap: string): void => {
  const locs = sitemapTags(sitemap, "loc");
  const repeated = new Set(locs.filter((url, i) => locs.indexOf(url) !== i));
  for (const loc of repeated) say.fail(`sitemap lists ${loc} twice`);
  const lastmods = sitemapTags(sitemap, "lastmod");
  if (lastmods.length < locs.length)
    say.warn(
      `sitemap: ${String(locs.length - lastmods.length)} URLs without lastmod`
    );
  for (const lastmod of lastmods)
    if (!isIso(lastmod))
      say.fail(`sitemap: lastmod "${lastmod}" is not ISO 8601`);
  for (const loc of locs)
    if (!loc.startsWith(live)) say.fail(`sitemap: ${loc} is not on ${live}`);
};

const checkInternal = async (
  say: Say,
  shared: Shared,
  sitemapPaths: Set<string>
): Promise<void> => {
  for (const [url, from] of shared.internal) {
    const response = await maybe(fetch(url));
    const { pathname } = new URL(url);
    if (!response || response.status >= 400)
      say.fail(
        `broken internal link ${pathname} (${String(response?.status ?? "no answer")}) on ${[...new Set(from)].join(", ")}`
      );
    if (
      response?.ok &&
      (response.headers.get("content-type") ?? "").includes("text/html") &&
      !sitemapPaths.has(pathname)
    )
      say.warn(
        `${pathname} is linked and serves HTML but is not in the sitemap`
      );
  }
};

const checkRobots = async (say: Say, base: string): Promise<void> => {
  const robots = await maybe(fetchText(`${base}/robots.txt`));
  if (robots?.status !== 200) {
    say.fail("robots.txt does not load");
    return;
  }
  if (!robots.body.includes(`Sitemap: ${live}/sitemap.xml`))
    say.fail(`robots.txt has no "Sitemap: ${live}/sitemap.xml"`);
  if (/^Disallow:\s*\/\s*$/mu.test(robots.body))
    say.fail("robots.txt disallows the whole site");
};

const checkLlms = async (
  result: Result,
  say: Say,
  base: string
): Promise<void> => {
  const llms = await maybe(fetchText(`${base}/llms.txt`));
  if (llms?.status !== 200 || !llms.body.trim()) {
    say.fail("llms.txt does not load or is empty");
    return;
  }
  const type = llms.headers.get("content-type") ?? "";
  if (!type.includes("text/plain")) say.warn(`llms.txt is served as ${type}`);
  const links = new Set(
    Array.from(
      llms.body.matchAll(/\]\(([^)\s]+)\)/gu),
      (match) => match[1] ?? ""
    )
      .filter((url) => url.startsWith(live) || url.startsWith("/"))
      .map((url) => toBase(url, base))
  );
  for (const url of links) {
    const response = await maybe(fetch(url));
    if (!response?.ok)
      say.fail(
        `llms.txt links to ${new URL(url).pathname}, which answers ${String(response?.status ?? "nothing")}`
      );
  }
  result.metrics["llms_links"] = links.size;
};

const checkFeed = async (
  say: Say,
  url: string,
  type: string
): Promise<void> => {
  const name = new URL(url).pathname;
  const feed = await maybe(fetchText(url));
  if (feed?.status !== 200) {
    say.fail(`feed ${name} answers ${String(feed?.status ?? "nothing")}`);
    return;
  }
  if (!type.includes("json")) {
    if (
      !/<(?:rss|feed)[\s>]/u.test(feed.body) ||
      !/<(?:item|entry)[\s>]/u.test(feed.body)
    )
      say.fail(`feed ${name} has no rss/feed root or no items`);
    return;
  }
  try {
    const parsed: unknown = JSON.parse(feed.body);
    const items = isNode(parsed) ? parsed["items"] : undefined;
    if (!Array.isArray(items) || items.length === 0)
      say.fail(`feed ${name} has no items`);
  } catch {
    say.fail(`feed ${name} is not JSON`);
  }
};

const checkManifest = async (
  say: Say,
  shared: Shared,
  base: string
): Promise<void> => {
  if (!shared.manifest) {
    say.warn("no manifest link");
    return;
  }
  const url = toBase(shared.manifest, base);
  const manifest = await maybe(fetchText(url));
  try {
    const json: unknown = JSON.parse(manifest?.body ?? "");
    if (!isNode(json)) throw new TypeError("manifest is not an object");
    const icons = Array.isArray(json["icons"]) ? json["icons"] : [];
    for (const icon of icons)
      if (isNode(icon) && typeof icon["src"] === "string")
        shared.icons.add(new URL(icon["src"], url).href);
    if (!json["name"]) say.warn("manifest has no name");
  } catch {
    say.fail("manifest does not load as JSON");
  }
};

const checkFiles = async (say: Say, base: string): Promise<void> => {
  const indexNow = await maybe(fetchText(`${base}/${indexNowKey}.txt`));
  if (indexNow?.status !== 200 || indexNow.body.trim() !== indexNowKey)
    say.fail("the IndexNow key file is missing or wrong");
  const cv = await maybe(fetchText(`${base}/cv.json`));
  try {
    JSON.parse(cv?.body ?? "");
  } catch {
    say.fail("/cv.json does not load as JSON");
  }
  const pdf = await maybe(fetch(`${base}/resume.pdf`));
  const head = pdf?.ok
    ? Buffer.from(await pdf.arrayBuffer())
        .subarray(0, 4)
        .toString()
    : "";
  if (head !== "%PDF") say.fail("/resume.pdf does not load as a PDF");
};

const check: Check = async (context) => {
  const result = newResult("seo");
  const say = reporter(result, "");
  const { base } = context;
  const shared: Shared = {
    alternates: [],
    descs: new Map(),
    icons: new Set(),
    images: new Map(),
    internal: new Map(),
    manifest: undefined,
    titles: new Map(),
  };
  for (const page of context.pages) await checkPage(result, page, base, shared);
  for (const [title, where] of shared.titles)
    if (where.length > 1)
      say.warn(`same title on ${where.join(", ")}: "${title}"`);
  for (const where of shared.descs.values())
    if (where.length > 1) say.warn(`same description on ${where.join(", ")}`);
  checkSitemap(say, context.sitemap);
  await checkInternal(
    say,
    shared,
    new Set(context.pages.filter((page) => page.live).map((page) => page.path))
  );
  result.metrics["internal_links"] = shared.internal.size;
  await checkRobots(say, base);
  await checkLlms(result, say, base);
  const feeds = new Map(
    shared.alternates
      .filter((alternate) => /rss|atom|feed\+json/u.test(alternate.type))
      .map((alternate): [string, string] => [
        toBase(alternate.href, base),
        alternate.type,
      ])
  );
  if (context.pages.some((page) => page.kind === "blog") && feeds.size === 0)
    say.warn("the blog pages link no RSS or JSON feed");
  for (const [url, type] of feeds) await checkFeed(say, url, type);
  await checkManifest(say, shared, base);
  for (const icon of shared.icons) {
    const response = await maybe(fetch(toBase(icon, base)));
    if (!response?.ok) say.fail(`icon ${new URL(icon).pathname} does not load`);
  }
  await checkFiles(say, base);
  const fails = count(result, "fail");
  const warns = count(result, "warn");
  result.metrics["fails"] = fails;
  result.metrics["warnings"] = warns;
  result.summary = `${String(context.pages.length)} pages, ${String(shared.internal.size)} internal links, ${String(feeds.size)} feeds: ${String(fails)} problems, ${String(warns)} warnings`;
  return result;
};

export default check;
