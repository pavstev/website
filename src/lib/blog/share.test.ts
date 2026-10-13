import { ImageResponse } from "next/og.js";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { postMeta } from "./post-fixture.ts";
import { type PostMeta } from "./schema.ts";
import { shareFonts, shareSize, shareTree } from "./share.ts";

const postWith = (title: string, readingMinutes: number): PostMeta =>
  postMeta({
    readingMinutes,
    slug: "a",
    title,
    url: "https://stevanpavlovic.com/blog/a",
    wordCount: 1,
  });

const texts = (node: unknown): string[] => {
  if (typeof node === "string") {
    return [node];
  }
  if (Array.isArray(node)) {
    return node.flatMap((child) => texts(child));
  }
  if (typeof node === "object" && node !== null && "props" in node) {
    const { props } = node;
    if (typeof props === "object" && props !== null && "children" in props) {
      return texts(props.children);
    }
  }
  return [];
};

describe("shareTree", () => {
  it("keeps a raw ampersand in the title text", () => {
    const post = postWith("Sky & <code>", 1);
    const tree = shareTree(post, "");
    assert.ok(texts(tree).includes("Sky & <code>"));
  });

  it("shows the reading time", () => {
    const post = postWith("Title", 7);
    assert.ok(
      texts(shareTree(post, "")).some((text) => text.includes("7 min read"))
    );
  });

  it("draws the cover behind the text when there is one", () => {
    const post = postWith("Title", 1);
    const tree = shareTree(post, "data:image/png;base64,AAAA");
    assert.ok(JSON.stringify(tree).includes("data:image/png;base64,AAAA"));
  });

  it("renders a share image without fetching any font", async (context) => {
    const real = globalThis.fetch;
    const requested: string[] = [];
    context.mock.method(
      globalThis,
      "fetch",
      (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
        const url = input instanceof Request ? input.url : input.toString();
        if (url.startsWith("data:")) {
          return real(input, init);
        }
        requested.push(url);
        return Promise.reject(new Error("offline"));
      }
    );
    const post = postWith("Sky & <code>", 3);
    const response = new ImageResponse(shareTree(post, ""), {
      ...shareSize,
      fonts: shareFonts().list,
    });
    const bytes = new Uint8Array(await response.arrayBuffer());
    assert.ok(bytes.length > 1000);
    assert.deepEqual(requested, []);
  });
});
