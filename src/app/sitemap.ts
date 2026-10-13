import type { MetadataRoute } from "next";

import { getCv } from "@/lib/cv";
import { personalData } from "@/lib/personal";

export const dynamic = "force-static";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const cv = await getCv();
  return [
    {
      images: [
        `${personalData.website}${personalData.portrait.url}`,
        `${personalData.website}/og-image.jpg`,
      ],
      lastModified: cv.updatedAt,
      url: personalData.website,
    },
  ];
}
