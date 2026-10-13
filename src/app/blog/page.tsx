import type { Metadata } from "next";
import type { ReactElement } from "react";

import { notFound } from "next/navigation";

import { BlogIndex } from "@/components/blog/blog-index";
import { showDrafts } from "@/lib/blog/build-env";
import { blogListing } from "@/lib/blog/listing";
import { blogUrl, listMetadata } from "@/lib/blog/metadata";
import { listPosts } from "@/lib/blog/posts";
import { en } from "@/lib/i18n";
import { blogGraph, serializeJsonLd } from "@/lib/structured-data";

export const metadata: Metadata = listMetadata({
  description: en.blog.metaDescription,
  title: en.blog.metaTitle,
  url: blogUrl,
});

export default function BlogIndexPage(): ReactElement {
  const posts = listPosts({ drafts: showDrafts() });
  const listing = blogListing(posts, 1);
  if (listing === undefined) notFound();
  return (
    <BlogIndex
      heading={en.blog.heading}
      jsonLd={serializeJsonLd(blogGraph(posts))}
      listing={listing}
    />
  );
}
