"""Builds eval/bills from public MSEDCL bill PDFs that have been rendered to PNG with pdftoppm.

The PDFs must never enter the repo: MSEDCL's masks cover the page image, but the real customer's
name and address are still in the PDF's text layer. Only flattened, redacted pixels are kept.

Usage: python scripts/bills/redact.py <folder with rendered pages> eval/bills
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

# Each box is (left, top, right, bottom) as fractions of the page.
BILLS = {
    "lt-residential-2022": [
        ("lt22-1.png", [(0.05, 0.195, 0.70, 0.255), (0.05, 0.27, 0.68, 0.365), (0.79, 0.27, 0.95, 0.37),
                        (0.05, 0.835, 0.56, 0.945), (0.16, 0.135, 0.40, 0.19), (0.18, 0.79, 0.55, 0.835)]),
        ("lt22-2.png", [(0.60, 0.08, 0.96, 0.105)]),
    ],
    "lt-residential-2026-marathi": [
        ("lt26-1.png", [(0.0, 0.03, 0.30, 0.08), (0.0, 0.072, 0.72, 0.135), (0.0, 0.195, 0.44, 0.295),
                        (0.75, 0.205, 0.96, 0.34), (0.0, 0.835, 0.60, 1.0)]),
        ("lt26-2.png", [(0.56, 0.0, 1.0, 0.018)]),
    ],
    "lt-solar-2026-08": [
        ("sol08-1.png", [(0.0, 0.085, 0.56, 0.238), (0.82, 0.085, 1.0, 0.1), (0.0, 0.24, 0.36, 0.277),
                         (0.44, 0.258, 0.66, 0.277), (0.76, 0.24, 1.0, 0.258), (0.0, 0.308, 0.60, 0.326),
                         (0.0, 0.342, 0.36, 0.358), (0.0, 0.378, 0.36, 0.414), (0.0, 0.645, 0.80, 0.68), (0.56, 0.362, 0.80, 0.38)]),
        ("sol08-2.png", [(0.56, 0.0, 1.0, 0.03)]),
    ],
    "lt-solar-2026-10": [
        ("sol10-1.png", [(0.0, 0.09, 0.56, 0.235), (0.82, 0.08, 1.0, 0.098), (0.0, 0.243, 0.36, 0.277),
                         (0.42, 0.243, 0.62, 0.277), (0.76, 0.243, 1.0, 0.262), (0.0, 0.31, 1.0, 0.33),
                         (0.0, 0.34, 0.36, 0.368), (0.0, 0.395, 0.36, 0.42), (0.0, 0.655, 0.80, 0.676)]),
        ("sol10-2.png", [(0.56, 0.0, 1.0, 0.03)]),
    ],
    "institution-solar-scan-2023": [
        ("kb-1.png", [(0.08, 0.125, 0.40, 0.205), (0.08, 0.21, 0.46, 0.262), (0.84, 0.1, 0.98, 0.13),
                      (0.5, 0.335, 0.72, 0.36), (0.1, 0.6, 0.6, 0.622), (0.17, 0.285, 0.25, 0.302), (0.42, 0.28, 0.52, 0.296)]),
    ],
}


def redact(path, boxes):
    page = Image.open(path).convert("RGB")
    draw = ImageDraw.Draw(page)
    width, height = page.size
    for left, top, right, bottom in boxes:
        draw.rectangle((left * width, top * height, right * width, bottom * height), fill=(40, 40, 40))
    return page


def stack(pages):
    canvas = Image.new("RGB", (max(p.width for p in pages), sum(p.height for p in pages)), "white")
    y = 0
    for page in pages:
        canvas.paste(page, (0, y))
        y += page.height
    return canvas


def phone_photo(page):
    """A simulated phone snapshot of a printed bill: rotated, softened and compressed."""
    tilted = page.convert("RGB").rotate(-3.5, resample=Image.BICUBIC, expand=True, fillcolor=(112, 104, 96))
    small = tilted.resize((int(tilted.width * 0.72), int(tilted.height * 0.72)), Image.LANCZOS)
    return small.filter(ImageFilter.GaussianBlur(0.6))


def main(source, target):
    source, target = Path(source), Path(target)
    target.mkdir(parents=True, exist_ok=True)
    for name, pages in BILLS.items():
        image = stack([redact(source / file, boxes) for file, boxes in pages])
        image.save(target / f"{name}.jpg", quality=82, optimize=True)
        if name in ("lt-residential-2026-marathi", "lt-solar-2026-08"):
            phone_photo(image).save(target / f"{name}-phone.jpg", quality=62, optimize=True)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
