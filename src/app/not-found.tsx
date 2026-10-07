import type { Metadata } from "next";
import type { ReactElement } from "react";

import Link from "next/link";

import { en } from "@/lib/i18n";

export const metadata: Metadata = {
  title: en.notFound.title,
};

export default function NotFound(): ReactElement {
  return (
    <main className="grid min-h-dvh place-items-center overflow-x-clip safe-area text-center">
      <div className="container-page grid justify-items-center gap-4">
        <h1 className="type-display text-balance text-foreground">
          {en.notFound.title}
        </h1>
        <Link
          className="focus-ring inline-flex min-h-11 items-center text-primary underline"
          href="/"
        >
          {en.notFound.home}
        </Link>
      </div>
    </main>
  );
}
