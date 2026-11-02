const rupeeFormat = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const numberFormat = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

/** ₹1,23,456 */
export const formatINR = (amount: number) => `₹${rupeeFormat.format(amount)}`;

export const formatNumber = (n: number) => numberFormat.format(n);

/** Today's date in India as YYYY-MM-DD. A28: "same day" always means the IST calendar day. */
export function istDate(at: Date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(at);
}

export const daysAgo = (days: number, from: Date = new Date()) => new Date(from.getTime() - days * 86_400_000);

/** 31 Oct 2026, in the reader's language. Dates are stored and compared as YYYY-MM-DD. */
export function formatDate(iso: string, locale = "en") {
  const date = new Date(`${iso}T12:00:00+05:30`);
  return new Intl.DateTimeFormat(`${locale}-IN-u-nu-latn`, { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(date);
}
