import type { Metadata } from "next";
import type { ReactElement } from "react";

import { notFound } from "next/navigation";

import { BlogIndex } from "@/components/blog/blog-index";
import { showDrafts } from "@/lib/blog/build-env";
import {
  findListingPage,
  listingMetadata,
  type ListingParams,
  listingParams,
} from "@/lib/blog/listing-route";
import { listPosts } from "@/lib/blog/posts";

interface ListingPageProps {
  params: Promise<ListingParams>;
}

export const dynamicParams = false;

export const generateStaticParams = (): ListingParams[] =>
  listingParams(listPosts({ drafts: showDrafts() }));

export const generateMetadata = async ({
  params,
}: ListingPageProps): Promise<Metadata> =>
  listingMetadata(findListingPage(await params));

export default async function ListingPage({
  params,
}: ListingPageProps): Promise<ReactElement> {
  const page = findListingPage(await params);
  if (page === undefined) notFound();
  return <BlogIndex heading={page.heading} listing={page.listing} />;
}
