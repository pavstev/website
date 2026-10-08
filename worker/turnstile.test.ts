import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";

import { verifyTurnstile } from "./turnstile.ts";

interface Call {
  body: unknown;
  method: string | undefined;
  url: string;
}

const recordingFetch = (
  answer: () => Promise<Response> | Response
): { calls: Call[]; fetchImpl: typeof fetch } => {
  const calls: Call[] = [];
  const fetchImpl = ((input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      body: init?.body,
      method: init?.method,
      url: input instanceof Request ? input.url : input.toString(),
    });
    return Promise.resolve(answer());
  }) as typeof fetch;
  return { calls, fetchImpl };
};

describe("verifyTurnstile", () => {
  it("posts secret, response and remoteip to siteverify and accepts success", async () => {
    const { calls, fetchImpl } = recordingFetch(() =>
      Response.json({ success: true })
    );
    const ok = await verifyTurnstile("tok", "203.0.113.9", "sec", fetchImpl);
    assert.equal(ok, true);
    assert.equal(calls.length, 1);
    assert.equal(
      calls[0]?.url,
      "https://challenges.cloudflare.com/turnstile/v0/siteverify"
    );
    assert.equal(calls[0]?.method, "POST");
    const body = calls[0]?.body;
    assert.ok(body instanceof FormData);
    assert.equal(body.get("secret"), "sec");
    assert.equal(body.get("response"), "tok");
    assert.equal(body.get("remoteip"), "203.0.113.9");
  });
  it("rejects success: false", async () => {
    const { fetchImpl } = recordingFetch(() =>
      Response.json({
        "error-codes": ["invalid-input-response"],
        success: false,
      })
    );
    assert.equal(await verifyTurnstile("tok", "ip", "sec", fetchImpl), false);
  });
  it("rejects a thrown fetch", async () => {
    const fetchImpl = (() =>
      Promise.reject(new Error("offline"))) as typeof fetch;
    assert.equal(await verifyTurnstile("tok", "ip", "sec", fetchImpl), false);
  });
  it("rejects a non-200 answer even with success: true", async () => {
    const { fetchImpl } = recordingFetch(() =>
      Response.json({ success: true }, { status: 500 })
    );
    assert.equal(await verifyTurnstile("tok", "ip", "sec", fetchImpl), false);
  });
  it("rejects invalid JSON and a missing success flag", async () => {
    const garbage = recordingFetch(() => new Response("not json"));
    assert.equal(
      await verifyTurnstile("tok", "ip", "sec", garbage.fetchImpl),
      false
    );
    const truthy = recordingFetch(() => Response.json({ success: "true" }));
    assert.equal(
      await verifyTurnstile("tok", "ip", "sec", truthy.fetchImpl),
      false
    );
  });
  it("aborts a siteverify call that never answers", async () => {
    const fetchImpl = ((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (!signal || signal.aborted) {
          reject(new Error("aborted"));
          return;
        }
        signal.addEventListener("abort", () => {
          reject(new Error("aborted"));
        });
      })) as typeof fetch;
    const timeout = mock.method(AbortSignal, "timeout", () =>
      AbortSignal.abort()
    );
    try {
      assert.equal(await verifyTurnstile("tok", "ip", "sec", fetchImpl), false);
      assert.equal(timeout.mock.calls[0]?.arguments[0], 5000);
    } finally {
      timeout.mock.restore();
    }
  });
  it("passes a signal to the siteverify fetch", async () => {
    let signal: AbortSignal | null | undefined;
    const fetchImpl = ((_input: RequestInfo | URL, init?: RequestInit) => {
      signal = init?.signal;
      return Promise.resolve(Response.json({ success: true }));
    }) as typeof fetch;
    assert.equal(await verifyTurnstile("tok", "ip", "sec", fetchImpl), true);
    assert.ok(signal instanceof AbortSignal);
  });
  it("rejects an empty token or secret without calling siteverify", async () => {
    const { calls, fetchImpl } = recordingFetch(() =>
      Response.json({ success: true })
    );
    assert.equal(await verifyTurnstile("", "ip", "sec", fetchImpl), false);
    assert.equal(await verifyTurnstile("tok", "ip", "", fetchImpl), false);
    assert.equal(calls.length, 0);
  });
  it("cancels the body of a non-200 answer", async () => {
    let cancelled = false;
    const body = new ReadableStream({
      cancel() {
        cancelled = true;
      },
    });
    const { fetchImpl } = recordingFetch(
      () => new Response(body, { status: 500 })
    );
    assert.equal(await verifyTurnstile("tok", "ip", "sec", fetchImpl), false);
    assert.equal(cancelled, true);
  });
  it("omits remoteip when the address is empty or unknown", async () => {
    for (const ip of ["", "unknown"]) {
      const { calls, fetchImpl } = recordingFetch(() =>
        Response.json({ success: true })
      );
      assert.equal(await verifyTurnstile("tok", ip, "sec", fetchImpl), true);
      const body = calls[0]?.body;
      assert.ok(body instanceof FormData);
      assert.equal(body.has("remoteip"), false);
    }
  });
});
