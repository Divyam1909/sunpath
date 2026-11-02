import { expect, test } from "@playwright/test";
import { signInAsHomeowner, signInAsSales } from "./helpers";

test("staff pages redirect signed-out visitors to sign in", async ({ page }) => {
  for (const path of ["/staff/leads", "/staff/projects", "/staff/messages", "/staff/admin"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/en\/login\?next=/);
  }
});

test("homeowners cannot open staff pages and only see their own lead", async ({ page }) => {
  await signInAsHomeowner(page);
  await expect(page).toHaveURL(/\/en\/my$/);
  await expect(page.getByText("Enquiry LD-30881")).toBeVisible();
  await expect(page.getByText(/LD-30902|LD-30915/)).toHaveCount(0);
  await page.goto("/staff/leads");
  await expect(page).toHaveURL(/\/en\/my$/);
});

test("sales cannot open the admin rule tables", async ({ page }) => {
  await signInAsSales(page);
  await page.goto("/staff/admin");
  await expect(page).toHaveURL(/\/staff\/leads$/);
});

test("lists mask consumer numbers to the last 4 digits", async ({ page }) => {
  await signInAsSales(page);
  await page.goto("/staff/leads");
  await expect(page.getByTestId("lead-row").first()).toBeVisible();
  const text = await page.locator("table").innerText();
  expect(text).not.toContain("410019900881");
  expect(text).toContain("•••• 0881");
});

test("public quote and status pages expose no address, phone or consumer number", async ({ page }) => {
  await page.goto("/en/q/demo-quote-ld-31007");
  let html = await page.content();
  expect(html).not.toMatch(/9000031007|Sample Road|41000031007|Fulzele/);

  await page.goto("/en/s/demo-status-pr-1003");
  html = await page.content();
  expect(html).not.toMatch(/9000031016|Sample Road|41000031016|Gawande/);
  await expect(page.getByText("Hello Anil")).toBeVisible();
});

test("unknown tokens show nothing, and upload routes refuse bad input", async ({ page, request }) => {
  // These pages stream a skeleton first, so the 404 arrives as the not-found page with noindex.
  for (const path of ["/en/q/not-a-real-token", "/en/s/not-a-real-token", "/en/l/not-a-real-token/result"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "This page isn't here" })).toBeVisible();
  }
  expect((await request.post("/api/leads/not-a-real-token/bill")).status()).toBe(404);
  expect((await request.get("/api/quotes/not-a-real-token/pdf")).status()).toBe(404);

  const fake = { file: { name: "bill.jpg", mimeType: "image/jpeg", buffer: Buffer.from("<script>not an image</script>") } };
  const upload = await request.post("/api/leads/demo-lead-ld-30902/bill", { multipart: fake });
  expect(upload.status()).toBe(415);

  const staffUpload = await request.post("/api/staff/projects/anything/documents", { multipart: fake });
  expect(staffUpload.status()).toBe(401);
});

test("the disk file route rejects unsigned links", async ({ request }) => {
  const response = await request.get("/api/files?key=bills/x/y.jpg&expires=9999999999999&sig=bad");
  expect(response.status()).toBe(403);
});
