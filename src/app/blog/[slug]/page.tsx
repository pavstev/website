import type { Metadata } from "next";
import type { ReactElement } from "react";

import { notFound } from "next/navigation";

import { BlogFooter } from "@/components/blog/blog-footer";
import { PostBody } from "@/components/blog/post-body";
import { PostHeader } from "@/components/blog/post-header";
import { PostNav } from "@/components/blog/post-nav";
import { pageRobots, showDrafts } from "@/lib/blog/build-env";
import { postTitle } from "@/lib/blog/format";
import { postCrops } from "@/lib/blog/media";
import { feedTypes, postShareImage } from "@/lib/blog/metadata";
import { findPost, listPosts } from "@/lib/blog/posts";
import { renderPost } from "@/lib/blog/render";
import { personalData } from "@/lib/personal";
import { postGraph, serializeJsonLd } from "@/lib/structured-data";

interface PostPageProps {
  params: Promise<{ slug: string }>;
}

export const dynamicParams = false;

const drafts = (): { drafts: boolean } => ({ drafts: showDrafts() });

export const generateStaticParams = (): Array<{ slug: string }> =>
  listPosts(drafts()).map((post) => ({ slug: post.slug }));

export const generateMetadata = async ({
  params,
}: PostPageProps): Promise<Metadata> => {
  const { slug } = await params;
  const source = findPost(slug, drafts());
  if (source === undefined) {
    return {};
  }
  const { meta } = source;
  const title = postTitle(meta.title);
  const image = postShareImage(meta);
  return {
    alternates: { canonical: meta.url, types: feedTypes },
    description: meta.description,
    keywords: meta.tags,
    openGraph: {
      authors: [personalData.website],
      description: meta.description,
      images: [image],
      locale: "en_US",
      modifiedTime: meta.updated ?? meta.date,
      publishedTime: meta.date,
      siteName: personalData.name,
      tags: meta.tags,
      title,
      type: "article",
      url: meta.url,
    },
    robots: pageRobots(),
    title,
    twitter: {
      card: "summary_large_image",
      description: meta.description,
      images: [{ alt: image.alt, url: image.url }],
      title,
    },
  };
};

export default async function PostPage({
  params,
}: PostPageProps): Promise<ReactElement> {
  const { slug } = await params;
  const source = findPost(slug, drafts());
  if (source === undefined) {
    notFound();
  }
  const { content, toc } = await renderPost(source);
  const posts = listPosts(drafts());
  const index = posts.findIndex((post) => post.slug === slug);
  const image = postShareImage(source.meta);
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(
            postGraph(source.meta, [
              {
                height: image.height,
                url: `${personalData.website}${image.url}`,
                width: image.width,
              },
              ...postCrops(slug, personalData.website),
            ])
          ),
        }}
        type="application/ld+json"
      />
      <main className="blog-main post-main" id="main-content">
        <PostHeader post={source.meta} />
        <div className="post-page">
          <PostBody content={content} toc={toc} />
          <PostNav newer={posts[index - 1]} older={posts[index + 1]} />
          <BlogFooter />
        </div>
      </main>
    </>
  );
}
