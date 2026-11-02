# Sunpath: Technical Design Document

**GitHub:** https://github.com/Divyam1909/sunpath
**Live app:** https://sunpath-virid.vercel.app

Sunpath takes a rooftop solar lead in Vidarbha from enquiry to subsidy credited. It was built for Company A's brief: stop spending survey visits on people who will never buy, and get a quote out the same day as the survey.

## 1. Problem and success metrics

Company A (Nagpur, 75 staff, about 120 installations a month) runs on WhatsApp and Excel. Sales calls every lead, asks for a bill photo, sends a surveyor, and builds the quote in a spreadsheet over three days. Subsidy and net-metering sit in another sheet.

On the client's own assumptions, of 1,400 leads a month, 350 are genuine.

| Cost | Client's figure | What it implies |
|---|---|---|
| 40% of 220 monthly surveys go to people who were never going to buy | ₹26.4 lakh a year | 88 wasted surveys a month at about ₹2,500 each |
| 4% of genuine leads (14 a month) go to faster rivals | ₹60.48 lakh a year | About ₹36,000 lost per sale |
| **Total** | **₹86.88 lakh a year** | |

The larger cost is the slow quote, not the wasted survey, so same-day quoting matters at least as much as scoring.

| Success metric | From | Target | How the app measures it |
|---|---|---|---|
| Unqualified surveys | 40% | Under 15% | The surveyor marks each visit qualified or not |
| Same-day quotes | 3 days | 90% of surveys | First quote sent on the survey's Indian calendar day |
| Status calls | Baseline unknown | Down 50% | Status page views, as a stand-in |

These three appear on the sales dashboard from live records. **The figures on the demo come from seed data, so they show the panel working, not a result.** Real baselines would come from a pilot.

## 2. Architecture

```mermaid
flowchart LR
  H[Homeowner on a phone] --> V
  S[Sales and admin] --> V
  subgraph V[Next.js on Vercel]
    P[Proxy: role gate and locale]
    UI[Server-rendered pages]
    A[Server actions and route handlers]
    D[src/domain: pure rules and maths]
    UI --> D
    A --> D
  end
  A --> N[(Neon Postgres)]
  A --> B[(Private Vercel Blob)]
  A --> G[Gemini vision API]
  A --> O[MessageOutbox: mock WhatsApp]
```

**Why this shape.** A ₹6 lakh, six-week build for a 75-person company needs one deployable and no servers to run, so it is a single Next.js app on free tiers.

- **Pure domain layer.** All maths lives in `src/domain` as functions with no I/O. This is the most important decision in the codebase. It makes the subsidy and payback rules testable and explainable, and the quote builder runs the same code in the browser for live numbers. The server then recomputes everything, so browser figures are never trusted.
- **Rule tables, not code.** Subsidy, prices and thresholds live in the database because the brief says they change.
- **Interfaces at the edges.** `BillReader` and `FileStore` each have a real and a fake implementation, so tests, CI and local work need no accounts.
- **Outbox for messages.** Every message is a row. Moving to the real WhatsApp Business API means adding a sender that drains the table, with no change to business logic.

Cache Components are switched off. Nearly every page shows live data, so the plain dynamic model is simpler. Next.js `proxy.ts` handles the first role check, and every action repeats it.

## 3. Data model

```mermaid
erDiagram
  User ||--o{ Lead : "owns (homeowner)"
  User ||--o{ Quote : "creates (staff)"
  User ||--o{ ProjectEvent : "acts on"
  Lead ||--o{ BillReading : "has"
  Lead ||--o{ Quote : "gets"
  Lead ||--o| Project : "becomes"
  Lead ||--o{ MessageOutbox : "receives"
  Quote ||--o| Project : "accepted as"
  Project ||--o{ ProjectEvent : "logs"
  Project ||--o{ ProjectDocument : "holds"
  Project ||--o{ MessageOutbox : "triggers"
  Lead {
    string code
    string accessToken
    enum ownership
    float roofAreaSqm
    int monthlyBill
    datetime consentAt
    enum score
    enum nextAction
    float recommendedKw
    bool surveyQualified
  }
  BillReading {
    enum status
    string reader
    json ai
    json confirmed
    string_array editedFields
  }
  Quote {
    string token
    date quoteDate
    json inputs
    json options
    json snapshot
  }
  Project {
    string token
    enum stage
    datetime stageEnteredAt
    int statusViews
  }
  SubsidyRule {
    json slabs
    int capAmount
    date effectiveFrom
    date effectiveTo
    bool verifyBeforeLaunch
  }
  PriceRule {
    json bands
    date effectiveFrom
    date effectiveTo
  }
  TariffRule {
    json slabs
    float fixedSinglePhase
    float wheelingPerUnit
    float dutyPercent
    date effectiveFrom
    date effectiveTo
  }
  SavingsCheck {
    string month
    int billAmount
    int promisedSaving
    int actualSaving
    string verdict
  }
  Setting {
    string key
    json value
  }
```

