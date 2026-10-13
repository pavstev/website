import type { Metadata } from "next";
import type { ReactElement } from "react";

import { BlogButton } from "@/components/blog-button";
import { CardStrips } from "@/components/card-strips";
import { ContactLinks } from "@/components/contact-links";
import { DownloadButton } from "@/components/download-button";
import { EffectsInit } from "@/components/effects-init";
import { MotionToggle } from "@/components/motion-toggle";
import { PageDock } from "@/components/page-dock";
import { Profile } from "@/components/profile";
import { ResumeTip } from "@/components/resume-tip";
import { SiteFooter } from "@/components/site-footer";
import { SpaceBackground } from "@/components/space-background";
import { pageRobots, showDrafts } from "@/lib/blog/build-env";
import { listPosts } from "@/lib/blog/posts";
import { getCv } from "@/lib/cv";
import { getContact, getRepos } from "@/lib/github";
import { en } from "@/lib/i18n";
import { personalData } from "@/lib/personal";
import { products } from "@/lib/products";
import { getResumeFacts } from "@/lib/resume-facts";
import { serializeJsonLd, structuredData } from "@/lib/structured-data";

const resumeDetailId = "resume-detail";

export const metadata: Metadata = {
  alternates: { canonical: personalData.website },
  description: en.meta.description,
  robots: pageRobots(),
  title: en.meta.title,
};

export default async function Page(): Promise<ReactElement> {
  const [repos, contact, resume, cv] = await Promise.all([
    getRepos(personalData.githubHandle),
    getContact(personalData.githubHandle),
    getResumeFacts(),
    getCv(),
  ]);
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(
            structuredData(repos, contact, cv.updatedAt, products)
          ),
        }}
        type="application/ld+json"
      />
      <SpaceBackground />
      <MotionToggle />
      <main
        className="relative grid min-h-dvh grid-cols-1 place-items-center overflow-x-clip safe-area"
        id="main-content"
      >
        <div
          className="container-page relative z-10 flex w-full flex-col items-center text-center"
          data-card=""
        >
          <Profile />
          <div
            className="fade-up contact-row relative z-1 mt-(--card-gap-actions) flex w-full flex-wrap items-center justify-center gap-3 delay-2"
            data-proximity=""
          >
            <DownloadButton describedBy={resumeDetailId}>
              <ResumeTip detailId={resumeDetailId} facts={resume} />
            </DownloadButton>
            <div className="contact-group flex items-center justify-center gap-3">
              <ContactLinks contact={contact} />
              <BlogButton count={listPosts({ drafts: showDrafts() }).length} />
            </div>
          </div>
          <CardStrips products={products} repos={repos} />
          <SiteFooter
            className="card-footer fade-up mt-(--card-gap-footer) delay-4"
            weatherCredit
          />
        </div>
        <EffectsInit />
      </main>
      <PageDock email={contact.email} />
    </>
  );
}
