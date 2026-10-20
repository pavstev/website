import type { APIRoute } from "astro";

import { getResumePdf } from "@/lib/resume-file";

export const GET: APIRoute = async () =>
  new Response(Buffer.from(await getResumePdf()), {
    headers: { "Content-Type": "application/pdf" },
  });
