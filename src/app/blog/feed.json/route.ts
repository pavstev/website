import { showDrafts } from "@/lib/blog/build-env";
import { jsonFeed, loadFeedPosts } from "@/lib/blog/feeds";
import { personalData } from "@/lib/personal";

export const dynamic = "force-static";

export const GET = (): Response => {
  const { website } = personalData;
  const posts = loadFeedPosts({ drafts: showDrafts() }, website);
  return Response.json(jsonFeed(posts, website), {
    headers: { "Content-Type": "application/feed+json; charset=utf-8" },
  });
};
