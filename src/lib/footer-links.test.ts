import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { footerLinks } from "./footer-links.ts";

const contact = { email: "hi@example.com", linkedin: "https://example.com/in" };

describe("footerLinks", () => {
  it("lists GitHub, LinkedIn, Email and Résumé, then RSS when the blog is live", () => {
    assert.deepEqual(
      footerLinks(contact, false).map(({ id }) => id),
      ["github", "linkedin", "email", "resume"]
    );
    assert.deepEqual(
      footerLinks(contact, true).map(({ id }) => id),
      ["github", "linkedin", "email", "resume", "rss"]
    );
  });

  it("opens only GitHub and LinkedIn in a new tab", () => {
    const external = footerLinks(contact, true)
      .filter((link) => link.external)
      .map(({ id }) => id);
    assert.deepEqual(external, ["github", "linkedin"]);
  });

  it("points Email at the address and gives RSS its feed type", () => {
    const links = footerLinks(contact, true);
    assert.equal(
      links.find(({ id }) => id === "email")?.href,
      "mailto:hi@example.com"
    );
    assert.equal(
      links.find(({ id }) => id === "rss")?.type,
      "application/rss+xml"
    );
  });
});
