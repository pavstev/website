import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { type AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import { promisify } from "node:util";

import { feedAnswer, servedCv } from "./cv-sample.ts";
import {
  type Cv,
  cvCachePath,
  CvFeedError,
  type CvFeedFailure,
  cvSchema,
  cvSourcePath,
  fetchFeed,
  getCv,
  isNewer,
  loadCv,
  stripPrivate,
} from "./cv.ts";

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

type FeedEnv = Record<string, string | undefined>;

const token = "tok-SECRET-123";
const feedOrigin = "https://feed.example";
const env: FeedEnv = { CV_FEED_TOKEN: token, CV_FEED_URL: feedOrigin };
const repoRoot = process.cwd();

interface Call {
  init: RequestInit | undefined;
  url: string;
}

const urlOf = (input: Parameters<typeof fetch>[0]): string =>
  input instanceof Request ? input.url : input.toString();

const textAnswer =
  (status: number, text: null | string, calls: Call[] = []): typeof fetch =>
  (input, init) => {
    calls.push({ init, url: urlOf(input) });
    return Promise.resolve(new Response(text, { status }));
  };

const answer = (
  status: number,
  body: unknown,
  calls: Call[] = []
): typeof fetch =>
  textAnswer(status, status === 404 ? null : JSON.stringify(body), calls);

const hangingFetch: typeof fetch = (_input, init) =>
  new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => {
      reject(new DOMException("aborted", "TimeoutError"));
    });
  });

const networkDown: typeof fetch = () =>
  Promise.reject(new TypeError("fetch failed"));

const brokenBody: typeof fetch = () =>
  Promise.resolve(
    new Response(
      new ReadableStream({
        start(controller) {
          controller.error(new TypeError("terminated"));
        },
      }),
      { status: 200 }
    )
  );

const cancelFails =
  (status: number): typeof fetch =>
  () =>
    Promise.resolve(
      new Response(
        new ReadableStream({
          cancel() {
            return Promise.reject(new TypeError("terminated"));
          },
        }),
        { status }
      )
    );

const refusedRedirect: typeof fetch = () =>
  Promise.reject(
    new TypeError("fetch failed", { cause: new Error("unexpected redirect") })
  );

const leakyFetch: typeof fetch = () =>
  Promise.reject(
    new TypeError("fetch failed", {
      cause: new Error(`connect ECONNREFUSED ${feedOrigin} ${token}`),
    })
  );

const failureOf = async (work: Promise<unknown>): Promise<CvFeedError> => {
  try {
    await work;
  } catch (error) {
    assert.ok(error instanceof CvFeedError, "expected a CvFeedError");
    return error;
  }
  return assert.fail("expected a rejection");
};

const kindOf = async (work: Promise<unknown>): Promise<CvFeedFailure> => {
  const { kind } = await failureOf(work);
  return kind;
};

const feedKind = (
  variables: FeedEnv,
  fetchImpl: typeof fetch,
  timeoutMs?: number
): Promise<CvFeedFailure> => kindOf(fetchFeed(variables, fetchImpl, timeoutMs));

const cvAt = (updatedAt: string): Cv =>
  cvSchema.parse({ ...sample, updatedAt });

const urls = (calls: Call[]): string[] => calls.map((call) => call.url);

const quietly = (stderr: string): void => {
  assert.doesNotMatch(stderr, /TimeoutError|DOMException|node:internal/);
};

const closeAll = async (servers: Server[]): Promise<void> => {
  await Promise.all(
    servers.map(
      (server) =>
        new Promise<void>((resolve) => {
          server.closeAllConnections();
          server.close(() => {
            resolve();
          });
        })
    )
  );
};

const listen = async (
  servers: Server[],
  handler: (request: IncomingMessage, response: ServerResponse) => void
): Promise<{ origin: string; server: Server }> => {
  const server = createServer(handler);
  servers.push(server);
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address() as AddressInfo;
  return { origin: `http://127.0.0.1:${String(port)}`, server };
};

