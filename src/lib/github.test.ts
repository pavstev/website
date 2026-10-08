import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getProject, type Release, type ReleaseAsset } from "./github.ts";

const markdownHtml = '<h1>Hi</h1><p><img src="src/logo.svg"></p>';

const readmeText = "# Hi\n\n![logo](src/logo.svg)";

const readme = Buffer.from(readmeText).toString("base64");

const releases = [
  {
    assets: [
      {
        browser_download_url: "https://example.com/sapat.zip",
        name: "sapat.zip",
        size: 1234,
      },
    ],
    draft: false,
    html_url: "https://github.com/pavstev/sapat/releases/tag/v1.0.0",
    name: "",
    prerelease: false,
    published_at: "2026-10-01T00:00:00Z",
    tag_name: "v1.0.0",
  },
  {
    assets: [],
    draft: false,
    html_url: "https://github.com/pavstev/sapat/releases/tag/v1.1.0-rc.1",
    name: "Candidate",
    prerelease: true,
    published_at: "2026-10-02T00:00:00Z",
    tag_name: "v1.1.0-rc.1",
  },
  {
    assets: [],
    draft: true,
    html_url: "https://github.com/pavstev/sapat/releases/tag/v2.0.0",
    name: "Draft",
    prerelease: false,
    published_at: null,
    tag_name: "v2.0.0",
  },
];

interface MarkdownRequest {
  body: unknown;
  headers: Headers;
  method: string;
}

interface Options {
  markdownRequests?: MarkdownRequest[];
  markdownStatus?: number;
  releases?: unknown[];
}

const routed = ({
  markdownRequests = [],
  markdownStatus = 200,
  releases: releaseList = releases,
}: Options = {}): typeof fetch => {
  const answers = new Map<string, (init?: RequestInit) => Response>([
    [
      "GET /repos/pavstev/sapat",
      () => Response.json({ default_branch: "main" }),
    ],
    [
      "GET /repos/pavstev/sapat/readme",
      () => Response.json({ content: readme, encoding: "base64" }),
    ],
    ["GET /repos/pavstev/sapat/releases", () => Response.json(releaseList)],
    [
      "POST /markdown",
      (init) => {
        markdownRequests.push({
          body:
            typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
          headers: new Headers(init?.headers),
          method: init?.method ?? "GET",
        });
        return new Response(markdownStatus === 200 ? markdownHtml : "denied", {
          headers: { "Content-Type": "text/html" },
          status: markdownStatus,
        });
      },
    ],
  ]);
  return (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input);
    const answer = answers.get(`${init?.method ?? "GET"} ${url.pathname}`);
    return Promise.resolve(
      answer ? answer(init) : Response.json({}, { status: 404 })
    );
  };
};

describe("getProject", () => {
  it("returns the branch, the README as HTML and the stable releases", async () => {
    const project = await getProject("pavstev", "sapat", routed());
    assert.equal(project.defaultBranch, "main");
    assert.equal(project.readmeHtml, markdownHtml);
    const asset: ReleaseAsset = {
      name: "sapat.zip",
      size: 1234,
      url: "https://example.com/sapat.zip",
    };
    const expected: Release = {
      assets: [asset],
      name: "v1.0.0",
      publishedAt: "2026-10-01T00:00:00Z",
      tag: "v1.0.0",
      url: "https://github.com/pavstev/sapat/releases/tag/v1.0.0",
    };
    assert.deepEqual(project.releases, [expected]);
  });

  it("posts the decoded README to the markdown endpoint as gfm", async () => {
    const markdownRequests: NonNullable<Options["markdownRequests"]> = [];
    await getProject("pavstev", "sapat", routed({ markdownRequests }));
    assert.equal(markdownRequests.length, 1);
    const [request] = markdownRequests;
    assert.equal(request?.method, "POST");
    assert.equal(request?.headers.get("Content-Type"), "application/json");
    assert.deepEqual(request?.body, {
      context: "pavstev/sapat",
      mode: "gfm",
      text: readmeText,
    });
  });

  it("rejects a kept release without a publish date", async () => {
    await assert.rejects(
      getProject(
        "pavstev",
        "sapat",
        routed({ releases: [{ ...releases[0], published_at: null }] })
      ),
      /no publish date/
    );
  });

  it("rejects when the markdown endpoint answers 403", async () => {
    await assert.rejects(
      getProject("pavstev", "sapat", routed({ markdownStatus: 403 })),
      /GitHub API 403/
    );
  });
});
