import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import sharp from "sharp";

import {
  type BuildEnv,
  builtInstant,
  fixturesEnabled,
  showDrafts,
} from "../src/lib/blog/build-env.ts";
import {
  fixtureImageSource,
  fixturePosts,
  fixtureRoot,
} from "../src/lib/blog/fixture-posts.ts";
import {
  contentHash,
  coverNames,
  cropKey,
  cropSpecs,
  hashName,
  imageWidths,
  type MediaEntry,
  mediaManifestPath,
  postImages,
  shareKey,
  singleImageEntry,
} from "../src/lib/blog/media.ts";
import { toMarkdown } from "../src/lib/blog/plain.ts";
import { type PostSource, visibleSources } from "../src/lib/blog/posts.ts";
import {
  renderShareSvg,
  type ShareFonts,
  shareFonts,
  shareSize,
  shareTree,
} from "../src/lib/blog/share.ts";

const mediaDir = "public/blog-media";
const markdownDir = "public/blog";
const buildMarkerPath = "public/build.json";
const avifOptions = {
  chromaSubsampling: "4:4:4",
  effort: 6,
  quality: 60,
} as const;
const webpQuality = 82;
const blurWidth = 16;
const shaPattern = /^[\da-f]{40}$/;

interface Output {
  root: string;
  written: Set<string>;
}

const writeIfChanged = (
  out: Output,
  file: string,
  content: string | Uint8Array
): void => {
  const target = path.resolve(out.root, file);
  out.written.add(target);
  const bytes = Buffer.from(content);
  if (existsSync(target) && readFileSync(target).equals(bytes)) {
    return;
  }
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, bytes);
};

const saveMedia = (
  out: Output,
  slug: string,
  file: string,
  bytes: Uint8Array
): string => {
  writeIfChanged(out, path.join(mediaDir, slug, file), bytes);
  return `/blog-media/${slug}/${file}`;
};

const encodeImage = async (
  out: Output,
  source: PostSource,
  file: string
): Promise<MediaEntry> => {
  const input = readFileSync(path.join(source.dir, file));
  const { width: sourceWidth } = await sharp(input).metadata();
  const { name } = path.parse(file);
  const widths = imageWidths(sourceWidth);
  const sizes = await Promise.all(
    widths.map(async (width) => {
      const resized = sharp(input).resize({ width });
      const [avif, webp] = await Promise.all([
        resized.clone().avif(avifOptions).toBuffer(),
        resized
          .clone()
          .webp({ quality: webpQuality })
          .toBuffer({ resolveWithObject: true }),
      ]);
      return {
        avif: saveMedia(
          out,
          source.slug,
          hashName(name, avif, width, "avif"),
          avif
        ),
        height: webp.info.height,
        webp: saveMedia(
          out,
          source.slug,
          hashName(name, webp.data, width, "webp"),
          webp.data
        ),
        width,
      };
    })
  );
  const blur = await sharp(input)
    .resize({ width: blurWidth })
    .webp()
    .toBuffer();
  const widest = sizes.at(-1);
  if (widest === undefined) {
    throw new Error(`content/blog/${source.slug}/${file}: unreadable image`);
  }
  return {
    avif: sizes.map((size) => size.avif),
    blur: `data:image/webp;base64,${blur.toString("base64")}`,
    fallback: widest.webp,
    height: widest.height,
    webp: sizes.map((size) => size.webp),
    width: widest.width,
    widths,
  };
};

const coverFile = (source: PostSource): string | undefined =>
  coverNames
    .map((name) => path.join(source.dir, name))
    .find((file) => existsSync(file));

const renderCrops = async (
  out: Output,
  source: PostSource
): Promise<Array<[string, MediaEntry]>> => {
  const cover = coverFile(source);
  if (cover === undefined) {
    return [];
  }
  return Promise.all(
    cropSpecs.map(async (spec): Promise<[string, MediaEntry]> => {
      const bytes = await sharp(cover)
        .resize(spec.width, spec.height, { fit: "cover" })
        .webp({ quality: webpQuality })
        .toBuffer();
      const url = saveMedia(
        out,
        source.slug,
        hashName(`crop-${spec.name}`, bytes, spec.width, "webp"),
        bytes
      );
      return [
        cropKey(source.slug, spec.name),
        singleImageEntry({ height: spec.height, url, width: spec.width }, [
          url,
        ]),
      ];
    })
  );
};

const coverData = async (source: PostSource): Promise<string> => {
  const cover = coverFile(source);
  if (cover === undefined) {
    return "";
  }
  const png = await sharp(cover)
    .resize(shareSize.width, shareSize.height, { fit: "cover" })
    .png()
    .toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
};

const renderShare = async (
  out: Output,
  source: PostSource,
  fonts: ShareFonts
): Promise<MediaEntry> => {
  const svg = await renderShareSvg(
    shareTree(source.meta, await coverData(source)),
    fonts
  );
  const bytes = new Uint8Array(await sharp(Buffer.from(svg)).png().toBuffer());
  const url = saveMedia(
    out,
    source.slug,
    `share.${contentHash(bytes)}.png`,
    bytes
  );
  return singleImageEntry(
    { height: shareSize.height, url, width: shareSize.width },
    []
  );
};

