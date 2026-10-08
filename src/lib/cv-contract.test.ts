import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import * as z from "zod";

import { cvSchema, stripPrivate } from "./cv.ts";

const readFixture = async (): Promise<unknown> =>
  JSON.parse(await readFile("src/lib/cv-feed.fixture.json", "utf8")) as unknown;

describe("the hirista feed contract", () => {
  it("the hirista fixture parses with cvSchema and keeps every field", async () => {
    const fixture = await readFixture();
    const { updatedAt } = z.object({ updatedAt: z.string() }).parse(fixture);
    const cv = stripPrivate(cvSchema.parse(fixture));

    assert.deepEqual(cv, fixture);
    assert.equal(cv.basics.phone, "");
    assert.equal(cv.updatedAt, updatedAt);
  });
});
