"use client";

import {
  type ComponentPropsWithoutRef,
  type ReactElement,
  useEffect,
  useRef,
  useState,
} from "react";

type BlurImageProps = ComponentPropsWithoutRef<"img"> & { alt: string };

export const BlurImage = ({ alt, ...props }: BlurImageProps): ReactElement => {
  const ref = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const image = ref.current;
    if (image?.complete && image.naturalWidth > 0) setLoaded(true);
  }, []);

  return (
    <img
      alt={alt}
      {...props}
      data-loaded={loaded ? "" : undefined}
      onLoad={() => {
        setLoaded(true);
      }}
      ref={ref}
    />
  );
};
