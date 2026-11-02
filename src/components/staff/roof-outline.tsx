"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import { outlineCentre, type LatLng } from "@/domain/geo";

const TILES = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

/** The roof the homeowner marked, so the surveyor sees it before the visit. */
export function RoofOutline({ outline }: { outline: LatLng[] }) {
  const holder = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let remove: (() => void) | undefined;
    import("leaflet").then((L) => {
      if (cancelled || !holder.current) return;
      const centre = outlineCentre(outline);
      const map = L.map(holder.current, { center: [centre.lat, centre.lng], zoom: 19, maxZoom: 20, scrollWheelZoom: false });
      L.tileLayer(TILES, { maxNativeZoom: 19, maxZoom: 20, attribution: "Imagery © Esri, Maxar, Earthstar Geographics" }).addTo(map);
      const shape = L.polygon(outline.map((p): [number, number] => [p.lat, p.lng]), { color: "#ffd166", weight: 3, fillOpacity: 0.25 }).addTo(map);
      map.fitBounds(shape.getBounds(), { padding: [30, 30], maxZoom: 20 });
      remove = () => map.remove();
    });
    return () => {
      cancelled = true;
      remove?.();
    };
  }, [outline]);

  return <div ref={holder} data-testid="roof-outline" className="z-0 h-56 w-full overflow-hidden rounded-lg bg-muted" />;
}
