import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createServer } from "node:net";
import { after, before, describe, test } from "node:test";
import {
  type Browser,
  type BrowserContextOptions,
  chromium,
  type Page,
} from "playwright-core";

import { fixturesEnabled } from "../src/lib/blog/build-env.ts";
import { en } from "../src/lib/i18n.ts";
import { fillText } from "../src/lib/template.ts";
import {
  sortWork,
  type WorkGroup,
  type WorkSort,
  workSortKeys,
} from "../src/lib/work.ts";
import { root, sleep } from "./audit/lib.ts";

interface Card {
  data: Record<string, string | undefined>;
  name: string;
}

interface Opened {
  errors: string[];
  page: Page;
}

interface Server {
  base: string;
  stop: () => void;
}

const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "localhost", () => {
      const address = probe.address();
      const port = typeof address === "object" && address ? address.port : 0;
      probe.close(() => {
        resolve(port);
      });
    });
  });

const answers = async (url: string): Promise<boolean> => {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    return response.ok;
  } catch {
    return false;
  }
};

const startDev = async (): Promise<Server> => {
  const env = { ...process.env, BLOG_FIXTURES: "1" };
  if (!fixturesEnabled(env)) {
    throw new Error("The e2e suite needs the dev fixtures. Run it locally.");
  }
  execFileSync("node", ["scripts/blog-fixtures.ts"], { cwd: root, env });
  const port = await freePort();
  const base = `http://localhost:${String(port)}`;
  const log: string[] = [];
  const child = spawn(
    "pnpm",
    ["exec", "astro", "dev", "--port", String(port), "--ignore-lock"],
    { cwd: root, detached: true, env, stdio: ["ignore", "pipe", "pipe"] }
  );
  const keep = (chunk: Buffer): void => {
    log.push(chunk.toString());
  };
  child.stdout.on("data", keep);
  child.stderr.on("data", keep);
  const stop = (): void => {
    if (child.pid === undefined || child.exitCode !== null) return;
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch (error) {
      process.stderr.write(`the dev server did not stop: ${String(error)}\n`);
    }
  };
  for (let attempt = 0; attempt < 240; attempt += 1) {
    if (await answers(`${base}/work`)) return { base, stop };
    if (child.exitCode !== null) break;
    await sleep(500);
  }
  stop();
  throw new Error(
    `The dev server did not answer.\n${log.join("").slice(-2000)}`
  );
};

let server: Server | undefined;
let browser: Browser | undefined;

const base = (): string => {
  assert.ok(server);
  return server.base;
};

