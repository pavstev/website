import type { APIRoute } from "astro";

import { showDrafts } from "@/lib/blog/build-env";
import { listPosts } from "@/lib/blog/posts";
import { getCv } from "@/lib/cv";
import { cvLlmsSections } from "@/lib/cv-llms";
import { getContact, getRepos } from "@/lib/github";
import { en } from "@/lib/i18n";
import { personalData, plainName } from "@/lib/personal";
import { productLlmsLines, products } from "@/lib/products";

export const GET: APIRoute = async () => {
  const [repos, contact, cv] = await Promise.all([
    getRepos(personalData.githubHandle),
    getContact(personalData.githubHandle),
    getCv(),
  ]);
  const posts = listPosts({ drafts: showDrafts() });
  const body = [
    `# ${personalData.name}`,
    "",
    `> ${en.llms.about
      .replace("{city}", () => personalData.city)
      .replace("{country}", () => personalData.country)}`,
    "",
    `${en.llms.detail} ${en.llms.alsoWritten.replace("{name}", () => plainName)}`,
    "",
    `## ${en.llms.topics}`,
    "",
    personalData.knowsAbout.join(", "),
    "",
    `## ${en.llms.projects}`,
    "",
    ...repos.map(
      (repo) => `- [${repo.name}](${repo.url}): ${repo.description}`
    ),
    "",
    `## ${en.products.llmsHeading}`,
    "",
    ...productLlmsLines(products),
    "",
    ...(posts.length > 0
      ? [
          `## ${en.llms.blog}`,
          "",
          `- [${en.llms.blogIndex}](${personalData.website}/blog)`,
          `- [${en.llms.blogFeedRss}](${personalData.website}/blog/feed.xml)`,
          `- [${en.llms.blogFeedJson}](${personalData.website}/blog/feed.json)`,
          ...posts.map(
            (post) =>
              `- [${post.title}](${personalData.website}/blog/${post.slug}.md): ${post.description}`
          ),
          "",
        ]
      : []),
    ...cvLlmsSections(cv),
    `## ${en.llms.links}`,
    "",
    `- [${en.llms.website}](${personalData.website})`,
    `- [${en.llms.resume}](${personalData.website}/resume.pdf)`,
    `- [${en.llms.cvJson}](${personalData.website}/cv.json)`,
    `- [${en.llms.github}](${personalData.github})`,
    `- [${en.llms.linkedin}](${contact.linkedin})`,
    `- [${en.llms.email}](mailto:${contact.email})`,
    "",
  ].join("\n");
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
