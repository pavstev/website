import type { APIRoute } from "astro";

import { personalData } from "@/lib/personal";

export const GET: APIRoute = () =>
  new Response(
    `User-Agent: *\nAllow: /\n\nSitemap: ${personalData.website}/sitemap.xml\n`,
    { headers: { "Content-Type": "text/plain; charset=utf-8" } }
  );
