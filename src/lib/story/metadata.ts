import { listMetadata } from "../blog/metadata.ts";
import { type PageMetadata } from "../blog/page-metadata.ts";
import { en } from "../i18n.ts";
import { personalData } from "../personal.ts";
import { dotfilesStory } from "../work.ts";

export const storyUrl = `${personalData.website}${dotfilesStory}`;

const image = {
  alt: en.story.metaImageAlt,
  height: 630,
  type: "image/jpeg",
  url: "/og-dotfiles.jpg",
  width: 1200,
};

export const storyMetadata = (): PageMetadata => {
  const base = listMetadata({
    description: en.story.metaDescription,
    title: en.story.metaTitle,
    url: storyUrl,
  });
  return {
    ...base,
    openGraph: { ...base.openGraph, images: [image] },
    twitter: {
      ...base.twitter,
      images: [{ alt: image.alt, url: image.url }],
    },
  };
};
