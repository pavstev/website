import { getResumePdf } from "@/lib/resume-file";

export const dynamic = "force-static";

export const GET = async (): Promise<Response> =>
  new Response(Buffer.from(await getResumePdf()), {
    headers: { "Content-Type": "application/pdf" },
  });