const sendJson = (response: ServerResponse, body: unknown): void => {
  response.writeHead(200, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
};

let tempDirs: string[] = [];

const enterTempDir = async (): Promise<void> => {
  const dir = await mkdtemp(path.join(tmpdir(), "cv-test-"));
  tempDirs.push(dir);
  process.chdir(dir);
};

const leaveTempDirs = async (): Promise<void> => {
  process.chdir(repoRoot);
  const made = tempDirs;
  tempDirs = [];
  await Promise.all(
    made.map((dir) => rm(dir, { force: true, recursive: true }))
  );
};

const writeCache = async (body: unknown, source?: string): Promise<void> => {
  await mkdir(".cv", { recursive: true });
  await writeFile(".cv/cv.json", JSON.stringify(body));
  if (source !== undefined) await writeFile(".cv/source", source);
};

describe("the cache paths", () => {
  it("sit in the ignored .cv/ folder", () => {
    assert.equal(cvCachePath, ".cv/cv.json");
    assert.equal(cvSourcePath, ".cv/source");
  });
});

describe("fetchFeed", () => {
  it("blanks the phone and fills defaults", async () => {
    const cv = await fetchFeed(env, answer(200, sample));
    assert.equal(cv.basics.phone, "");
    assert.equal(cv.basics.name, "Ada Example");
    assert.equal(cv.basics.location, "");
    assert.deepEqual(cv.education.items, []);
    assert.equal(cv.experience.items[0]?.overview, "");
  });
  it("serves exactly the shape the Worker sample reads", async () => {
    const expected: Cv = servedCv;
    const cv = await fetchFeed(env, answer(200, feedAnswer));
    assert.deepEqual(cv, expected);
  });
  it("keeps the projects section", async () => {
    const cv = await fetchFeed(env, answer(200, sample));
    assert.equal(cv.projects.items.length, 1);
    assert.equal(cv.projects.items[0]?.name, "Ledger");
    assert.equal(
      cv.projects.items[0]?.websiteUrl,
      "https://example.com/ledger"
    );
  });
  it("asks the feed path with the bearer, a timeout signal and no redirects", async () => {
    const calls: Call[] = [];
    await fetchFeed(env, answer(200, sample, calls));
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.url, `${feedOrigin}/api/public/cv`);
    const init = calls[0]?.init;
    assert.equal(init?.cache, undefined);
    assert.equal(Reflect.has(init ?? {}, "next"), false);
    assert.equal(init?.redirect, "error");
    assert.ok(init?.signal instanceof AbortSignal);
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("Authorization"), `Bearer ${token}`);
  });
  it("stops a hung feed at the timeout as unavailable", async () => {
    const started = Date.now();
    assert.equal(await feedKind(env, hangingFetch, 30), "unavailable");
    assert.ok(Date.now() - started < 5000);
  });
  it("treats a 503 as unavailable", async () => {
    const failure = await failureOf(fetchFeed(env, answer(503, {})));
    assert.equal(failure.kind, "unavailable");
    assert.match(failure.message, /CV feed 503/);
  });
  it("treats a network error as unavailable", async () => {
    assert.equal(await feedKind(env, networkDown), "unavailable");
  });
  it("names the feed when it cannot be reached", async () => {
    const failure = await failureOf(fetchFeed(env, networkDown));
    assert.equal(failure.message, "CV feed could not be reached");
  });
  it("classifies a 5xx whose body cannot be cancelled", async () => {
    assert.equal(await feedKind(env, cancelFails(503)), "unavailable");
  });
  it("classifies a 404 whose body cannot be cancelled", async () => {
    assert.equal(await feedKind(env, cancelFails(404)), "refused");
  });
  it("treats a body that dies halfway as unavailable", async () => {
    assert.equal(await feedKind(env, brokenBody), "unavailable");
  });
  it("treats a redirect status as config", async () => {
    assert.equal(await feedKind(env, answer(308, {})), "config");
  });
  it("treats a refused redirect as config", async () => {
    assert.equal(await feedKind(env, refusedRedirect), "config");
  });
  it("explains a 404 as a token or résumé problem", async () => {
    const failure = await failureOf(fetchFeed(env, answer(404, null)));
    assert.equal(failure.kind, "refused");
    assert.equal(
      failure.message,
      "CV feed 404: check CV_FEED_TOKEN and that the résumé is saved"
    );
  });
  it("treats any other 4xx as refused", async () => {
    assert.equal(await feedKind(env, answer(403, {})), "refused");
  });
  it("fails without the token", async () => {
    const variables: FeedEnv = { CV_FEED_URL: feedOrigin };
    const failure = await failureOf(fetchFeed(variables, answer(200, sample)));
    assert.equal(failure.kind, "config");
    assert.match(failure.message, /CV_FEED_URL and CV_FEED_TOKEN/);
  });
  it("fails without the URL", async () => {
    const variables: FeedEnv = { CV_FEED_TOKEN: token };
    const failure = await failureOf(fetchFeed(variables, answer(200, sample)));
    assert.equal(failure.kind, "config");
    assert.match(failure.message, /CV_FEED_URL and CV_FEED_TOKEN/);
  });
  it("fails on a URL that is not a URL", async () => {
    const variables: FeedEnv = { ...env, CV_FEED_URL: "feed" };
    assert.equal(await feedKind(variables, answer(200, sample)), "config");
  });
  it("fails on a token that cannot be a header value", async () => {
    const calls: Call[] = [];
    const variables: FeedEnv = { ...env, CV_FEED_TOKEN: "line\nbreak" };
    const failure = await failureOf(
      fetchFeed(variables, answer(200, sample, calls))
    );
    assert.equal(failure.kind, "config");
    assert.equal(calls.length, 0);
  });
  it("refuses an http feed on a public host before any request", async () => {
    const calls: Call[] = [];
    const plain = new URL("https://hirista.app");
    plain.protocol = "http:";
    const variables: FeedEnv = { ...env, CV_FEED_URL: plain.origin };
    const failure = await failureOf(
      fetchFeed(variables, answer(200, sample, calls))
    );
    assert.equal(failure.kind, "config");
    assert.equal(failure.message, "CV_FEED_URL must be https");
    assert.equal(calls.length, 0);
  });
  it("allows plain http on the loopback hosts", async () => {
    for (const base of [
      "http://127.0.0.1:4799",
      "http://localhost:4799",
      "http://[::1]:4799",
    ]) {
      const calls: Call[] = [];
      const variables: FeedEnv = { ...env, CV_FEED_URL: base };
      await fetchFeed(variables, answer(200, sample, calls));
      assert.equal(calls[0]?.url, `${base}/api/public/cv`);
    }
  });
  it("treats bad JSON as invalid", async () => {
    const failure = await failureOf(fetchFeed(env, textAnswer(200, "{broken")));
    assert.equal(failure.kind, "invalid");
    assert.match(failure.message, /^CV feed/);
  });
  it("treats data that fails the schema as invalid", async () => {
    const stale = answer(200, { ...sample, updatedAt: "yesterday" });
    const failure = await failureOf(fetchFeed(env, stale));
    assert.equal(failure.kind, "invalid");
    assert.match(failure.message, /^CV feed/);
    assert.match(failure.message, /updatedAt/);
  });
  it("never puts the token or the URL in an error message", async () => {
    const plain = new URL(feedOrigin);
    plain.protocol = "http:";
    const stale = answer(200, { ...sample, updatedAt: "yesterday" });
    const attempts: Array<() => Promise<unknown>> = [
      () => fetchFeed(env, answer(503, {})),
      () => fetchFeed(env, answer(404, null)),
      () => fetchFeed(env, answer(403, {})),
      () => fetchFeed(env, answer(308, {})),
      () => fetchFeed(env, hangingFetch, 10),
      () => fetchFeed(env, leakyFetch),
      () => fetchFeed(env, textAnswer(200, "{broken")),
      () => fetchFeed(env, stale),
      () => fetchFeed({ CV_FEED_URL: feedOrigin }, stale),
      () => fetchFeed({ ...env, CV_FEED_URL: plain.origin }, stale),
      () => fetchFeed({ ...env, CV_FEED_TOKEN: `${token}\nx` }, stale),
    ];
    for (const attempt of attempts) {
      const { message } = await failureOf(attempt());
      assert.ok(!message.includes(token), message);
      assert.ok(!message.includes("feed.example"), message);
    }
  });
});

