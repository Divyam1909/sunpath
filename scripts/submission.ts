/**
 * Builds TDD.pdf from docs/TDD.md, then submission.zip containing exactly TDD.pdf and deployment.md.
 * Run: pnpm submission
 */
import { createWriteStream, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import { ZipArchive } from "archiver";
import { marked } from "marked";

const MAX_BYTES = 25 * 1024 * 1024;

const css = `
@page { size: A4; margin: 18mm 17mm; }
body { font: 10.5pt/1.55 "Segoe UI", Arial, sans-serif; color: #17201f; }
h1 { font-size: 24pt; font-weight: 600; margin: 0 0 8pt; }
h2 { font-size: 15pt; font-weight: 600; margin: 22pt 0 6pt; break-after: avoid; }
h3 { font-size: 12pt; font-weight: 600; margin: 14pt 0 4pt; break-after: avoid; }
a { color: #0b5c58; }
table { border-collapse: collapse; width: 100%; margin: 8pt 0 12pt; font-size: 9pt; line-height: 1.4; }
th { text-align: left; font-weight: 600; border-bottom: 1px solid #17201f; padding: 4pt 6pt 4pt 0; }
td { border-bottom: 1px solid #e3e7e6; padding: 4pt 6pt 4pt 0; vertical-align: top; }
tr { break-inside: avoid; }
p:has(+ ul), p:has(+ table) { break-after: avoid; }
code { font: 9pt Consolas, monospace; background: #f3f5f5; padding: 0 2pt; border-radius: 2pt; }
.mermaid { margin: 10pt 0; text-align: center; break-inside: avoid; }
.mermaid svg { max-width: 100%; height: auto; max-height: 235mm; }
img { border: 1px solid #e3e7e6; border-radius: 4pt; margin: 4pt 6pt 6pt 0; vertical-align: top; }
`;

function tddMarkdown() {
  const tdd = readFileSync("docs/TDD.md", "utf8");
  const assumptions = readFileSync("docs/ASSUMPTIONS.md", "utf8").replace(/^# Assumptions\n+/, "");
  return tdd.replace("<!-- ASSUMPTIONS -->", assumptions);
}

async function buildTddPdf() {
  const markdown = tddMarkdown().replace(/!\[([^\]]*)\]\(([^)]+)\)\{width=(\d+)\}/g, '<img src="$2" alt="$1" width="$3">');
  const body = await marked.parse(markdown);
  const withDiagrams = body.replace(
    /<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g,
    (_, code: string) => `<pre class="mermaid">${code}</pre>`,
  );
  // Sits in docs/ so the relative screenshot paths resolve.
  const htmlPath = path.resolve("docs/.tdd.html");
  writeFileSync(htmlPath, `<!doctype html><html lang="en"><meta charset="utf-8"><title>Sunpath TDD</title><style>${css}</style><body>${withDiagrams}</body></html>`);

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(pathToFileURL(htmlPath).href);
  await page.addScriptTag({ path: "node_modules/mermaid/dist/mermaid.min.js" });
  await page.evaluate(async () => {
    const { mermaid } = window as unknown as { mermaid: { initialize(c: object): void; run(): Promise<void> } };
    mermaid.initialize({ startOnLoad: false, theme: "neutral", securityLevel: "loose" });
    await mermaid.run();
  });
  const failures = await page.locator(".mermaid:not(:has(svg))").count();
  if (failures > 0) throw new Error(`${failures} Mermaid diagrams did not render`);
  await page.pdf({
    path: "TDD.pdf",
    format: "A4",
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: "<span></span>",
    footerTemplate: `<div style="font-size:8px;width:100%;text-align:center;color:#5b6866"><span class="pageNumber"></span></div>`,
    margin: { top: "18mm", bottom: "18mm", left: "17mm", right: "17mm" },
  });
  await browser.close();
  rmSync(htmlPath);
}

function zip() {
  return new Promise<void>((resolve, reject) => {
    const output = createWriteStream("submission.zip");
    const archive = new ZipArchive({ zlib: { level: 9 } });
    output.on("close", () => resolve());
    archive.on("error", reject);
    archive.pipe(output);
    archive.file("TDD.pdf", { name: "TDD.pdf" });
    archive.file("deployment.md", { name: "deployment.md" });
    archive.finalize();
  });
}

async function main() {
  await buildTddPdf();
  await zip();
  const size = statSync("submission.zip").size;
  const megabytes = (size / 1024 / 1024).toFixed(2);
  if (size > MAX_BYTES) throw new Error(`submission.zip is ${megabytes} MB, over the 25 MB limit`);
  console.log(`submission.zip is ${megabytes} MB, under the 25 MB limit. It contains TDD.pdf and deployment.md.`);
}

main();
