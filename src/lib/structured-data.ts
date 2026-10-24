import type {
  BlogPosting,
  BreadcrumbList,
  Graph,
  ImageObject,
  Person,
  ProfilePage,
  WebPage,
  WebSite,
} from "schema-dts";

import type { PostMeta } from "./blog/schema.ts";
import type { Contact, Repo } from "./github.ts";
import type { Product } from "./products.ts";

import { blogUrl } from "./blog/metadata.ts";
import { modifiedOf } from "./blog/modified.ts";
import { en } from "./i18n.ts";
import { personalData, plainName } from "./personal.ts";
import { skyStoryUrl, storyUrl } from "./story/metadata.ts";
import { type StoryKey } from "./work.ts";

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

const personNode = (contact: Contact): Person => ({
  "@id": personId,
  "@type": "Person",
  alternateName: [plainName, personalData.githubHandle],
  description: en.meta.description,
  email: `mailto:${contact.email}`,
  familyName: personalData.familyName,
  givenName: personalData.givenName,
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
});

const profilePage = (
  url: string,
  name: string,
  description: string,
  modified: string
): ProfilePage => ({
  "@id": url === home ? profileId : `${url}#profile`,
  "@type": "ProfilePage",
  dateModified: modified,
  description,
  inLanguage: "en",
  isPartOf: { "@id": websiteId },
  mainEntity: { "@id": personId },
  name,
  primaryImageOfPage: portrait,
  url,
});

export const structuredData = (
  repos: Repo[],
  contact: Contact,
  modified: string
): Graph => ({
  "@context": "https://schema.org",
  "@graph": [
    websiteNode,
    profilePage(home, en.meta.title, en.meta.description, modified),
    personNode(contact),
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
  ],
});

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
  dateModified: modifiedOf(post),
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
      timeRequired: `PT${String(post.readingMinutes)}M`,
      wordCount: post.wordCount,
    },
    breadcrumbs(`${post.url}#breadcrumb`, [
      homeCrumb,
      blogCrumb,
      { name: post.title, url: post.url },
    ]),
  ],
});

const storyPages = {
  dotfiles: {
    crumb: en.story.crumb,
    description: en.story.metaDescription,
    name: en.story.metaTitle,
    repo: "dotfiles",
    url: storyUrl,
  },
  website: {
    crumb: en.skyStory.crumb,
    description: en.skyStory.metaDescription,
    name: en.skyStory.metaTitle,
    repo: "website",
    url: skyStoryUrl,
  },
} as const;

export const storyPageNode = (
  updatedAt: string,
  story: StoryKey = "dotfiles"
): WebPage => {
  const page = storyPages[story];
  return {
    "@id": `${page.url}#webpage`,
    "@type": "WebPage",
    dateModified: updatedAt,
    description: page.description,
    inLanguage: "en",
    isPartOf: { "@id": websiteId },
    mainEntity: { "@id": `${site}#repo-${page.repo}` },
    name: page.name,
    url: page.url,
  };
};

export const storyGraph = (
  updatedAt: string,
  story: StoryKey = "dotfiles"
): Graph => {
  const page = storyPages[story];
  return {
    "@context": "https://schema.org",
    "@graph": [
      websiteNode,
      storyPageNode(updatedAt, story),
      breadcrumbs(`${page.url}#breadcrumb`, [
        homeCrumb,
        { name: en.work.heading, url: `${home}/work` },
        { name: page.crumb, url: page.url },
      ]),
    ],
  };
};

const workUrl = `${home}/work`;
const aboutUrl = `${home}/about`;

export const workGraph = (items: readonly Product[]): Graph => ({
  "@context": "https://schema.org",
  "@graph": [
    websiteNode,
    {
      "@id": `${workUrl}#webpage`,
      "@type": "WebPage",
      description: en.work.metaDescription,
      inLanguage: "en",
      isPartOf: { "@id": websiteId },
      name: en.work.metaTitle,
      url: workUrl,
    },
    breadcrumbs(`${workUrl}#breadcrumb`, [
      homeCrumb,
      { name: en.work.heading, url: workUrl },
    ]),
    ...items.map(
      (product) =>
        ({
          "@id": `${site}#product-${product.key}`,
          "@type": product.schemaType,
          applicationCategory: product.applicationCategory,
          creator: { "@id": personId },
          description: product.line,
          name: product.name,
          operatingSystem: product.operatingSystem,
          url: product.url,
        }) as const
    ),
  ],
});

export const aboutGraph = (
  contact: Contact,
  description: string,
  modified: string
): Graph => ({
  "@context": "https://schema.org",
  "@graph": [
    websiteNode,
    profilePage(aboutUrl, en.about.metaTitle, description, modified),
    personNode(contact),
    breadcrumbs(`${aboutUrl}#breadcrumb`, [
      homeCrumb,
      { name: en.about.crumb, url: aboutUrl },
    ]),
  ],
});

export const serializeJsonLd = (data: Graph): string =>
  JSON.stringify(data).replaceAll("<", String.raw`\u003c`);
