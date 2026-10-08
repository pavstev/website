import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { cvSchema } from "./cv.ts";
import {
  formatPeriod,
  industries,
  industryCompanies,
  industryJob,
} from "./industries.ts";

interface Stint {
  company: string;
  from: string;
  to: string;
  websiteUrl: string;
}

const cvOf = (items: Stint[]): ReturnType<typeof cvSchema.parse> =>
  cvSchema.parse({
    experience: { items },
    updatedAt: "2026-10-08T00:00:00.000Z",
  });

const stint = (
  company: string,
  from: string,
  to: string,
  websiteUrl = ""
): Stint => ({ company, from, to, websiteUrl });

const liveFeed = cvOf([
  stint(
    "Safety Real Time",
    "Apr 2022",
    "Present",
    "https://safetyrealtime.com/"
  ),
  stint("167Pluto", "Feb 2024", "Jun 2025"),
  stint("Apoddo", "Aug 2021", "Mar 2022", "https://apoddo.com/"),
  stint("Evermed", "Jan 2021", "Aug 2021", "https://start.evermedtv.com/"),
  stint("Pannovate", "Jan 2020", "Dec 2020", "https://www.pannovate.com/"),
]);

describe("formatPeriod", () => {
  it("shows one year when both ends fall in it", () => {
    assert.equal(formatPeriod("Jan 2020", "Dec 2020"), "2020");
    assert.equal(formatPeriod("Jan 2021", "Aug 2021"), "2021");
  });

  it("shows since for an ongoing stint", () => {
    assert.equal(formatPeriod("Apr 2022", "Present"), "since 2022");
    assert.equal(formatPeriod("Apr 2022", "Now"), "since 2022");
    assert.equal(formatPeriod("Apr 2022", "current"), "since 2022");
    assert.equal(formatPeriod("2019", ""), "since 2019");
    assert.equal(formatPeriod("2019", "unknown"), "since 2019");
  });

  it("shows a range across years", () => {
    assert.equal(formatPeriod("Feb 2024", "Jun 2025"), "2024 to 2025");
    assert.equal(formatPeriod("2018", "2020"), "2018 to 2020");
  });

  it("reads the last four-digit year of each end", () => {
    assert.equal(formatPeriod("01.02.2019", "30.11.2021"), "2019 to 2021");
    assert.equal(formatPeriod("2019-02 to 2019-11", ""), "since 2019");
  });

  it("throws when the start has no year", () => {
    assert.throws(() => formatPeriod("", "2020"), /industries/);
    assert.throws(() => formatPeriod("spring", "2020"), /industries/);
  });
});

describe("industryCompanies", () => {
  it("names the feed company behind each topic", () => {
    assert.deepEqual(industryCompanies, {
      betting: "167Pluto",
      fintech: "Pannovate",
      fleet: "Safety Real Time",
      healthtech: "Evermed",
    });
  });
});

