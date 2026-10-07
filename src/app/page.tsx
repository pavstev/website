import type { Metadata } from "next";
import type { ReactElement } from "react";

import { CardFooter } from "@/components/card-footer";
import { CloudsCanvas } from "@/components/clouds-canvas";
import { ContactLinks } from "@/components/contact-links";
import { CursorGlow } from "@/components/cursor-glow";
import { DownloadButton } from "@/components/download-button";
import { EffectsInit } from "@/components/effects-init";
import { PrivacyNote } from "@/components/privacy-note";
import { Profile } from "@/components/profile";
import { RepoStrip } from "@/components/repo-strip";
import { SpaceBackground } from "@/components/space-background";
import { getRepos } from "@/lib/github";
import { en } from "@/lib/i18n";
import { personalData } from "@/lib/personal";
import { serializeJsonLd, structuredData } from "@/lib/structured-data";

export const metadata: Metadata = {
  alternates: { canonical: `${personalData.website}/` },
  description: en.meta.description,
  robots: {
    follow: true,
    googleBot: {
      follow: true,
      index: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
    index: true,
  },
  title: en.meta.title,
};

export default async function Page(): Promise<ReactElement> {
  const repos = await getRepos(personalData.githubHandle);
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(structuredData(repos, new Date())),
        }}
        type="application/ld+json"
      />
      <SpaceBackground />
      <CloudsCanvas />
      <CursorGlow />
      <main
        className="relative grid min-h-dvh grid-cols-1 place-items-center overflow-x-clip safe-area"
        id="main-content"
      >
        <div
          className="container-page relative z-10 flex w-full flex-col items-center text-center"
          data-card=""
        >
          <Profile />
          <div className="fade-up relative z-1 mt-(--card-gap-actions) flex flex-wrap items-center justify-center gap-x-5 gap-y-4 delay-2">
            <DownloadButton />
            <ContactLinks />
          </div>
          <RepoStrip repos={repos} />
          <CardFooter />
        </div>
        <EffectsInit />
      </main>
      <PrivacyNote />
    </>
  );
}
