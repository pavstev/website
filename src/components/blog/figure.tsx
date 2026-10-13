import type { ReactElement } from "react";

import { BlogImage } from "@/components/blog/blog-image";
import { ImageZoom } from "@/components/blog/image-zoom";
import { mediaEntry } from "@/lib/blog/media";
import { en } from "@/lib/i18n";

interface FigureProps {
  alt: string;
  caption?: string | undefined;
  priority?: boolean;
  slug: string;
  src: string;
}

export const Figure = ({
  alt,
  caption,
  priority = false,
  slug,
  src,
}: FigureProps): ReactElement => {
  const entry = mediaEntry(slug, src);
  const image = (
    <BlogImage alt={alt} priority={priority} slug={slug} src={src} />
  );
  return (
    <figure className="blog-figure">
      {entry === undefined ? (
        image
      ) : (
        <ImageZoom
          alt={alt}
          height={entry.height}
          label={en.blog.zoomImage.replace("{alt}", () => alt)}
          src={entry.fallback}
          width={entry.width}
        >
          {image}
        </ImageZoom>
      )}
      {caption !== undefined && caption !== "" && (
        <figcaption>{caption}</figcaption>
      )}
    </figure>
  );
};