const open = async (
  path: string,
  options: BrowserContextOptions = {}
): Promise<Opened> => {
  assert.ok(browser);
  const context = await browser.newContext({
    viewport: { height: 900, width: 1280 },
    ...options,
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => {
    errors.push(error.message);
  });
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto(`${base()}${path}`, { waitUntil: "networkidle" });
  return { errors, page };
};

const ready = (page: Page): Promise<unknown> =>
  page.waitForSelector("[data-work][data-ready]", { state: "attached" });

const shown = (page: Page): Promise<Card[]> =>
  page.$$eval(".work-card", (cards) =>
    cards
      .filter((card) => card instanceof HTMLElement && card.checkVisibility())
      .map((card) => {
        const data = Object.fromEntries(
          Object.entries((card as HTMLElement).dataset)
        );
        return { data, name: data["name"] ?? "" };
      })
  );

const productsFirst = (groups: readonly WorkGroup[]): boolean => {
  const firstOpen = groups.indexOf("open-source");
  return firstOpen === -1 || !groups.slice(firstOpen).includes("products");
};

const groupsOf = (cards: readonly Card[]): WorkGroup[] =>
  cards.map((card) => workSortKeys(card.data).group);

const pick = (page: Page, value: string): Promise<void> =>
  page.click(`label.work-filter-option:has(input[value="${value}"])`);

const checked = (page: Page): Promise<string> =>
  page.$eval(
    'input[name="work-show"]:checked',
    (input) => (input as HTMLInputElement).value
  );

const search = (page: Page): Promise<string> =>
  page.evaluate(() => globalThis.location.search);

const sortValue = (page: Page): Promise<string> =>
  page.$eval(
    ".work-sort",
    (menu) => (menu as HTMLElement).dataset["value"] ?? ""
  );

const total = (page: Page): Promise<number> =>
  page.locator(".work-card").count();

const shownCount = async (page: Page): Promise<number> => {
  const cards = await shown(page);
  return cards.length;
};

const text = async (page: Page, selector: string): Promise<string> => {
  const content = await page.textContent(selector);
  return content?.trim() ?? "";
};

const robots = async (page: Page): Promise<string> => {
  const content = await page.getAttribute('meta[name="robots"]', "content");
  return content ?? "";
};

const closeAll = async (opened: Opened): Promise<void> => {
  await opened.page.context().close();
};

before(async () => {
  server = await startDev();
  browser = await chromium.launch();
});

after(async () => {
  await browser?.close();
  server?.stop();
});

describe("work grid", () => {
  test("lists products before open source", async () => {
    const opened = await open("/work");
    await ready(opened.page);
    const cards = await shown(opened.page);
    const groups = groupsOf(cards);
    assert.ok(groups.includes("products"));
    assert.ok(groups.includes("open-source"));
    assert.ok(productsFirst(groups));
    assert.equal(await checked(opened.page), "all");
    assert.deepEqual(opened.errors, []);
    await closeAll(opened);
  });

  test("falls back to the default view on bad values", async () => {
    const opened = await open("/work?show=bogus&sort=bogus&ref=x#top");
    await ready(opened.page);
    assert.equal(await checked(opened.page), "all");
    assert.equal(await sortValue(opened.page), "featured");
    assert.equal(await search(opened.page), "?ref=x");
    assert.equal(
      await opened.page.evaluate(() => globalThis.location.hash),
      "#top"
    );
    assert.equal(await shownCount(opened.page), await total(opened.page));
    assert.deepEqual(opened.errors, []);
    await closeAll(opened);
  });

  test("opens the view the address asks for", async () => {
    const opened = await open("/work?show=products&sort=name");
    await ready(opened.page);
    assert.equal(await checked(opened.page), "products");
    assert.equal(await sortValue(opened.page), "name");
    const cards = await shown(opened.page);
    assert.ok(cards.length > 0);
    assert.ok(groupsOf(cards).every((group) => group === "products"));
    assert.deepEqual(opened.errors, []);
    await closeAll(opened);
  });

  test("a filter click updates the address and the status", async () => {
    const opened = await open("/work");
    await ready(opened.page);
    const all = await total(opened.page);
    await pick(opened.page, "open-source");
    const cards = await shown(opened.page);
    assert.ok(groupsOf(cards).every((group) => group === "open-source"));
    assert.equal(await search(opened.page), "?show=open-source");
    assert.equal(
      await opened.page.textContent("[data-work-status]"),
      fillText(en.work.status, {
        shown: String(cards.length),
        total: String(all),
      })
    );
    await pick(opened.page, "all");
    assert.equal(await search(opened.page), "");
    assert.equal(await shownCount(opened.page), all);
    assert.deepEqual(opened.errors, []);
    await closeAll(opened);
  });

  test("featured keeps products first and every sort orders the cards", async () => {
    const opened = await open("/work");
    await ready(opened.page);
    const sorts: WorkSort[] = ["stars", "updated", "name", "featured"];
    for (const sort of sorts) {
      await opened.page.click("#work-sort");
      await opened.page.click(`[role="option"][data-value="${sort}"]`);
      const cards = await shown(opened.page);
      if (sort === "featured") assert.ok(productsFirst(groupsOf(cards)));
      const expected = sortWork(
        cards.map((card) => workSortKeys(card.data)),
        sort
      ).map((card) => card.name);
      assert.deepEqual(
        cards.map((card) => card.name),
        expected,
        sort
      );
      assert.equal(
        await search(opened.page),
        sort === "featured" ? "" : `?sort=${sort}`
      );
      assert.equal(await sortValue(opened.page), sort);
      assert.equal(
        await opened.page.$eval(".work-sort", (menu) =>
          Object.hasOwn(menu.dataset, "changed")
        ),
        sort !== "featured",
        sort
      );
      assert.equal(
        await opened.page.isVisible(".select-menu-panel:popover-open"),
        false
      );
    }
    assert.deepEqual(opened.errors, []);
    await closeAll(opened);
  });

  test("the keyboard drives the sort menu", async () => {
    const opened = await open("/work");
    await ready(opened.page);
    await opened.page.focus("#work-sort");
    await opened.page.keyboard.press("Enter");
    await opened.page.keyboard.press("End");
    await opened.page.keyboard.press("Enter");
    assert.equal(await sortValue(opened.page), "name");
    assert.equal(await search(opened.page), "?sort=name");
    assert.equal(
      await opened.page.evaluate(() => globalThis.document.activeElement?.id),
      "work-sort"
    );
    assert.deepEqual(opened.errors, []);
    await closeAll(opened);
  });

  test("the arrow keys move the filter", async () => {
    const opened = await open("/work");
    await ready(opened.page);
    await opened.page.focus('input[name="work-show"][value="all"]');
    await opened.page.keyboard.press("ArrowRight");
    assert.equal(await checked(opened.page), "products");
    assert.equal(await search(opened.page), "?show=products");
    assert.ok(
      await opened.page.$eval(
        'label.work-filter-option:has(input[value="products"])',
        (label) => label.matches(":has(:focus-visible)")
      )
    );
    assert.deepEqual(opened.errors, []);
    await closeAll(opened);
  });

  test("the filter works without JavaScript", async () => {
    const opened = await open("/work", { javaScriptEnabled: false });
    assert.equal(await opened.page.isVisible(".work-sort"), false);
    await pick(opened.page, "products");
    const cards = await shown(opened.page);
    assert.ok(cards.length > 0);
    assert.ok(groupsOf(cards).every((group) => group === "products"));
    await closeAll(opened);
  });

  test("a failed controls script leaves the page usable", async () => {
    assert.ok(browser);
    const context = await browser.newContext();
    await context.route("**/work-controls.ts*", (route) => route.abort());
    const page = await context.newPage();
    await page.goto(`${base()}/work`, { waitUntil: "networkidle" });
    assert.equal(await page.isVisible(".work-sort"), false);
    await pick(page, "open-source");
    const cards = await shown(page);
    assert.ok(cards.length > 0);
    assert.ok(groupsOf(cards).every((group) => group === "open-source"));
    await context.close();
  });

  test("fits a 320 pixel screen", async () => {
    const opened = await open("/work?show=open-source", {
      viewport: { height: 720, width: 320 },
    });
    await ready(opened.page);
    assert.equal(
      await opened.page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      ),
      true
    );
    assert.deepEqual(opened.errors, []);
    await closeAll(opened);
  });
});

describe("error pages", () => {
  test("a missing page answers 404 and names the path", async () => {
    assert.ok(browser);
    const page = await browser.newPage();
    const response = await page.goto(`${base()}/no/such/page`);
    assert.equal(response?.status(), 404);
    assert.equal(await text(page, "h1"), en.notFound.heading);
    assert.equal(await text(page, "[data-lost-path]"), "/no/such/page");
    assert.match(await robots(page), /noindex/);
    assert.ok((await page.locator(".not-found-links a").count()) > 1);
    await page.close();
  });

  test("the 500 page renders its own copy", async () => {
    const opened = await open("/500");
    const { page } = opened;
    assert.equal(await text(page, "h1"), en.serverError.heading);
    assert.equal(
      await text(page, "[data-lost-path]"),
      en.serverError.fallbackPath
    );
    assert.match(await robots(page), /noindex/);
    assert.deepEqual(
      opened.errors.filter((error) => !error.includes("status of 500")),
      []
    );
    await closeAll(opened);
  });
});
