import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { contactEntries } from "./contact-links.ts";
import { footerLinks } from "./footer-links.ts";
import { personalData } from "./personal.ts";

const contact = {
  email: "hi@example.com",
  linkedin: "https://example.com/in/someone",
  linkedinHandle: "someone",
};

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

  it("gives each contact key the tone and detail of the home card", () => {
    const links = footerLinks(contact, true);
    const pick = (id: string) => links.find((link) => link.id === id);
    assert.deepEqual(
      [pick("github")?.tone, pick("linkedin")?.tone, pick("email")?.tone],
      ["purple", "green", "blue"]
    );
    assert.equal(pick("github")?.detail, personalData.githubHandle);
    assert.equal(pick("linkedin")?.detail, "someone");
    assert.equal(pick("email")?.detail, "hi@example.com");
    assert.equal(pick("rss")?.tone, "gold");
    assert.ok(pick("rss")?.detail);
  });

  it("leaves the details of the Résumé to its page sheet", () => {
    const resume = footerLinks(contact, false).find(
      ({ id }) => id === "resume"
    );
    assert.equal(resume?.detail, undefined);
  });

  it("shares the contact entries with the home card", () => {
    const entries = contactEntries(contact);
    const links = footerLinks(contact, false);
    for (const entry of entries) {
      assert.deepEqual(
        links.find(({ id }) => id === entry.id),
        entry
      );
    }
  });
});
