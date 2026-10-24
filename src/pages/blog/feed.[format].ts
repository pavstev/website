import type { APIRoute } from "astro";

import { imageUrlsOf } from "@/components/blog/post-images";
import { showDrafts } from "@/lib/blog/build-env";
import { jsonFeed, loadFeedPosts, rssXml } from "@/lib/blog/feeds";
import { blogLive } from "@/lib/blog/live";
import { personalData } from "@/lib/personal";

export const getStaticPaths = (): Array<{ params: { format: string } }> =>
  blogLive()
    ? [{ params: { format: "xml" } }, { params: { format: "json" } }]
    : [];

export const GET: APIRoute = async ({ params }) => {
  const { website } = personalData;
  const posts = await loadFeedPosts(
    { drafts: showDrafts() },
    website,
    (source) => imageUrlsOf(source, website)
  );
  return params["format"] === "json"
    ? Response.json(jsonFeed(posts, website), {
        headers: { "Content-Type": "application/feed+json; charset=utf-8" },
      })
    : new Response(rssXml(posts, website), {
        headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
      });
};
