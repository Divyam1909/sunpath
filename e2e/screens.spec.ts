import { mkdirSync } from "node:fs";
import { test, type Page } from "@playwright/test";
import { fillLeadForm, signInAsAdmin, uniquePhone, uploadBill } from "./helpers";

// Not an assertion suite: takes every screen at both widths for design review and the TDD.
// Run on demand: SCREENS=1 pnpm exec playwright test --project=screens
test.skip(!process.env.SCREENS, "Only for design review");

const OUT = "docs/screenshots";
mkdirSync(OUT, { recursive: true });

const WIDTHS = [
  { label: "390", width: 390, height: 844 },
  { label: "1280", width: 1280, height: 900 },
];

async function shoot(page: Page, name: string, path?: string) {
  for (const { label, width, height } of WIDTHS) {
    await page.setViewportSize({ width, height });
    if (path) await page.goto(path);
    await page.waitForTimeout(1300);
    await page.screenshot({ path: `${OUT}/${name}-${label}.png`, fullPage: true });
  }
}

test("public screens", async ({ page }) => {
  test.setTimeout(180_000);
  await shoot(page, "01-landing", "/en");
  await fillLeadForm(page, { name: "Design Review", phone: uniquePhone() });
  await shoot(page, "02-upload");
  await uploadBill(page, "tilted-phone-photo.jpg");
  await page.waitForURL(/\/check$/);
  await shoot(page, "03-bill-check");
  await page.getByLabel(/Sanctioned load/).fill("5");
  await page.getByRole("button", { name: /Confirm/ }).click();
  await page.waitForURL(/\/result$/);
  await shoot(page, "04-result");
  await shoot(page, "04b-result-low", "/en/l/demo-lead-ld-30902/result");
  await shoot(page, "05-quote", "/en/q/demo-quote-ld-31007");
  await shoot(page, "05b-quote-marathi", "/mr/q/demo-quote-ld-31007");
  await shoot(page, "06-status", "/en/s/demo-status-pr-1005");
  await shoot(page, "06b-status-hindi", "/hi/s/demo-status-pr-1006");
  await shoot(page, "06c-status-documents", "/mr/s/demo-status-pr-1002");
  await shoot(page, "07-login", "/en/login");
});

test("staff screens", async ({ page }) => {
  test.setTimeout(180_000);
  await signInAsAdmin(page);
  await shoot(page, "10-leads", "/staff/leads");
  await page.goto("/staff/leads");
  await page.getByRole("link", { name: "Yogesh Fulzele" }).click();
  await page.waitForURL(/\/staff\/leads\/.+/);
  await shoot(page, "11-lead-quoted", page.url());
  await page.goto("/staff/leads");
  await page.getByRole("link", { name: "Prashant Wankhede" }).click();
  await page.waitForURL(/\/staff\/leads\/.+/);
  await shoot(page, "12-quote-builder", page.url());
  await shoot(page, "13-projects", "/staff/projects");
  await page.goto("/staff/projects");
  await page.getByRole("link", { name: "Nitin Chaudhari" }).first().click();
  await page.waitForURL(/\/staff\/projects\/.+/);
  await shoot(page, "14-project", page.url());
  await shoot(page, "15-messages", "/staff/messages");
  await shoot(page, "16-admin", "/staff/admin");
});
