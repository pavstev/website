import type { MetadataRoute } from "next";

import { personalData } from "@/lib/personal";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { allow: "/", userAgent: "*" },
    sitemap: `${personalData.website}/sitemap.xml`,
  };
}
