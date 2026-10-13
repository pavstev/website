import { showDrafts } from "@/lib/blog/build-env";
import { shareImageUrl } from "@/lib/blog/media";
import { listPosts } from "@/lib/blog/posts";
import { getCv } from "@/lib/cv";
import { personalData } from "@/lib/personal";
import { sitemapEntries, sitemapXml } from "@/lib/sitemap";

export const dynamic = "force-static";

export const GET = async (): Promise<Response> => {
  const { portrait, website } = personalData;
  const cv = await getCv();
  const entries = sitemapEntries({
    homeImages: [`${website}${portrait.url}`, `${website}/og-image.jpg`],
    homeModified: cv.updatedAt,
    imageFor: (slug) => shareImageUrl(slug, website),
    posts: listPosts({ drafts: showDrafts() }),
    site: website,
  });
  return new Response(sitemapXml(entries), {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
};
