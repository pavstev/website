import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { readResumeFacts } from "./resume-facts.ts";
import { getResumePdf } from "./resume-file.ts";

describe("readResumeFacts", () => {
  it("reads two pages and the size from the committed résumé", async () => {
    const facts = readResumeFacts(await getResumePdf());
    assert.equal(facts.pages, 2);
    assert.ok(facts.kilobytes > 20);
  });

  it("fails when the file has no page count", () => {
    assert.throws(
      () => readResumeFacts(Buffer.from("not a pdf")),
      /no page count/
    );
  });
});