Decisions worth defending:

- **`BillReading` keeps `ai` and `confirmed` side by side**, plus `editedFields`. This is the audit trail for measuring AI accuracy later.
- **`Quote.snapshot` copies the rules used.** There is no foreign key to a rule on purpose: a later edit cannot reach an old quote. An E2E test proves it.
- **Money is whole rupees, dates in rule tables are date-only**, and "same day" means the Indian calendar day.
- **A quote freezes its year of bills too.** `Quote.snapshot.billView` holds the tariff and the month-by-month projection for each option, so the promise tracker compares a later bill with what was actually promised, even after tariffs change.
- **`RateLimit` is a table**, because in-memory counters do not survive across serverless instances.

## 4. Main flows

### Lead to bill read to score

```mermaid
sequenceDiagram
  actor H as Homeowner
  participant App as Next.js
  participant Store as Private Blob
  participant AI as Gemini
  participant Dom as Domain rules
  H->>App: Stepped form with consent
  App->>Dom: Provisional score from typed bill
  App-->>H: Lead saved, ask for bill photo
  H->>App: Upload bill (compressed in browser)
  App->>App: Check size and real file type
  App->>Store: Save file privately
  App->>AI: Image and strict JSON schema
  alt Clear read
    AI-->>App: Values with confidence
    App-->>H: Bill beside values, doubtful ones highlighted
  else Poor photo or not a bill
    AI-->>App: Quality flag
    App-->>H: Specific re-upload tips
  else AI down or bad output
    App-->>H: Manual entry, lead is kept
  end
  H->>App: Confirm or correct values
  App->>Dom: Score and size from confirmed values
  App-->>H: Result and next step
```

### Quote to advance to project

```mermaid
sequenceDiagram
  actor S as Sales
  actor H as Homeowner
  participant App as Next.js
  participant Dom as Domain rules
  participant DB as Postgres
  S->>App: Record survey (roof, shading, qualified?)
  S->>App: Edit options, numbers update live
  S->>App: Send quote
  App->>Dom: Recompute with rules active today
  App->>DB: Save quote and rule snapshot
  App->>DB: Outbox row in customer's language
  H->>App: Open tokenised quote link
  H->>App: Pay advance (mock)
  App->>DB: Create project, event and message
  S->>App: Move stage (blocked if documents missing)
  App->>DB: Update stage, event and outbox
  H->>App: Open status link, see new stage
```

## 5. How the AI works and how it fails safely

The AI does one job: it reads a bill. It never sets a price, a subsidy, generation or a score.

**Reading.** `GeminiBillReader` sends the image with a strict response schema. The model returns a value and a confidence per field, plus `isElectricityBill` and an image-quality flag. The prompt forbids estimating, tells the model to return null for anything it cannot see, and treats text in the image as data, which guards against prompt injection from an uploaded image. Zod then validates the reply again in `parseBillResponse`.

**Measured on real bills.** `pnpm eval:bills` runs the reader over documents with known answers and writes [BILL_ACCURACY.md](BILL_ACCURACY.md). On 7 images of 5 real MSEDCL bills, including a Marathi bill, net-meter bills and a stamped, hand-marked scan, the light model read **79 of 83 fields (95%)** and 84 of 85 months of history. Fields hidden by masks must come back blank: it invented one value out of 83, taking a DTC code for a blacked-out consumer number. On 14 lookalike images it read 196 of 196. The main model read the real Marathi bill 13 of 13 before its daily limit ran out, so it has not been measured across the full set. This is a small test: it proves the reader copes with real layouts, not its accuracy on thousands of phone photos. The stored AI-versus-confirmed values answer that in a pilot.

