/**
 * Generates fictional electricity bills in public/samples (served at /samples) and the matching
 * mock-reader fixtures. Everything here is made up and stamped SAMPLE. No real personal data.
 * Run: pnpm tsx scripts/make-sample-bills.ts
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium, type Page } from "@playwright/test";

interface Bill {
  name: string;
  address: string;
  consumer: string;
  tariff: string;
  load: number;
  units: number;
  amount: number;
  month: string;
  history: [string, number][];
}

const months = ["Oct 25", "Nov 25", "Dec 25", "Jan 26", "Feb 26", "Mar 26", "Apr 26", "May 26", "Jun 26", "Jul 26", "Aug 26", "Sep 26"];
const history = (values: number[]) => values.map((v, i) => [months[i], v] as [string, number]);
const inr = (n: number) => new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2 }).format(n);

function billHtml(b: Bill, smudge = false) {
  const fixed = 130;
  const wheel = Math.round(b.units * 1.17);
  const duty = Math.round(b.amount * 0.14);
  const energy = b.amount - fixed - wheel - duty;
  return `<article class="bill">
  <div class="stamp">SAMPLE</div>
  ${smudge ? '<div class="smudge" style="top:252px;left:400px;width:150px;height:62px"></div><div class="smudge" style="top:262px;left:20px;width:150px;height:44px"></div>' : ""}
  <header>
    <div>
      <h1>Vidarbha Vij Vitaran Co. Ltd.</h1>
      <p>Fictional utility for software testing. Not a real bill.</p>
    </div>
    <div class="right"><strong>Electricity Bill</strong><br/>Bill of ${b.month}</div>
  </header>
  <section class="grid">
    <div><label>Consumer No.</label><b class="big">${b.consumer}</b></div>
    <div><label>Bill Amount (Rs.)</label><b class="big">${inr(b.amount)}</b></div>
    <div><label>Consumer Name</label><b>${b.name}</b></div>
    <div><label>Due Date</label><b>25 of next month</b></div>
    <div class="wide"><label>Address</label><span>${b.address}</span></div>
    <div><label>Tariff</label><b>${b.tariff}</b></div>
    <div><label>Sanctioned Load</label><b>${b.load} KW</b></div>
  </section>
  <section class="cols">
    <table>
      <caption>Meter reading</caption>
      <tr><th>Previous</th><th>Current</th><th>Units</th></tr>
      <tr><td>${(48120 + b.units * 3).toFixed(0)}</td><td>${(48120 + b.units * 4).toFixed(0)}</td><td><b>${b.units}</b></td></tr>
    </table>
    <table>
      <caption>Charges</caption>
      <tr><td>Fixed charges</td><td class="n">${inr(fixed)}</td></tr>
      <tr><td>Energy charges</td><td class="n">${inr(energy)}</td></tr>
      <tr><td>Wheeling charges</td><td class="n">${inr(wheel)}</td></tr>
      <tr><td>Electricity duty</td><td class="n">${inr(duty)}</td></tr>
      <tr class="t"><td>Total</td><td class="n">${inr(b.amount)}</td></tr>
    </table>
  </section>
  <table class="hist">
    <caption>Consumption history (units)</caption>
    <tr>${b.history.map(([m]) => `<th>${m}</th>`).join("")}</tr>
    <tr>${b.history.map(([, u]) => `<td>${u}</td>`).join("")}</tr>
  </table>
</article>`;
}

const css = `
*{box-sizing:border-box} body{margin:0;background:#fff;font:15px/1.35 Arial,Helvetica,sans-serif;color:#1a1a1a}
.bill{position:relative;width:820px;padding:28px 32px;background:#fff;border:2px solid #1d3f72;overflow:hidden}
header{display:flex;justify-content:space-between;border-bottom:3px solid #1d3f72;padding-bottom:10px}
h1{margin:0;font-size:24px;color:#1d3f72} header p{margin:2px 0 0;font-size:12px}
.right{text-align:right} .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 28px;margin:16px 0}
.wide{grid-column:1/3} label{display:block;font-size:12px;color:#555}.big{font-size:22px}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:24px} table{width:100%;border-collapse:collapse}
caption{text-align:left;font-weight:bold;color:#1d3f72;padding-bottom:4px}
th,td{border:1px solid #9fb0c8;padding:5px 7px;font-size:13px;text-align:center}.n{text-align:right}
.cols td:first-child{text-align:left}.cols table:first-child td{text-align:center}.t td{font-weight:bold;background:#eef2f8}
.hist{margin-top:18px}.hist th,.hist td{padding:4px 2px;font-size:12px}
.smudge{position:absolute;z-index:2;border-radius:50%;background:rgba(92,62,30,.93);filter:blur(7px)}
.stamp{position:absolute;top:42%;left:18%;font-size:120px;font-weight:bold;color:rgba(190,30,30,.13);transform:rotate(-22deg);letter-spacing:8px;pointer-events:none}
`;

const prashant: Bill = {
  name: "Prashant Wankhede",
  address: "Plot 14, Sample Nagar, Nagpur 440022",
  consumer: "410019900881",
  tariff: "LT I - Residential",
  load: 5,
  units: 340,
  amount: 3200,
  month: "Sep 2026",
  history: history([310, 305, 265, 270, 300, 365, 430, 455, 380, 335, 325, 340]),
};
const ayesha: Bill = {
  name: "Ayesha Siddiqui",
  address: "House 7, Sample Colony, Amravati 444601",
  consumer: "430029900915",
  tariff: "LT I - Residential",
  load: 2,
  units: 85,
  amount: 650,
  month: "Sep 2026",
  history: history([80, 75, 70, 72, 78, 88, 100, 110, 96, 85, 81, 85]),
};
const shop: Bill = {
  name: "Sample Traders",
  address: "Shop 3, Sample Market, Wardha 442001",
  consumer: "440039901204",
  tariff: "LT II - Commercial",
  load: 8,
  units: 620,
  amount: 8400,
  month: "Sep 2026",
  history: history([580, 560, 540, 550, 590, 650, 720, 740, 660, 610, 600, 620]),
};
const tilted: Bill = {
  name: "Kiran Bawane",
  address: "Flat 2, Sample Layout, Chandrapur 442401",
  consumer: "450049901377",
  tariff: "LT I - Residential",
  load: 3,
  units: 260,
  amount: 2350,
  month: "Sep 2026",
  history: history([240, 225, 215, 220, 235, 275, 320, 340, 290, 255, 250, 260]),
};
const avg = (b: Bill) => b.history.map(([, u]) => u);

const conf = (value: unknown, confidence = 0.96) => ({ value, confidence });
const fixture = (b: Bill, over: Record<string, unknown> = {}) => ({
  isElectricityBill: true,
  imageQuality: "good",
  consumerNumber: conf(b.consumer),
  tariffCategory: conf(b.tariff),
  ratePerUnit: conf(null, 0),
  sanctionedLoadKw: conf(b.load),
  unitsLatestMonth: conf(b.units),
  billAmount: conf(b.amount),
  billingMonth: conf(b.month),
  monthlyUnitsHistory: avg(b),
  ...over,
});
const emptyRead = (over: Record<string, unknown>) => ({
  ...fixture(prashant),
  consumerNumber: conf(null, 0),
  tariffCategory: conf(null, 0),
  sanctionedLoadKw: conf(null, 0),
  unitsLatestMonth: conf(null, 0),
  billAmount: conf(null, 0),
  billingMonth: conf(null, 0),
  monthlyUnitsHistory: [],
  ...over,
});

const receipt = `<article style="width:420px;padding:30px;font:16px/1.6 'Courier New',monospace;background:#fff;border:1px solid #ccc">
  <h2 style="margin:0;text-align:center">SAMPLE KIRANA STORES</h2><p style="text-align:center;margin:0 0 12px">Cash memo. Fictional.</p>
  <p>Rice 5 kg ........ 340.00<br/>Toor dal 1 kg .... 165.00<br/>Oil 1 L .......... 150.00<br/>Tea 250 g ........ 120.00<br/>Sugar 2 kg ........ 92.00</p>
  <p><b>TOTAL ........... 867.00</b></p><p style="text-align:center">Thank you. Visit again.</p></article>`;

interface Sample {
  file: string;
  label: string;
  html: string;
  /** CSS applied to the page wrapper to fake a phone photo. */
  wrapper?: string;
  /** The answer the mock reader gives for this file. */
  response: unknown;
}

