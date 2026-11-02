import { z } from "zod";

export interface LatLng {
  lat: number;
  lng: number;
}

const point = z.object({ lat: z.number().min(6).max(38), lng: z.number().min(68).max(98) });

/** A roof outline as tapped on the map. Bounds are India, so a bad value cannot reach the database. */
export const roofOutlineSchema = z.array(point).min(3).max(40);

const EARTH_RADIUS_M = 6_371_008.8;
const radians = (degrees: number) => (degrees * Math.PI) / 180;

function toMetres(points: LatLng[]) {
  const originLat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
  const originLng = points.reduce((sum, p) => sum + p.lng, 0) / points.length;
  const cosLat = Math.cos(radians(originLat));
  return points.map((p) => ({
    x: radians(p.lng - originLng) * EARTH_RADIUS_M * cosLat,
    y: radians(p.lat - originLat) * EARTH_RADIUS_M,
  }));
}

/** Plan area of a roof. At house scale a flat local projection is accurate to well under 1%. */
export function polygonAreaSqm(points: LatLng[]) {
  if (points.length < 3) return 0;
  const metres = toMetres(points);
  let twice = 0;
  metres.forEach((a, i) => {
    const b = metres[(i + 1) % metres.length];
    twice += a.x * b.y - b.x * a.y;
  });
  return Math.abs(twice) / 2;
}

const crosses = (a: { x: number; y: number }, b: typeof a, c: typeof a, d: typeof a) => {
  const side = (p: typeof a, q: typeof a, r: typeof a) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
};

/** False when the outline crosses itself, which would give a wrong area. */
export function isSimpleOutline(points: LatLng[]) {
  const metres = toMetres(points);
  const count = metres.length;
  for (let i = 0; i < count; i++) {
    for (let j = i + 2; j < count; j++) {
      if (i === 0 && j === count - 1) continue;
      if (crosses(metres[i], metres[i + 1], metres[j], metres[(j + 1) % count])) return false;
    }
  }
  return true;
}

export function outlineCentre(points: LatLng[]): LatLng {
  return {
    lat: points.reduce((sum, p) => sum + p.lat, 0) / points.length,
    lng: points.reduce((sum, p) => sum + p.lng, 0) / points.length,
  };
}

// Where the map opens, by the first three digits of the pincode. The default is Nagpur.
const PINCODE_CENTRES: Record<string, LatLng> = {
  "440": { lat: 21.1458, lng: 79.0882 },
  "441": { lat: 21.1667, lng: 79.65 },
  "442": { lat: 20.7453, lng: 78.6022 },
  "443": { lat: 20.5293, lng: 76.1842 },
  "444": { lat: 20.9374, lng: 77.7796 },
  "445": { lat: 20.3888, lng: 78.1204 },
};

export const pincodeCentre = (pincode: string): LatLng => PINCODE_CENTRES[pincode.slice(0, 3)] ?? PINCODE_CENTRES["440"];
