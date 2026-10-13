import Link from "next/link";
import { type CSSProperties, type ReactElement } from "react";

import {
  moonPosition,
  moonRadius,
  orbitFor,
  startAngle,
} from "@/lib/blog/moons";

interface MoonFallbackPost {
  readingMinutes: number;
  slug: string;
}

interface MoonFallbackProps {
  count: number;
  index: number;
  post: MoonFallbackPost;
}

const referenceViewport = { height: 900, width: 1440 };

export const MoonFallback = ({
  count,
  index,
  post,
}: MoonFallbackProps): ReactElement => {
  const { depth, x, y } = moonPosition(
    orbitFor(index, count, 1, referenceViewport),
    startAngle(index, count)
  );
  const style = {
    "--moon-r": `${moonRadius(post.readingMinutes).toFixed(2)}px`,
    translate: `calc(var(--eclipse-r) * ${x.toFixed(3)}) calc(var(--eclipse-r) * ${y.toFixed(3)})`,
  } as CSSProperties;
  return (
    <Link
      aria-hidden="true"
      className="moon"
      data-moon={post.slug}
      data-side={`${x >= 0 ? "end" : "start"} ${depth < 0 ? "front" : "back"}`}
      href={`/blog/${post.slug}`}
      style={style}
      tabIndex={-1}
    />
  );
};
