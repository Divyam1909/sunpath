import { expect, test } from "@playwright/test";
import { fillLeadForm, signInAsAdmin, signInAsSales, uniquePhone, uploadBill } from "./helpers";

test("sales books a survey, builds a quote with live numbers, sends it and the PDF downloads", async ({ page, browser }) => {
  const name = `Quote Tester ${Date.now()}`;
  const phone = uniquePhone();
  const customer = await (await browser.newContext()).newPage();
  await fillLeadForm(customer, { name, phone });
  await uploadBill(customer, "clear-home-bill.jpg");
  await expect(customer).toHaveURL(/\/check$/);
  await customer.getByRole("button", { name: /Confirm/ }).click();
  await expect(customer).toHaveURL(/\/result$/);

  await signInAsSales(page);
  await page.goto("/staff/leads?stage=SCORED");
  await page.getByRole("link", { name }).click();
  await expect(page.getByText("100 points")).toBeVisible();

  await page.getByLabel("Survey date").fill("2026-12-01");
  await page.getByRole("button", { name: "Book survey" }).click();
  await page.getByLabel("Measured roof area, sq ft").waitFor();
  await page.getByLabel("Survey notes").fill("Good south-facing roof.");
  await page.getByRole("button", { name: "Save survey" }).click();

  const table = page.getByTestId("quote-table");
  await expect(table).toContainText("₹1,17,000");
  await expect(table).toContainText("₹38,753");

  await page.getByLabel("Tariff, ₹ per unit").fill("10");
  await expect(table).toContainText("₹41,160");
  await page.getByLabel("Tariff, ₹ per unit").fill("9.41");
  await expect(table).toContainText("₹38,753");

  await page.getByRole("button", { name: "Generate and send on WhatsApp" }).click();
  await expect(page.getByText("Latest quote")).toBeVisible();

  const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("quote-pdf").click()]);
  expect(download.suggestedFilename()).toMatch(/^solar-quote-LD-\d+\.pdf$/);
  const stream = await download.createReadStream();
  const head = await new Promise<Buffer>((resolve) => stream.once("data", (chunk) => resolve(chunk as Buffer)));
  expect(head.subarray(0, 5).toString()).toBe("%PDF-");

  await page.goto("/staff/messages");
  await expect(page.getByTestId("outbox-row").filter({ hasText: name.split(" ")[0] }).first()).toContainText("solar quote for 3 kW is ready");

  const quoteMessage = await page.getByTestId("outbox-row").filter({ hasText: "solar quote" }).first().innerText();
  const quotePath = quoteMessage.match(/\/en\/q\/[\w-]+/)?.[0];
  expect(quotePath).toBeTruthy();
  await customer.goto(quotePath!);
  await expect(customer.getByTestId("quote-story")).toContainText("₹1,17,000");
  await customer.getByText("How we calculated this").click();
  await expect(customer.getByText("₹1,95,000 − ₹78,000 = ₹1,17,000")).toBeVisible();
  await customer.getByRole("button", { name: /Pay ₹23,400 advance/ }).click();
  await expect(customer).toHaveURL(/\/s\//);
  await expect(customer.getByTestId("current-stage")).toHaveText("Advance received");
});

test("a stage change writes an outbox message and the status page updates", async ({ page, browser }) => {
  await signInAsSales(page);
  await page.goto("/staff/projects");
  await page.getByRole("link", { name: "Sanjay Thakre" }).first().click();
  await expect(page.getByTestId("project-stage")).toHaveText("Advance received");
  const before = await page.getByTestId("project-message").count();

  const statusHref = await page.getByTestId("status-link").getAttribute("href");
  const customer = await (await browser.newContext()).newPage();
  await customer.goto(statusHref!);
  await expect(customer.getByTestId("current-stage")).toContainText(/आगाऊ/);

  await page.getByRole("button", { name: "Move to Documents" }).click();
  await expect(page.getByTestId("project-stage")).toHaveText("Documents");
  await expect(page.getByTestId("project-message")).toHaveCount(before + 1);
  // Sanjay's language is Marathi, so the message and status page are too.
  await expect(page.getByTestId("project-message").first()).toContainText("कागदपत्रे");

  await customer.reload();
  await expect(customer.getByTestId("current-stage")).toHaveText("कागदपत्रे");
  await expect(customer.getByText("Sanjay Thakre")).toHaveCount(0);
});

test("a stage cannot move on until its documents are in", async ({ page }) => {
  await signInAsSales(page);
  await page.goto("/staff/projects");
  await page.getByTestId("stuck-project").filter({ hasText: "Meena Bhoyar" }).click();
  await page.getByRole("button", { name: /Move to Installation scheduled/ }).click();
  await expect(page.getByText(/Still needed first: Property papers/)).toBeVisible();
  await expect(page.getByTestId("project-stage")).toHaveText("Documents");
});

test("a low score still reaches a person: the call opens the survey route", async ({ page }) => {
  await signInAsSales(page);
  await page.goto("/staff/leads?score=LOW");
  await page.getByRole("link", { name: "Ayesha Siddiqui" }).click();
  await page.getByLabel("What did they say?").fill("Wants to add AC next year, so a survey is worth it.");
  await page.getByRole("button", { name: "Save call" }).click();
  await expect(page.getByLabel("Survey date")).toBeVisible();
});

test("admin sees the verify note and cannot save an overlapping rule", async ({ page }) => {
  await signInAsAdmin(page);
  await page.goto("/staff/admin");
  await expect(page.getByTestId("verify-banner")).toContainText("capped at ₹78,000");

  await page.getByRole("button", { name: "Add subsidy rule" }).click();
  await page.getByLabel("Scheme name").fill("Overlap test");
  await page.getByLabel("Slab 1 up to kW").fill("2");
  await page.getByLabel("Slab 1 rate per kW").fill("10000");
  await page.getByLabel("Cap, ₹").fill("20000");
  await page.getByLabel("Effective from").fill("2026-06-01");
  await page.getByRole("button", { name: "Save subsidy rule" }).click();
  await expect(page.getByText(/These dates overlap/)).toBeVisible();
});

test("an old quote keeps its numbers after the rules change", async ({ page }) => {
  await page.goto("/en/q/demo-quote-ld-31007");
  await expect(page.getByTestId("quote-story")).toContainText("₹1,17,000");

  await signInAsAdmin(page);
  await page.goto("/staff/admin");
  await page.getByLabel("Generation, units per kW a year").fill("1000");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Settings saved.")).toBeVisible();

  await page.goto("/en/q/demo-quote-ld-31007");
  await page.getByText("How we calculated this").click();
  await expect(page.getByText(/1,400 units per kW/)).toBeVisible();

  await page.goto("/staff/admin");
  await page.getByLabel("Generation, units per kW a year").fill("1400");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Settings saved.")).toBeVisible();
});

test("admin can erase a customer's data on request", async ({ page }) => {
  await signInAsAdmin(page);
  await page.goto("/staff/leads");
  await page.getByRole("link", { name: "Ganesh Pawar" }).first().click();
  await page.getByRole("button", { name: "Erase customer data" }).click();
  await page.getByRole("button", { name: "Yes, erase permanently" }).click();
  await expect(page).toHaveURL(/\/staff\/leads$/);
  await expect(page.getByRole("link", { name: "Ganesh Pawar" })).toHaveCount(0);
});
