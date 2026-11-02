import { expect, test } from "@playwright/test";
import { fillLeadForm, uniquePhone, uploadBill } from "./helpers";

test("homeowner submits a lead on a 390px phone, confirms the bill and sees the result", async ({ page }) => {
  await fillLeadForm(page, { name: "Mobile Tester", phone: uniquePhone() });
  await uploadBill(page, "clear-home-bill.jpg");

  await expect(page).toHaveURL(/\/check$/);
  await expect(page.getByRole("heading", { name: "Check what we read" })).toBeVisible();
  await expect(page.getByLabel(/Units this month/)).toHaveValue("340");
  await expect(page.getByLabel(/Consumer number/)).toHaveValue("410019900881");
  await expect(page.getByRole("img", { name: "Your bill" })).toBeVisible();

  await page.getByRole("button", { name: /Confirm/ }).click();
  await expect(page).toHaveURL(/\/result$/);
  await expect(page.getByTestId("result-title")).toHaveText("You're a great fit for a 3 kW system");
  await expect(page.getByText("About ₹1,17,000 after subsidy")).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("a poor photo asks for a re-upload, and a low score gets a call, never a rejection", async ({ page }) => {
  await fillLeadForm(page, { name: "Small Bill", phone: uniquePhone(), bill: "650" });
  await uploadBill(page, "blurry-photo.jpg");

  await expect(page.getByRole("heading", { name: "That photo is too blurry to read" })).toBeVisible();
  await page.getByRole("link", { name: "Upload a different photo" }).click();

  await uploadBill(page, "small-home-bill.jpg");
  await expect(page).toHaveURL(/\/check$/);
  await page.getByRole("button", { name: /Confirm/ }).click();

  await expect(page.getByTestId("result-title")).toHaveText("We'll give you a quick call");
  await expect(page.getByText("We'll call you within one working day")).toBeVisible();
});

test("low-confidence fields are highlighted and left blank, not guessed", async ({ page }) => {
  await fillLeadForm(page, { name: "Stained Bill", phone: uniquePhone(), bill: "2350" });
  await uploadBill(page, "tilted-phone-photo.jpg");

  const load = page.getByLabel(/Sanctioned load/);
  await expect(load).toHaveAttribute("data-low-confidence", "true");
  await expect(load).toHaveValue("");
  await load.fill("3");
  await page.getByRole("button", { name: /Confirm/ }).click();
  await expect(page.getByTestId("result-title")).toContainText("2 kW");
});

test("the language switch translates the form", async ({ page }) => {
  await page.goto("/en");
  await page.getByRole("link", { name: "मराठी" }).click();
  await expect(page).toHaveURL(/\/mr$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("तुमच्या छतावर सोलर परवडेल का?");
  await page.getByRole("link", { name: "हिंदी" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("क्या आपकी छत पर सोलर फ़ायदेमंद रहेगा?");
});
