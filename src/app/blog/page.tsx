import type { Metadata } from "next";
import type { ReactElement } from "react";

import { BlogFooter } from "@/components/blog/blog-footer";
import { BlogMoons } from "@/components/blog/blog-moons";
import { PostList } from "@/components/blog/post-list";
import { SpaceBackground } from "@/components/space-background";
import { pageRobots, showDrafts } from "@/lib/blog/build-env";
import { blogUrl, feedTypes, shareImage } from "@/lib/blog/metadata";
import { listPosts } from "@/lib/blog/posts";
import { en } from "@/lib/i18n";
import { personalData } from "@/lib/personal";
import { blogGraph, serializeJsonLd } from "@/lib/structured-data";

export const metadata: Metadata = {
  alternates: { canonical: blogUrl, types: feedTypes },
  description: en.blog.metaDescription,
  openGraph: {
    description: en.blog.metaDescription,
    images: [shareImage],
    locale: "en_US",
    siteName: personalData.name,
    title: en.blog.metaTitle,
    type: "website",
    url: blogUrl,
  },
  robots: pageRobots(),
  title: en.blog.metaTitle,
  twitter: {
    card: "summary_large_image",
    description: en.blog.metaDescription,
    images: [{ alt: shareImage.alt, url: shareImage.url }],
    title: en.blog.metaTitle,
  },
};

const portraitSrcSet =
  "/portraits/portrait-224.webp 224w, /portraits/portrait-336.webp 336w";

export default function BlogIndex(): ReactElement {
  const posts = listPosts({ drafts: showDrafts() });
  return (
    <>
      <SpaceBackground mode="index" />
      <script
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(blogGraph(posts)) }}
        type="application/ld+json"
      />
      <main className="blog-main safe-area" id="main-content">
        <section
          aria-labelledby="blog-heading"
          className="blog-index"
          data-blog-index=""
        >
          <div className="blog-orbit">
            <span
              className="blog-portrait"
              data-eclipse=""
              data-portrait-mini=""
            >
              <img
                alt=""
                decoding="async"
                fetchPriority="high"
                sizes="6rem"
                src="/portraits/portrait-224.webp"
                srcSet={portraitSrcSet}
              />
            </span>
            <BlogMoons
              posts={posts.map((post) => ({
                readingMinutes: post.readingMinutes,
                sky: post.sky,
                slug: post.slug,
                tags: post.tags,
              }))}
            />
          </div>
          <h1 className="blog-heading text-sky" id="blog-heading">
            {en.blog.heading}
          </h1>
          <PostList posts={posts} />
        </section>
        <BlogFooter weatherCredit />
      </main>
    </>
  );
}
