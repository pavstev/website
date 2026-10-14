import type { APIRoute } from "astro";

import { showDrafts } from "@/lib/blog/build-env";
import { loadFeedPosts, rssXml } from "@/lib/blog/feeds";
import { personalData } from "@/lib/personal";

export const GET: APIRoute = () => {
  const { website } = personalData;
  const posts = loadFeedPosts({ drafts: showDrafts() }, website);
  return new Response(rssXml(posts, website), {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
};
