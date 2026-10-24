import type { APIRoute } from "astro";

import { builtInstant } from "@/lib/blog/build-env";
import { commitSha, markerText } from "@/lib/blog/marker";

export const GET: APIRoute = () =>
  new Response(
    markerText(commitSha(process.env), builtInstant() ?? new Date()),
    { headers: { "Content-Type": "application/json; charset=utf-8" } }
  );