**Finding the bills.** MSEDCL publishes real bills as format guides, and a college published one for accreditation. No homeowner's forum post was used. MSEDCL's masks cover the page image only: the real customer's name and address are still in those PDFs' text layer. So the test set is flattened pixels, redacted further by hand, and the PDFs are never committed or sent to the model.

**What real bills broke.** Fake data had hidden two bugs. A bill's total includes old dues, which inflated one sample's rate to ₹20 a unit and its payback to 1.4 years (A42). The real Marathi bill has a 0.5 kW sanctioned load, too small for any system, and the result page said "a 0 kW system looks right". It now goes to a call and gives the reason.

**Prompt lessons from real bills.** Real bills print three totals (prompt-payment, due, late), carry arrears inside the headline amount, and print meter readings beside the units. The first run confused these, so the prompt now names each, and the arrears are taken out before any rate is worked out (A42). That raised the real-bill score from 93% to 95%.

**Poor photos.** People photograph bills on a table, in dim rooms, one side only. Three things handle this. The browser checks the photo for blur, darkness and size before it is sent, and only advises, because Gemini still reads surprisingly soft photos. A second photo of the back can be added, and the two are joined into one image, as arrears and charges are usually on the back. The model is told to expect tilt, folds and stamps, and simulated tilted, dim and soft shots score the same as clean ones in the lookalike set.


| Failure | What the app does |
|---|---|
| Unsure of a value | The value is highlighted beside the zoomable bill for a person to confirm |
| Value not found | Left blank, never guessed |
| Blurry, cropped, dark or not a bill | A specific message with photo tips and a re-upload |
| Model returns bad JSON or wrong shape | Treated as a failed read, then manual entry |
| Over the daily limit on the main model | The reader moves to the lighter model (A30) |
| API down, or no key | The lead is kept, with a clear message and manual entry |
| Model wrong but confident | A person sees every value before it is used, and corrections are stored |
| Low score | A short call replaces the visit. Only a person can close a lead |

The deterministic `MockBillReader` runs first and answers the sample bills from a saved reading, and the record says `mock`. It recognises samples by SHA-256 and refuses anything else, so it can never invent values for a real bill. Trying the demo therefore spends no model quota, and a Gemini outage cannot break it. Each address gets 5 real reads a day, and past that a bill goes to manual entry with the file kept. Model confidence is uncalibrated, so the 75% threshold (A13) is a starting point.

## 6. Subsidy and payback maths

The subsidy comes from an admin table, and generation from a fixed formula. Neither comes from AI.

**Rule selection.** The engine picks the rule active on the quote date, with both end dates inclusive. Rules for the same segment cannot overlap, which is checked on save and tested. Commercial tariffs get no subsidy, because the stated scheme is residential (A20).

**Scoring.** Points out of 100 (A09): owner 25; bill of ₹2,000 or more 30, or ₹1,000 to ₹1,999 10; roof fits the need 20, or part of it 10; inside Vidarbha 15; clear bill read 10. High is 90 or more, Medium 50 or more. Tenants and bills under ₹1,000 are held at Low whatever the total.

### Worked example: LD-30881, Prashant Wankhede

Owner, ₹3,200 bill, 340 units a month, 600 sq ft roof, 5 kW sanctioned load.

