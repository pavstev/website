import type { Graph, ImageObject } from "schema-dts";

import type { Contact, Repo } from "./github.ts";
import type { Product } from "./products.ts";

import { en } from "./i18n.ts";
import { personalData, plainName } from "./personal.ts";

const site = `${personalData.website}/`;
const personId = `${site}#person`;
const profileId = `${site}#profile`;
const websiteId = `${site}#website`;

const portrait: ImageObject = {
  "@type": "ImageObject",
  caption: en.card.portraitAlt,
  height: String(personalData.portrait.height),
  url: `${personalData.website}${personalData.portrait.url}`,
  width: String(personalData.portrait.width),
};

export const structuredData = (
  repos: Repo[],
  contact: Contact,
  modified: Date,
  items: readonly Product[]
): Graph => ({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@id": websiteId,
      "@type": "WebSite",
      inLanguage: "en",
      name: personalData.name,
      publisher: { "@id": personId },
      url: site,
    },
    {
      "@id": profileId,
      "@type": "ProfilePage",
      dateModified: modified.toISOString(),
      description: en.meta.description,
      inLanguage: "en",
      isPartOf: { "@id": websiteId },
      mainEntity: { "@id": personId },
      name: en.meta.title,
      primaryImageOfPage: portrait,
      url: site,
    },
    {
      "@id": personId,
      "@type": "Person",
      address: {
        "@type": "PostalAddress",
        addressCountry: personalData.countryCode,
        addressLocality: personalData.city,
      },
      alternateName: [plainName, personalData.githubHandle],
      description: en.meta.description,
      email: `mailto:${contact.email}`,
      familyName: personalData.familyName,
      givenName: personalData.givenName,
      homeLocation: {
        "@type": "City",
        containedInPlace: { "@type": "Country", name: personalData.country },
        name: personalData.city,
      },
      image: portrait,
      jobTitle: personalData.title.split(" · "),
      knowsAbout: [...personalData.knowsAbout],
      knowsLanguage: [...personalData.languages],
      mainEntityOfPage: { "@id": profileId },
      name: personalData.name,
      sameAs: [personalData.github, contact.linkedin],
      subjectOf: {
        "@type": "DigitalDocument",
        encodingFormat: "application/pdf",
        name: en.meta.resume,
        url: `${site}resume.pdf`,
      },
      url: site,
    },
    ...repos.map(
      (repo) =>
        ({
          "@type": "SoftwareSourceCode",
          author: { "@id": personId },
          codeRepository: repo.url,
          description: repo.description,
          keywords: repo.topics,
          name: repo.name,
          ...(repo.language && { programmingLanguage: repo.language }),
        }) as const
    ),
    ...items.map(
      (product) =>
        ({
          "@id": `${site}#product-${product.key}`,
          "@type": product.schemaType,
          applicationCategory: product.applicationCategory,
          creator: { "@id": personId },
          description: product.line,
          name: product.name,
          url: product.url,
        }) as const
    ),
  ],
});

export const serializeJsonLd = (data: Graph): string =>
  JSON.stringify(data).replaceAll("<", String.raw`\u003c`);
