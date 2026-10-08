import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  askBlock,
  askEnabled,
  askErrorKey,
  askSiteKeyOf,
  readAnswerStream,
  readErrorCode,
} from "./ask.ts";

const stream = (text: string): ReadableStream<Uint8Array> =>
  new Blob([text]).stream();

const chunked = (parts: string[]): ReadableStream<Uint8Array> =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      for (const part of parts) {
        controller.enqueue(new TextEncoder().encode(part));
      }
      controller.close();
    },
  });

const collect = async (body: ReadableStream<Uint8Array>): Promise<string> => {
  let out = "";
  await readAnswerStream(body, (chunk) => {
    out += chunk;
  });
  return out;
};

describe("readAnswerStream", () => {
  it("joins response chunks and stops at DONE", async () => {
    const out = await collect(
      stream(
        'data: {"response":"Hel"}\n\ndata: {"response":"lo"}\n\ndata: [DONE]\n\n'
      )
    );
    assert.equal(out, "Hello");
  });

  it("survives a chunk split in the middle of a line", async () => {
    const out = await collect(chunked(['data: {"resp', 'onse":"ok"}\n\n']));
    assert.equal(out, "ok");
  });

  it("keeps multi-byte characters split across chunks", async () => {
    const bytes = new TextEncoder().encode('data: {"response":"ć"}\n\n');
    const cut = bytes.indexOf(0xc4) + 1;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, cut));
        controller.enqueue(bytes.slice(cut));
        controller.close();
      },
    });
    assert.equal(await collect(body), "ć");
  });

  it("reads a last line that has no trailing newline", async () => {
    assert.equal(await collect(stream('data: {"response":"end"}')), "end");
  });

  it("handles CRLF line endings", async () => {
    const out = await collect(
      stream('data: {"response":"a"}\r\n\r\ndata: {"response":"b"}\r\n\r\n')
    );
    assert.equal(out, "ab");
  });

  it("ignores comments, malformed lines and empty or missing responses", async () => {
    const out = await collect(
      stream(
        [
          ": keep-alive",
          "event: message",
          "data: not json",
          'data: {"response":""}',
          'data: {"usage":{"total_tokens":3}}',
          'data: {"response":7}',
          'data: {"response":"kept"}',
          "",
        ].join("\n")
      )
    );
    assert.equal(out, "kept");
  });

  it("ignores everything after DONE", async () => {
    const out = await collect(
      stream('data: {"response":"a"}\ndata: [DONE]\ndata: {"response":"b"}\n')
    );
    assert.equal(out, "a");
  });
});

describe("askErrorKey", () => {
  it("maps known codes and falls back to failed", () => {
    assert.equal(askErrorKey(429, "limit"), "limit");
    assert.equal(askErrorKey(403, "bot"), "bot");
    assert.equal(askErrorKey(400, "question"), "question");
    assert.equal(askErrorKey(500, undefined), "failed");
  });

  it("uses the status when the code is missing or unknown", () => {
    assert.equal(askErrorKey(429, undefined), "limit");
    assert.equal(askErrorKey(403, "other"), "bot");
    assert.equal(askErrorKey(400, undefined), "question");
    assert.equal(askErrorKey(502, "failed"), "failed");
    assert.equal(askErrorKey(405, "method"), "failed");
  });

  it("prefers a known code over the status", () => {
    assert.equal(askErrorKey(500, "limit"), "limit");
  });
});

describe("readErrorCode", () => {
  it("reads the error code from a JSON body", async () => {
    const response = Response.json({ error: "limit" }, { status: 429 });
    assert.equal(await readErrorCode(response), "limit");
  });

  it("returns undefined for a body that is not the contract", async () => {
    assert.equal(
      await readErrorCode(new Response("<html></html>", { status: 502 })),
      undefined
    );
    assert.equal(
      await readErrorCode(Response.json({ error: 7 }, { status: 500 })),
      undefined
    );
    assert.equal(
      await readErrorCode(Response.json(null, { status: 500 })),
      undefined
    );
    assert.equal(
      await readErrorCode(new Response(null, { status: 500 })),
      undefined
    );
  });
});

describe("askBlock", () => {
  it("is null when the question can be sent", () => {
    assert.equal(
      askBlock({ busy: false, hasToken: true, question: "Where?" }),
      null
    );
  });

  it("asks for a question first when it is empty or blank", () => {
    assert.equal(
      askBlock({ busy: false, hasToken: true, question: "" }),
      "questionFirst"
    );
    assert.equal(
      askBlock({ busy: false, hasToken: true, question: "  \n " }),
      "questionFirst"
    );
  });

  it("asks for the human check when there is no token", () => {
    assert.equal(
      askBlock({ busy: false, hasToken: false, question: "Where?" }),
      "checkFirst"
    );
  });

  it("names the question before the check when both are missing", () => {
    assert.equal(
      askBlock({ busy: false, hasToken: false, question: "" }),
      "questionFirst"
    );
  });

  it("says nothing while an answer is on its way", () => {
    assert.equal(
      askBlock({ busy: true, hasToken: false, question: "Where?" }),
      null
    );
  });
});

describe("askEnabled", () => {
  it("is on when a site key is set, even on Workers Builds", () => {
    assert.equal(askEnabled("0x4AAAAAAAreal", undefined), true);
    assert.equal(askEnabled("0x4AAAAAAAreal", "1"), true);
  });

  it("is on without a key when the build is not a Workers Builds build", () => {
    assert.equal(askEnabled(undefined, undefined), true);
    assert.equal(askEnabled("", undefined), true);
    assert.equal(askEnabled(undefined, "0"), true);
  });

  it("is off without a key on Workers Builds", () => {
    assert.equal(askEnabled(undefined, "1"), false);
    assert.equal(askEnabled("", "1"), false);
  });
});

describe("askSiteKeyOf", () => {
  it("uses the configured key and falls back to the test key", () => {
    assert.equal(askSiteKeyOf("0x4AAAAAAAreal"), "0x4AAAAAAAreal");
    assert.equal(askSiteKeyOf(undefined), "1x00000000000000000000AA");
    assert.equal(askSiteKeyOf(""), "1x00000000000000000000AA");
  });
});
