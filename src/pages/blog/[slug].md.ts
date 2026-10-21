import type { APIRoute } from "astro";

import { imageUrlsOf } from "@/components/blog/post-images";
import { showDrafts } from "@/lib/blog/build-env";
import { toMarkdown } from "@/lib/blog/plain";
import { findPost, listPosts } from "@/lib/blog/posts";
import { personalData } from "@/lib/personal";

export const getStaticPaths = (): Array<{ params: { slug: string } }> =>
  listPosts({ drafts: showDrafts() }).map((post) => ({
    params: { slug: post.slug },
  }));

export const GET: APIRoute = async ({ params }) => {
  const source = findPost(params["slug"] ?? "", { drafts: showDrafts() });
  if (source === undefined) return new Response(null, { status: 404 });
  const imageUrl = await imageUrlsOf(source, personalData.website);
  return new Response(toMarkdown(source, imageUrl), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
};
