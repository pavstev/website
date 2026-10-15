import type { ReactElement } from "react";

import { BlogImage } from "@/components/blog/blog-image";
import { mediaEntry } from "@/lib/blog/media";

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
        <div className="image-zoom focus-ring">{image}</div>
      )}
      {caption !== undefined && caption !== "" && (
        <figcaption>{caption}</figcaption>
      )}
    </figure>
  );
};
