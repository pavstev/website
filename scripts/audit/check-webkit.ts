import path from "node:path";
import { type Browser, type BrowserContext, webkit } from "playwright-core";

import type { Check, Page } from "./types.ts";

import {
  count,
  firstPostOnly,
  newResult,
  outDir,
  pageSlug,
  pool,
  reporter,
  sizes,
} from "./lib.ts";

type SizeName = "laptop" | "phone";

const sizeNames: SizeName[] = ["phone", "laptop"];

const keepHttp = async (context: BrowserContext): Promise<void> => {
  await context.route("**/*", async (route) => {
    if (route.request().resourceType() !== "document") {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    const headers = response.headers();
    const policy = headers["content-security-policy"];
    if (policy !== undefined)
      headers["content-security-policy"] = policy.replaceAll(
        /;?\s*upgrade-insecure-requests/gu,
        ""
      );
    await route.fulfill({ headers, response });
  });
};

const sideways = (): number =>
  Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) -
  innerWidth;

const visit = async (
  browser: Browser,
  dir: string,
  local: boolean,
  page: Page,
  sizeName: SizeName
): Promise<{ errors: string[]; sideways: number }> => {
  const size = sizes[sizeName];
  const context = await browser.newContext({
    deviceScaleFactor: 2,
    hasTouch: "hasTouch" in size,
    isMobile: "isMobile" in size,
    viewport: size.viewport,
  });
  try {
    if (local) await keepHttp(context);
    const tab = await context.newPage();
    const errors: string[] = [];
    tab.on("console", (message) => {
      if (
        message.type() === "error" &&
        !(page.kind === "404" && message.text().includes("status of 404"))
      )
        errors.push(`console: ${message.text()}`);
    });
    tab.on("pageerror", (error) => {
      errors.push(`pageerror: ${error.message}`);
    });
    tab.on("response", (response) => {
      if (response.status() >= 400 && response.url() !== page.url)
        errors.push(`${String(response.status())} ${response.url()}`);
    });
    const response = await tab.goto(page.url, {
      timeout: 60_000,
      waitUntil: "load",
    });
    await tab.waitForTimeout(2000);
    const expected = page.kind === "404" ? 404 : 200;
    if (response?.status() !== expected)
      errors.push(
        `status ${String(response?.status())}, expected ${String(expected)}`
      );
    await tab.screenshot({
      path: path.join(dir, `${pageSlug(page.url)}-${sizeName}.png`),
    });
    return { errors, sideways: await tab.evaluate(sideways) };
  } finally {
    await context.close();
  }
};

const check: Check = async (context) => {
  const result = newResult("webkit");
  const dir = outDir(context, "webkit");
  const pages = firstPostOnly(context.pages);
  const browser = await webkit.launch();
  try {
    const jobs = pages.flatMap((page) =>
      sizeNames.map((sizeName) => ({ page, sizeName }))
    );
    const runs = await pool(jobs, async ({ page, sizeName }) => ({
      page,
      seen: await visit(browser, dir, context.local, page, sizeName),
      sizeName,
    }));
    for (const { page, seen, sizeName } of runs) {
      const say = reporter(result, `${page.path} ${sizeName}`);
      for (const error of seen.errors) say.fail(error);
      if (seen.sideways > 1)
        say.fail(`page scrolls sideways, ${String(seen.sideways)}px too wide`);
    }
  } finally {
    await browser.close();
  }
  const fails = count(result, "fail");
  result.summary = `${String(pages.length)} pages x ${String(sizeNames.length)} sizes in WebKit: ${String(fails)} problems`;
  return result;
};

export default check;
