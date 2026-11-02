import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { readBill, readerChain, type BillFile, type BillReader } from "./index";
import { MockBillReader } from "./mock";

const sample = (name: string): BillFile => {
  const bytes = readFileSync(path.resolve("public/samples", name));
  return { bytes, mimeType: "image/jpeg", sha256: createHash("sha256").update(bytes).digest("hex") };
};
const fake = (read: () => Promise<string>, name = "fake"): BillReader => ({ name, model: null, read });
const mock = [new MockBillReader()];

describe("readBill with the mock reader", () => {
  it("reads the clear sample with every key field", async () => {
    const outcome = await readBill(sample("clear-home-bill.jpg"), 0.75, mock);
    if (outcome.status !== "read") throw new Error(outcome.status);
    expect(outcome.result.extraction.unitsLatestMonth.value).toBe(340);
    expect(outcome.result.extraction.sanctionedLoadKw.value).toBe(5);
    expect(outcome.reader).toBe("mock");
  });

  it("flags low-confidence fields on the tilted photo", async () => {
    const outcome = await readBill(sample("tilted-phone-photo.jpg"), 0.75, mock);
    if (outcome.status !== "read") throw new Error(outcome.status);
    expect(outcome.result.lowConfidence).toEqual(expect.arrayContaining(["sanctionedLoadKw", "tariffCategory"]));
  });

  it("asks for a re-upload on the blurry photo and the receipt", async () => {
    expect(await readBill(sample("blurry-photo.jpg"), 0.75, mock)).toMatchObject({ status: "poor", reason: "blurry" });
    expect(await readBill(sample("not-a-bill.jpg"), 0.75, mock)).toMatchObject({ status: "poor", reason: "notBill" });
  });

  it("refuses to invent values for a file it does not know", async () => {
    const unknown = { bytes: Buffer.from("x"), mimeType: "image/jpeg", sha256: "nope" };
    expect(await readBill(unknown, 0.75, mock)).toMatchObject({ status: "unavailable" });
  });
});

describe("reader order", () => {
  it("tries the saved sample readings before spending a model request", () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("BILL_READER", "auto");
    expect(readerChain().map((reader) => reader.name)).toEqual(["mock", "gemini", "gemini"]);
    vi.unstubAllEnvs();
  });

  it("does not call the model for a sample, and does for anything else", async () => {
    const read = vi.fn(async () => "not json");
    const chain = [...mock, fake(read)];
    await readBill(sample("clear-home-bill.jpg"), 0.75, chain);
    expect(read).not.toHaveBeenCalled();
    await readBill({ bytes: Buffer.from("x"), mimeType: "image/jpeg", sha256: "nope" }, 0.75, chain);
    expect(read).toHaveBeenCalledOnce();
  });
});

describe("readBill failure handling", () => {
  const file = sample("clear-home-bill.jpg");

  it("reports unavailable instead of throwing when the reader is down", async () => {
    const down = fake(() => Promise.reject(new Error("503 from provider")));
    expect(await readBill(file, 0.75, [down])).toEqual({ status: "unavailable", detail: "503 from provider" });
  });

  it("treats malformed model output as a failed read", async () => {
    expect(await readBill(file, 0.75, [fake(async () => "not json")])).toMatchObject({ status: "unavailable" });
  });

  it("falls through to the next reader for a known sample", async () => {
    const down = fake(() => Promise.reject(new Error("quota")));
    expect(await readBill(file, 0.75, [down, ...mock])).toMatchObject({ status: "read", reader: "mock" });
  });
});
