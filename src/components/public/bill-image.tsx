"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

const ZOOMS = [1, 1.6, 2.4, 3.2];

interface Props {
  src: string;
  alt: string;
  zoomInLabel: string;
  zoomOutLabel: string;
}

/** Scrollable zoom keeps pinch, drag and keyboard scrolling working without a viewer library. */
export function BillImage({ src, alt, zoomInLabel, zoomOutLabel }: Props) {
  const [level, setLevel] = useState(0);
  return (
    <figure className="grid gap-2">
      <div tabIndex={0} role="group" aria-label={alt} className="max-h-[60vh] overflow-auto rounded-lg border bg-muted lg:max-h-[75vh]">
        {/* Short-lived signed URL, so next/image optimisation and caching do not apply. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} style={{ width: `${ZOOMS[level] * 100}%`, maxWidth: "none" }} className="block" />
      </div>
      <div className="flex justify-end gap-1">
        <Button type="button" variant="outline" size="icon" aria-label={zoomOutLabel} disabled={level === 0} onClick={() => setLevel(level - 1)}>
          <Minus aria-hidden />
        </Button>
        <Button type="button" variant="outline" size="icon" aria-label={zoomInLabel} disabled={level === ZOOMS.length - 1} onClick={() => setLevel(level + 1)}>
          <Plus aria-hidden />
        </Button>
      </div>
    </figure>
  );
}
