import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { servedCv } from "./cv-sample.ts";
import { cvSchema } from "./cv.ts";
import { personalData } from "./personal.ts";
import { readResumeFacts } from "./resume-facts.ts";
import { readPhoto } from "./resume-file.ts";
import { renderResumePdf } from "./resume-pdf.ts";

const site = personalData.website;

const known = `${site}/stevan-pavlovic.jpeg`;

const recordingReader = (): {
  read: (file: string) => Promise<Uint8Array>;
  requested: string[];
} => {
  const requested: string[] = [];
  return {
    read: (file) => {
      requested.push(file);
      return Promise.resolve(Buffer.from("jpeg bytes"));
    },
    requested,
  };
};

describe("readPhoto", () => {
  it("reads public/stevan-pavlovic.jpeg for the one known address", async () => {
    assert.equal(known, "https://stevanpavlovic.com/stevan-pavlovic.jpeg");
    const { read, requested } = recordingReader();
    const photo = await readPhoto(known, read);
    assert.equal(Buffer.from(photo ?? []).toString(), "jpeg bytes");
    assert.deepEqual(requested, ["public/stevan-pavlovic.jpeg"]);
  });

  it("uses no photo for any other address and reads nothing", async () => {
    const { read, requested } = recordingReader();
    for (const url of [
      "",
      "not a url",
      "/stevan-pavlovic.jpeg",
      `${known}?v=2`,
      `${known}?`,
      `${known}#top`,
      `${known}x`,
      `${site}/portraits/portrait-800.webp`,
      `${site}/`,
      `${site}/../etc/passwd`,
      `${site}/a/..%2fstevan-pavlovic.jpeg`,
      `${site}//stevan-pavlovic.jpeg`,
      "https://example.com/stevan-pavlovic.jpeg",
      "https://stevanpavlovic.com.evil.test/stevan-pavlovic.jpeg",
      "https://user@stevanpavlovic.com/stevan-pavlovic.jpeg",
      "https://stevanpavlovic.com:8443/stevan-pavlovic.jpeg",
      `${site.replace("https:", "http:")}/stevan-pavlovic.jpeg`,
      "file:///etc/passwd",
      "data:image/png;base64,AAAA",
    ]) {
      assert.equal(await readPhoto(url, read), null, url);
    }
    assert.deepEqual(requested, []);
  });

  it("uses no photo when the file cannot be read", async () => {
    const photo = await readPhoto(known, () =>
      Promise.reject(new Error("EACCES"))
    );
    assert.equal(photo, null);
  });

  it("reads the committed JPEG, which is small enough for the PDF", async () => {
    const photo = await readPhoto(known);
    assert.notEqual(photo, null);
    assert.equal(photo?.[0], 0xff);
    assert.equal(photo?.[1], 0xd8);
    assert.ok((photo?.byteLength ?? 0) < 120 * 1024);
  });
});

describe("readResumeFacts", () => {
  it("reads the page count and the size of a rendered sample", async () => {
    const pdf = await renderResumePdf(cvSchema.parse(servedCv), null);
    const facts = readResumeFacts(pdf);
    assert.ok(facts.pages >= 1);
    assert.equal(facts.kilobytes, Math.round(pdf.byteLength / 1024));
  });

  it("fails when the bytes are not a PDF", () => {
    assert.throws(
      () => readResumeFacts(Buffer.from("not a pdf")),
      /resume PDF: no page count found/
    );
  });
});
