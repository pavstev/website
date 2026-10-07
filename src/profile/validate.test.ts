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

  it("reports an image that is missing from the output", () => {
    const errors = errorsFor((files) =>
      files.filter((file) => file.path !== "assets/flag-at.svg")
    );
    assert.ok(errors.some((error) => error.includes("assets/flag-at.svg")));
  });

  it("reports an image without alt text", () => {
    const errors = errorsFor((files) =>
      edit(files, "README.md", (text) =>
        text.replace('alt="Website"', 'alt=""')
      )
    );
    assert.ok(errors.some((error) => error.includes("no alt text")));
  });

  it("reports an empty projects section", () => {
    const errors = errorsFor((files) =>
      edit(
        files,
        "README.md",
        (text) => `${text.split("## Open source", 1)[0]}## Open source\n`
      )
    );
    assert.ok(errors.some((error) => error.includes("projects section")));
  });

  it("reports a missing generated notice", () => {
    const errors = errorsFor((files) =>
      edit(files, "README.md", (text) => text.replace(/^<!--.*-->\n/, ""))
    );
    assert.ok(errors.some((error) => error.includes("generated notice")));
  });

  it("reports scripts and outside hosts in an SVG", () => {
    const errors = errorsFor((files) =>
      edit(files, "assets/flag-at.svg", (text) =>
        text.replace(
          "</svg>",
          '<script>1</script><image href="https://x.test/a.png"/></svg>'
        )
      )
    );
    assert.ok(errors.some((error) => error.includes("script")));
    assert.ok(errors.some((error) => error.includes("another host")));
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
