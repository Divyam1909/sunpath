# Assumptions

Anything not stated in the client brief is listed here. Code comments and the TDD refer to these IDs. Values marked **editable** live in the admin Settings or rule tables, so changing them needs no deploy.

| ID | Assumption | Why | Where used |
|---|---|---|---|
| A01 | Sizes round to the nearest 0.5 kW, with a 1 kW minimum. **Editable.** | Reproduces the sample rows (2.91 → 3 kW; 0.73 → 1 kW) without oversizing, and 1 kW is the smallest common residential system. | `domain/sizing.ts` |
| A02 | Quote options sit 1 kW either side of the recommendation. **Editable.** | The brief says "one step either side". A 0.5 kW gap is too small to be a real choice for a homeowner. | `domain/quote.ts` |
| A03 | A system needs 10 m² of usable roof per kW. **Editable.** | Common industry rule of thumb for flat-mounted panels. The surveyor replaces it with a measured area. | `domain/sizing.ts` |
| A04 | System size cannot exceed sanctioned load. If load is unknown, no load cap applies. **Editable by removing the value.** | Net-metering applications are normally limited by sanctioned load. Load enhancement is a sales conversation, not an automatic step. | `domain/sizing.ts` |
| A05 | Prices: up to 2 kW ₹70,000/kW; up to 3 kW ₹65,000/kW; up to 5 kW ₹60,000/kW; up to 10 kW ₹55,000/kW; above ₹52,000/kW. The whole system is charged at its band's rate. **Editable.** | The brief gives no prices. These are placeholders to be replaced by Company A's real rate card before launch. | Seed, `domain/quote.ts` |
| A06 | Net metering: each generated unit offsets one consumed unit at the full tariff, up to yearly consumption. Surplus units earn ₹3 per unit. **Editable.** | The brief leaves crediting open. This stops an oversized system from looking better than it is. | `domain/quote.ts` |
| A07 | Tariff comes from the rate printed on the bill, else bill amount ÷ units, else ₹9 per unit. **Editable.** | Bill amount includes fixed charges, so ÷ units slightly overstates the rate. Sales can correct it in the quote builder. | `domain/quote.ts` |
| A08 | 25-year savings = yearly savings × 25 − net cost, with no tariff rise and no panel degradation. | Rising tariffs and panel ageing work in opposite directions. A flat model is simple to explain and does not oversell. | `domain/quote.ts` |
| A09 | Score points out of 100: owner 25; bill ≥ ₹2,000 30, or ₹1,000–1,999 10; roof fits need 20, or fits part 10; inside Vidarbha 15; clear bill read 10. High ≥ 90, Medium ≥ 50. **Thresholds editable.** | Reproduces the sample rows, and each point value can be explained to the client in one sentence. | `domain/score.ts` |
| A10 | Bills under ₹1,000 a month are always Low. **Editable.** | The client names "people with ₹600 bills" as the problem. ₹1,000 sits above the sample's ₹650. | `domain/score.ts` |
| A11 | Tenants are always Low and get no size until the owner is involved. | Sample row LD-30902 shows "-" for size and Low for a tenant. | `domain/score.ts` |
| A12 | Vidarbha means pincodes 440000–445999. | These postal prefixes cover Nagpur, Amravati and the surrounding districts. Needs a check against the client's actual service area. | `domain/pincode.ts` |
| A13 | A bill field under 75% confidence is highlighted for checking. **Editable.** | Model confidence is uncalibrated, so this is a starting point. Stored AI-vs-confirmed values allow tuning it later. | `domain/bill.ts` |
| A14 | Homeowners need no login for the form, quote or status page: unguessable links carry them. They can set a password on the result page to get a "My solar" page. | A password in a lead form would cut completion. The HOMEOWNER role still exists and is checked for accounts. | Auth, `/my` |
| A15 | Stage SLAs in days: Advance 3, Documents 7, Scheduled 14, Installed 5, Net-metering applied 21, Net meter installed 7, Subsidy applied 30. **Editable.** | The brief says "stuck" but gives no timings. | `domain/project.ts` |
| A16 | Required documents per stage are as listed in `REQUIRED_DOCS`, and a project cannot leave a stage until its documents are in. | The brief asks for a checklist per stage but does not list documents. | `domain/project.ts` |
| A17 | The advance is 20% of net cost. **Editable.** | The brief does not state it. Payment is mocked. | `server/quotes.ts` |
| A18 | Staff screens are English only; homeowner screens, the quote PDF and customer messages are English, Marathi and Hindi. | The brief allows this. Staff read English in the existing Excel workflow. | i18n |
| A19 | Marathi and Hindi copy is machine-drafted and needs a native review before launch. | No translator in a zero-cost build. | `messages/*.json` |
| A20 | The subsidy table is residential only. Bills on commercial tariffs (LT II and above) get the COMMERCIAL segment, which has no subsidy rule, so subsidy is ₹0. Sales can override the segment. | The brief's scheme is "central residential", yet the client also serves small businesses. | `domain/bill.ts` |
| A21 | Retention: lead data and bills 24 months after last activity for unconverted leads; project records 8 years for tax. | Placeholder for legal review. See the TDD. | TDD |
| A22 | The demo runs in Vercel `iad1` next to Neon `us-east-1` because that is what the free provisioning gave. Production should move to `ap-south-1`/`bom1`. | Latency and data-location concerns for a real launch. | `vercel.json` |
| A23 | Survey shading reduces usable roof: partial 20%, heavy 50%. It does not change generation. | The brief fixes generation to one formula. Shading therefore affects how much roof is usable. | Quote builder |
| A24 | Monthly units for sizing are the average of the bill's history when present, else the latest month. | The sample column is "Avg Units/Month", and one month can be seasonal. | `domain/bill.ts` |
| A25 | With no bill read, units are estimated as monthly bill ÷ ₹9. | The lead must still be scored when AI is down. It earns no confidence points. | `server/leads.ts` |
| A26 | "Sunpath" is the working product name, and the customer-facing brand shows "Company A Solar". | The brief names no product. | UI |
| A27 | Every outbound update is a mock WhatsApp row in `MessageOutbox`. | The brief says to mock messages. | `server/outbox.ts` |
| A28 | "Same day" is measured on the Indian calendar day. | A UTC day boundary would misreport evening surveys. | `domain/format.ts` |
