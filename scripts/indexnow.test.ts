import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";

import {
  changedPaths,
  changedSlugs,
  indexNowBody,
  indexNowError,
  isIndexNowAccepted,
  isPublicSource,
  parseBuildSha,
  parseBuiltAt,
  resolveBase,
  urlAction,
  wasPublicAt,
} from "./indexnow.ts";

describe("changedSlugs", () => {
  it("keeps the post folders and drops other paths", () => {
    assert.deepEqual(
      changedSlugs([
        "content/blog/a/index.mdx",
        "content/blog/a/x.png",
        "src/x.ts",
      ]),
      ["a"]
    );
  });

  it("lists each slug once, in the order it first appears", () => {
    assert.deepEqual(
      changedSlugs([
        "content/blog/b/index.mdx",
        "content/blog/a/index.mdx",
        "content/blog/b/data/chart.json",
      ]),
      ["b", "a"]
    );
  });

  it("ignores files directly in content/blog and odd folder names", () => {
    assert.deepEqual(
      changedSlugs([
        "content/blog/README.md",
        "content/blog/Bad Slug/index.mdx",
        "content/blog/../x/index.mdx",
        "content/blog-other/a/index.mdx",
        "",
      ]),
      []
    );
  });
});

describe("indexNowBody", () => {
  it("holds the host, the public key and the key file location", () => {
    const body = indexNowBody(["https://stevanpavlovic.com/blog"]);
    assert.equal(body.host, "stevanpavlovic.com");
    assert.equal(body.key, "ee32ef309c036fb4c6b716d08e9bf922");
    assert.equal(
      body.keyLocation,
      "https://stevanpavlovic.com/ee32ef309c036fb4c6b716d08e9bf922.txt"
    );
    assert.deepEqual(body.urlList, ["https://stevanpavlovic.com/blog"]);
  });
});

describe("parseBuildSha", () => {
  it("reads the sha of a build marker", () => {
    const sha = "a".repeat(40);
    assert.equal(
      parseBuildSha(JSON.stringify({ builtAt: "2026-10-13T10:00:00Z", sha })),
      sha
    );
  });

  it("answers undefined for anything else", () => {
    assert.equal(parseBuildSha("not json"), undefined);
    assert.equal(parseBuildSha("{}"), undefined);
    assert.equal(parseBuildSha(JSON.stringify({ sha: 5 })), undefined);
    assert.equal(parseBuildSha(JSON.stringify({ sha: "main" })), undefined);
  });
});

describe("parseBuiltAt", () => {
  it("reads the build time of a build marker", () => {
    assert.equal(
      parseBuiltAt(
        JSON.stringify({ builtAt: "2026-10-13T12:03:56.892Z", sha: "a" })
      )?.toISOString(),
      "2026-10-13T12:03:56.892Z"
    );
  });

  it("answers undefined for anything else", () => {
    assert.equal(parseBuiltAt("not json"), undefined);
    assert.equal(parseBuiltAt("{}"), undefined);
    assert.equal(parseBuiltAt(JSON.stringify({ builtAt: 5 })), undefined);
    assert.equal(parseBuiltAt(JSON.stringify({ builtAt: "soon" })), undefined);
  });
});

describe("isIndexNowAccepted", () => {
  it("accepts 200 and 202 only", () => {
    assert.equal(isIndexNowAccepted(200), true);
    assert.equal(isIndexNowAccepted(202), true);
    assert.equal(isIndexNowAccepted(400), false);
    assert.equal(isIndexNowAccepted(422), false);
    assert.equal(isIndexNowAccepted(429), false);
  });
});

describe("indexNowError", () => {
  it("names the status, a hint for 422 and 429, and the first 300 characters", () => {
    assert.match(
      indexNowError(422, "bad host"),
      /^IndexNow answered 422 \(.*host.*\): bad host$/u
    );
    assert.match(
      indexNowError(429, ""),
      /^IndexNow answered 429 \(.*wait.*\)$/u
    );
    assert.equal(indexNowError(500, ""), "IndexNow answered 500");
    assert.equal(
      indexNowError(400, "x".repeat(500)),
      `IndexNow answered 400: ${"x".repeat(300)}`
    );
  });
});

