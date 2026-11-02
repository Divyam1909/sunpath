export type PhotoIssue = "dark" | "blurry" | "small";

/** Below these the small print is usually lost. Set from real and phone-style bills that Gemini still read at 35 sharpness. */
const MIN_SHORT_EDGE = 450;
const DARK_BELOW = 70;
const BLURRY_BELOW = 20;

const luma = (data: Uint8ClampedArray, i: number) => 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

/** Average brightness, and how sharp the edges are (the variance of the Laplacian). */
export function photoStats(data: Uint8ClampedArray, width: number, height: number) {
  const grey = new Float32Array(width * height);
  let total = 0;
  for (let i = 0; i < grey.length; i++) {
    grey[i] = luma(data, i * 4);
    total += grey[i];
  }
  let sum = 0;
  let squares = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const at = y * width + x;
      const edge = 4 * grey[at] - grey[at - 1] - grey[at + 1] - grey[at - width] - grey[at + width];
      sum += edge;
      squares += edge * edge;
      count += 1;
    }
  }
  const mean = count > 0 ? sum / count : 0;
  return { brightness: total / Math.max(grey.length, 1), sharpness: count > 0 ? squares / count - mean * mean : 0 };
}

/** The problems worth a retake. It only ever advises: the homeowner can always send the photo anyway. */
export function assessPhoto(stats: { brightness: number; sharpness: number }, size: { width: number; height: number }): PhotoIssue[] {
  const issues: PhotoIssue[] = [];
  if (Math.min(size.width, size.height) < MIN_SHORT_EDGE) issues.push("small");
  if (stats.brightness < DARK_BELOW) issues.push("dark");
  if (stats.sharpness < BLURRY_BELOW) issues.push("blurry");
  return issues;
}
