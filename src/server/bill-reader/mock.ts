import type { BillFile, BillReader } from "./index";
import { BillReaderUnavailable } from "./index";
import fixtures from "./sample-fixtures.json";

/**
 * Deterministic reader for tests, CI and a missing API key. It recognises the sample bills by hash.
 * It refuses anything else rather than inventing values for a real bill.
 */
export class MockBillReader implements BillReader {
  name = "mock";
  model = null;

  async read(file: BillFile) {
    const fixture = (fixtures as Record<string, { response: unknown }>)[file.sha256];
    if (!fixture) throw new BillReaderUnavailable("Mock reader only knows the sample bills");
    return JSON.stringify(fixture.response);
  }
}
