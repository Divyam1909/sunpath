import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { fillLeadForm, SAMPLES, signInAsAdmin, signInAsSales, uniquePhone, uploadBill } from "./helpers";

async function confirmBill(page: Page) {
  await expect(page).toHaveURL(/\/check$/);
  await page.getByRole("button", { name: /Confirm/ }).click();
  await expect(page).toHaveURL(/\/result$/);
}

test("a Marathi bill in the real layout gives a year of bills before and after solar", async ({ page }) => {
  await fillLeadForm(page, { name: "Prasad Deshpande", phone: uniquePhone(), bill: "4000" });
  await uploadBill(page, "marathi-home-bill.jpg");
  await expect(page.getByLabel(/Units this month/)).toHaveValue("310");
  await expect(page.getByLabel(/Name on the bill/)).toHaveValue("PRASAD M DESHPANDE");
  await expect(page.getByLabel(/Arrears on the bill/)).toHaveValue("4.62");
  await confirmBill(page);

  await expect(page.getByTestId("blockers")).toHaveCount(0);
  await expect(page.getByTestId("bill-before-after")).toContainText("₹");
  await expect(page.getByTestId("year-plan")).toBeVisible();
  await page.getByText("See every month").click();
  await expect(page.getByTestId("year-plan").getByRole("rowheader", { name: "May" })).toBeVisible();
});

test("a peak May bill is sized on the year, not the month, and staff see why", async ({ page, browser }) => {
  const name = `Vinod Bobde ${Date.now()}`;
  const customer = await (await browser.newContext()).newPage();
  await fillLeadForm(customer, { name, phone: uniquePhone(), bill: "8000" });
  await uploadBill(customer, "peak-may-bill.jpg");
  await expect(customer.getByLabel(/Units this month/)).toHaveValue("610");
  await expect(customer.getByLabel(/Average units a month/)).toHaveValue("365");
  await confirmBill(customer);
  await expect(customer.getByTestId("season-note")).toContainText("67% above your normal month");

  await signInAsSales(page);
  await page.goto("/staff/leads");
  await page.getByRole("link", { name }).first().click();
  await expect(page.getByTestId("staff-season")).toContainText("On this bill alone it would be");
});

test("a bill in another name with arrears is caught before anyone visits", async ({ page, browser }) => {
  const name = `Pooja Tiwari ${Date.now()}`;
  const customer = await (await browser.newContext()).newPage();
  await fillLeadForm(customer, { name, phone: uniquePhone(), bill: "8000" });
  await uploadBill(customer, "name-and-arrears-bill.jpg");
  await confirmBill(customer);
  const blockers = customer.getByTestId("blockers");
  await expect(blockers.locator('[data-blocker="nameMismatch"]')).toContainText("RAMESH K TIWARI");
  await expect(blockers.locator('[data-blocker="arrears"]')).toContainText("₹2,986");
  await expect(blockers.locator('[data-blocker="loadLow"]')).toContainText("2 kW");

  await signInAsSales(page);
  await page.goto("/staff/leads");
  await expect(page.getByTestId("lead-row").filter({ hasText: name }).getByTestId("lead-blocked")).toHaveText("2 to fix first");
  await page.getByRole("link", { name }).first().click();
  await expect(page.getByTestId("staff-blockers")).toContainText("is overdue on this bill");
});

test("a real 0.5 kW sanctioned load fits no system, so it goes to a call with the reason", async ({ page }) => {
  await fillLeadForm(page, { name: "Tiny Load", phone: uniquePhone(), bill: "4000" });
  await uploadBill(page, "marathi-home-bill.jpg");
  await page.getByLabel(/Sanctioned load/).fill("0.5");
  await confirmBill(page);
  await expect(page.getByTestId("result-title")).toHaveText("We'll give you a quick call");
  await expect(page.getByTestId("blockers").locator('[data-blocker="loadLow"]')).toContainText("0.5 kW");
});

