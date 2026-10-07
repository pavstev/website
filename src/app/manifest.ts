import type { MetadataRoute } from "next";

import { en } from "@/lib/i18n";
import { personalData } from "@/lib/personal";
import { designTokens } from "@/lib/theme";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: designTokens.background,
    description: en.meta.description,
    display: "browser",
    icons: [
      {
        purpose: "any",
        sizes: "192x192",
        src: "/android-chrome-192x192.png",
        type: "image/png",
      },
      {
        purpose: "any",
        sizes: "512x512",
        src: "/android-chrome-512x512.png",
        type: "image/png",
      },
    ],
    lang: "en",
    name: personalData.name,
    short_name: en.meta.shortName,
    start_url: "/",
    theme_color: designTokens.background,
  };
}
