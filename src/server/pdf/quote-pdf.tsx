import path from "node:path";
import { Document, Font, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import { createTranslator } from "next-intl";
import { formatINR, formatNumber } from "@/domain/format";
import type { QuoteOption } from "@/domain/quote";
import type { Locale } from "@/i18n/routing";
import type { StoredQuote } from "@/server/quotes";

const fontDir = path.join(process.cwd(), "src/assets/fonts");

Font.register({
  family: "Inter",
  fonts: [
    { src: path.join(fontDir, "Inter_400Regular.ttf"), fontWeight: 400 },
    { src: path.join(fontDir, "Inter_600SemiBold.ttf"), fontWeight: 600 },
  ],
});
Font.register({
  family: "Devanagari",
  fonts: [
    { src: path.join(fontDir, "NotoSansDevanagari_400Regular.ttf"), fontWeight: 400 },
    { src: path.join(fontDir, "NotoSansDevanagari_600SemiBold.ttf"), fontWeight: 600 },
  ],
});
Font.registerHyphenationCallback((word) => [word]);

const INK = "#17201f";
const MUTED = "#5b6866";
const LINE = "#e3e7e6";
const TEAL = "#0b5c58";
const TINT = "#e7f1f0";

const styles = StyleSheet.create({
  page: { paddingTop: 44, paddingBottom: 44, paddingHorizontal: 48, fontFamily: ["Inter", "Devanagari"], fontSize: 10, color: INK, lineHeight: 1.5 },
  top: { flexDirection: "row", justifyContent: "space-between", marginBottom: 30 },
  brand: { fontSize: 12, fontWeight: 600 },
  muted: { color: MUTED },
  title: { fontSize: 20, fontWeight: 600, marginBottom: 2 },
  story: { flexDirection: "row", marginTop: 22, marginBottom: 26, paddingVertical: 18, borderTopWidth: 1, borderBottomWidth: 1, borderColor: LINE },
  storyCell: { flex: 1 },
  storyNumber: { fontSize: 26, fontWeight: 600, color: TEAL, lineHeight: 1.2 },
  h2: { fontSize: 12, fontWeight: 600, marginBottom: 8 },
  row: { flexDirection: "row", borderBottomWidth: 1, borderColor: LINE, paddingVertical: 5 },
  rowHead: { flexDirection: "row", paddingBottom: 6, borderBottomWidth: 1, borderColor: INK },
  labelCell: { flex: 1.7, color: MUTED },
  valueCell: { flex: 1, textAlign: "right" },
  selected: { backgroundColor: TINT, borderRadius: 3, paddingHorizontal: 4 },
  bold: { fontWeight: 600 },
  how: { marginTop: 22 },
  howLine: { marginBottom: 3, color: MUTED },
  footer: { position: "absolute", left: 48, right: 48, bottom: 26, fontSize: 8, color: MUTED },
});

interface PdfProps {
  locale: Locale;
  messages: Record<string, unknown>;
  brand: string;
  customerFirstName: string;
  quoteDate: string;
  quote: StoredQuote;
  selectedKw: number;
}

function QuotePdf({ locale, messages, brand, customerFirstName, quoteDate, quote, selectedKw }: PdfProps) {
  const t = createTranslator({ locale, messages: messages as never, namespace: "quote" as never }) as unknown as (
    key: string,
    values?: Record<string, string | number>,
  ) => string;
  const selected = quote.options.find((o) => o.systemKw === selectedKw) ?? quote.options[0];
  const { snapshot, inputs } = quote;
  const rows: [string, (o: QuoteOption) => string][] = [
    ["gross", (o) => formatINR(o.grossCost)],
    ["subsidy", (o) => `− ${formatINR(o.subsidy)}`],
    ["net", (o) => formatINR(o.netCost)],
    ["generation", (o) => t("units", { units: formatNumber(o.yearlyGeneration) })],
    ["savings", (o) => formatINR(o.yearlySavings)],
    ["payback", (o) => (o.paybackYears === null ? "-" : t("years", { years: formatNumber(o.paybackYears) }))],
    ["lifetime", (o) => formatINR(o.savings25Years)],
  ];
  const surplus =
    selected.unitsSurplus > 0
      ? t("howSurplus", { units: formatNumber(selected.unitsSurplus), rate: `₹${snapshot.surplusRatePerUnit}` })
      : "";

  return (
    <Document title={t("title")} author={brand}>
      <Page size="A4" style={styles.page}>
        <View style={styles.top}>
          <Text style={styles.brand}>{brand}</Text>
          <Text style={styles.muted}>{t("forName", { name: customerFirstName, date: quoteDate })}</Text>
        </View>
        <Text style={styles.title}>{t("title")}</Text>

        <View style={styles.story}>
          <View style={styles.storyCell}>
            <Text style={styles.muted}>{t("systemLabel")}</Text>
            <Text style={styles.storyNumber}>{formatNumber(selected.systemKw)} kW</Text>
          </View>
          <View style={styles.storyCell}>
            <Text style={styles.muted}>{t("afterSubsidy")}</Text>
            <Text style={styles.storyNumber}>{formatINR(selected.netCost)}</Text>
          </View>
          <View style={styles.storyCell}>
            <Text style={styles.muted}>{t("paybackLabel")}</Text>
            <Text style={styles.storyNumber}>
              {selected.paybackYears === null ? "-" : t("years", { years: formatNumber(selected.paybackYears) })}
            </Text>
          </View>
        </View>

        <Text style={styles.h2}>{t("optionsTitle")}</Text>
        <View style={styles.rowHead}>
          <Text style={styles.labelCell}>{t("table.system")}</Text>
          {quote.options.map((o) => (
            <Text key={o.systemKw} style={[styles.valueCell, styles.bold]}>
              {formatNumber(o.systemKw)} kW{o.systemKw === selectedKw ? " *" : ""}
            </Text>
          ))}
        </View>
        {rows.map(([key, value]) => (
          <View key={key} style={styles.row} wrap={false}>
            <Text style={styles.labelCell}>{t(`table.${key}`)}</Text>
            {quote.options.map((o) => (
              <Text key={o.systemKw} style={[styles.valueCell, key === "net" ? styles.bold : {}]}>
                {value(o)}
              </Text>
            ))}
          </View>
        ))}
        <Text style={[styles.muted, { marginTop: 5, fontSize: 8.5 }]}>* {t("selected")}</Text>

        <View style={styles.how}>
          <Text style={styles.h2}>{t("howTitle")}</Text>
          <Text style={styles.howLine}>
            {t("howCost", { kw: formatNumber(selected.systemKw), rate: formatINR(selected.pricePerKw), gross: formatINR(selected.grossCost) })}
          </Text>
          {selected.subsidyLines.map((line) => (
            <Text key={line.ratePerKw} style={styles.howLine}>
              {t("howSubsidyLine", { kw: formatNumber(line.kw), rate: formatINR(line.ratePerKw), amount: formatINR(line.amount) })}
            </Text>
          ))}
          {snapshot.subsidyRule ? (
            <Text style={styles.howLine}>{t("howSubsidyTotal", { amount: formatINR(selected.subsidy) })}</Text>
          ) : (
            <Text style={styles.howLine}>{t("howSubsidyNone")}</Text>
          )}
          <Text style={styles.howLine}>
            {t("howNet", { gross: formatINR(selected.grossCost), subsidy: formatINR(selected.subsidy), net: formatINR(selected.netCost) })}
          </Text>
          <Text style={styles.howLine}>
            {t("howGeneration", {
              kw: formatNumber(selected.systemKw),
              factor: formatNumber(snapshot.generationKwhPerKwYear),
              units: formatNumber(selected.yearlyGeneration),
            })}
          </Text>
          <Text style={styles.howLine}>
            {t("howSavings", {
              offset: formatNumber(selected.unitsOffset),
              tariff: `₹${inputs.tariffPerUnit}`,
              surplus,
              savings: formatINR(selected.yearlySavings),
            })}
          </Text>
          {selected.paybackYears !== null ? (
            <Text style={styles.howLine}>
              {t("howPayback", { net: formatINR(selected.netCost), savings: formatINR(selected.yearlySavings), years: formatNumber(selected.paybackYears) })}
            </Text>
          ) : null}
          <Text style={styles.howLine}>
            {t("howLifetime", { savings: formatINR(selected.yearlySavings), net: formatINR(selected.netCost), total: formatINR(selected.savings25Years) })}
          </Text>
        </View>
        <Text style={styles.footer} fixed>
          {brand}
        </Text>
      </Page>
    </Document>
  );
}

export const renderQuotePdf = (props: PdfProps) => renderToBuffer(<QuotePdf {...props} />);
