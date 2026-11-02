"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { Map as LeafletMap, Polygon, Polyline, CircleMarker, LayerGroup } from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatNumber } from "@/domain/format";
import { isSimpleOutline, pincodeCentre, polygonAreaSqm, type LatLng } from "@/domain/geo";
import { SQM_PER_SQFT } from "@/lib/validation";

const TILES = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const MAX_ROOF_SQ_FT = 20000;
const ATTRIBUTION = "Imagery © Esri, Maxar, Earthstar Geographics. Search © OpenStreetMap contributors";

interface Props {
  pincode: string;
  onDone: (outline: LatLng[], areaSqFt: number) => void;
  onCancel: () => void;
}

/** The homeowner taps the corners of their roof on a satellite photo. The browser only draws: the server measures again. */
export function RoofMap({ pincode, onDone, onCancel }: Props) {
  const t = useTranslations("roofMap");
  const holder = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const layers = useRef<{ shape: Polygon | Polyline | null; dots: LayerGroup | null; circle: typeof CircleMarker | null }>({ shape: null, dots: null, circle: null });
  const leaflet = useRef<typeof import("leaflet") | null>(null);
  const [points, setPoints] = useState<LatLng[]>([]);
  const [query, setQuery] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !holder.current || map.current) return;
      leaflet.current = L;
      const centre = pincodeCentre(pincode);
      const created = L.map(holder.current, { center: [centre.lat, centre.lng], zoom: 16, maxZoom: 20, doubleClickZoom: false });
      L.tileLayer(TILES, { maxNativeZoom: 19, maxZoom: 20, attribution: ATTRIBUTION }).addTo(created);
      created.on("click", (event) => setPoints((p) => (p.length >= 40 ? p : [...p, { lat: event.latlng.lat, lng: event.latlng.lng }])));
      layers.current.dots = L.layerGroup().addTo(created);
      map.current = created;
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, [pincode]);

  useEffect(() => {
    const L = leaflet.current;
    if (!L || !map.current || !layers.current.dots) return;
    layers.current.shape?.remove();
    layers.current.dots.clearLayers();
    const path = points.map((p): [number, number] => [p.lat, p.lng]);
    const style = { color: "#ffd166", weight: 3, fillColor: "#ffd166", fillOpacity: 0.28 };
    layers.current.shape = points.length >= 3 ? L.polygon(path, style).addTo(map.current) : points.length === 2 ? L.polyline(path, style).addTo(map.current) : null;
    for (const point of path) {
      L.circleMarker(point, { radius: 5, color: "#ffffff", weight: 2, fillColor: "#0b5c58", fillOpacity: 1 }).addTo(layers.current.dots);
    }
  }, [points]);

  async function search() {
    if (!query.trim()) return;
    setSearching(true);
    setNotFound(false);
    try {
      const params = new URLSearchParams({ format: "jsonv2", limit: "1", countrycodes: "in", q: `${query}, ${pincode}` });
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`);
      const [hit] = (await response.json()) as { lat: string; lon: string }[];
      if (hit) map.current?.setView([Number(hit.lat), Number(hit.lon)], 19);
      else setNotFound(true);
    } catch {
      setNotFound(true);
    }
    setSearching(false);
  }

  function locate() {
    navigator.geolocation?.getCurrentPosition(
      (position) => map.current?.setView([position.coords.latitude, position.coords.longitude], 19),
      () => setNotFound(true),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  const simple = points.length < 4 || isSimpleOutline(points);
  const sqFt = Math.round(polygonAreaSqm(points) / SQM_PER_SQFT);
  const tooBig = sqFt > MAX_ROOF_SQ_FT;
  const ready = points.length >= 3 && simple && sqFt >= 50 && !tooBig;

  return (
    <div className="grid gap-3 rounded-xl border p-3" data-testid="roof-map">
      {/* Not a form: this sits inside the lead form, and Enter here must not submit that. */}
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            search();
          }}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
        />
        <Button type="button" variant="outline" disabled={searching} onClick={search}>{t("search")}</Button>
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm leading-relaxed text-muted-foreground">{t("tapCorners")}</p>
        <Button type="button" variant="ghost" size="sm" onClick={locate}>{t("locate")}</Button>
      </div>
      {notFound ? <p role="alert" className="text-sm text-destructive">{t("notFound")}</p> : null}
      <div ref={holder} data-testid="roof-map-canvas" className="z-0 h-80 w-full touch-none overflow-hidden rounded-lg bg-muted" />
      <p aria-live="polite" className="tabular text-[0.9375rem] font-medium" data-testid="roof-map-area">
        {!simple ? t("crossed") : tooBig ? t("tooBig") : points.length < 3 ? t("cornersSoFar", { count: points.length }) : t("area", { area: formatNumber(sqFt) })}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={!ready} onClick={() => onDone(points, sqFt)}>{t("use")}</Button>
        <Button type="button" variant="outline" disabled={points.length === 0} onClick={() => setPoints(points.slice(0, -1))}>{t("undo")}</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>{t("cancel")}</Button>
      </div>
    </div>
  );
}
