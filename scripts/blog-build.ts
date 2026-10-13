import { ImageResponse } from "next/og.js";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import sharp from "sharp";

import { showDrafts } from "../src/lib/blog/build-env.ts";
import {
  contentHash,
  cropKey,
  cropSpecs,
  hashName,
  imageWidths,
  type MediaEntry,
  mediaManifestPath,
  postImages,
  shareKey,
} from "../src/lib/blog/media.ts";
import { toMarkdown } from "../src/lib/blog/plain.ts";
import { type PostSource, visibleSources } from "../src/lib/blog/posts.ts";
import {
  type ShareFonts,
  shareFonts,
  shareSize,
  shareTree,
} from "../src/lib/blog/share.ts";

const mediaDir = "public/blog-media";
const markdownDir = "public/blog";
const buildMarkerPath = "public/build.json";
const coverNames = ["cover.webp", "cover.png", "cover.jpg"];
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
        {
          avif: [],
          blur: "",
          fallback: url,
          height: spec.height,
          webp: [url],
          width: spec.width,
          widths: [spec.width],
        },
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
  const response = new ImageResponse(
    shareTree(source.meta, await coverData(source)),
    { ...shareSize, fonts: fonts.list }
  );
  const bytes = new Uint8Array(await response.arrayBuffer());
  const url = saveMedia(
    out,
    source.slug,
    `share.${contentHash(bytes)}.png`,
    bytes
  );
  return {
    avif: [],
    blur: "",
    fallback: url,
    height: shareSize.height,
    webp: [],
    width: shareSize.width,
    widths: [shareSize.width],
  };
};

const postMedia = async (
  out: Output,
  source: PostSource,
  fonts: ShareFonts
): Promise<Array<[string, MediaEntry]>> => {
  const images = await Promise.all(
    postImages(source).map(async (file): Promise<[string, MediaEntry]> => [
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

interface BuildOptions {
  drafts: boolean;
  root: string;
}

interface BuildResult {
  manifest: Record<string, MediaEntry>;
  posts: number;
}

export const buildBlog = async ({
  drafts,
  root,
}: BuildOptions): Promise<BuildResult> => {
  const out: Output = { root, written: new Set() };
  const sources = visibleSources({ drafts }, root);
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
    const { manifest, posts } = await buildBlog({
      drafts: showDrafts(),
      root: process.cwd(),
    });
    writeFileSync(
      buildMarkerPath,
      `{"sha": ${JSON.stringify(commitSha())}, "builtAt": ${JSON.stringify(new Date().toISOString())}}\n`
    );
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