describe("changedPaths", () => {
  const sha = "b".repeat(40);
  const before = "a".repeat(40);

  it("diffs against before when it is known", () => {
    const calls: string[][] = [];
    const paths = changedPaths(before, sha, (args) => {
      calls.push(args);
      return "content/blog/a/index.mdx\nsrc/x.ts";
    });
    assert.deepEqual(paths, ["content/blog/a/index.mdx", "src/x.ts"]);
    assert.deepEqual(calls, [["diff", "--name-only", before, sha]]);
  });

  it("falls back to the parent, then to the root commit listing", () => {
    const calls: string[] = [];
    const paths = changedPaths(before, sha, (args) => {
      calls.push(args[0] ?? "");
      if (args[0] === "diff") throw new Error("unknown revision");
      return "content/blog/a/index.mdx";
    });
    assert.deepEqual(paths, ["content/blog/a/index.mdx"]);
    assert.deepEqual(calls, ["diff", "diff", "diff-tree"]);
  });

  it("fails when nothing can list the files", () => {
    assert.throws(
      () =>
        changedPaths("0".repeat(40), sha, () => {
          throw new Error("no");
        }),
      /Could not list/u
    );
  });

  describe("in a real repository", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "indexnow-"));
    after(() => {
      rmSync(dir, { force: true, recursive: true });
    });
    const env = {
      ...process.env,
      ...Object.fromEntries(
        Object.keys(process.env)
          .filter((key) => key.startsWith("GIT_"))
          .map((key) => [key, undefined])
      ),
    };
    const run = (args: string[]): string =>
      execFileSync("git", ["-C", dir, ...args], {
        encoding: "utf8",
        env,
        stdio: ["ignore", "pipe", "pipe"],
      });

    it("lists every post of an orphan root commit", () => {
      run(["init", "--quiet"]);
      mkdirSync(path.join(dir, "content/blog/one"), { recursive: true });
      mkdirSync(path.join(dir, "content/blog/two"), { recursive: true });
      writeFileSync(path.join(dir, "content/blog/one/index.mdx"), "one");
      writeFileSync(path.join(dir, "content/blog/two/index.mdx"), "two");
      writeFileSync(path.join(dir, "README.md"), "readme");
      run(["add", "."]);
      run([
        "-c",
        "user.name=t",
        "-c",
        "user.email=t@example.com",
        "-c",
        "commit.gpgsign=false",
        "commit",
        "--quiet",
        "-m",
        "root",
      ]);
      const head = run(["rev-parse", "HEAD"]).trim();
      const paths = changedPaths("c".repeat(40), head, run);
      assert.deepEqual(changedSlugs(paths), ["one", "two"]);
    });
  });
});

const post = (lines: string[]): string =>
  ["---", "title: T", ...lines, "tags: [A]", "---", "", "Body"].join("\n");

describe("urlAction", () => {
  it("sends a live post", () => {
    assert.equal(urlAction(200, false), "live");
    assert.equal(urlAction(200, true), "live");
  });

  it("sends a removed post only when it was public", () => {
    assert.equal(urlAction(404, true), "removed");
    assert.equal(urlAction(410, true), "removed");
    assert.equal(urlAction(404, false), "skip");
    assert.equal(urlAction(410, false), "skip");
  });

  it("skips any other answer", () => {
    assert.equal(urlAction(undefined, true), "skip");
    assert.equal(urlAction(500, true), "skip");
    assert.equal(urlAction(301, true), "skip");
    assert.equal(urlAction(403, true), "skip");
  });
});

