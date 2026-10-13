import type {
  BlogPosting,
  BreadcrumbList,
  Graph,
  ImageObject,
  Person,
  WebSite,
} from "schema-dts";

import type { PostMeta } from "./blog/schema.ts";
import type { Contact, Repo } from "./github.ts";
import type { Product } from "./products.ts";

import { en } from "./i18n.ts";
import { personalData, plainName } from "./personal.ts";

const home = personalData.website;
const site = `${home}/`;
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

const websiteNode: WebSite = {
  "@id": websiteId,
  "@type": "WebSite",
  inLanguage: "en",
  name: personalData.name,
  publisher: { "@id": personId },
  url: home,
};

export const structuredData = (
  repos: Repo[],
  contact: Contact,
  modified: string,
  items: readonly Product[]
): Graph => ({
  "@context": "https://schema.org",
  "@graph": [
    websiteNode,
    {
      "@id": profileId,
      "@type": "ProfilePage",
      dateModified: modified,
      description: en.meta.description,
      inLanguage: "en",
      isPartOf: { "@id": websiteId },
      mainEntity: { "@id": personId },
      name: en.meta.title,
      primaryImageOfPage: portrait,
      url: home,
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
      url: home,
    },
    ...repos.map(
      (repo) =>
        ({
          "@id": `${site}#repo-${repo.name}`,
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

const blogUrl = `${home}/blog`;
const blogId = `${blogUrl}#blog`;
const postId = (post: PostMeta): string => `${post.url}#post`;

const author: Person = {
  "@id": personId,
  "@type": "Person",
  name: personalData.name,
  url: home,
};

interface Crumb {
  name: string;
  url: string;
}

const breadcrumbs = (id: string, crumbs: readonly Crumb[]): BreadcrumbList => ({
  "@id": id,
  "@type": "BreadcrumbList",
  itemListElement: crumbs.map((crumb, index) => ({
    "@type": "ListItem",
    item: crumb.url,
    name: crumb.name,
    position: index + 1,
  })),
});

const homeCrumb: Crumb = { name: personalData.name, url: home };
const blogCrumb: Crumb = { name: en.blog.heading, url: blogUrl };

const postSummary = (post: PostMeta): BlogPosting => ({
  "@id": postId(post),
  "@type": "BlogPosting",
  author,
  dateModified: post.updated ?? post.date,
  datePublished: post.date,
  description: post.description,
  headline: post.title,
  inLanguage: "en",
  keywords: [...post.tags],
  url: post.url,
});

export const blogGraph = (posts: readonly PostMeta[]): Graph => ({
  "@context": "https://schema.org",
  "@graph": [
    websiteNode,
    {
      "@id": blogId,
      "@type": "Blog",
      author,
      blogPost: posts.map((post) => postSummary(post)),
      description: en.blog.metaDescription,
      inLanguage: "en",
      isPartOf: { "@id": websiteId },
      name: en.blog.blogName,
      publisher: author,
      url: blogUrl,
    },
    breadcrumbs(`${blogUrl}#breadcrumb`, [homeCrumb, blogCrumb]),
  ],
});

export interface PostImage {
  height: number;
  url: string;
  width: number;
}

const imageObject = (image: PostImage): ImageObject => ({
  "@type": "ImageObject",
  height: String(image.height),
  url: image.url,
  width: String(image.width),
});

export const postGraph = (
  post: PostMeta,
  images: readonly PostImage[]
): Graph => ({
  "@context": "https://schema.org",
  "@graph": [
    {
      ...postSummary(post),
      image: images.map((image) => imageObject(image)),
      isPartOf: {
        "@id": blogId,
        "@type": "Blog",
        name: en.blog.blogName,
        url: blogUrl,
      },
      mainEntityOfPage: { "@id": post.url, "@type": "WebPage" },
      publisher: author,
      wordCount: post.wordCount,
    },
    breadcrumbs(`${post.url}#breadcrumb`, [
      homeCrumb,
      blogCrumb,
      { name: post.title, url: post.url },
    ]),
  ],
});

export const serializeJsonLd = (data: Graph): string =>
  JSON.stringify(data).replaceAll("<", String.raw`\u003c`);