test("when solar will not pay back in time, the homeowner is told so", async ({ page }) => {
  await page.goto("/en/l/demo-lead-ld-30915/result");
  await expect(page.getByTestId("poor-worth")).toHaveCount(0);

  // With the subsidy even a small home pays back in about 5 years, so the limit is tightened to show the message.
  await signInAsAdmin(page);
  await page.goto("/staff/admin");
  await page.getByLabel("Say solar may not pay above, years").fill("3");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Settings saved.")).toBeVisible();
  await page.goto("/en/l/demo-lead-ld-30915/result");
  await expect(page.getByTestId("poor-worth")).toContainText("Solar may not be worth it for you");

  await page.goto("/staff/admin");
  await page.getByLabel("Say solar may not pay above, years").fill("12");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Settings saved.")).toBeVisible();
});

test("the photo check warns before upload, and both sides join into one image", async ({ page }) => {
  await fillLeadForm(page, { name: "Photo Check", phone: uniquePhone() });
  const file = page.getByTestId("bill-file");

  await file.setInputFiles(path.join(SAMPLES, "blurry-photo.jpg"));
  await expect(page.getByTestId("photo-issues")).toContainText("looks blurry");
  await expect(page.getByRole("button", { name: "Use this photo anyway" })).toBeVisible();

  await page.getByRole("button", { name: "Take a new photo" }).click();
  await file.setInputFiles(path.join(SAMPLES, "not-a-bill.jpg"));
  await file.setInputFiles(path.join(SAMPLES, "tilted-phone-photo.jpg"));
  await expect(page.getByText("This photo looks clear.")).toBeVisible();

  await page.getByTestId("bill-back-file").setInputFiles(path.join(SAMPLES, "clear-home-bill.jpg"));
  await expect(page.getByRole("img", { name: "Back of the bill" })).toBeVisible();
  await page.getByRole("button", { name: "Read my bill" }).click();
  // Sent as one new file. It matches no sample, so the mock reader passes it to manual entry, proving it was joined.
  await expect(page).toHaveURL(/\/check$/);
  await expect(page.getByRole("heading", { name: "Enter your bill details" })).toBeVisible();
});

test("the roof is measured on the map, re-measured on the server and shown to the surveyor", async ({ page, browser }) => {
  const name = `Map Tester ${Date.now()}`;
  const customer = await (await browser.newContext()).newPage();
  // Imagery is decoration here: taps are measured the same whether or not tiles load.
  await customer.route(/arcgisonline|openstreetmap/, (route) => route.abort());
  await customer.goto("/en");
  await customer.getByText("Yes, I own it").click();
  await customer.getByText("Concrete (flat)").click();
  await customer.getByRole("button", { name: "Continue" }).click();
  await customer.getByLabel("Pincode").fill("440022");
  await customer.getByLabel(/monthly bill/).fill("3200");
  await customer.getByRole("button", { name: /Measure your roof on a map/ }).click();

  const canvas = customer.getByTestId("roof-map-canvas");
  await canvas.waitFor();
  await customer.waitForSelector(".leaflet-container");
  const zoomIn = customer.locator(".leaflet-control-zoom-in");
  for (let i = 0; i < 3; i++) {
    await zoomIn.click();
    await customer.waitForTimeout(500);
  }
  const box = (await canvas.boundingBox())!;
  const corners: [number, number][] = [[-30, -20], [30, -20], [30, 20], [-30, 20]];
  for (const [x, y] of corners) await customer.mouse.click(box.x + box.width / 2 + x, box.y + box.height / 2 + y);
  await expect(customer.getByTestId("roof-map-area")).toContainText("sq ft");
  const measured = Number((await customer.getByTestId("roof-map-area").innerText()).replace(/\D/g, ""));
  expect(measured).toBeGreaterThan(50);

  await customer.getByRole("button", { name: "Use this area" }).click();
  await expect(customer.getByLabel(/Roof area/)).toHaveValue(String(measured));
  await customer.getByRole("button", { name: "Continue" }).click();
  await customer.getByLabel("Your name").fill(name);
  await customer.getByLabel("Mobile number").fill(uniquePhone());
  await customer.getByRole("checkbox").click();
  await customer.getByRole("button", { name: "Continue to bill photo" }).click();
  await expect(customer).toHaveURL(/\/upload$/);
  await uploadBill(customer, "clear-home-bill.jpg");
  await confirmBill(customer);

  await signInAsSales(page);
  await page.route(/arcgisonline/, (route) => route.abort());
  await page.goto("/staff/leads");
  await page.getByRole("link", { name }).first().click();
  await expect(page.getByTestId("roof-outline")).toBeVisible();
});