| Step | Calculation | Result |
|---|---|---|
| Yearly use | 340 × 12 | 4,080 units |
| Size needed | 4,080 ÷ 1,400 = 2.91, rounded to nearest 0.5 kW | 3 kW |
| Roof cap | 55.7 m² ÷ 10 m² per kW | 5.5 kW, no limit |
| Load cap | Sanctioned load | 5 kW, no limit |
| Score | 25 + 30 + 20 + 15 + 10 | 100, High, book survey |
| Gross cost (assumed price, A05) | 3 kW × ₹65,000 | ₹1,95,000 |
| Subsidy | 2 × ₹30,000 + 1 × ₹18,000 | ₹78,000 |
| Net cost | ₹1,95,000 − ₹78,000 | ₹1,17,000 |
| Yearly generation | 3 × 1,400 | 4,200 units |
| Tariff | ₹3,200 ÷ 340 (no single rate printed) | ₹9.41 per unit |
| Units offset | Lower of 4,200 and 4,080 | 4,080 units |
| Surplus | 4,200 − 4,080, credited at ₹3 | 120 units |
| Yearly savings | 4,080 × ₹9.41 + 120 × ₹3 | ₹38,753 |
| Payback | ₹1,17,000 ÷ ₹38,753 | 3.0 years |
| 25-year savings | ₹38,753 × 25 − ₹1,17,000 | ₹8,51,825 |

Options one step either side:

| | 2 kW | 3 kW | 4 kW |
|---|---|---|---|
| Net cost | ₹80,000 | ₹1,17,000 | ₹1,62,000 |
| Yearly savings | ₹26,348 | ₹38,753 | ₹42,953 |
| Payback | 3.0 years | 3.0 years | 3.8 years |

The 4 kW row shows why the surplus rate matters. Valuing every unit at full tariff would make oversizing look better than it is. Here the extra 1,400 units earn only ₹3 each.

**Subsidy at each size:** 1 kW ₹30,000; 2 kW ₹60,000; 2.5 kW ₹69,000; 3, 5 and 10 kW ₹78,000. Fractional kW are paid pro rata inside each slab.

**A note on the cap.** With today's slabs, the ₹78,000 cap can never bite: the slabs themselves stop at 3 kW and total exactly ₹78,000. The engine still applies it, so a later rule whose slabs exceed its cap will work.

The other two sample rows also come out as specified: LD-30902 (tenant) gets Low and no size, and LD-30915 (₹650, 85 units) gets 1 kW and Low. `score.test.ts` asserts all three.

### Real bills, not one rate

The quote keeps the brief's one-rate formula so its sample rows still reproduce (A38). Beside it, the app shows the homeowner's real bills, because one rate hides what matters. Solar removes the dearest slabs first, and the fixed charge never goes.

**The tariff engine is proven on real bills.** `calculateBill` uses the dated `TariffRule` table, taken from MERC Case 75 of 2025, and reproduces two published MSEDCL bills line by line, to the paisa:

| Bill | Units | Fixed | Energy | Wheeling | FAC | Other | Duty | Total |
|---|---|---|---|---|---|---|---|---|
| October 2026 | 146 | 130.00 | 892.80 | 233.60 | 48.00 | -34.00 | 203.26 | **1,473.66** |
| September 2022 (1.03 months) | 202 | 105.00 | 1,072.74 | 272.70 | 210.50 | 0.00 | 265.75 | **1,926.69** |

The 2022 bill shows a detail no guide mentions: slabs widen with the billing period, so 1.03 months puts the first slab at 103 units. The October bill also shows a daytime rebate of ₹0.85 a unit, which the projection leaves out as it depends on a smart meter (A40).

**Seasons.** Bills print a year of history, in a table or a bar chart, and the reader now returns it with month labels. Sizing uses the year. One peak bill would mislead: a May bill of 610 units, on a home averaging 365, would size the system on a month. Both the homeowner and sales are told when this happens, and sales sees the size each basis gives. Months the bill omits are filled from a seasonal pattern and drawn lighter (A36).

**Month by month.** `projectBills` walks April to March: generation from Nagpur's PVGIS monthly shape, netted against use, with spare units banked through the monsoon and the balance paid on 31 March (A35, A37). For a 340-unit home with 3 kW the average bill falls from ₹4,619 to ₹288, and the yearly saving is ₹53,021 against ₹38,753 on the quote's one-rate formula.

**An honest result that disproved an idea.** I expected this to tell small users solar is not worth it. It does not: with the subsidy, an 85-unit home pays back in about 5 years, because a 1 kW system is cheap. The warning exists (A39) but rarely shows, and I would rather report that than force it.

### Catching problems early

