import type { CSSProperties, ReactElement } from "react";

import { BlurImage } from "@/components/blog/blur-image";
import { mediaEntry, mediaPath } from "@/lib/blog/media";

interface BlogImageProps {
  alt: string;
  priority?: boolean;
  slug: string;
  src: string;
}

const sizes =
  "(min-width: 48em) min(46rem, calc(100vw - 4rem)), min(43.5rem, calc(100vw - 2.5rem))";

const srcSet = (urls: string[], widths: number[]): string =>
  urls.map((url, index) => `${url} ${String(widths[index] ?? 0)}w`).join(", ");

export const BlogImage = ({
  alt,
  priority = false,
  slug,
  src,
}: BlogImageProps): ReactElement => {
  const entry = mediaEntry(slug, src);
  const loading = priority
    ? ({ loading: "eager" } as const)
    : ({ decoding: "async", loading: "lazy" } as const);
  if (entry === undefined) {
    return (
      <img
        alt={alt}
        className="blog-image"
        src={mediaPath(slug, src)}
        {...loading}
      />
    );
  }
  return (
    <picture>
      <source
        sizes={sizes}
        srcSet={srcSet(entry.avif, entry.widths)}
        type="image/avif"
      />
      <source
        sizes={sizes}
        srcSet={srcSet(entry.webp, entry.widths)}
        type="image/webp"
      />
      <BlurImage
        alt={alt}
        className="blog-image"
        height={entry.height}
        src={entry.fallback}
        style={{ "--blur": `url("${entry.blur}")` } as CSSProperties}
        width={entry.width}
        {...loading}
      />
    </picture>
  );
};
