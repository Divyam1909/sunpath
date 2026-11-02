import path from "node:path";
import { expect, type Page } from "@playwright/test";

export const SAMPLES = path.resolve("public/samples");

export async function signIn(page: Page, login: string, password: string) {
  await page.goto("/en/login");
  await page.getByLabel("Mobile number or email").fill(login);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/login/);
}

export const signInAsSales = (page: Page) => signIn(page, "sales@sunpath.demo", "sales-demo-1");
export const signInAsAdmin = (page: Page) => signIn(page, "admin@sunpath.demo", "admin-demo-1");
export const signInAsHomeowner = (page: Page) => signIn(page, "9000030881", "home-demo-1");

export const uniquePhone = () => `9${String(Date.now()).slice(-9)}`;

/** Walks the three form steps from a clean browser. Leaves the page on the bill upload step. */
export async function fillLeadForm(page: Page, { name, phone, bill = "3200" }: { name: string; phone: string; bill?: string }) {
  await page.goto("/en");
  await page.getByText("Yes, I own it").click();
  await page.getByText("Concrete (flat)").click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel(/Roof area/).fill("600");
  await page.getByLabel(/monthly bill/).fill(bill);
  await page.getByLabel("Pincode").fill("440022");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Mobile number").fill(phone);
  await page.getByRole("checkbox").click();
  await page.getByRole("button", { name: "Continue to bill photo" }).click();
  await expect(page).toHaveURL(/\/upload$/);
}

export async function uploadBill(page: Page, file: string) {
  await page.getByTestId("bill-file").setInputFiles(path.join(SAMPLES, file));
  await page.getByRole("button", { name: /Read my bill|Use this photo anyway/ }).click();
}
