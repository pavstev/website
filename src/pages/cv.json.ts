import type { APIRoute } from "astro";

import { getCv } from "@/lib/cv";

export const GET: APIRoute = async () =>
  Response.json(await getCv(), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