const samples: Sample[] = [
  { file: "clear-home-bill.jpg", label: "Clear home bill, 340 units", html: billHtml(prashant), response: fixture(prashant) },
  { file: "small-home-bill.jpg", label: "Small bill, ₹650", html: billHtml(ayesha), response: fixture(ayesha) },
  { file: "shop-bill.jpg", label: "Shop on a commercial tariff", html: billHtml(shop), response: fixture(shop) },
  {
    file: "tilted-phone-photo.jpg",
    label: "Tilted, stained photo",
    html: billHtml(tilted, true),
    wrapper: "padding:60px;background:#6e675f;filter:brightness(.82) contrast(.86) blur(.9px);transform:rotate(-3.5deg) scale(.96)",
    response: fixture(tilted, {
      sanctionedLoadKw: conf(null, 0),
      tariffCategory: conf(null, 0),
    }),
  },
  {
    file: "blurry-photo.jpg",
    label: "Blurry photo",
    html: billHtml(prashant),
    wrapper: "padding:40px;background:#6e675f;filter:blur(7px) brightness(.9)",
    response: emptyRead({ imageQuality: "blurry" }),
  },
  { file: "not-a-bill.jpg", label: "Not a bill", html: receipt, wrapper: "padding:50px;background:#d7d3cc;width:fit-content", response: emptyRead({ isElectricityBill: false, imageQuality: "good" }) },
];

async function shoot(page: Page, sample: Sample, out: string) {
  await page.setContent(`<!doctype html><style>${css}</style><div id="shot" style="width:fit-content;background:#6e675f"><div style="${sample.wrapper ?? ""}">${sample.html}</div></div>`);
  await page.locator("#shot").screenshot({ path: out, type: "jpeg", quality: 82 });
}

async function main() {
  const outDir = path.resolve("public/samples");
  mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1000, height: 1100 } });
  const fixtures: Record<string, { label: string; file: string; response: unknown }> = {};
  for (const sample of samples) {
    const out = path.join(outDir, sample.file);
    await shoot(page, sample, out);
    const sha = createHash("sha256").update(readFileSync(out)).digest("hex");
    fixtures[sha] = { label: sample.label, file: sample.file, response: sample.response };
  }
  await browser.close();
  writeFileSync("src/server/bill-reader/sample-fixtures.json", `${JSON.stringify(fixtures, null, 2)}\n`);
  writeFileSync(
    "src/lib/sample-bills.ts",
    `// Generated by scripts/make-sample-bills.ts\nexport const SAMPLE_BILLS = ${JSON.stringify(
      samples.map((s) => ({ file: s.file, label: s.label })),
      null,
      2,
    )};\n`,
  );
  console.log(`Wrote ${samples.length} samples`);
}

main();