describe("industryJob", () => {
  it("reads company, period and link for the four topics", () => {
    assert.deepEqual(industryJob(liveFeed, "fintech"), {
      company: "Pannovate",
      period: "2020",
      site: "https://www.pannovate.com/",
    });
    assert.deepEqual(industryJob(liveFeed, "betting"), {
      company: "167Pluto",
      period: "2024 to 2025",
      site: "https://www.linkedin.com/company/167pluto/",
    });
    assert.deepEqual(industryJob(liveFeed, "healthtech"), {
      company: "Evermed",
      period: "2021",
      site: "https://start.evermedtv.com/",
    });
    assert.deepEqual(industryJob(liveFeed, "fleet"), {
      company: "Safety Real Time",
      period: "since 2022",
      site: "https://safetyrealtime.com/",
    });
  });

  it("matches the company without regard to case or spaces", () => {
    const cv = cvOf([
      stint(
        " safety REAL  time ",
        "Apr 2022",
        "Present",
        "https://srt.example/"
      ),
    ]);
    assert.deepEqual(industryJob(cv, "fleet"), {
      company: " safety REAL  time ",
      period: "since 2022",
      site: "https://srt.example/",
    });
    const joined = cvOf([stint("SafetyRealTime", "2022", "Now")]);
    assert.equal(industryJob(joined, "fleet").period, "since 2022");
  });

  it("spans several stints from the earliest start to the latest end", () => {
    const cv = cvOf([
      stint("Evermed", "Mar 2023", "Dec 2023", "https://later.example/"),
      stint("Evermed", "Jan 2021", "Aug 2021"),
    ]);
    assert.deepEqual(industryJob(cv, "healthtech"), {
      company: "Evermed",
      period: "2021 to 2023",
      site: "https://later.example/",
    });
  });

  it("keeps an ongoing stint ongoing", () => {
    const cv = cvOf([
      stint("Evermed", "Jan 2021", "Aug 2021"),
      stint("Evermed", "Mar 2023", "Present"),
    ]);
    assert.equal(industryJob(cv, "healthtech").period, "since 2021");
  });

  it("shows no link for an empty or unsafe one", () => {
    const attacks = [
      "",
      " ".repeat(3),
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "JAVASCRIPT:alert(1)",
      "\n javascript:alert(1)",
      " javascript:alert(1)",
      "\tdata:text/html,x",
      "data:text/html,<b>x</b>",
      "mailto:a@b.example",
      "ftp://files.example/",
      "https://",
      "//evil.example/",
      "evil.example",
    ];
    for (const websiteUrl of attacks) {
      const cv = cvOf([stint("Pannovate", "Jan 2020", "Dec 2020", websiteUrl)]);
      assert.equal(industryJob(cv, "fintech").site, "", websiteUrl);
    }
  });

  it("links 167Pluto to its LinkedIn page until the feed has a link", () => {
    const empty = cvOf([stint("167Pluto", "Feb 2024", "Jun 2025", "")]);
    assert.equal(
      industryJob(empty, "betting").site,
      "https://www.linkedin.com/company/167pluto/"
    );
    const unsafe = cvOf([
      stint("167Pluto", "Feb 2024", "Jun 2025", "javascript:alert(1)"),
    ]);
    assert.equal(
      industryJob(unsafe, "betting").site,
      "https://www.linkedin.com/company/167pluto/"
    );
    const fromFeed = cvOf([
      stint("167Pluto", "Feb 2024", "Jun 2025", "https://167pluto.example/"),
    ]);
    assert.equal(
      industryJob(fromFeed, "betting").site,
      "https://167pluto.example/"
    );
  });

  it("takes the first usable link across stints", () => {
    const cv = cvOf([
      stint("Pannovate", "2022", "2023", "javascript:alert(1)"),
      stint("Pannovate", "2020", "2021", "http://old.example/"),
      stint("Pannovate", "2018", "2019", "https://older.example/"),
    ]);
    assert.equal(industryJob(cv, "fintech").site, "http://old.example/");
  });

  it("throws when the company is not in the feed", () => {
    const cv = cvOf([stint("Evermed", "2021", "2021")]);
    assert.throws(
      () => industryJob(cv, "betting"),
      new Error("industries: 167Pluto is not in the CV feed")
    );
    assert.throws(
      () => industryJob(cvOf([]), "fleet"),
      new Error("industries: Safety Real Time is not in the CV feed")
    );
  });

  it("throws when the matched stint has no start year", () => {
    const cv = cvOf([stint("Evermed", "", "2021")]);
    assert.throws(() => industryJob(cv, "healthtech"), /industries/);
  });
});

describe("industries", () => {
  it("lists the four topics with static bio fields only", () => {
    assert.deepEqual(
      industries.map(({ key, panelId, word }) => ({ key, panelId, word })),
      [
        { key: "fintech", panelId: "industry-fintech", word: "fintech" },
        { key: "betting", panelId: "industry-betting", word: "betting" },
        {
          key: "healthtech",
          panelId: "industry-healthtech",
          word: "healthtech",
        },
        { key: "fleet", panelId: "industry-fleet", word: "fleet logistics" },
      ]
    );
    for (const industry of industries) {
      assert.deepEqual(
        Object.keys(industry).toSorted((a, b) => a.localeCompare(b)),
        ["facts", "icon", "key", "label", "panelId", "title", "word"]
      );
    }
  });
});
