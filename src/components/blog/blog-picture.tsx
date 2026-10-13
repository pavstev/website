"use client";

import { type ReactElement, type ReactNode, useEffect, useRef } from "react";

interface BlogPictureProps {
  children: ReactNode;
}

export const BlogPicture = ({ children }: BlogPictureProps): ReactElement => {
  const ref = useRef<HTMLPictureElement>(null);

  useEffect(() => {
    const picture = ref.current;
    const image = picture?.querySelector("img");
    if (!picture || !image) return;
    const mark = (): void => {
      picture.dataset["loaded"] = "";
    };
    if (image.complete && image.naturalWidth > 0) {
      mark();
      return;
    }
    image.addEventListener("load", mark, { once: true });
    return () => {
      image.removeEventListener("load", mark);
    };
  }, []);

  return <picture ref={ref}>{children}</picture>;
};
