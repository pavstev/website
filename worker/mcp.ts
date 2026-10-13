import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import * as z from "zod";

import {
  type BlogPost,
  compact,
  type Facts,
  loadBlogPosts,
  loadFacts,
  loadPostMarkdown,
  projectsText,
  roleBlock,
  skillLines,
} from "./facts.ts";
import { clientIp, failure, withSecurityHeaders } from "./http.ts";

const serverName = "stevanpavlovic.com";
const serverVersion = "0.1.0";
const projectsHeading = "Open-source projects";
const productsHeading = "Products";
const resumeProjectsHeading = "Projects from the résumé";
const linksHeading = "Links";
const unavailable = "Not available.";
const maxRequestBodySize = 16_384;
const slugPattern = /^[a-z0-9-]{1,80}$/;
const notFound = JSON.stringify({ error: "not_found" });
const readOnly = { openWorldHint: false, readOnlyHint: true };

export interface BlogSource {
  assets: Fetcher;
  origin: string;
}

type Cv = Facts["cv"];

interface ToolResult {
  [key: string]: unknown;
  content: [{ text: string; type: "text" }];
  isError?: boolean;
}

const section = (llms: string, heading: string): string | undefined => {
  const lines = llms.split("\n");
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`);

  if (start === -1) {
    return undefined;
  }

  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith("## "));
  const body = (end === -1 ? rest : rest.slice(0, end)).join("\n").trim();

  return body || undefined;
};

const linkOf = (llms: string, label: string): string | undefined => {
  const prefix = label.toLowerCase();

  const lines = (section(llms, linksHeading) ?? "").split("\n");

  for (const line of lines) {
    const match = /^-\s*\[([^\]]*)\]\(([^)\s]+)\)/.exec(line.trim());
    const text = match?.[1];
    const url = match?.[2];

    if (url && text?.toLowerCase().startsWith(prefix)) {
      return `${label}: ${url}`;
    }
  }

  return undefined;
};

const profileText = (facts: Facts): string =>
  compact([
    facts.cv.basics.name,
    facts.cv.basics.headline,
    facts.cv.basics.location,
    facts.cv.summary,
    linkOf(facts.llms, "Website"),
    linkOf(facts.llms, "GitHub"),
  ]).join("\n");

const experienceText = (cv: Cv): string =>
  cv.experience.items.length > 0
    ? cv.experience.items.map((role) => roleBlock(role)).join("\n\n")
    : unavailable;

const skillsText = (cv: Cv): string => {
  const lines = skillLines(cv);

  return lines.length > 0 ? lines.join("\n") : unavailable;
};

const projectsAnswer = (facts: Facts): string => {
  const resume = projectsText(facts.cv);

  return (
    compact([
      section(facts.llms, projectsHeading),
      resume ? `${resumeProjectsHeading}\n${resume}` : undefined,
    ]).join("\n\n") || unavailable
  );
};

const postBlock = (post: BlogPost): string =>
  [
    post.title,
    `URL: ${post.url}`,
    `Date: ${post.date}`,
    `Tags: ${post.tags.join(", ")}`,
    `Markdown: ${post.markdownUrl}`,
    post.description,
  ].join("\n");

const postsText = async (blog: BlogSource): Promise<string> => {
  try {
    const posts = await loadBlogPosts(blog.assets, blog.origin);

    return posts.length > 0
      ? posts.map((post) => postBlock(post)).join("\n\n")
      : unavailable;
  } catch {
    return unavailable;
  }
};

const postResult = async (
  blog: BlogSource,
  slug: string
): Promise<ToolResult> => {
  try {
    const markdown = await loadPostMarkdown(blog.assets, blog.origin, slug);
    return markdown === undefined
      ? { content: [{ text: notFound, type: "text" }], isError: true }
      : textResult(markdown);
  } catch {
    return textResult(unavailable);
  }
};

const textResult = (text: string): ToolResult => ({
  content: [{ text, type: "text" }],
});

export const createMcpServer = (facts: Facts, blog: BlogSource): McpServer => {
  const server = new McpServer({ name: serverName, version: serverVersion });
  const { cv, llms } = facts;

  server.registerTool(
    "profile",
    {
      annotations: readOnly,
      description:
        "Name, headline, location, summary, website and GitHub of the site owner.",
    },
    () => textResult(profileText(facts))
  );
  server.registerTool(
    "experience",
    {
      annotations: readOnly,
      description: "Every role in the work history.",
    },
    () => textResult(experienceText(cv))
  );
  server.registerTool(
    "skills",
    {
      annotations: readOnly,
      description: "Skill groups with their keywords.",
    },
    () => textResult(skillsText(cv))
  );
  server.registerTool(
    "projects",
    {
      annotations: readOnly,
      description:
        "Open-source projects, one per line with a link, then the projects from the résumé.",
    },
    () => textResult(projectsAnswer(facts))
  );
  server.registerTool(
    "products",
    {
      annotations: readOnly,
      description:
        "Products the site owner founded, one per line: link, role, years and what it does.",
    },
    () => textResult(section(llms, productsHeading) ?? unavailable)
  );
  server.registerTool(
    "contact",
    {
      annotations: readOnly,
      description: "Website, résumé, GitHub, LinkedIn and email links.",
    },
    () => textResult(section(llms, linksHeading) ?? unavailable)
  );
  server.registerTool(
    "posts",
    {
      annotations: readOnly,
      description:
        "Blog posts, newest first: title, link, date, tags, Markdown link and a short description.",
    },
    async () => textResult(await postsText(blog))
  );
  server.registerTool(
    "post",
    {
      annotations: readOnly,
      description:
        "The full text of one blog post as Markdown. Use a slug from the posts tool.",
      inputSchema: { slug: z.string().regex(slugPattern) },
    },
    async ({ slug }) => postResult(blog, slug)
  );

  return server;
};

export const handleMcp = async (
  request: Request,
  env: Env
): Promise<Response> => withSecurityHeaders(await respond(request, env));

const respond = async (request: Request, env: Env): Promise<Response> => {
  if (request.method !== "POST") {
    return failure(405, "method", { Allow: "POST" });
  }

  try {
    const { success } = await env.MCP_LIMITER.limit({
      key: clientIp(request),
    });

    if (!success) {
      return failure(429, "limit");
    }

    const { origin } = new URL(request.url);
    const facts = await loadFacts(env.ASSETS, origin);
    const server = createMcpServer(facts, { assets: env.ASSETS, origin });
    const transport = new WebStandardStreamableHTTPServerTransport({
      maxRequestBodySize,
    });

    await server.connect(transport);

    return await transport.handleRequest(request);
  } catch {
    return failure(502, "failed");
  }
};
