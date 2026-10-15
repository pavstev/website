import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { fixture } from "./fixtures.ts";
import { renderProfile } from "./render.ts";
import { type ProfileFile } from "./types.ts";
import { validateProfile } from "./validate.ts";

const options = { generated: fixture.strings.profile.generated };

const errorsFor = (change: (files: ProfileFile[]) => ProfileFile[]): string[] =>
  validateProfile(change(renderProfile(fixture)), options);

const edit = (
  files: ProfileFile[],
  path: string,
  change: (contents: string) => string
): ProfileFile[] =>
  files.map((file) =>
    file.path === path ? { ...file, contents: change(file.contents) } : file
  );

describe("validateProfile", () => {
  it("accepts the fixture output", () => {
    assert.deepEqual(
      errorsFor((files) => files),
      []
    );
  });

  it("reports a missing file", () => {
    const errors = errorsFor((files) =>
      files.filter((file) => file.path !== "CONTRIBUTING.md")
    );
    assert.ok(errors.some((error) => error.includes("CONTRIBUTING.md")));
  });

  it("reports an image", () => {
    const errors = errorsFor((files) =>
      edit(files, "README.md", (text) => `${text}<img src="a.svg" alt="a">\n`)
    );
    assert.ok(errors.some((error) => error.includes("image")));
  });

  it("reports a README without a table", () => {
    const errors = errorsFor((files) =>
      edit(files, "README.md", (text) => text.replaceAll("| :--", "| --"))
    );
    assert.ok(errors.some((error) => error.includes("projects section")));
  });

  it("reports a missing generated notice", () => {
    const errors = errorsFor((files) =>
      edit(files, "README.md", (text) => text.replace(/^<!--.*-->\n/, ""))
    );
    assert.ok(errors.some((error) => error.includes("generated notice")));
  });

  it("reports a link that is not https", () => {
    const errors = errorsFor((files) =>
      edit(files, "README.md", (text) =>
        text.replace("https://www.linkedin.com", "ftp://www.linkedin.com")
      )
    );
    assert.ok(errors.some((error) => error.includes("not https")));
  });

  it("reports CRLF endings", () => {
    const errors = errorsFor((files) =>
      edit(files, "CONTRIBUTING.md", (text) => text.replaceAll("\n", "\r\n"))
    );
    assert.ok(errors.some((error) => error.includes("CR")));
  });
});
