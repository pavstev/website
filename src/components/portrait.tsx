import type { ReactElement } from "react";

import { Icon } from "@/components/icon";
import { PortraitExpander } from "@/components/portrait-expander";
import { en } from "@/lib/i18n";

const portrait = {
  beadUrl: "/portraits/portrait-448.webp",
  largeUrl: "/portraits/portrait-800.webp",
  sizes: "(min-width: 768px) 154px, 134px",
  srcSet:
    "/portraits/portrait-224.webp 224w, /portraits/portrait-336.webp 336w, /portraits/portrait-448.webp 448w",
  url: "/portraits/portrait-336.webp",
};

interface PortraitProps {
  alt: string;
}

export const Portrait = ({ alt }: PortraitProps): ReactElement => (
  <PortraitExpander
    alt={alt}
    closeIcon={<Icon aria-hidden name="lucide:x" size="1.125rem" />}
    closeLabel={en.card.portraitClose}
    dialogLabel={en.card.portraitDialog}
    expandLabel={en.card.portraitExpand}
    largeUrl={portrait.largeUrl}
  >
    <span
      className="portrait-photo absolute inset-0 block overflow-hidden rounded-full ring-1 ring-(--border)"
      data-bead-src={portrait.beadUrl}
      data-portrait-photo=""
    >
      <img
        alt={alt}
        className="size-full object-cover object-top"
        decoding="async"
        fetchPriority="high"
        sizes={portrait.sizes}
        src={portrait.url}
        srcSet={portrait.srcSet}
      />
    </span>
    <span aria-hidden="true" className="orbit" data-orbit="">
      <span className="orbit-track" data-orbit-track="" />
      <span className="orbit-whisper" data-orbit-whisper="" />
      <span className="orbit-comet" data-orbit-comet="">
        <span className="orbit-arc" />
        <span className="orbit-head" />
      </span>
    </span>
  </PortraitExpander>
);