test("the quote shows real bills and makes a family card in Marathi", async ({ page }) => {
  await page.goto("/mr/q/demo-quote-ld-31007");
  await expect(page.getByTestId("bill-before-after")).toContainText("₹");
  const save = page.getByTestId("family-card-save");
  await expect(save).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent("download"), save.click()]);
  expect(download.suggestedFilename()).toBe("solar-quote.png");
  const stream = await download.createReadStream();
  const head = await new Promise<Buffer>((resolve) => stream.once("data", (chunk) => resolve(chunk as Buffer)));
  expect(head.subarray(1, 4).toString()).toBe("PNG");

  const blank = await page.getByTestId("family-card").evaluate((canvas: HTMLCanvasElement) => {
    const { data } = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
    return data.every((value) => value === 255);
  });
  expect(blank).toBe(false);
  await expect(page.getByRole("link", { name: /WhatsApp/ })).toHaveAttribute("href", /wa\.me/);
});

test("a bill after solar is read, checked against the promise and shown to staff", async ({ page, browser }) => {
  await signInAsSales(page);
  await page.goto("/staff/projects");
  await expect(page.getByTestId("behind-count")).toHaveText("1");
  await expect(page.getByTestId("behind-project").first()).toContainText("Rajesh Katre");

  const customer = await (await browser.newContext()).newPage();
  await customer.goto("/en/s/demo-status-pr-1008");
  await expect(customer.getByTestId("savings-row")).toHaveCount(2);
  await customer.getByRole("link", { name: "Add a bill after solar" }).click();
  await customer.getByRole("button", { name: "Bill after solar, with a net meter" }).click();

  await expect(customer.getByLabel("Export units")).toHaveValue("306");
  await expect(customer.getByLabel("Bill month")).toHaveValue("Mar 2026");
  await customer.getByRole("button", { name: "Check against my quote" }).click();
  await expect(customer).toHaveURL(/\/s\/demo-status-pr-1008$/);
  await expect(customer.getByTestId("savings-row")).toHaveCount(3);
  await expect(customer.getByTestId("savings-row").filter({ hasText: "March 2026" })).toContainText("We said");
});

test("the forecast warns about slips from real stage history", async ({ page, browser }) => {
  await signInAsSales(page);
  await page.goto("/staff/projects");
  await expect(page.getByTestId("slipping-project").first()).toContainText("usually takes");
  await page.getByRole("link", { name: "Vaishali Raut" }).first().click();
  await expect(page.getByTestId("project-forecast")).toContainText("finished projects");

  const customer = await (await browser.newContext()).newPage();
  await customer.goto("/en/s/demo-status-pr-1006");
  await expect(customer.getByTestId("forecast")).toContainText("Based on 6 finished projects");
});

test("a future tariff cannot overlap the one in force, and the impact panel shows delivered savings", async ({ page }) => {
  await signInAsAdmin(page);
  await page.goto("/staff/admin");
  await expect(page.getByTestId("tariff-rule").first()).toContainText("wheeling");
  await page.getByRole("button", { name: "Add tariff" }).click();
  await page.getByLabel("Tariff name").fill("Overlap test");
  await page.getByLabel("Slab 1 energy rate").fill("5");
  await page.getByLabel("Slab 1 FAC").fill("0");
  await page.getByLabel("Fixed, 1-phase, ₹").fill("100");
  await page.getByLabel("Fixed, 3-phase, ₹").fill("300");
  await page.getByLabel("Wheeling, ₹ per unit").fill("1");
  await page.getByLabel("Effective from").last().fill("2026-06-01");
  await page.getByRole("button", { name: "Save tariff" }).click();
  await expect(page.getByText(/These dates overlap/)).toBeVisible();

  await page.goto("/staff/leads");
  await expect(page.getByText("Savings delivered against the quote")).toBeVisible();
  await expect(page.getByText(/From \d+ bills after solar/)).toBeVisible();
});
