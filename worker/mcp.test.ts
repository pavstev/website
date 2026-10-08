import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Facts } from "./facts.ts";

import { createMcpServer, handleMcp } from "./mcp.ts";

const llms = [
  "# Ada Example",
  "",
  "## Topics",
  "",
  "Systems",
  "",
  "## Open-source projects",
  "",
  "- [engine](https://github.com/ada/engine): A fast engine",
  "",
  "## Links",
  "",
  "- [Website: contact card](https://ada.example/)",
  "- [GitHub: open-source code](https://github.com/ada)",
  "- [Email](mailto:ada@example.com)",
  "",
].join("\n");

const sampleFacts: Facts = {
  cv: {
    basics: {
      headline: "Backend engineer",
      location: "Vienna, Austria",
      name: "Ada Example",
    },
    experience: {
      items: [
        {
          company: "Acme",
          contributions: [
            { description: "Cut latency by half", title: "Speed" },
            { description: "Led four engineers", title: "" },
          ],
          from: "2020",
          overview: "Payments platform",
          position: "Tech lead",
          skills: ["Go", "Postgres"],
          to: "2024",
        },
      ],
    },
    skills: {
      items: [
        { keywords: ["Go", "Rust"], name: "Languages" },
        { keywords: [], name: "Empty" },
      ],
    },
    summary: "Builds systems people rely on.",
    updatedAt: "2026-10-08T00:00:00.000Z",
  },
  llms,
};

const bareProject = {
  contributions: [],
  from: "",
  name: "",
  overview: "",
  skills: [],
  to: "",
  websiteUrl: "",
};

const connect = async (facts: Facts): Promise<Client> => {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "0.0.0" });
  await createMcpServer(facts).connect(serverSide);
  await client.connect(clientSide);
  return client;
};

const textOf = async (client: Client, name: string): Promise<string> => {
  const { content } = await client.callTool({ name });

  assert.ok(Array.isArray(content));
  assert.equal(content.length, 1);

  const [block] = content as unknown[];

  assert.ok(
    typeof block === "object" &&
      block !== null &&
      "type" in block &&
      block.type === "text" &&
      "text" in block &&
      typeof block.text === "string"
  );

  return block.text;
};

interface Options {
  assetsStatus?: number;
  limiterSuccess?: boolean;
  limiterThrows?: boolean;
}

let originCounter = 0;

const envOf = (
  options: Options = {}
): { env: Env; limiterCalls: unknown[] } => {
  const limiterCalls: unknown[] = [];
  const env = {
    ASK_LIMITER: {
      limit: (input: unknown) => {
        limiterCalls.push(input);
        return options.limiterThrows
          ? Promise.reject(new Error("limiter down"))
          : Promise.resolve({ success: options.limiterSuccess ?? true });
      },
    },
    ASSETS: {
      fetch: (url: string) =>
        Promise.resolve(
          options.assetsStatus && options.assetsStatus !== 200
            ? new Response("", { status: options.assetsStatus })
            : url.endsWith("/cv.json")
              ? Response.json(sampleFacts.cv)
              : new Response(llms)
        ),
    },
  } as unknown as Env;

  return { env, limiterCalls };
};

const listTools = {
  id: 1,
  jsonrpc: "2.0",
  method: "tools/list",
  params: {},
};

const mcpRequest = (): Request => {
  originCounter += 1;
  return new Request(`https://mcp${String(originCounter)}.test/mcp`, {
    body: JSON.stringify(listTools),
    headers: {
      Accept: "application/json, text/event-stream",
      "CF-Connecting-IP": "203.0.113.7",
      "Content-Type": "application/json",
    },
    method: "POST",
  });
};

const errorOf = async (response: Response): Promise<unknown> => {
  const body: unknown = await response.json();
  return typeof body === "object" && body !== null && "error" in body
    ? body.error
    : undefined;
};

