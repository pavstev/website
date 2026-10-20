export interface FeedLink {
  title: string;
  url: string;
}

export interface FeedLinks {
  "application/feed+json": FeedLink[];
  "application/rss+xml": FeedLink[];
}

export interface PageMetadata {
  alternates: { canonical?: string; types: FeedLinks };
  description: string;
  keywords?: readonly string[];
  openGraph: {
    authors?: readonly string[];
    description: string;
    images: readonly OpenGraphImage[];
    locale: string;
    modifiedTime?: string;
    publishedTime?: string;
    siteName: string;
    tags?: readonly string[];
    title: string;
    type: "article" | "website";
    url?: string;
  };
  robots: Robots;
  title: string;
  twitter: {
    card: string;
    description: string;
    images: ReadonlyArray<{ alt: string; url: string }>;
    title: string;
  };
}

export interface Robots {
  follow: boolean;
  googleBot: {
    follow: boolean;
    index: boolean;
    "max-image-preview": string;
    "max-snippet": number;
    "max-video-preview": number;
  };
  index: boolean;
}

interface OpenGraphImage {
  alt: string;
  height: number;
  type: string;
  url: string;
  width: number;
}

const flag = (on: boolean, word: string): string => (on ? word : `no${word}`);

export const robotsContent = ({ follow, index }: Robots): string =>
  `${flag(index, "index")}, ${flag(follow, "follow")}`;

export const googleBotContent = ({ googleBot }: Robots): string =>
  [
    flag(googleBot.index, "index"),
    flag(googleBot.follow, "follow"),
    `max-video-preview:${String(googleBot["max-video-preview"])}`,
    `max-image-preview:${googleBot["max-image-preview"]}`,
    `max-snippet:${String(googleBot["max-snippet"])}`,
  ].join(", ");

export const resolveUrl = (origin: string, url: string): string =>
  new URL(url, origin).href.replace(/\/$/u, "");
