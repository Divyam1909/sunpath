import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readBill } from "@/server/bill-reader";
import { allowRequest } from "@/server/rate-limit";
import { uploadBill } from "./leads";

const created = vi.hoisted(() => vi.fn(async ({ data }: { data: unknown }) => data));

vi.mock("@/server/db", () => ({ db: { billReading: { create: created } } }));
vi.mock("@/server/storage", () => ({ fileStore: { put: vi.fn() } }));
vi.mock("@/server/settings", () => ({ getSettings: async () => ({ score: { lowConfidenceBelow: 0.75 } }) }));
vi.mock("@/server/outbox", () => ({ queueMessage: vi.fn() }));
vi.mock("@/server/rate-limit", () => ({ allowRequest: vi.fn(), clientIp: async () => "203.0.113.9" }));
vi.mock("@/server/bill-reader", async (original) => ({
  ...(await original<typeof import("@/server/bill-reader")>()),
  readBill: vi.fn(async () => ({ status: "unavailable", detail: "stub" })),
}));

const sample = readFileSync(path.resolve("public/samples/clear-home-bill.jpg"));
const realBill = Buffer.from("a bill that is not one of the samples");

describe("uploadBill daily limit", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does not count a sample against the limit", async () => {
    await uploadBill("lead", sample, "image/jpeg");
    expect(allowRequest).not.toHaveBeenCalled();
    expect(vi.mocked(readBill).mock.calls[0][0].sha256).toBe(createHash("sha256").update(sample).digest("hex"));
  });

  it("gives a real bill five reads a day per address", async () => {
    vi.mocked(allowRequest).mockResolvedValue(true);
    await uploadBill("lead", realBill, "image/jpeg");
    expect(allowRequest).toHaveBeenCalledWith("read:ip:203.0.113.9", 5, 86_400);
    expect(readBill).toHaveBeenCalledOnce();
  });

  it("sends a real bill to manual entry without calling the reader once over the limit", async () => {
    vi.mocked(allowRequest).mockResolvedValue(false);
    const reading = await uploadBill("lead", realBill, "image/jpeg");
    expect(readBill).not.toHaveBeenCalled();
    expect(reading).toMatchObject({ status: "UNAVAILABLE" });
  });
});
