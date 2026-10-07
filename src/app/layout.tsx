import type { Metadata, Viewport } from "next";

import "@/styles/globals.css";
import type { ReactElement, ReactNode } from "react";

import Script from "next/script";

import { en } from "@/lib/i18n";
import { personalData } from "@/lib/personal";
import { privacyAckScript } from "@/lib/privacy-ack";
import { designTokens } from "@/lib/theme";

export const viewport: Viewport = {
  initialScale: 1,
  themeColor: designTokens.background,
  viewportFit: "cover",
  width: "device-width",
};

export const metadata: Metadata = {
  authors: [{ name: personalData.name, url: personalData.website }],
  description: en.meta.description,
  icons: {
    apple: [{ sizes: "180x180", url: "/apple-touch-icon.png" }],
    icon: [
      { sizes: "32x32", url: "/favicon-32x32.png" },
      { url: "/favicon.ico" },
    ],
  },
  metadataBase: new URL(personalData.website),
  openGraph: {
    description: en.meta.description,
    firstName: personalData.givenName,
    images: [
      {
        alt: en.meta.imageAlt,
        height: 630,
        type: "image/jpeg",
        url: "/og-image.jpg",
        width: 1200,
      },
    ],
    lastName: personalData.familyName,
    locale: "en_US",
    siteName: personalData.name,
    title: en.meta.title,
    type: "profile",
    url: "/",
    username: personalData.githubHandle,
  },
  title: en.meta.title,
  twitter: {
    card: "summary_large_image",
    description: en.meta.description,
    images: [{ alt: en.meta.imageAlt, url: "/og-image.jpg" }],
    title: en.meta.title,
  },
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({
  children,
}: RootLayoutProps): ReactElement {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link href="/sitemap.xml" rel="sitemap" />
      </head>
      <body>
        {children}
        <Script id="privacy-ack" strategy="beforeInteractive">
          {privacyAckScript}
        </Script>
      </body>
    </html>
  );
}
