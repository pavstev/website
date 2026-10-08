import { getCv } from "@/lib/cv";

export const dynamic = "force-static";

export const GET = async (): Promise<Response> =>
  Response.json(await getCv(), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