**Blockers (A41).** When a bill is confirmed, `findBlockers` looks for what stops a subsidy or net meter weeks later: a connection in someone else's name, overdue arrears, a sanctioned load below the wanted size, a non-home tariff, a tenant, existing solar export, a faulty meter. Name matching allows for titles, word order, initials and one-letter spelling changes, and says nothing rather than guess at a Devanagari name. Each item says what to do. None changes the score.

**Promise tracker (A43).** After the net meter is in, a homeowner adds a bill to the status page. The same reader reads import, export and bank. The bill is compared with the promise for that same month, as a monsoon bill is meant to be higher. A bill far behind messages the customer and appears for staff before the customer has to complain. The impact panel gains a fourth number: savings delivered against the quote.

**Real completion dates (A44).** `forecastProject` learns how long each stage really took from finished projects, and gives a likely date, a late date and the slip against the promised date. A project can be flagged weeks before any stage limit is broken, with the reason, such as net metering usually taking 40 days, not 21.

**Roof map (A45).** Homeowners rarely know their roof area. They can tap its corners on a satellite photo. The browser only draws: the server measures the outline again and never trusts a sent area. The surveyor sees the same outline. An outline that crosses itself or is larger than a house is refused.

**Family card.** The decision is often made by relatives who never saw the sales chat. One image carries the size, the bill before and after, the cost and the payback. It is drawn on a canvas in the browser, as browsers shape Marathi correctly and server image libraries often do not. It carries a first name only.

## 7. UI and design decisions

The direction is calm and minimal: white space, one deep teal accent, neutral greys, and red kept for "stuck" and errors. Latin text is Geist, with Noto Sans Devanagari for Marathi and Hindi.

- **The form is the hero.** The landing page opens on the first question, because the job is to start the form.
- **The quote is a story.** System size, cost after subsidy and payback come first in very large type. The options, the table and "How we calculated this" follow, for anyone who wants them.
- **The sun's path.** The status page draws the project as a sun crossing the sky, from advance at sunrise to subsidy at sunset. It is the one memorable element and the only motion that plays on its own.
- **Honest emptiness.** Stained fields stay blank and highlighted, rather than showing a guess.
- **Staff screens are dense, homeowner screens are not.** Sales sees reasons, points and the next step in one row.

Every screen was captured at 390 px and 1280 px, then reviewed and corrected. That review found a select overflowing its column, misaligned settings fields, weak "why" text and raw ISO dates, all since fixed.

![Landing and first question](screenshots/01-landing-390.png){width=180}
![Bill check with doubtful fields highlighted](screenshots/03-bill-check-1280.png){width=470}

