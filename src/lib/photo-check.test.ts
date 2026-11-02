import { describe, expect, it } from "vitest";
import { assessPhoto, photoStats } from "./photo-check";

function image(width: number, height: number, shade: (x: number, y: number) => number) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const value = shade(x, y);
      data.set([value, value, value, 255], (y * width + x) * 4);
    }
  }
  return data;
}

describe("photoStats", () => {
  it("sees crisp print as sharp", () => {
    const print = image(64, 64, (x, y) => (x % 4 === 0 && y % 4 === 0 ? 10 : 240));
    expect(photoStats(print, 64, 64).sharpness).toBeGreaterThan(500);
  });

  it("sees a smooth wash as not sharp", () => {
    const wash = image(64, 64, (x) => 120 + x / 8);
    expect(photoStats(wash, 64, 64).sharpness).toBeLessThan(1);
  });

  it("measures brightness", () => {
    expect(photoStats(image(8, 8, () => 40), 8, 8).brightness).toBeCloseTo(40, 0);
  });
});

describe("assessPhoto", () => {
  const size = { width: 1200, height: 1600 };

  it("passes a good photo", () => {
    expect(assessPhoto({ brightness: 170, sharpness: 400 }, size)).toEqual([]);
  });

  it("flags dark, blurry and small together", () => {
    expect(assessPhoto({ brightness: 40, sharpness: 12 }, { width: 400, height: 500 })).toEqual(["small", "dark", "blurry"]);
  });
});
