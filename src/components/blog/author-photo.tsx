import type { ReactElement } from "react";

interface AuthorPhotoProps {
  alt: string;
  className: string;
  sizes: string;
}

const photo = {
  size: 224,
  srcSet:
    "/portraits/portrait-224.webp 224w, /portraits/portrait-336.webp 336w, /portraits/portrait-448.webp 448w",
  url: "/portraits/portrait-336.webp",
};

export const AuthorPhoto = ({
  alt,
  className,
  sizes,
}: AuthorPhotoProps): ReactElement => (
  <img
    alt={alt}
    className={className}
    decoding="async"
    height={photo.size}
    loading="lazy"
    sizes={sizes}
    src={photo.url}
    srcSet={photo.srcSet}
    width={photo.size}
  />
);