![Quote story in Marathi](screenshots/05b-quote-marathi-390.png){width=180}
![Project status with the sun's path](screenshots/06c-status-documents-390.png){width=180}

![Leads inbox and impact panel](screenshots/10-leads-1280.png){width=640}

![Quote builder](screenshots/12-quote-builder-1280.png){width=640}

![Stuck projects dashboard](screenshots/13-projects-1280.png){width=640}

![Admin rule tables with the verify note](screenshots/16-admin-1280.png){width=640}

![A peak month flagged, with a year of bills in Marathi](screenshots/05c-result-marathi-bill-390.png){width=180}
![Blockers found on a bill](screenshots/05d-result-blockers-390.png){width=180}
![Roof measured on satellite imagery](screenshots/08-roof-map-390.png){width=180}

## 8. Security and DPDP handling

**Access.** Auth.js with hashed passwords and three roles. The proxy gives a fast redirect, and every server action, route and page checks the role again on the server. Homeowners only ever read leads linked to their own account. Public links carry 192 random bits. Signing in a homeowner never links a lead by phone number alone, because the number is unverified.

**Input.** Zod validates every input, sharing one schema between form and server. Uploads are limited to 4 MB, and the type comes from the file's bytes, not its name. Lead, login, upload and payment routes are rate limited in Postgres, by the client address Vercel sets. A faked `X-Forwarded-For` was tried on production and did not get past the limit. The `next` login redirect accepts same-site paths only.

**Personal data under the DPDP Act 2023.**

| Principle | How it is handled |
|---|---|
| Consent | A plain-language purpose notice and an explicit tick. Timestamp, purpose and version are stored |
| Purpose limit | Only what the quote and project need is collected |
| Minimisation | Lists show the last 4 digits of consumer numbers. Quote and status pages show a first name only, and a test asserts no phone, address or consumer number appears in them |
| Storage | Bills and documents sit in a private store, reachable only through 5-minute signed URLs. An unsigned link returns 403 on the live site |
| Erasure | Admins can erase a customer's lead, files, quotes, project and messages on request |
| Secrets | Only `.env.example` is committed, and the repo has been scanned for keys |

**Retention (A21, for legal review).** Unconverted leads and bills: delete 24 months after last activity. Project records: keep 8 years for tax. Rejected bill photos: delete after 90 days. No automatic deletion job exists yet, so this is policy rather than code today.

**Known gaps, which I would raise before launch.**

- Consumer numbers are stored unencrypted at field level, with only provider encryption at rest.
- Bills go to a third-party AI on Google's free tier, and free-tier data may be used to improve Google's products. A paid tier with a data-processing agreement is needed before real customer bills are sent.
- The demo database sits in `us-east-1` (A22). Production should move to an Indian region.
- A bill's consumer number and any name on it reach Gemini, so the consent notice must name this processor at launch.
- A roof outline is the customer's exact home location, and map tiles and search reveal the area to Esri and OpenStreetMap. It is optional, named in the consent notice (v2), staff-only, and removed on erasure.
- MSEDCL's published sample PDFs leak a real customer's name under their masks. Sunpath keeps only flattened, redacted images. MSEDCL should be told.
- Seeded demo links use readable tokens (A29), and the demo logins are public.

## 9. Testing strategy

The riskiest logic gets the most tests.

| Layer | Tool | Count | Covers |
|---|---|---|---|
| Domain and reader | Vitest | 218 | Everything before, plus real-bill tariff reproduction, usage years, bill projection, blockers and name matching, the savings promise, forecasts, roof geometry, photo check and accuracy scoring |
| End to end | Playwright | 31 | Everything before, plus a Marathi bill to a year of bills, a peak May bill, blockers for homeowner and staff, the photo check and two-sided upload, roof map to surveyor, the family card, a bill after solar through to staff, forecasts, and tariff overlap |
| CI | GitHub Actions | On every push | Lint, typecheck, unit tests, migrations, seed, build and E2E against Postgres with the mock reader |

Bill reading is measured by `pnpm eval:bills`, outside CI, as it needs a key and uses daily quota. Real Gemini was also checked through production, not in CI, because CI must not depend on a live API or use a key. Marathi and Hindi PDFs were rendered and inspected by eye, since a test cannot judge glyph shaping.

## 10. All assumptions



<!-- ASSUMPTIONS -->

## 11. What was cut, and why

| Cut | Why |
|---|---|
| Real WhatsApp or SMS | The brief says to mock it. The outbox keeps the seam clean |
| Real payments | The brief says to mock it |
| Filing on the subsidy portal, inventory, inverter monitoring | Out of scope in the brief |
| Survey calendar and surveyor assignment | One date field proves the flow. Scheduling is its own product |
| Phone verification by OTP | Paid SMS. Instead, leads are never linked to accounts by phone alone |
| Automatic retention job | Needs a legal decision on periods first |
| Native-reviewed Marathi and Hindi | No budget in a zero-cost build, so the copy is machine-drafted (A19) |
| Audit log of admin rule edits | Snapshots already protect quotes. Worth adding before launch |

## 12. What I would do next

1. **Pilot on real phone photos** to measure read accuracy from the stored AI-vs-confirmed values, tune the confidence threshold, and replace the assumed seasonal pattern with confirmed history.
2. **Real WhatsApp Business API**, draining the existing outbox, with delivery status and customer replies.
3. **DISCOM integrations** for net-metering status where MSEDCL allows it.
4. **Accuracy dashboard**: edits per field, by bill layout.
5. **Offline survey mode**, as roofs often have poor signal.
6. **Move to Indian regions**, a paid AI tier with a data-processing agreement, and field-level encryption for consumer numbers.
7. **Tune the score** against real outcomes: which High leads bought, and which Low leads surprised us.
