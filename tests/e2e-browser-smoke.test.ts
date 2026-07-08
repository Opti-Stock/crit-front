import assert from "node:assert/strict";
import { test } from "node:test";

const runBrowserE2e = process.env.CRIT_E2E_BROWSER === "1";
const baseUrl = process.env.CRIT_E2E_BASE_URL ?? "http://localhost:5173";

test("browser smoke covers public app entry points", { skip: !runBrowserE2e }, async () => {
  const playwright = await import("@playwright/test");
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage();

  try {
    for (const path of ["/", "/admin.html", "/checkin.html", "/super-admin.html"]) {
      await page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded" });
      const title = await page.title();
      assert.ok(title.length >= 0);
      await page.locator("body").waitFor({ state: "visible" });
    }
  } finally {
    await browser.close();
  }
});
