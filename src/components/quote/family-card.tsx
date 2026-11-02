"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Download, Share2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SIZE = { width: 1080, height: 1350 };
const INK = "#17201f";
const MUTED = "#5b6866";
const TEAL = "#0b5c58";
const TINT = "#e7f1f0";
const SUN = "#b8740c";

export interface CardFacts {
  name: string;
  brand: string;
  kw: string;
  netCost: string;
  payback: string;
  saving25: string;
  /** Today's monthly bill and the bill with solar, when the quote has a bill view. */
  before: string | null;
  after: string | null;
  date: string;
  link: string;
}

/** Drawn in the browser, which shapes Marathi and Hindi correctly. Carries a first name and no address or number. */
function drawCard(canvas: HTMLCanvasElement, facts: CardFacts, t: (key: string, values?: Record<string, string>) => string, fontFamily: string) {
  const context = canvas.getContext("2d")!;
  const font = (weight: number, size: number) => `${weight} ${size}px ${fontFamily}`;
  const text = (value: string, x: number, y: number, weight: number, size: number, colour: string, align: CanvasTextAlign = "left") => {
    context.font = font(weight, size);
    context.fillStyle = colour;
    context.textAlign = align;
    context.fillText(value, x, y);
  };

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, SIZE.width, SIZE.height);

  // The sun arc from the status page, rising over the headline.
  context.strokeStyle = SUN;
  context.lineWidth = 6;
  context.lineCap = "round";
  context.beginPath();
  context.ellipse(540, 300, 440, 210, 0, Math.PI, Math.PI * 1.72);
  context.stroke();
  context.fillStyle = SUN;
  context.beginPath();
  context.arc(740, 113, 26, 0, Math.PI * 2);
  context.fill();

  text(facts.brand, 80, 100, 600, 38, TEAL);
  text(t("heading", { name: facts.name }), 80, 330, 500, 58, INK);
  text(`${facts.kw} kW`, 80, 470, 600, 132, TEAL);
  text(t("systemLine"), 80, 530, 400, 36, MUTED);

  if (facts.before && facts.after) {
    context.fillStyle = TINT;
    context.beginPath();
    context.roundRect(80, 580, 920, 240, 28);
    context.fill();
    text(t("billToday"), 130, 650, 400, 34, MUTED);
    text(facts.before, 130, 730, 600, 66, INK);
    text(t("billWithSolar"), 560, 650, 400, 34, MUTED);
    text(facts.after, 560, 730, 600, 66, TEAL);
    text(t("perMonth"), 130, 785, 400, 28, MUTED);
  }

  const rows: [string, string][] = [
    [t("cost"), facts.netCost],
    [t("payback"), facts.payback],
    [t("saving25"), facts.saving25],
  ];
  rows.forEach(([label, value], i) => {
    const y = 915 + i * 100;
    text(label, 80, y, 400, 38, MUTED);
    text(value, 1000, y, 600, 46, INK, "right");
    if (i < rows.length - 1) {
      context.fillStyle = "#e3e7e6";
      context.fillRect(80, y + 34, 920, 2);
    }
  });

  text(t("footer", { date: facts.date }), 80, 1275, 400, 28, MUTED);
}

export function FamilyCard({ facts }: { facts: CardFacts }) {
  const t = useTranslations("card");
  const canvas = useRef<HTMLCanvasElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function render() {
      const element = canvas.current;
      if (!element) return;
      const fontFamily = getComputedStyle(document.body).fontFamily;
      await Promise.all([500, 600].map((weight) => document.fonts.load(`${weight} 40px ${fontFamily}`, "सौर ₹")));
      if (cancelled) return;
      drawCard(element, facts, (key, values) => t(key as "heading", values as never), fontFamily);
      element.toBlob((blob) => {
        if (cancelled || !blob) return;
        const file = new File([blob], "solar-quote.png", { type: "image/png" });
        setUrl((old) => {
          if (old) URL.revokeObjectURL(old);
          return URL.createObjectURL(blob);
        });
        setCanShare(typeof navigator.canShare === "function" && navigator.canShare({ files: [file] }));
      }, "image/png");
    }
    render();
    return () => {
      cancelled = true;
    };
  }, [facts, t]);

  async function share() {
    if (!url) return;
    const blob = await fetch(url).then((r) => r.blob());
    const file = new File([blob], "solar-quote.png", { type: "image/png" });
    await navigator.share({ files: [file], text: t("shareText", { link: facts.link }) }).catch(() => undefined);
  }

  const whatsapp = `https://wa.me/?text=${encodeURIComponent(t("shareText", { link: facts.link }))}`;

  return (
    <section className="mt-12 border-t pt-8" aria-labelledby="family-heading">
      <h2 id="family-heading" className="text-lg font-medium">{t("title")}</h2>
      <p className="mt-1 leading-relaxed text-muted-foreground">{t("lead")}</p>
      <canvas ref={canvas} width={SIZE.width} height={SIZE.height} data-testid="family-card" aria-label={t("imageLabel")} role="img" className="mt-4 w-full max-w-sm rounded-xl border" />
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {url ? (
          <a href={url} download="solar-quote.png" data-testid="family-card-save" className={cn(buttonVariants({ variant: "outline" }))}>
            <Download aria-hidden />
            {t("save")}
          </a>
        ) : null}
        {canShare ? (
          <Button onClick={share}>
            <Share2 aria-hidden />
            {t("share")}
          </Button>
        ) : (
          <a href={whatsapp} target="_blank" rel="noreferrer" className={cn(buttonVariants())}>
            <Share2 aria-hidden />
            {t("shareLink")}
          </a>
        )}
      </div>
    </section>
  );
}
