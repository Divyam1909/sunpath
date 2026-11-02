/**
 * Lookalike bills: the layouts of MSEDCL's published bills, filled with fictional people and numbers
 * worked out from the real tariff. Each carries a printed notice and a SAMPLE stamp, has no logo, QR
 * code, barcode or real identifier, and so cannot pass for a bill. They exist to test the reader.
 */
import { calculateBill, type BillTariff } from "../src/domain/tariff";
import { monthsBefore } from "../src/domain/usage";

export interface Lookalike {
  key: string;
  layout: "MARATHI" | "ENGLISH" | "SOLAR";
  name: string;
  address: string;
  consumer: string;
  tariffText: string;
  tariffCode: string;
  phase: 1 | 3;
  loadKw: number;
  units: number;
  month: string;
  arrears: number;
  meterStatus: string;
  /** Oldest first, ending the month before this bill. */
  history: number[];
  solar?: { import: number; export: number; banked: number; generation: number };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MARATHI_MONTHS = ["जानेवारी", "फेब्रुवारी", "मार्च", "एप्रिल", "मे", "जून", "जुलै", "ऑगस्ट", "सप्टेंबर", "ऑक्टोबर", "नोव्हेंबर", "डिसेंबर"];

const monthParts = (month: string) => month.split("-").map(Number);
const english = (month: string) => `${MONTHS[monthParts(month)[1] - 1]} ${monthParts(month)[0]}`;
const marathi = (month: string) => `${MARATHI_MONTHS[monthParts(month)[1] - 1]}-${monthParts(month)[0]}`;

const money = (n: number) => new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

/** Months in the printed history, newest first, as real bills print them. */
export const historyRows = (bill: Lookalike) =>
  bill.history
    .map((units, i) => ({ month: monthsBefore(bill.month, bill.history.length - i), units }))
    .reverse();

export function amounts(bill: Lookalike, tariff: BillTariff) {
  const lines = calculateBill(bill.units, tariff, { phase: bill.phase });
  const net = lines.total + bill.arrears;
  return { lines, current: lines.total, payable: Math.round(net / 10) * 10 };
}

const NOTICE = `<div class="notice">SAMPLE FOR SOFTWARE TESTING. NOT ISSUED BY MSEDCL. NOT A BILL. NOT VALID FOR ANY PURPOSE.</div>
  <div class="mark">SAMPLE</div><div class="mark two">SAMPLE</div>`;

function chargesTable(bill: Lookalike, tariff: BillTariff, labels: string[]) {
  const { lines, current, payable } = amounts(bill, tariff);
  const rows: [string, number][] = [
    [labels[0], lines.fixed],
    [labels[1], lines.energy],
    [`${labels[2]} @ ${tariff.wheelingPerUnit} Rs/U`, lines.wheeling],
    [labels[3], lines.fac],
    [`${labels[4]} ${tariff.dutyPercent}%`, lines.duty],
  ];
  return `<table class="charges">
    ${rows.map(([label, value]) => `<tr><td>${label}</td><td class="n">${money(value)}</td></tr>`).join("")}
    <tr class="t"><td>${labels[5]}</td><td class="n">${money(current)}</td></tr>
    <tr><td>${labels[6]}</td><td class="n">${money(bill.arrears)}</td></tr>
    <tr class="t"><td>${labels[7]}</td><td class="n">${money(payable)}</td></tr>
  </table>`;
}

function marathiBill(bill: Lookalike, tariff: BillTariff) {
  const { payable } = amounts(bill, tariff);
  const max = Math.max(...bill.history, 1);
  return `<article class="bill">${NOTICE}
  <header><div><h1>नमुना वीज देयक</h1><p>Sample utility. Layout modelled on an LT bill.</p></div>
  <div class="right">BILL OF SUPPLY FOR THE MONTH OF<br/><b>${marathi(bill.month)}</b></div></header>
  <section class="two">
    <div>
      <p><label>ग्राहक क्रमांक</label><b class="big">${bill.consumer}</b></p>
      <p><b>${bill.name}</b><br/>${bill.address}</p>
      <p><label>दर संकेत</label><b>${bill.tariffText}</b></p>
      <p><label>मंजूर भार</label><b>${bill.loadKw.toFixed(2)} KW</b></p>
    </div>
    <div class="due">
      <p><label>देयक रक्कम रु</label><b class="big">${money(payable)}</b></p>
      <p><label>Meter Status</label><b>${bill.meterStatus}</b></p>
    </div>
  </section>
  <table class="tiles"><tr><th>चालु रिडिंग</th><th>मागील रिडिंग</th><th>गुणक अवयव</th><th>युनिट</th><th>एकूण वापर</th></tr>
  <tr><td>${5000 + bill.units}</td><td>5000</td><td>1.00</td><td>${bill.units}</td><td><b>${bill.units}</b></td></tr></table>
  <section class="two">
    <div class="bars"><h2>वापराचा इतिहास</h2>
      ${historyRows(bill).map((row) => `<div class="bar"><span>${marathi(row.month)}</span><i style="width:${Math.round((row.units / max) * 220)}px"></i><em>${row.units}</em></div>`).join("")}
    </div>
    <div>${chargesTable(bill, tariff, ["स्थिर आकार", "वीज आकार", "वहन आकार", "इंधन समायोजन आकार", "वीज शुल्क", "चालू वीज देयक (रु.)", "एकूण थकबाकी/जमा", "पूर्णांक देयक (रु.)"])}</div>
  </section>
</article>`;
}

function englishBill(bill: Lookalike, tariff: BillTariff) {
  const { payable } = amounts(bill, tariff);
  const max = Math.max(...bill.history, 1);
  return `<article class="bill">${NOTICE}
  <header><div><h1>Sample Electricity Bill</h1><p>Sample utility. Layout modelled on an LT bill.</p></div>
  <div class="right">Bill of Supply For:<br/><b>${english(bill.month).toUpperCase()}</b></div></header>
  <section class="two">
    <div>
      <p><label>Consumer No</label><b class="big">${bill.consumer}</b></p>
      <p><b>${bill.name.toUpperCase()}</b><br/>${bill.address}</p>
      <p><label>Tariff/Category</label><b>${bill.tariffText}</b></p>
      <p><label>Sanct. Load</label><b>${bill.loadKw} KW</b></p>
    </div>
    <div class="due">
      <p><label>Bill Amount Rs</label><b class="big">${money(payable)}</b></p>
      <p><label>Meter status</label><b>${bill.meterStatus.toUpperCase()}</b></p>
    </div>
  </section>
  <table class="tiles"><tr><th>Current Reading</th><th>Previous Reading</th><th>MF</th><th>Unit</th><th>Total</th></tr>
  <tr><td>${7000 + bill.units}</td><td>7000</td><td>01</td><td>${bill.units}</td><td><b>${bill.units}</b></td></tr></table>
  <section class="two">
    <div class="columns"><h2>Billing History</h2><div class="plot">
      ${[...historyRows(bill)].reverse().map((row) => `<div><em>${row.units}</em><i style="height:${Math.round((row.units / max) * 130)}px"></i><span>${english(row.month).replace(" 20", " ")}</span></div>`).join("")}
    </div></div>
    <div>${chargesTable(bill, tariff, ["Fixed Charges", "Energy Charges", "Wheeling Charges", "F.A.C.", "Electricity Duty", "Total Current Bill(Rs)", "Total Arrears", "Rounded Bill(Rs)"])}</div>
  </section>
</article>`;
}

function solarBill(bill: Lookalike, tariff: BillTariff) {
  const { payable } = amounts(bill, tariff);
  const solar = bill.solar!;
  return `<article class="bill">${NOTICE}
  <header><div><h1>Sample Solar Net Meter Bill</h1><p>Sample utility. Layout modelled on a net meter bill.</p></div>
  <div class="right">BILL OF SUPPLY FOR THE MONTH<br/><b>${english(bill.month).replace(" ", "-")}</b></div></header>
  <section class="two">
    <div>
      <p><label>Consumer No.</label><b class="big">${bill.consumer}</b></p>
      <p><label>Consumer Name</label><b>${bill.name.toUpperCase()}</b><br/>${bill.address}</p>
      <p><label>Tariff</label><b>${bill.tariffText}</b></p>
      <p><label>Sanctioned Load</label><b>${bill.loadKw} KW</b></p>
    </div>
    <div class="due">
      <p><label>Total Bill Amount (Rounded) Rs.</label><b class="big">${money(payable)}</b></p>
      <p><label>Solar Generation Capacity (KW)</label><b>3.00</b></p>
    </div>
  </section>
  <section class="two">
    <table class="hist"><caption>BILLING HISTORY</caption><tr><th>Bill</th><th>Units</th></tr>
      ${historyRows(bill).map((row) => `<tr><td>${english(row.month).replace(" ", "-")}</td><td>${row.units}</td></tr>`).join("")}
    </table>
    <div>${chargesTable(bill, tariff, ["Fixed Charges", "Energy Charges", "Wheeling Charge", "FAC", "Electricity Duty", "TOTAL CURRENT BILL", "Principal Arrears", "Total Bill Amount (Rounded) Rs."])}</div>
  </section>
  <p class="line">Rooftop Solar Units: Export:${solar.export} Import:${solar.import} Adjusted:${solar.import - bill.units} Bank:${solar.banked}</p>
  <table class="tiles"><caption>SOLAR NET METER CONSUMPTION DETAILS</caption>
    <tr><th>IMPORT UNITS</th><th>EXPORT UNITS</th><th>GENERATION UNIT</th><th>OFFSET</th><th>Current Banked</th><th>Billed</th></tr>
    <tr><td>${solar.import}</td><td>${solar.export}</td><td>${solar.generation}</td><td>${solar.import - bill.units}</td><td>${solar.banked}</td><td><b>${bill.units}</b></td></tr>
  </table>
</article>`;
}

export function lookalikeHtml(bill: Lookalike, tariff: BillTariff) {
  if (bill.layout === "SOLAR") return solarBill(bill, tariff);
  return bill.layout === "MARATHI" ? marathiBill(bill, tariff) : englishBill(bill, tariff);
}

export const LOOKALIKE_CSS = `
.bill{position:relative;width:860px;padding:22px 28px;background:#fff;border:1px solid #777;overflow:hidden;font:14px/1.35 Arial,'Noto Sans Devanagari','Nirmala UI',sans-serif;color:#1b1b1b}
.notice{margin:-22px -28px 12px;padding:6px 10px;background:#b3261e;color:#fff;font-weight:bold;font-size:13px;text-align:center}
.mark{position:absolute;top:24%;left:16%;font-size:130px;font-weight:bold;color:rgba(190,30,30,.13);transform:rotate(-22deg);letter-spacing:10px;pointer-events:none}
.mark.two{top:68%;left:30%}
.bill header{display:flex;justify-content:space-between;border-bottom:2px solid #7a1f1f;padding-bottom:8px}
.bill h1{margin:0;font-size:22px;color:#7a1f1f}.bill h2{margin:0 0 6px;font-size:14px}.bill header p{margin:2px 0 0;font-size:12px}
.bill .right{text-align:right}.two{display:grid;grid-template-columns:1.2fr 1fr;gap:24px;margin:12px 0}
.bill p{margin:0 0 8px}.bill label{display:inline-block;min-width:120px;font-size:12px;color:#555}.big{font-size:20px}
.due{background:#fdeee6;padding:10px 12px;border-radius:4px}
.tiles{width:100%;border-collapse:separate;border-spacing:6px;background:#f6f8cf}.tiles caption{font-weight:bold;text-align:left;padding-bottom:4px}
.tiles th,.tiles td{padding:6px 4px;text-align:center;font-size:13px;background:#fbfde4;border:1px solid #d6d98e}
.charges{width:100%;border-collapse:collapse}.charges td{border-bottom:1px solid #bbb;padding:4px 6px;font-size:13px}.charges .n{text-align:right}.charges .t td{font-weight:bold;background:#eef6d8}
.bar{display:flex;align-items:center;gap:6px;height:20px;font-size:12px}.bar span{width:96px}.bar i{display:block;height:13px;background:#2b6fe0}.bar em{font-style:normal}
.plot{display:flex;align-items:flex-end;gap:5px;height:190px}.plot div{display:flex;flex-direction:column;align-items:center;flex:1;font-size:10px}.plot i{display:block;width:16px;background:#3fa7c0}.plot em{font-style:normal}.plot span{transform:rotate(-40deg);margin-top:12px;white-space:nowrap}
.hist{border-collapse:collapse;width:100%}.hist caption{background:#7a1f1f;color:#fff;font-weight:bold;padding:3px}.hist th,.hist td{border:1px solid #888;padding:3px 8px;font-size:12.5px;text-align:right}
.line{font-size:13px}
`;

/** CSS that turns a clean render into a phone snapshot of a printed bill. */
export const PHONE_EFFECTS = {
  tilted: "padding:50px;background:#6e675f;filter:brightness(.9) contrast(.9) blur(.7px);transform:rotate(-4deg) scale(.95)",
  dim: "padding:36px;background:#3f3a35;filter:brightness(.55) contrast(.82) blur(.5px);transform:rotate(2deg)",
  soft: "padding:24px;background:#8a8378;filter:blur(1.3px) saturate(.75);transform:rotate(-1.5deg) scale(.97)",
};

const RES1 = "90/LT I Res 1-Phase";
const RES3 = "91/LT I Res 3-Phase";

// Everyone here is fictional. Consumer numbers start 9999, which MSEDCL's real series do not use here.
export const LOOKALIKES: Lookalike[] = [
  { key: "typical-marathi", layout: "MARATHI", name: "PRASAD M DESHPANDE", address: "12 Sample Layout, Trimurti Nagar, Nagpur 440022", consumer: "999900012345", tariffText: RES1, tariffCode: "LT I", phase: 1, loadKw: 5, units: 310, month: "2026-09", arrears: 4.62, meterStatus: "Normal", history: [298, 262, 241, 250, 278, 330, 402, 431, 352, 308, 301] },
  { key: "peak-may-marathi", layout: "MARATHI", name: "SHRI VINOD S BOBDE", address: "4 Sample Colony, Manish Nagar, Nagpur 440015", consumer: "999900023456", tariffText: RES1, tariffCode: "LT I", phase: 1, loadKw: 6, units: 610, month: "2026-05", arrears: 0, meterStatus: "Normal", history: [372, 355, 330, 318, 300, 288, 276, 290, 335, 412, 498] },
  { key: "arrears-other-name", layout: "MARATHI", name: "RAMESH K TIWARI", address: "Flat 8, Sample Heights, Dharampeth, Nagpur 440010", consumer: "999900034567", tariffText: RES1, tariffCode: "LT I", phase: 1, loadKw: 2, units: 420, month: "2026-09", arrears: 2986.44, meterStatus: "Normal", history: [398, 365, 330, 338, 372, 445, 512, 548, 465, 418, 404] },
  { key: "three-phase-english", layout: "ENGLISH", name: "Dr Meera A Joshi", address: "22 Sample Road, Civil Lines, Amravati 444601", consumer: "999900045678", tariffText: RES3, tariffCode: "LT I", phase: 3, loadKw: 9, units: 480, month: "2026-08", arrears: -12.3, meterStatus: "Normal", history: [455, 462, 421, 378, 350, 362, 440, 548, 612, 598, 505] },
  { key: "small-user", layout: "ENGLISH", name: "Sunanda P Khobragade", address: "9 Sample Galli, Bhandara 441904", consumer: "999900056789", tariffText: RES1, tariffCode: "LT I", phase: 1, loadKw: 1, units: 78, month: "2026-09", arrears: 0, meterStatus: "Normal", history: [74, 70, 62, 66, 71, 82, 96, 104, 88, 80, 76] },
  { key: "faulty-meter", layout: "ENGLISH", name: "Ashok T Meshram", address: "31 Sample Nagar, Akola 444001", consumer: "999900067890", tariffText: RES1, tariffCode: "LT I", phase: 1, loadKw: 4, units: 240, month: "2026-07", arrears: 0, meterStatus: "Faulty", history: [212, 228, 205, 198, 222, 268, 318, 342, 291, 255, 240] },
  { key: "after-solar-march", layout: "SOLAR", name: "Deepak Nagpure", address: "5 Sample Enclave, Nagpur 440025", consumer: "999900078901", tariffText: "90 LT-I B Residential", tariffCode: "LT I", phase: 1, loadKw: 7, units: 96, month: "2026-03", arrears: 0, meterStatus: "Normal", history: [540, 498, 460, 88, 42, 0, 0, 36, 74, 102, 118], solar: { import: 402, export: 306, banked: 0, generation: 548 } },
  { key: "after-solar-july", layout: "SOLAR", name: "Swati Dhoke", address: "16 Sample Vihar, Hinganghat 442101", consumer: "999900089012", tariffText: "90 LT-I B Residential", tariffCode: "LT I", phase: 1, loadKw: 3, units: 188, month: "2026-07", arrears: 310, meterStatus: "Normal", history: [235, 228, 96, 58, 41, 22, 18, 29, 44, 92, 120], solar: { import: 281, export: 93, banked: 0, generation: 212 } },
];

/** What a perfect reader returns for this bill. The mock reader and the accuracy test both use it. */
export function lookalikeTruth(bill: Lookalike, tariff: BillTariff) {
  const { current, payable } = amounts(bill, tariff);
  return {
    consumerNumber: bill.consumer,
    consumerName: bill.name,
    tariffCategory: bill.tariffCode,
    sanctionedLoadKw: bill.loadKw,
    unitsLatestMonth: bill.units,
    billAmount: payable,
    currentBillAmount: current,
    arrearsAmount: bill.arrears,
    billingMonth: english(bill.month),
    // The solar layout, like the real one, prints no meter status.
    meterStatus: bill.solar ? null : bill.meterStatus,
    solarImportUnits: bill.solar?.import ?? null,
    solarExportUnits: bill.solar?.export ?? null,
    solarBankedUnits: bill.solar?.banked ?? null,
    solarBilledUnits: bill.solar ? bill.units : null,
    monthlyUsage: historyRows(bill).map((row) => ({ month: english(row.month), units: row.units })),
  };
}
