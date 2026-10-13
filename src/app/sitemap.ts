import type { MetadataRoute } from "next";

import { showDrafts } from "@/lib/blog/build-env";
import { shareImageUrl } from "@/lib/blog/media";
import { lastModified, listPosts } from "@/lib/blog/posts";
import { getCv } from "@/lib/cv";
import { personalData } from "@/lib/personal";

export const dynamic = "force-static";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const cv = await getCv();
  const posts = listPosts({ drafts: showDrafts() });
  const blogModified = lastModified(posts);
  return [
    {
      images: [
        `${personalData.website}${personalData.portrait.url}`,
        `${personalData.website}/og-image.jpg`,
      ],
      lastModified: cv.updatedAt,
      url: personalData.website,
    },
    ...(blogModified === undefined
      ? []
      : [{ lastModified: blogModified, url: `${personalData.website}/blog` }]),
    ...posts.map((post) => {
      const image = shareImageUrl(post.slug, personalData.website);
      return {
        ...(image !== undefined && { images: [image] }),
        lastModified: post.updated ?? post.date,
        url: post.url,
      };
    }),
  ];
}
