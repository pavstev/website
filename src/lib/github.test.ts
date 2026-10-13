import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getContact,
  getProject,
  getRepos,
  type GitHubSnapshot,
  type GitHubSource,
  type Release,
  type ReleaseAsset,
  requestKey,
} from "./github.ts";
import { personalData } from "./personal.ts";

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

const online = (options?: Options): GitHubSource => ({
  env: {},
  fetch: routed(options),
  token: () => "test-token",
});

describe("getProject", () => {
  it("returns the branch, the README as HTML and the stable releases", async () => {
    const project = await getProject("pavstev", "sapat", online());
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
    await getProject("pavstev", "sapat", online({ markdownRequests }));
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
        online({ releases: [{ ...releases[0], published_at: null }] })
      ),
      /no publish date/
    );
  });

  it("rejects when the markdown endpoint answers 403", async () => {
    await assert.rejects(
      getProject("pavstev", "sapat", online({ markdownStatus: 403 })),
      /GitHub API 403/
    );
  });
});

const api = "https://api.github.com";

const contactSnapshot: GitHubSnapshot = {
  "GET /users/pavstev": { email: "hi@example.com" },
  "GET /users/pavstev/social_accounts": [
    { provider: "linkedin", url: "https://www.linkedin.com/in/someone/" },
  ],
};

const refusingFetch: typeof fetch = () =>
  Promise.reject(new Error("network must not be used"));

const contactFetch =
  (calls: string[]): typeof fetch =>
  (input, init) => {
    const url = typeof input === "string" ? input : "";
    calls.push(requestKey(url, init));
    const answer = contactSnapshot[requestKey(url, init)];
    return Promise.resolve(Response.json(answer));
  };