describe("isPublicSource", () => {
  const now = new Date("2026-10-13T10:00:00Z");

  it("is true for a dated post that is no draft", () => {
    assert.equal(isPublicSource(post(["date: 2026-10-12"]), now), true);
    assert.equal(isPublicSource(post(["date: 2026-10-13"]), now), true);
    assert.equal(
      isPublicSource(post(["date: 2026-10-12", "draft: false"]), now),
      true
    );
  });

  it("is false for a draft", () => {
    assert.equal(
      isPublicSource(post(["date: 2026-10-12", "draft: true"]), now),
      false
    );
  });

  it("is false for a scheduled post", () => {
    assert.equal(isPublicSource(post(["date: 2026-10-14"]), now), false);
  });

  it("compares the written instant with now", () => {
    const date = "date: 2026-10-13T12:15:00+02:00";
    assert.equal(
      isPublicSource(post([date]), new Date("2026-10-13T10:14:59Z")),
      false
    );
    assert.equal(
      isPublicSource(post([date]), new Date("2026-10-13T10:15:00Z")),
      true
    );
  });

  it("reads an old date-only line from history as midnight +01:00", () => {
    const late = new Date("2026-10-13T23:30:00Z");
    assert.equal(isPublicSource(post(["date: 2026-10-14"]), late), true);
    assert.equal(
      isPublicSource(
        post(["date: 2026-10-14"]),
        new Date("2026-10-13T22:59:59Z")
      ),
      false
    );
  });

  it("reads quoted dates, comments and Windows line endings", () => {
    assert.equal(
      isPublicSource(
        post(['date: "2026-10-12" # day']).replaceAll("\n", "\r\n"),
        now
      ),
      true
    );
    assert.equal(
      isPublicSource(post(["date: 2026-10-12", "draft: true # wip"]), now),
      false
    );
  });

  it("is false without frontmatter or a date", () => {
    assert.equal(isPublicSource("Body only", now), false);
    assert.equal(isPublicSource(post([]), now), false);
  });
});

const known =
  (...ok: string[]) =>
  (args: string[]): string => {
    const ref = args.at(-1)?.replace("^{commit}", "") ?? "";
    if (!ok.includes(ref)) throw new Error("unknown");
    return ref;
  };

describe("resolveBase", () => {
  const sha = "b".repeat(40);
  const before = "a".repeat(40);
  const zero = "0".repeat(40);

  it("uses before when it resolves", () => {
    assert.equal(resolveBase(before, sha, known(before, `${sha}^`)), before);
  });

  it("falls back to the parent when before is gone", () => {
    assert.equal(resolveBase(before, sha, known(`${sha}^`)), `${sha}^`);
  });

  it("skips before for a new branch", () => {
    assert.equal(resolveBase(zero, sha, known(zero, `${sha}^`)), `${sha}^`);
  });

  it("answers undefined for a first commit", () => {
    assert.equal(resolveBase(before, sha, known()), undefined);
  });
});

describe("wasPublicAt", () => {
  const now = new Date("2026-10-13T10:00:00Z");
  const files = new Map([
    ["a:content/blog/later/index.mdx", post(["date: 2026-11-01"])],
    ["a:content/blog/live/index.mdx", post(["date: 2026-10-01"])],
    ["a:content/blog/wip/index.mdx", post(["date: 2026-10-01", "draft: true"])],
  ]);
  const run = (args: string[]): string => {
    const text = files.get(args.at(-1) ?? "");
    if (text === undefined) throw new Error("missing");
    return text;
  };

  it("is true for a public post at the base", () => {
    assert.equal(wasPublicAt("a", "live", now, run), true);
  });

  it("is false for a draft, a scheduled post and a missing folder", () => {
    assert.equal(wasPublicAt("a", "wip", now, run), false);
    assert.equal(wasPublicAt("a", "later", now, run), false);
    assert.equal(wasPublicAt("a", "gone", now, run), false);
  });

  it("is false without a base", () => {
    assert.equal(wasPublicAt(undefined, "live", now, run), false);
  });
});