describe("loadCv", () => {
  const liveUrl = "https://live.example/cv.json";
  const liveStamp = "2026-10-01T00:00:00.000Z";

  const routed =
    (feedStatus: number, calls: Call[]): typeof fetch =>
    (input, init) => {
      const url = urlOf(input);
      calls.push({ init, url });
      return url === liveUrl
        ? answer(200, { ...sample, updatedAt: liveStamp })(input, init)
        : answer(feedStatus, sample)(input, init);
    };

  it("reads the feed and leaves the live address alone", async () => {
    const calls: Call[] = [];
    const fetchImpl = routed(200, calls);
    const loaded = await loadCv({ env, fetchImpl, liveUrl });
    assert.equal(loaded.source, "feed");
    assert.equal(loaded.cv.updatedAt, sample.updatedAt);
    assert.deepEqual(urls(calls), [`${feedOrigin}/api/public/cv`]);
  });
  it("falls back to the live URL when the feed is unavailable", async () => {
    const calls: Call[] = [];
    const fetchImpl = routed(503, calls);
    const loaded = await loadCv({ env, fetchImpl, liveUrl });
    assert.equal(loaded.source, "live");
    assert.equal(loaded.cv.updatedAt, liveStamp);
    assert.equal(loaded.cv.basics.phone, "");
    const live = calls.find((call) => call.url === liveUrl);
    assert.ok(live);
    const headers = new Headers(live.init?.headers);
    assert.equal(headers.get("Authorization"), null);
  });
  it("falls back when the feed hangs", async () => {
    const fetchImpl: typeof fetch = (input, init) =>
      urlOf(input) === liveUrl
        ? answer(200, sample)(input, init)
        : hangingFetch(input, init);
    const loaded = await loadCv({ env, fetchImpl, liveUrl, timeoutMs: 30 });
    assert.equal(loaded.source, "live");
  });
  it("falls back when a 503 body cannot be cancelled", async () => {
    const dying = cancelFails(503);
    const fetchImpl: typeof fetch = (input, init) =>
      urlOf(input) === liveUrl
        ? answer(200, sample)(input, init)
        : dying(input, init);
    const loaded = await loadCv({ env, fetchImpl, liveUrl });
    assert.equal(loaded.source, "live");
  });
  it("names the live /cv.json when both addresses are unreachable", async () => {
    const failure = await failureOf(
      loadCv({ env, fetchImpl: networkDown, liveUrl })
    );
    assert.equal(failure.kind, "unavailable");
    assert.equal(failure.message, "Live /cv.json could not be reached");
  });
  it("names the live /cv.json when both addresses answer 503", async () => {
    const failure = await failureOf(
      loadCv({ env, fetchImpl: answer(503, {}), liveUrl })
    );
    assert.equal(failure.message, "Live /cv.json 503");
  });
  it("never puts a URL or the token in the live failure", async () => {
    const failure = await failureOf(
      loadCv({ env, fetchImpl: leakyFetch, liveUrl })
    );
    assert.ok(!failure.message.includes(token));
    assert.ok(!failure.message.includes("example"));
  });
  it("refuses a plain-http live address on a public host", async () => {
    const calls: Call[] = [];
    const fetchImpl = routed(503, calls);
    const kind = await kindOf(
      loadCv({ env, fetchImpl, liveUrl: "http://live.example/cv.json" })
    );
    assert.equal(kind, "config");
    assert.deepEqual(urls(calls), [`${feedOrigin}/api/public/cv`]);
  });
  it("never falls back on a refused feed", async () => {
    const calls: Call[] = [];
    const fetchImpl = routed(404, calls);
    const kind = await kindOf(loadCv({ env, fetchImpl, liveUrl }));
    assert.equal(kind, "refused");
    assert.deepEqual(urls(calls), [`${feedOrigin}/api/public/cv`]);
  });
  it("never falls back on a missing variable", async () => {
    const calls: Call[] = [];
    const variables: FeedEnv = { CV_FEED_URL: feedOrigin };
    const fetchImpl = routed(200, calls);
    const kind = await kindOf(loadCv({ env: variables, fetchImpl, liveUrl }));
    assert.equal(kind, "config");
    assert.equal(calls.length, 0);
  });
  it("never falls back on a redirect", async () => {
    const calls: Call[] = [];
    const fetchImpl = routed(308, calls);
    const kind = await kindOf(loadCv({ env, fetchImpl, liveUrl }));
    assert.equal(kind, "config");
    assert.equal(calls.length, 1);
  });
  it("never falls back on invalid feed data", async () => {
    const calls: Call[] = [];
    const fetchImpl = textAnswer(200, "{broken", calls);
    const kind = await kindOf(loadCv({ env, fetchImpl, liveUrl }));
    assert.equal(kind, "invalid");
    assert.equal(calls.length, 1);
  });
  it("fails when the feed and the live address are both down", async () => {
    const fetchImpl = answer(503, {});
    const kind = await kindOf(
      loadCv({ env, fetchImpl, liveUrl, timeoutMs: 30 })
    );
    assert.equal(kind, "unavailable");
  });
  it("fails on live data that does not match the schema", async () => {
    const stale = answer(200, { ...sample, updatedAt: "yesterday" });
    const down = answer(503, {});
    const fetchImpl: typeof fetch = (input, init) =>
      urlOf(input) === liveUrl ? stale(input, init) : down(input, init);
    const kind = await kindOf(loadCv({ env, fetchImpl, liveUrl }));
    assert.equal(kind, "invalid");
  });
});