describe("GitHub source without a token", () => {
  it("replays the snapshot on a preview build and warns once", async () => {
    const warnings: string[] = [];
    const contact = await getContact("pavstev", {
      env: { WORKERS_CI_BRANCH: "blog" },
      fetch: refusingFetch,
      snapshot: () => contactSnapshot,
      token: () => undefined,
      warn: (line) => {
        warnings.push(line);
      },
    });
    assert.deepEqual(contact, {
      email: "hi@example.com",
      linkedin: "https://www.linkedin.com/in/someone/",
      linkedinHandle: "someone",
    });
    assert.equal(warnings.length, 1);
    assert.match(
      warnings[0] ?? "",
      /preview branch blog.*github-snapshot\.json/
    );
  });

  it("replays a recording of the REST and GraphQL answers", async () => {
    const repo = {
      archived: false,
      description: "A tool",
      fork: false,
      forks_count: 0,
      html_url: "https://github.com/pavstev/tool",
      language: "TypeScript",
      name: "tool",
      pushed_at: "2026-10-01T00:00:00Z",
      stargazers_count: 1,
      topics: [],
    };
    const languages = {
      data: {
        repository: {
          languages: {
            edges: [
              { node: { color: "#3178c6", name: "TypeScript" }, size: 9 },
            ],
          },
        },
      },
    };
    const recorded: GitHubSnapshot = {};
    const network: typeof fetch = (input, init) => {
      const key = requestKey(typeof input === "string" ? input : "", init);
      const answer = key.startsWith("POST /graphql ") ? languages : [repo];
      recorded[key] = answer;
      return Promise.resolve(Response.json(answer));
    };
    const live = await getRepos("pavstev", {
      env: {},
      fetch: network,
      token: () => "test-token",
    });
    assert.ok(
      Object.keys(recorded).some((key) =>
        /^POST \/graphql [\da-f]{16}$/.test(key)
      )
    );
    const warnings: string[] = [];
    const replayed = await getRepos("pavstev", {
      env: { WORKERS_CI_BRANCH: "blog" },
      fetch: refusingFetch,
      snapshot: () => recorded,
      token: () => undefined,
      warn: (line) => {
        warnings.push(line);
      },
    });
    assert.equal(warnings.length, 1);
    assert.deepEqual(replayed, live);
    assert.deepEqual(replayed[0]?.languages, [
      { color: "#3178c6", name: "TypeScript" },
    ]);
  });

  it("keys POST requests by their body", () => {
    const body = JSON.stringify({ variables: { name: "tool" } });
    assert.notEqual(
      requestKey(`${api}/graphql`, { body, method: "POST" }),
      requestKey(`${api}/graphql`, {
        body: body.replace("tool", "other"),
        method: "POST",
      })
    );
  });

  it("names the missing request when the snapshot has no answer", async () => {
    await assert.rejects(
      getContact("pavstev", {
        env: { WORKERS_CI_BRANCH: "blog" },
        fetch: refusingFetch,
        snapshot: () => ({}),
        token: () => undefined,
        warn: () => undefined,
      }),
      /no answer for GET \/users\/pavstev.*pnpm github:snapshot/
    );
  });

  it("still fails a production build", async () => {
    for (const env of [{}, { WORKERS_CI_BRANCH: "main" }]) {
      await assert.rejects(
        getRepos("pavstev", {
          env,
          fetch: () => Promise.resolve(Response.json([], { status: 401 })),
          snapshot: () => contactSnapshot,
          token: () => undefined,
          warn: () => assert.fail("production must not replay"),
        }),
        /GitHub API 401/
      );
    }
  });

  it("needs GITHUB_TOKEN on a production build when REST answers 200", async () => {
    const repo = {
      archived: false,
      description: "A repo.",
      fork: false,
      forks_count: 0,
      html_url: "https://github.com/pavstev/sapat",
      language: "TypeScript",
      name: "sapat",
      pushed_at: "2026-10-01T00:00:00Z",
      stargazers_count: 1,
      topics: [],
    };
    for (const env of [{}, { WORKERS_CI_BRANCH: "main" }]) {
      const calls: string[] = [];
      await assert.rejects(
        getRepos("pavstev", {
          env,
          fetch: (input, init) => {
            calls.push(
              requestKey(typeof input === "string" ? input : "", init)
            );
            return Promise.resolve(Response.json([repo]));
          },
          snapshot: () => assert.fail("production must not replay"),
          token: () => undefined,
          warn: () => assert.fail("production must not replay"),
        }),
        /needs GITHUB_TOKEN/
      );
      assert.equal(calls.length, 1);
    }
  });

  it("calls the network on a preview build that has a token", async () => {
    const calls: string[] = [];
    await getContact("pavstev", {
      env: { WORKERS_CI_BRANCH: "blog" },
      fetch: contactFetch(calls),
      snapshot: () => assert.fail("a token must not replay"),
      token: () => "test-token",
      warn: () => assert.fail("a token must not warn"),
    });
    assert.deepEqual(
      calls.toSorted((a, b) => a.localeCompare(b)),
      ["GET /users/pavstev", "GET /users/pavstev/social_accounts"]
    );
  });
});

const previewOptions = (
  warnings: string[]
): {
  env: Record<string, string>;
  fetch: typeof fetch;
  token: () => undefined;
  warn: (line: string) => void;
} => ({
  env: { WORKERS_CI_BRANCH: "blog" },
  fetch: refusingFetch,
  token: () => undefined,
  warn: (line) => {
    warnings.push(line);
  },
});

describe("committed GitHub snapshot", () => {
  it("answers every request the build makes for the repos", async () => {
    const warnings: string[] = [];
    const repos = await getRepos(
      personalData.githubHandle,
      previewOptions(warnings)
    );
    assert.equal(warnings.length, 1);
    assert.ok(repos.length > 0);
    for (const repo of repos) assert.ok(repo.languages.length > 0);
  });

  it("answers every request the build makes for the contact", async () => {
    const warnings: string[] = [];
    const contact = await getContact(
      personalData.githubHandle,
      previewOptions(warnings)
    );
    assert.equal(warnings.length, 1);
    assert.match(contact.email, /@/);
    assert.ok(contact.linkedinHandle.length > 0);
  });
});
