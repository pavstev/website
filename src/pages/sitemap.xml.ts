import type { APIRoute } from "astro";

import { storyMeta } from "@/data/dotfiles-story";
import { showDrafts } from "@/lib/blog/build-env";
import { absoluteUrl, shareImagePath } from "@/lib/blog/images";
import { listPosts } from "@/lib/blog/posts";
import { getCv } from "@/lib/cv";
import { personalData } from "@/lib/personal";
import { sitemapEntries, sitemapXml } from "@/lib/sitemap";
import { dotfilesStory } from "@/lib/work";

export const GET: APIRoute = async () => {
  const { portrait, website } = personalData;
  const cv = await getCv();
  const entries = sitemapEntries({
    homeImages: [`${website}${portrait.url}`, `${website}/og-image.jpg`],
    homeModified: cv.updatedAt,
    imageFor: (slug) => absoluteUrl(shareImagePath(slug), website),
    posts: listPosts({ drafts: showDrafts() }),
    site: website,
    stories: [{ path: dotfilesStory, updatedAt: storyMeta.updatedAt }],
  });
  return new Response(sitemapXml(entries), {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
};