describe("isNewer", () => {
  it("compares instants, not strings", () => {
    const utc = cvAt("2026-10-08T09:00:00Z");
    const offset = cvAt("2026-10-08T10:00:00+02:00");
    assert.equal(isNewer(utc, offset), true);
    assert.equal(isNewer(offset, utc), false);
  });
  it("is false for the same instant", () => {
    const utc = cvAt("2026-10-08T08:00:00Z");
    const offset = cvAt("2026-10-08T10:00:00+02:00");
    assert.equal(isNewer(utc, offset), false);
  });
  it("is false when the feed went backwards", () => {
    const older = cvAt("2026-10-07T00:00:00Z");
    const newer = cvAt("2026-10-08T00:00:00Z");
    assert.equal(isNewer(older, newer), false);
  });
});

describe("getCv", () => {
  before(enterTempDir);

  after(leaveTempDirs);

  it("names the fetch script when the cache file is missing", async () => {
    const failure = await failureOf(getCv());
    assert.equal(failure.kind, "config");
    assert.match(failure.message, /scripts\/cv-fetch\.ts/);
  });
  it("rejects a cache file that fails the schema", async () => {
    await writeCache({ ...sample, updatedAt: "yesterday" });
    assert.equal(await kindOf(getCv()), "invalid");
  });
  it("reads the cache file once and blanks the phone", async () => {
    await writeCache(sample);
    const first = await getCv();
    assert.equal(first.basics.name, "Ada Example");
    assert.equal(first.basics.phone, "");
    await writeCache({ ...sample, basics: { name: "Changed" } });
    const second = await getCv();
    assert.equal(second, first);
    assert.equal(second.basics.name, "Ada Example");
  });
});

