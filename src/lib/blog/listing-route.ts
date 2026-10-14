import { en } from "../i18n.ts";
import { postTitle } from "./format.ts";
import {
  blogListing,
  blogPageParams,
  type Listing,
  tagListing,
  tagPageParams,
  tagParams,
} from "./listing.ts";
import { listMetadata } from "./metadata.ts";
import { type PageMetadata } from "./page-metadata.ts";
import { parsePage } from "./pagination.ts";
import { type PostMeta } from "./schema.ts";

export interface ListingPage {
  description: string;
  heading: string;
  listing: Listing;
}

export interface ListingParams {
  rest: string[];
  slug: string;
}

export const listingParams = (posts: readonly PostMeta[]): ListingParams[] => [
  ...blogPageParams(posts).map(({ n }) => ({ rest: [n], slug: "page" })),
  ...tagParams(posts).map(({ tag }) => ({ rest: [tag], slug: "tag" })),
  ...tagPageParams(posts).map(({ n, tag }) => ({
    rest: [tag, "page", n],
    slug: "tag",
  })),
];

const fill = (text: string, values: Record<string, string>): string =>
  text.replaceAll(/\{(\w+)\}/gu, (match, key: string) => values[key] ?? match);

const laterPage = (text = ""): number | undefined => {
  const page = parsePage(text);
  return page !== undefined && page > 1 ? page : undefined;
};

const tagPage = (
  posts: readonly PostMeta[],
  [tag = "", word, number, ...extra]: readonly string[]
): ListingPage | undefined => {
  if (extra.length > 0) return undefined;
  const page = word === undefined ? 1 : laterPage(number);
  if (page === undefined || (word !== undefined && word !== "page")) {
    return undefined;
  }
  const listing = tagListing(posts, tag, page);
  const name = listing?.tag?.name ?? "";
  return listing === undefined
    ? undefined
    : {
        description: fill(en.blog.tagDescription, { tag: name }),
        heading: fill(page > 1 ? en.blog.tagPageTitle : en.blog.tagTitle, {
          n: String(page),
          tag: name,
        }),
        listing,
      };
};

export const listingPage = (
  posts: readonly PostMeta[],
  { rest, slug }: ListingParams
): ListingPage | undefined => {
  if (slug === "tag") return tagPage(posts, rest);
  const [number, ...extra] = rest;
  const page = laterPage(number);
  if (slug !== "page" || page === undefined || extra.length > 0) {
    return undefined;
  }
  const listing = blogListing(posts, page);
  return listing === undefined
    ? undefined
    : {
        description: en.blog.metaDescription,
        heading: fill(en.blog.pageTitle, { n: String(page) }),
        listing,
      };
};

export const listingMetadata = (page: ListingPage): PageMetadata =>
  listMetadata({
    description: page.description,
    title: postTitle(page.heading),
    url: page.listing.url,
  });
