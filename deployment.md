# Deployment

**Live app:** https://sunpath-virid.vercel.app
**Repository:** https://github.com/Divyam1909/sunpath

## Run it locally

You need Node 22 or later, pnpm 10 and Docker.

1. Clone and install. This also generates the Prisma client.

   ```bash
   git clone https://github.com/Divyam1909/sunpath.git
   cd sunpath
   pnpm i
   ```

2. Start Postgres on port 5433.

   ```bash
   docker compose up -d
   ```

3. Create `.env` from the example, and fill in these values.

   ```bash
   cp .env.example .env
   ```

   ```bash
   DATABASE_URL=postgresql://sunpath:sunpath@localhost:5433/sunpath
   DIRECT_URL=postgresql://sunpath:sunpath@localhost:5433/sunpath
   AUTH_SECRET=<run: openssl rand -base64 32>
   AUTH_TRUST_HOST=true
   FILE_SIGNING_SECRET=<run: openssl rand -base64 32>
   ```

   Leave `GEMINI_API_KEY` empty to use the mock reader, which recognises the sample bills. To read real bills, add a free key from https://aistudio.google.com/apikey. Leave `BLOB_READ_WRITE_TOKEN` empty, and files are stored in `.data/`.

4. Apply migrations and seed the data.

   ```bash
   pnpm prisma migrate deploy
   pnpm db:seed
   ```

5. Start the app at http://localhost:3000.

   ```bash
   pnpm dev
   ```

## Check it

```bash
pnpm lint
pnpm typecheck
pnpm test

# End-to-end tests: use a separate database, then build first
docker exec sunpath-db psql -U sunpath -c "create database sunpath_test"
export DATABASE_URL=postgresql://sunpath:sunpath@localhost:5433/sunpath_test
export DIRECT_URL=$DATABASE_URL
pnpm prisma migrate deploy && pnpm db:seed && pnpm build
pnpm exec playwright install chromium
pnpm test:e2e --project=desktop --project=mobile --project=security --project=features
```

`pnpm eval:bills` measures the reader on the real and lookalike bills in `eval/` and rewrites `docs/BILL_ACCURACY.md`. It makes 21 requests, more than the main model's free daily limit, so run it with `GEMINI_MODEL=gemini-3.5-flash-lite` to keep the main model's quota for the demo.

## How it is deployed

| Part | Service | Plan |
|---|---|---|
| App | Vercel, region `iad1` | Hobby |
| Database | Neon Postgres, `us-east-1`, added through the Vercel integration | Free |
| Files | Vercel Blob, private store | Free |
| Bill reading | Gemini API | Free |

Pushing to `main` deploys automatically. The build command in `vercel.json` runs `prisma migrate deploy`, then `next build`. No step needs a card.

To set up a new copy on Vercel:

1. Import the repository in Vercel.
2. Add Neon under Storage. This sets `DATABASE_URL` and `DATABASE_URL_UNPOOLED`.
3. Create a private Blob store and connect it. This sets `BLOB_READ_WRITE_TOKEN`.
4. Add `AUTH_SECRET`, `FILE_SIGNING_SECRET` and `GEMINI_API_KEY`.
5. Deploy.
6. Seed the database from your machine, using a local copy of the production variables.

   ```bash
   vercel env pull .env.vercel
   SEED_ENV_FILE=.env.vercel SEED_APP_URL=https://your-app.vercel.app pnpm exec tsx prisma/seed/index.ts
   ```

Re-seeding replaces the demo records only, and leaves anything real untouched.

## Environment variables

| Name | Needed | Purpose |
|---|---|---|
| `DATABASE_URL` | Always | Postgres connection, pooled on Neon |
| `DIRECT_URL` | Local | Direct connection for migrations |
| `DATABASE_URL_UNPOOLED` | Vercel | Direct connection for migrations, set by Neon |
| `AUTH_SECRET` | Always | Signs sessions |
| `AUTH_TRUST_HOST` | Outside Vercel | Lets Auth.js trust the host |
| `FILE_SIGNING_SECRET` | Local | Signs disk-adapter file links |
| `BLOB_READ_WRITE_TOKEN` | Production | Private Blob store. Unset means disk storage |
| `GEMINI_API_KEY` | For real reading | Unset means mock reader and manual entry |
| `GEMINI_MODEL` | Optional | Default `gemini-3.5-flash` |
| `GEMINI_FALLBACK_MODEL` | Optional | Used when the main model is over its limit. Default `gemini-3.5-flash-lite` |
| `BILL_READER` | Optional | `auto` (default), `gemini` or `mock` |
| `APP_URL` | Outside Vercel | Base URL for links in messages |
| `SEED_ENV_FILE` | Remote seeding | Env file to seed from |
| `SEED_APP_URL` | Remote seeding | Base URL in seeded message links |

## Demo logins

These are fictional, and work on the live app and after a local seed.

| Role | Login | Password | Sees |
|---|---|---|---|
| Sales | `sales@sunpath.demo` | `sales-demo-1` | Leads, quotes, projects, messages |
| Admin (sales lead) | `admin@sunpath.demo` | `admin-demo-1` | All of the above, plus rule tables and data erasure |
| Homeowner | `9000030881` | `home-demo-1` | Only Prashant Wankhede's lead |
