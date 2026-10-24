import type { APIRoute } from "astro";

import path from "node:path";

import { findCover } from "@/components/blog/post-images";
import { showDrafts } from "@/lib/blog/build-env";
import { findPost, listPosts } from "@/lib/blog/posts";
import { shareFonts, sharePng } from "@/lib/blog/share";

const fonts = shareFonts();

export const getStaticPaths = (): Array<{ params: { slug: string } }> =>
  listPosts({ drafts: showDrafts() }).map((post) => ({
    params: { slug: post.slug },
  }));

export const GET: APIRoute = async ({ params }) => {
  const slug = params["slug"] ?? "";
  const source = findPost(slug, { drafts: showDrafts() });
  if (source === undefined) return new Response(null, { status: 404 });
  const cover = await findCover(slug);
  const png = await sharePng(
    source.meta,
    cover === undefined ? undefined : path.join(process.cwd(), cover.key),
    fonts
  );
  return new Response(png, { headers: { "Content-Type": "image/png" } });
};
