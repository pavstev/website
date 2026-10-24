import type { ImageMetadata } from "astro";

import { getImage } from "astro:assets";

import {
  absoluteUrl,
  coverNames,
  imageKeys,
  imageWidths,
  localFile,
  postImages,
} from "@/lib/blog/images";
import { type ImageUrl } from "@/lib/blog/plain";
import { type PostSource } from "@/lib/blog/posts";

const files = import.meta.glob<{ default: ImageMetadata }>([
  "/content/**/*.{avif,jpeg,jpg,png,webp}",
  "/blog-fixtures/content/**/*.{avif,jpeg,jpg,png,webp}",
]);

export interface FoundImage {
  image: ImageMetadata;
  key: string;
}

export const findImage = async (
  pathname: string,
  file: string
): Promise<FoundImage | undefined> => {
  for (const key of imageKeys(pathname, file)) {
    const load = files[key];
    if (load !== undefined) {
      const { default: image } = await load();
      return { image, key };
    }
  }
  return undefined;
};

export const findCover = async (
  slug: string
): Promise<FoundImage | undefined> => {
  for (const name of coverNames) {
    const found = await findImage(`/blog/${slug}`, name);
    if (found !== undefined) return found;
  }
  return undefined;
};

export const imageUrlsOf = async (
  source: Pick<PostSource, "body" | "slug">,
  site: string
): Promise<ImageUrl> => {
  const urls = new Map<string, string>();
  for (const file of postImages(source)) {
    const found = await findImage(`/blog/${source.slug}`, file);
    if (found === undefined) {
      throw new Error(
        `content/blog/${source.slug}/index.mdx: image "${file}" not found`
      );
    }
    const { src } = await getImage({
      format: "webp",
      src: found.image,
      width: Math.min(found.image.width, Math.max(...imageWidths)),
    });
    urls.set(file, absoluteUrl(src, site));
  }
  return (src) => {
    const file = localFile(src);
    return (
      (file === undefined ? undefined : urls.get(file)) ??
      absoluteUrl(src, site)
    );
  };
};