const postMedia = async (
  out: Output,
  source: PostSource,
  fonts: ShareFonts
): Promise<Array<[string, MediaEntry]>> => {
  const cover = coverFile(source);
  const files = new Set([
    ...postImages(source),
    ...(cover === undefined ? [] : [path.basename(cover)]),
  ]);
  const images = await Promise.all(
    [...files].map(async (file): Promise<[string, MediaEntry]> => [
      `${source.slug}/${file}`,
      await encodeImage(out, source, file),
    ])
  );
  return [
    ...images,
    ...(await renderCrops(out, source)),
    [shareKey(source.slug), await renderShare(out, source, fonts)],
  ];
};

const commitSha = (): string => {
  const fromCi = process.env["WORKERS_CI_COMMIT_SHA"] ?? "";
  const sha =
    fromCi === ""
      ? execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim()
      : fromCi;
  if (!shaPattern.test(sha)) {
    throw new Error(`build.json: "${sha}" is not a full commit sha`);
  }
  return sha;
};

const prune = (out: Output, dir: string): void => {
  const base = path.resolve(out.root, dir);
  if (!existsSync(base)) {
    return;
  }
  const entries = readdirSync(base, { withFileTypes: true });
  for (const entry of entries) {
    const file = path.resolve(base, entry.name);
    if (entry.isDirectory()) {
      prune(out, file);
      if (readdirSync(file).length === 0) {
        rmSync(file, { recursive: true });
      }
    } else if (!out.written.has(file)) {
      rmSync(file);
    }
  }
};

export const fixtureGuard = (env: BuildEnv): string | undefined =>
  env.BLOG_FIXTURES === "1" && !fixturesEnabled(env)
    ? "BLOG_FIXTURES=1 is for pnpm dev:many only. Unset it for a build or in CI: test posts must never ship."
    : undefined;

export const writeFixtures = (root: string, imagesFrom = root): number => {
  const base = path.join(root, fixtureRoot, "content/blog");
  rmSync(path.join(root, fixtureRoot), { force: true, recursive: true });
  const posts = fixturePosts();
  for (const post of posts) {
    const dir = path.join(base, post.slug);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "index.mdx"), post.mdx);
    copyFileSync(
      path.join(imagesFrom, fixtureImageSource, post.cover),
      path.join(dir, "cover.webp")
    );
    if (post.chart !== undefined) {
      mkdirSync(path.join(dir, "data"), { recursive: true });
      writeFileSync(path.join(dir, "data/speed.json"), post.chart);
    }
    if (post.image !== undefined) {
      copyFileSync(
        path.join(imagesFrom, fixtureImageSource, post.image),
        path.join(dir, post.image)
      );
    }
  }
  return posts.length;
};

interface BuildOptions {
  drafts: boolean;
  now?: Date;
  root: string;
}

interface BuildResult {
  manifest: Record<string, MediaEntry>;
  posts: number;
}

export const markerText = (sha: string, builtAt: Date): string =>
  `{"sha": ${JSON.stringify(sha)}, "builtAt": ${JSON.stringify(builtAt.toISOString())}}\n`;

export const buildBlog = async ({
  drafts,
  now,
  root,
}: BuildOptions): Promise<BuildResult> => {
  const out: Output = { root, written: new Set() };
  const sources = visibleSources(
    { drafts, ...(now !== undefined && { now }) },
    root
  );
  const fonts = shareFonts();
  const entries = await Promise.all(
    sources.map((source) => postMedia(out, source, fonts))
  );
  const manifest = Object.fromEntries(
    entries.flat().toSorted(([a], [b]) => a.localeCompare(b, "en"))
  );
  writeIfChanged(
    out,
    mediaManifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`
  );
  for (const source of sources) {
    writeIfChanged(
      out,
      path.join(markdownDir, `${source.slug}.md`),
      toMarkdown(source)
    );
  }
  prune(out, mediaDir);
  prune(out, markdownDir);
  return { manifest, posts: sources.length };
};

if (import.meta.main) {
  try {
    const guard = fixtureGuard(process.env);
    if (guard !== undefined) throw new Error(guard);
    if (fixturesEnabled()) {
      const count = writeFixtures(process.cwd());
      console.warn(`blog: ${String(count)} test posts`);
    } else {
      rmSync(fixtureRoot, { force: true, recursive: true });
    }
    const builtAt = builtInstant() ?? new Date();
    const { manifest, posts } = await buildBlog({
      drafts: showDrafts(),
      now: builtAt,
      root: process.cwd(),
    });
    writeFileSync(buildMarkerPath, markerText(commitSha(), builtAt));
    console.warn(
      `blog: ${String(posts)} posts, ${String(Object.keys(manifest).length)} media entries`
    );
  } catch (error) {
    console.error(
      error instanceof Error ? (error.stack ?? error.message) : error
    );
    process.exitCode = 1;
  }
}
