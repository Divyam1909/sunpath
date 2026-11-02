// archiver 8 ships no types, and @types/archiver still describes the older API.
declare module "archiver" {
  import type { Writable } from "node:stream";

  export class ZipArchive {
    constructor(options: { zlib: { level: number } });
    on(event: "error", listener: (error: Error) => void): this;
    pipe(destination: Writable): void;
    file(path: string, data: { name: string }): void;
    finalize(): Promise<void>;
  }
}
