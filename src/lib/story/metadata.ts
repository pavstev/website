import { brandTitle } from "../blog/format.ts";
import { listMetadata } from "../blog/metadata.ts";
import { type PageMetadata } from "../blog/page-metadata.ts";
import { en } from "../i18n.ts";
import { personalData } from "../personal.ts";
import { dotfilesStory, websiteStory } from "../work.ts";

export const storyUrl = `${personalData.website}${dotfilesStory}`;

export const skyStoryUrl = `${personalData.website}${websiteStory}`;

interface ShareImage {
  alt: string;
  height: number;
  type: string;
  url: string;
  width: number;
}

interface StoryPage {
  description: string;
  image: ShareImage;
  title: string;
  url: string;
}

const shareImage = (alt: string, url: string): ShareImage => ({
  alt,
  height: 630,
  type: "image/jpeg",
  url,
  width: 1200,
});

const storyPageMetadata = ({
  description,
  image,
  title,
  url,
}: StoryPage): PageMetadata => {
  const base = listMetadata({ description, title, url });
  return {
    ...base,
    openGraph: { ...base.openGraph, images: [image] },
    twitter: {
      ...base.twitter,
      images: [{ alt: image.alt, url: image.url }],
    },
  };
};

export const storyMetadata = (): PageMetadata =>
  storyPageMetadata({
    description: en.story.metaDescription,
    image: shareImage(en.story.metaImageAlt, "/og-dotfiles.jpg"),
    title: brandTitle(en.story.metaTitle),
    url: storyUrl,
  });

export const skyStoryMetadata = (): PageMetadata =>
  storyPageMetadata({
    description: en.skyStory.metaDescription,
    image: shareImage(en.skyStory.metaImageAlt, "/og-sky-story.jpg"),
    title: brandTitle(en.skyStory.metaTitle),
    url: skyStoryUrl,
  });
