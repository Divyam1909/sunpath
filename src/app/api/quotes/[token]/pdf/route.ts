import { NextResponse, type NextRequest } from "next/server";
import { formatDate } from "@/domain/format";
import { routing, type Locale } from "@/i18n/routing";
import { db } from "@/server/db";
import { renderQuotePdf } from "@/server/pdf/quote-pdf";
import { readQuote } from "@/server/quotes";

export async function GET(request: NextRequest, { params }: RouteContext<"/api/quotes/[token]/pdf">) {
  const { token } = await params;
  const quote = await db.quote.findUnique({ where: { token }, include: { lead: true } });
  if (!quote) return new NextResponse("Not found", { status: 404 });

  const asked = request.nextUrl.searchParams.get("locale");
  const locale = (routing.locales as readonly string[]).includes(asked ?? "") ? (asked as Locale) : (quote.lead.locale as Locale);
  const messages = (await import(`../../../../../../messages/${locale}.json`)).default;

  const pdf = await renderQuotePdf({
    locale,
    messages,
    brand: messages.brand.name,
    customerFirstName: quote.lead.name.split(" ")[0],
    quoteDate: formatDate(quote.quoteDate.toISOString().slice(0, 10), locale),
    quote: readQuote(quote),
    selectedKw: quote.selectedKw,
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="solar-quote-${quote.lead.code}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