describe("a feed over HTTP", () => {
  let servers: Server[] = [];

  afterEach(async () => {
    const running = servers;
    servers = [];
    await closeAll(running);
  });

  it("refuses a redirect instead of following it without the bearer", async () => {
    let followed = 0;
    const { origin } = await listen(servers, (request, response) => {
      if (request.url === "/moved") {
        followed += 1;
        sendJson(response, sample);
        return;
      }
      response.writeHead(308, { Location: "/moved" });
      response.end();
    });
    const kind = await kindOf(
      fetchFeed({ CV_FEED_TOKEN: "t", CV_FEED_URL: origin })
    );
    assert.equal(kind, "config");
    assert.equal(followed, 0);
  });

  it("uses the live data when the feed never answers", async () => {
    const authorization: Array<string | undefined> = [];
    const hung = await listen(servers, () => undefined);
    const live = await listen(servers, (request, response) => {
      authorization.push(request.headers.authorization);
      sendJson(response, { ...sample, updatedAt: "2026-10-01T00:00:00.000Z" });
    });
    const loaded = await loadCv({
      env: { CV_FEED_TOKEN: "t", CV_FEED_URL: hung.origin },
      liveUrl: `${live.origin}/cv.json`,
      timeoutMs: 150,
    });
    assert.equal(loaded.source, "live");
    assert.equal(loaded.cv.updatedAt, "2026-10-01T00:00:00.000Z");
    assert.deepEqual(authorization, [undefined]);
  });

  it("fails a wrong token without asking the live address", async () => {
    let liveCalls = 0;
    const feed = await listen(servers, (_request, response) => {
      response.writeHead(404);
      response.end();
    });
    const live = await listen(servers, (_request, response) => {
      liveCalls += 1;
      sendJson(response, sample);
    });
    const kind = await kindOf(
      loadCv({
        env: { CV_FEED_TOKEN: "wrong", CV_FEED_URL: feed.origin },
        liveUrl: `${live.origin}/cv.json`,
      })
    );
    assert.equal(kind, "refused");
    assert.equal(liveCalls, 0);
  });
});

