import type { MetadataRoute } from "next";

import { personalData } from "@/lib/personal";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      images: [
        `${personalData.website}${personalData.portrait.url}`,
        `${personalData.website}/og-image.jpg`,
      ],
      lastModified: new Date(),
      url: personalData.website,
    },
  ];
}
