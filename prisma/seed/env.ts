import { config } from "dotenv";

// Imported first in seed.ts, so env is set before the storage adapter is chosen.
config({ path: process.env.SEED_ENV_FILE ? [process.env.SEED_ENV_FILE] : [".env.local", ".env"], override: Boolean(process.env.SEED_ENV_FILE), quiet: true });
