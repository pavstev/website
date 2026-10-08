import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { type AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, it } from "node:test";

import { feedAnswer, servedCv } from "./cv-sample.ts";
import { type Cv, cvSchema, getCv, stripPrivate } from "./cv.ts";

const sample = {
  basics: { headline: "Engineer", name: "Ada Example", phone: "+43 1 234" },
  experience: {
    items: [
      { company: "Example", from: "Jan 2020", position: "Lead", to: "Present" },
    ],
  },
  projects: {
    items: [
      {
        name: "Ledger",
        overview: "A double-entry ledger.",
        websiteUrl: "https://example.com/ledger",
      },
    ],
  },
  updatedAt: "2026-10-08T00:00:00.000Z",
};

interface Call {
  init: RequestInit | undefined;
  url: string;
}

const urlOf = (input: Parameters<typeof fetch>[0]): string =>
  input instanceof Request ? input.url : input.toString();

const recordingFetch =
  (status: number, body: unknown, calls: Call[] = []): typeof fetch =>
  (input, init) => {
    calls.push({ init, url: urlOf(input) });
    return Promise.resolve(
      new Response(status === 404 ? null : JSON.stringify(body), { status })
    );
  };

const savedUrl = process.env["CV_FEED_URL"];
const savedToken = process.env["CV_FEED_TOKEN"];

const restore = (name: string, value: string | undefined): void => {
  if (value === undefined) {
    Reflect.deleteProperty(process.env, name);
  } else {
    process.env[name] = value;
  }
};

beforeEach(() => {
  process.env["CV_FEED_URL"] = "https://feed.test";
  process.env["CV_FEED_TOKEN"] = "t";
});

afterEach(() => {
  restore("CV_FEED_URL", savedUrl);
  restore("CV_FEED_TOKEN", savedToken);
});

describe("getCv", () => {
  it("blanks the phone and fills defaults", async () => {
    const cv = await getCv(recordingFetch(200, sample));
    assert.equal(cv.basics.phone, "");
    assert.equal(cv.basics.name, "Ada Example");
    assert.equal(cv.basics.location, "");
    assert.deepEqual(cv.education.items, []);
    assert.equal(cv.experience.items[0]?.overview, "");
  });
  it("serves exactly the shape the Worker sample reads", async () => {
    const expected: Cv = servedCv;
    assert.deepEqual(await getCv(recordingFetch(200, feedAnswer)), expected);
  });
  it("keeps the projects section", async () => {
    const cv = await getCv(recordingFetch(200, sample));
    assert.equal(cv.projects.items.length, 1);
    assert.equal(cv.projects.items[0]?.name, "Ledger");
    assert.equal(
      cv.projects.items[0]?.websiteUrl,
      "https://example.com/ledger"
    );
  });
  it("asks the feed path with the bearer, a 1 s revalidate and no redirects", async () => {
    const calls: Call[] = [];
    await getCv(recordingFetch(200, sample, calls));
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.url, "https://feed.test/api/public/cv");
    const init = calls[0]?.init;
    assert.equal(init?.cache, undefined);
    assert.deepEqual(Reflect.get(init ?? {}, "next"), { revalidate: 1 });
    assert.equal(init?.redirect, "error");
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer t");
  });
  it("explains a 404 as a token or résumé problem", async () => {
    await assert.rejects(getCv(recordingFetch(404, null)), {
      message: "CV feed 404: check CV_FEED_TOKEN and that the résumé is saved",
    });
  });
  it("fails on a non-200 answer", async () => {
    await assert.rejects(getCv(recordingFetch(503, {})), /CV feed 503/);
  });
  it("fails on a redirect status", async () => {
    await assert.rejects(getCv(recordingFetch(308, {})), /CV feed 308/);
  });
  it("fails on data that does not match the schema", async () => {
    await assert.rejects(
      getCv(recordingFetch(200, { ...sample, updatedAt: "yesterday" }))
    );
  });
  it("fails without the token", async () => {
    Reflect.deleteProperty(process.env, "CV_FEED_TOKEN");
    await assert.rejects(
      getCv(recordingFetch(200, sample)),
      /CV_FEED_URL and CV_FEED_TOKEN/
    );
  });
  it("refuses a plain-http feed before any request", async () => {
    const calls: Call[] = [];
    const plain = new URL("https://hirista.app");
    plain.protocol = "http:";
    process.env["CV_FEED_URL"] = plain.origin;
    await assert.rejects(getCv(recordingFetch(200, sample, calls)), {
      message: "CV_FEED_URL must be https",
    });
    assert.equal(calls.length, 0);
  });
  it("allows plain http on the loopback hosts", async () => {
    for (const base of [
      "http://127.0.0.1:4799",
      "http://localhost:4799",
      "http://[::1]:4799",
    ]) {
      const calls: Call[] = [];
      process.env["CV_FEED_URL"] = base;
      await getCv(recordingFetch(200, sample, calls));
      assert.equal(calls[0]?.url, `${base}/api/public/cv`);
    }
  });
  it("fails without the URL", async () => {
    Reflect.deleteProperty(process.env, "CV_FEED_URL");
    await assert.rejects(
      getCv(recordingFetch(200, sample)),
      /CV_FEED_URL and CV_FEED_TOKEN/
    );
  });
});

describe("getCv over HTTP", () => {
  let server: Server | undefined;
  let followed = 0;

  afterEach(async () => {
    const running = server;
    server = undefined;
    if (running) {
      await new Promise<void>((resolve) => {
        running.close(() => {
          resolve();
        });
      });
    }
  });

  it("refuses a redirect instead of following it without the bearer", async () => {
    server = createServer((request, response) => {
      if (request.url === "/moved") {
        followed += 1;
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify(sample));
        return;
      }
      response.writeHead(308, { Location: "/moved" });
      response.end();
    });
    await new Promise<void>((resolve) => {
      server?.listen(0, "127.0.0.1", resolve);
    });
    const { port } = server.address() as AddressInfo;
    process.env["CV_FEED_URL"] = `http://127.0.0.1:${String(port)}`;
    await assert.rejects(
      getCv(),
      (error: unknown) =>
        error instanceof TypeError &&
        error.cause instanceof Error &&
        error.cause.message === "unexpected redirect"
    );
    assert.equal(followed, 0);
  });
});

describe("cvSchema", () => {
  it("rejects a project link that is not http(s)", () => {
    const bad = {
      ...sample,
      projects: {
        items: [{ name: "X", websiteUrl: "javascript:alert(1)" }],
      },
    };
    assert.equal(cvSchema.safeParse(bad).success, false);
  });
  it("accepts an ISO time with an offset", () => {
    const parsed = cvSchema.parse({
      ...sample,
      updatedAt: "2026-10-08T00:00:00+02:00",
    });
    assert.equal(parsed.updatedAt, "2026-10-08T00:00:00+02:00");
  });
});

describe("stripPrivate", () => {
  it("blanks the phone and does not mutate its input", () => {
    const cv = cvSchema.parse(sample);
    const stripped = stripPrivate(cv);
    assert.equal(stripped.basics.phone, "");
    assert.equal(cv.basics.phone, "+43 1 234");
  });
});
