import { describe, expect, it } from "vitest";
import { isSimpleOutline, outlineCentre, pincodeCentre, polygonAreaSqm, roofOutlineSchema } from "./geo";

// A rectangle in Nagpur, 20 m by 15 m. One degree of latitude is 111,195 m at this Earth radius.
const LAT = 21.1458;
const LNG = 79.0882;
const dLat = 15 / 111_195;
const dLng = 20 / (111_195 * Math.cos((LAT * Math.PI) / 180));
const roof = [
  { lat: LAT, lng: LNG },
  { lat: LAT, lng: LNG + dLng },
  { lat: LAT + dLat, lng: LNG + dLng },
  { lat: LAT + dLat, lng: LNG },
];

describe("polygonAreaSqm", () => {
  it("measures a known rectangle to within 0.1%", () => {
    expect(polygonAreaSqm(roof)).toBeCloseTo(300, 0);
  });

  it("does not depend on which way round the corners were tapped", () => {
    expect(polygonAreaSqm([...roof].reverse())).toBeCloseTo(polygonAreaSqm(roof), 6);
  });

  it("is zero until there are three corners", () => {
    expect(polygonAreaSqm(roof.slice(0, 2))).toBe(0);
  });
});

describe("isSimpleOutline", () => {
  it("accepts a normal roof", () => {
    expect(isSimpleOutline(roof)).toBe(true);
  });

  it("refuses an outline that crosses itself", () => {
    expect(isSimpleOutline([roof[0], roof[2], roof[1], roof[3]])).toBe(false);
  });
});

describe("roofOutlineSchema", () => {
  it("accepts a roof in India", () => {
    expect(roofOutlineSchema.safeParse(roof).success).toBe(true);
  });

  it("refuses a point outside India", () => {
    expect(roofOutlineSchema.safeParse([...roof, { lat: 51, lng: 0 }]).success).toBe(false);
  });

  it("refuses too few corners", () => {
    expect(roofOutlineSchema.safeParse(roof.slice(0, 2)).success).toBe(false);
  });
});

describe("map helpers", () => {
  it("finds the middle of an outline", () => {
    expect(outlineCentre(roof).lat).toBeCloseTo(LAT + dLat / 2, 8);
  });

  it("opens near the pincode's town, or on Nagpur", () => {
    expect(pincodeCentre("444601").lat).toBeCloseTo(20.9374);
    expect(pincodeCentre("411001").lat).toBeCloseTo(21.1458);
  });
});
