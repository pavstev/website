import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import {
  compact,
  type Facts,
  loadFacts,
  projectsText,
  roleBlock,
  skillLines,
} from "./facts.ts";
import { clientIp, failure } from "./http.ts";

const serverName = "stevanpavlovic.com";
const serverVersion = "0.1.0";
const projectsHeading = "Open-source projects";
const resumeProjectsHeading = "Projects from the résumé";
const linksHeading = "Links";
const unavailable = "Not available.";
const maxRequestBodySize = 16_384;
const readOnly = { openWorldHint: false, readOnlyHint: true };

type Cv = Facts["cv"];

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

const textResult = (
  text: string
): { content: [{ text: string; type: "text" }] } => ({
  content: [{ text, type: "text" }],
});

export const createMcpServer = (facts: Facts): McpServer => {
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
    "contact",
    {
      annotations: readOnly,
      description: "Website, résumé, GitHub, LinkedIn and email links.",
    },
    () => textResult(section(llms, linksHeading) ?? unavailable)
  );

  return server;
};

export const handleMcp = async (
  request: Request,
  env: Env
): Promise<Response> => {
  if (request.method !== "POST") {
    return failure(405, "method", { Allow: "POST" });
  }

  try {
    const { success } = await env.ASK_LIMITER.limit({
      key: clientIp(request),
    });

    if (!success) {
      return failure(429, "limit");
    }

    const facts = await loadFacts(env.ASSETS, new URL(request.url).origin);
    const server = createMcpServer(facts);
    const transport = new WebStandardStreamableHTTPServerTransport({
      maxRequestBodySize,
    });

    await server.connect(transport);

    return await transport.handleRequest(request);
  } catch {
    return failure(502, "failed");
  }
};