describe("the build scripts", () => {
  const run = promisify(execFile);
  const scripts = path.join(import.meta.dirname, "..", "..", "scripts");
  const secret = "tok-SCRIPT-456";
  const wrong = "wrong-token-789";
  const stamp = "2026-10-08T12:00:00.000Z";
  let servers: Server[] = [];

  beforeEach(enterTempDir);

  afterEach(async () => {
    const running = servers;
    servers = [];
    await Promise.all([closeAll(running), leaveTempDirs()]);
  });

  const startFeed = (
    updatedAt: string
  ): Promise<{ origin: string; server: Server }> =>
    listen(servers, (request, response) => {
      if (
        request.url !== "/api/public/cv" ||
        request.headers.authorization !== `Bearer ${secret}`
      ) {
        response.writeHead(404);
        response.end();
        return;
      }
      sendJson(response, { ...sample, updatedAt });
    });

  const deadFeed = async (): Promise<string> => {
    const { origin, server } = await startFeed(stamp);
    await closeAll([server]);
    return origin;
  };

  const runScript = async (
    name: string,
    variables: Record<string, string>,
    args: string[] = []
  ): Promise<{ code: number; stderr: string }> => {
    try {
      const { stderr } = await run(
        process.execPath,
        ["--unhandled-rejections=strict", path.join(scripts, name), ...args],
        { cwd: process.cwd(), env: { ...variables, NODE_ENV: "production" } }
      );
      return { code: 0, stderr };
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        typeof error.code === "number" &&
        "stderr" in error &&
        typeof error.stderr === "string"
      ) {
        return { code: error.code, stderr: error.stderr };
      }
      throw error;
    }
  };

  const guard = (
    origin: string,
    bearer = secret,
    args: string[] = []
  ): Promise<{ code: number; stderr: string }> =>
    runScript(
      "cv-guard.ts",
      { CV_FEED_TOKEN: bearer, CV_FEED_URL: origin },
      args
    );

  const stalls: Record<string, (response: ServerResponse) => void> = {
    "never answers": () => undefined,
    "stops after the headers": (response) => {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.write("{");
    },
  };

  describe("cv-fetch", () => {
    it("writes the feed and its source into .cv/", async () => {
      const { origin } = await startFeed(stamp);
      const result = await runScript("cv-fetch.ts", {
        CV_FEED_TOKEN: secret,
        CV_FEED_URL: origin,
      });
      assert.equal(result.code, 0, result.stderr);
      assert.match(result.stderr, /2026-10-08T12:00:00\.000Z/);
      const written = cvSchema.parse(
        JSON.parse(await readFile(".cv/cv.json", "utf8"))
      );
      assert.equal(written.basics.name, "Ada Example");
      assert.equal(written.basics.phone, "");
      assert.equal(await readFile(".cv/source", "utf8"), "feed");
    });
    it("reads the variables from .env.local", async () => {
      const { origin } = await startFeed(stamp);
      await writeFile(
        ".env.local",
        `CV_FEED_URL=${origin}\nCV_FEED_TOKEN=${secret}\n`
      );
      const result = await runScript("cv-fetch.ts", {});
      assert.equal(result.code, 0, result.stderr);
    });
    it("fails on a wrong token and writes nothing", async () => {
      const { origin } = await startFeed(stamp);
      const result = await runScript("cv-fetch.ts", {
        CV_FEED_TOKEN: wrong,
        CV_FEED_URL: origin,
      });
      assert.equal(result.code, 1);
      assert.match(result.stderr, /CV feed 404/);
      assert.ok(!result.stderr.includes(wrong));
      await assert.rejects(readFile(".cv/cv.json"));
    });
    it("fails when a variable is missing", async () => {
      const result = await runScript("cv-fetch.ts", {});
      assert.equal(result.code, 1);
      assert.match(result.stderr, /CV_FEED_URL and CV_FEED_TOKEN/);
    });
  });

  describe("a feed that stalls", () => {
    for (const [name, stall] of Object.entries(stalls)) {
      it(`makes cv-fetch use the live stub when the feed ${name}`, async () => {
        const hung = await listen(servers, (_request, response) => {
          stall(response);
        });
        const live = await listen(servers, (_request, response) => {
          sendJson(response, { ...sample, updatedAt: "2026-10-01T00:00:00Z" });
        });
        const result = await runScript(
          "cv-fetch.ts",
          { CV_FEED_TOKEN: secret, CV_FEED_URL: hung.origin },
          ["--timeout-ms=150", `--live-url=${live.origin}/cv.json`]
        );
        assert.equal(result.code, 0, result.stderr);
        assert.match(result.stderr, /did not answer/);
        quietly(result.stderr);
        assert.equal(await readFile(".cv/source", "utf8"), "live");
        const written = cvSchema.parse(
          JSON.parse(await readFile(".cv/cv.json", "utf8"))
        );
        assert.equal(written.updatedAt, "2026-10-01T00:00:00Z");
        assert.equal(written.basics.phone, "");
      });
      it(`makes cv-guard skip when the feed ${name}`, async () => {
        await writeCache({ ...sample, updatedAt: stamp }, "feed");
        const hung = await listen(servers, (_request, response) => {
          stall(response);
        });
        const result = await guard(hung.origin, secret, ["--timeout-ms=150"]);
        assert.equal(result.code, 0, result.stderr);
        assert.match(
          result.stderr,
          /CV guard skipped: the CV feed did not answer\./
        );
        quietly(result.stderr);
      });
    }
    it("fails cv-fetch cleanly when the live stub is down too", async () => {
      const hung = await listen(servers, () => undefined);
      const live = await listen(servers, () => undefined);
      const result = await runScript(
        "cv-fetch.ts",
        { CV_FEED_TOKEN: secret, CV_FEED_URL: hung.origin },
        ["--timeout-ms=150", `--live-url=${live.origin}/cv.json`]
      );
      assert.equal(result.code, 1);
      assert.match(result.stderr, /Live \/cv\.json could not be reached/);
      quietly(result.stderr);
    });
    it("refuses a timeout that is not a positive number", async () => {
      const { origin } = await startFeed(stamp);
      const result = await runScript(
        "cv-fetch.ts",
        { CV_FEED_TOKEN: secret, CV_FEED_URL: origin },
        ["--timeout-ms=soon"]
      );
      assert.equal(result.code, 1);
      assert.match(result.stderr, /--timeout-ms/);
    });
  });

  describe("cv-guard", () => {
    it("fails when the feed is newer than the built data", async () => {
      await writeCache({ ...sample, updatedAt: stamp }, "feed");
      const { origin } = await startFeed("2026-10-08T12:05:00.000Z");
      const result = await guard(origin);
      assert.equal(result.code, 1);
      assert.match(
        result.stderr,
        /The résumé changed during this build\. A newer build is on its way\./
      );
    });
    it("passes when the feed has the built data", async () => {
      await writeCache({ ...sample, updatedAt: stamp }, "feed");
      const { origin } = await startFeed(stamp);
      const result = await guard(origin);
      assert.equal(result.code, 0, result.stderr);
    });
    it("passes with the live fallback even when the feed is newer", async () => {
      await writeCache(
        { ...sample, updatedAt: "2026-10-01T00:00:00Z" },
        "live"
      );
      const { origin } = await startFeed("2026-10-08T12:05:00.000Z");
      const result = await guard(origin);
      assert.equal(result.code, 0, result.stderr);
    });
    it("passes when the feed does not answer", async () => {
      await writeCache({ ...sample, updatedAt: stamp }, "feed");
      const result = await guard(await deadFeed());
      assert.equal(result.code, 0, result.stderr);
    });
    it("fails on a wrong token", async () => {
      await writeCache({ ...sample, updatedAt: stamp }, "feed");
      const { origin } = await startFeed(stamp);
      const result = await guard(origin, wrong);
      assert.equal(result.code, 1);
      assert.ok(!result.stderr.includes(wrong));
    });
    it("fails when the build left no data", async () => {
      const { origin } = await startFeed(stamp);
      const result = await guard(origin);
      assert.equal(result.code, 1);
    });
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