describe("createMcpServer", () => {
  it("lists exactly the five tools", async () => {
    const client = await connect(sampleFacts);
    const { tools } = await client.listTools();

    assert.deepEqual(
      tools.map((tool) => tool.name).toSorted((a, b) => a.localeCompare(b)),
      ["contact", "experience", "profile", "projects", "skills"]
    );
  });
  it("profile returns name, headline, location, summary and links", async () => {
    const client = await connect(sampleFacts);
    const text = await textOf(client, "profile");

    assert.match(text, /Ada Example/);
    assert.match(text, /Backend engineer/);
    assert.match(text, /Vienna, Austria/);
    assert.match(text, /Builds systems people rely on\./);
    assert.match(text, /Website: https:\/\/ada\.example\//);
    assert.match(text, /GitHub: https:\/\/github\.com\/ada/);
  });
  it("profile omits the link lines when the Links section is missing", async () => {
    const client = await connect({ ...sampleFacts, llms: "# Ada" });
    const text = await textOf(client, "profile");

    assert.match(text, /Ada Example/);
    assert.doesNotMatch(text, /Website:|GitHub:/);
  });
  it("marks every tool read-only and closed-world", async () => {
    const client = await connect(sampleFacts);
    const { tools } = await client.listTools();

    for (const tool of tools) {
      assert.equal(tool.annotations?.readOnlyHint, true, tool.name);
      assert.equal(tool.annotations?.openWorldHint, false, tool.name);
    }
  });
  it("experience returns every role as in the system prompt", async () => {
    const client = await connect(sampleFacts);
    const text = await textOf(client, "experience");

    assert.match(text, /Tech lead at Acme \(2020 to 2024\)/);
    assert.match(text, /Payments platform/);
    assert.match(text, /Speed: Cut latency by half/);
    assert.match(text, /Led four engineers/);
    assert.match(text, /Skills: Go, Postgres/);
  });
  it("skills returns the groups that have keywords", async () => {
    const client = await connect(sampleFacts);
    const text = await textOf(client, "skills");

    assert.match(text, /Languages: Go, Rust/);
    assert.doesNotMatch(text, /Empty/);
  });
  it("projects returns the Open-source projects section only", async () => {
    const client = await connect(sampleFacts);
    const text = await textOf(client, "projects");

    assert.match(text, /\[engine\]\(https:\/\/github\.com\/ada\/engine\)/);
    assert.doesNotMatch(text, /mailto:/);
    assert.doesNotMatch(text, /Systems/);
  });
  it("projects adds the projects of the feed after the open-source ones", async () => {
    const client = await connect({
      ...sampleFacts,
      cv: {
        ...sampleFacts.cv,
        projects: {
          items: [
            {
              contributions: [
                { description: "Used by 300 teams.", title: "Adoption" },
              ],
              from: "Jan 2022",
              name: "tracelite",
              overview: "A small tracing library for Go services.",
              skills: ["Go"],
              to: "Present",
              websiteUrl: "https://github.com/ada/tracelite",
            },
            { ...bareProject, name: "", overview: "Nameless." },
          ],
        },
      },
    });
    const text = await textOf(client, "projects");

    assert.match(text, /\[engine\]\(https:\/\/github\.com\/ada\/engine\)/);
    assert.match(
      text,
      /Projects from the résumé\ntracelite \(Jan 2022 to Present\)/
    );
    assert.match(text, /Link: https:\/\/github\.com\/ada\/tracelite/);
    assert.match(text, /Adoption: Used by 300 teams\./);
    assert.ok(text.indexOf("engine") < text.indexOf("tracelite"));
    assert.doesNotMatch(text, /Nameless/);
    assert.doesNotMatch(text, /mailto:/);
  });
  it("projects answers with the feed projects when llms.txt has no section", async () => {
    const client = await connect({
      cv: {
        ...sampleFacts.cv,
        projects: { items: [{ ...bareProject, name: "tracelite" }] },
      },
      llms: "# Ada",
    });
    const text = await textOf(client, "projects");

    assert.equal(text, "Projects from the résumé\ntracelite");
  });
  it("contact returns the Links section only", async () => {
    const client = await connect(sampleFacts);
    const text = await textOf(client, "contact");

    assert.match(text, /mailto:ada@example\.com/);
    assert.doesNotMatch(text, /engine/);
  });
  it("answers not available when a section is missing", async () => {
    const client = await connect({ ...sampleFacts, llms: "# Ada" });

    assert.match(await textOf(client, "projects"), /not available/i);
    assert.match(await textOf(client, "contact"), /not available/i);
  });
  it("answers not available when there are no skills", async () => {
    const { skills: _skills, ...rest } = sampleFacts.cv;
    const client = await connect({ ...sampleFacts, cv: rest });

    assert.match(await textOf(client, "skills"), /not available/i);
  });
});

describe("handleMcp", () => {
  it("answers 429 with no-store when the limiter denies", async () => {
    const { env, limiterCalls } = envOf({ limiterSuccess: false });
    const response = await handleMcp(mcpRequest(), env);

    assert.equal(response.status, 429);
    assert.equal(await errorOf(response), "limit");
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(limiterCalls, [{ key: "203.0.113.7" }]);
  });
  it("answers 502 with no-store when the limiter throws", async () => {
    const { env } = envOf({ limiterThrows: true });
    const response = await handleMcp(mcpRequest(), env);

    assert.equal(response.status, 502);
    assert.equal(await errorOf(response), "failed");
    assert.equal(response.headers.get("cache-control"), "no-store");
  });
  it("answers 502 with no-store when the facts fail to load", async () => {
    const { env } = envOf({ assetsStatus: 500 });
    const response = await handleMcp(mcpRequest(), env);

    assert.equal(response.status, 502);
    assert.equal(await errorOf(response), "failed");
    assert.equal(response.headers.get("cache-control"), "no-store");
  });
  for (const method of ["GET", "DELETE", "PUT"]) {
    it(`answers 405 to ${method} before the limiter or facts`, async () => {
      const { env, limiterCalls } = envOf();
      const response = await handleMcp(
        new Request("https://mcp-method.test/mcp", {
          headers: { Accept: "text/event-stream" },
          method,
        }),
        env
      );

      assert.equal(response.status, 405);
      assert.equal(await errorOf(response), "method");
      assert.equal(response.headers.get("allow"), "POST");
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.equal(limiterCalls.length, 0);
    });
  }
  it("rejects an oversized POST body", async () => {
    const { env } = envOf();
    originCounter += 1;
    const body = JSON.stringify({ ...listTools, pad: "x".repeat(20_000) });
    const response = await handleMcp(
      new Request(`https://mcp${String(originCounter)}.test/mcp`, {
        body,
        headers: {
          Accept: "application/json, text/event-stream",
          "Content-Type": "application/json",
        },
        method: "POST",
      }),
      env
    );

    assert.equal(response.status, 413);
  });
  it("serves tools/list over stateless HTTP", async () => {
    const { env } = envOf();
    const response = await handleMcp(mcpRequest(), env);
    const text = await response.text();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("mcp-session-id"), null);
    for (const name of [
      "contact",
      "experience",
      "profile",
      "projects",
      "skills",
    ]) {
      assert.ok(text.includes(`"${name}"`), name);
    }
  });
});
