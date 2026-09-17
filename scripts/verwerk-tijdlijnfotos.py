#!/usr/bin/env python3
"""Maakt tijdlijnfoto's consistent: center-crop naar 4:3 + kleurcorrectie
(warmte/contrast/verzadiging) zodat koele/grijze foto's dichter bij de
warme oranje/gele OG-merkkleur komen.

Vereist alleen Pillow (pip install Pillow), verder geen dependencies.

Gebruik:
    python3 verwerk-tijdlijnfotos.py <invoermap> <uitvoermap>
    python3 verwerk-tijdlijnfotos.py <invoermap> <uitvoermap> --warmte 10 --contrast 8 --verzadiging 10

Origineel wordt nooit aangepast: alle output gaat naar <uitvoermap>
(wordt aangemaakt als die nog niet bestaat), met dezelfde bestandsnamen
als de invoer.
"""

import argparse
import sys
from pathlib import Path

from PIL import Image, ImageEnhance

ONDERSTEUNDE_EXTENSIES = {".jpg", ".jpeg", ".png", ".webp"}
DOEL_RATIO = 4 / 3


def center_crop_4_3(img: Image.Image) -> Image.Image:
    """Center-cropt naar exact 4:3, ongeacht of het origineel breder of
    hoger is dan die verhouding — de kortste as blijft heel, de langste
    as wordt in het midden bijgeknipt."""
    breedte, hoogte = img.size
    huidige_ratio = breedte / hoogte

    if huidige_ratio > DOEL_RATIO:
        nieuwe_breedte = round(hoogte * DOEL_RATIO)
        links = (breedte - nieuwe_breedte) // 2
        box = (links, 0, links + nieuwe_breedte, hoogte)
    else:
        nieuwe_hoogte = round(breedte / DOEL_RATIO)
        boven = (hoogte - nieuwe_hoogte) // 2
        box = (0, boven, breedte, boven + nieuwe_hoogte)

    return img.crop(box)


def pas_warmte_toe(img: Image.Image, warmte: float) -> Image.Image:
    """Verschuift de kleurbalans richting warm (rood/geel omhoog, blauw
    omlaag) of koud (omgekeerd bij een negatieve waarde). warmte=10
    betekent een zichtbare maar niet overdreven verschuiving; werkt via
    Image.point() per kleurband, dus geen numpy nodig.
    """
    if warmte == 0:
        return img

    offset = warmte * 1.2  # 10 -> ±12 op een 0-255-schaal, bewust gematigd
    heeft_alpha = img.mode == "RGBA"
    banden = img.split()
    r, g, b = banden[0], banden[1], banden[2]

    r = r.point(lambda p: max(0, min(255, round(p + offset))))
    b = b.point(lambda p: max(0, min(255, round(p - offset))))

    nieuwe_banden = [r, g, b]
    if heeft_alpha:
        nieuwe_banden.append(banden[3])
    return Image.merge(img.mode, nieuwe_banden)


def verwerk_afbeelding(img: Image.Image, warmte: float, contrast: float, verzadiging: float) -> Image.Image:
    img = center_crop_4_3(img)
    img = pas_warmte_toe(img, warmte)
    img = ImageEnhance.Color(img).enhance(1 + verzadiging / 100)
    img = ImageEnhance.Contrast(img).enhance(1 + contrast / 100)
    return img


def main():
    parser = argparse.ArgumentParser(description="Tijdlijnfoto's center-croppen naar 4:3 en consistent kleurcorrigeren.")
    parser.add_argument("invoermap", type=Path, help="Map met de originele foto's")
    parser.add_argument("uitvoermap", type=Path, help="Map waar de verwerkte foto's naartoe geschreven worden")
    parser.add_argument("--warmte", type=float, default=10, help="Warmte-verschuiving, standaard 10")
    parser.add_argument("--contrast", type=float, default=8, help="Contrast-verhoging in %%, standaard 8")
    parser.add_argument("--verzadiging", type=float, default=10, help="Verzadiging-verhoging in %%, standaard 10")
    args = parser.parse_args()

    if not args.invoermap.is_dir():
        sys.exit(f"Invoermap bestaat niet: {args.invoermap}")

    args.uitvoermap.mkdir(parents=True, exist_ok=True)

    bestanden = sorted(
        p for p in args.invoermap.iterdir()
        if p.is_file() and p.suffix.lower() in ONDERSTEUNDE_EXTENSIES
    )
    if not bestanden:
        sys.exit(f"Geen afbeeldingen gevonden in {args.invoermap} (ondersteund: {', '.join(sorted(ONDERSTEUNDE_EXTENSIES))})")

    for pad in bestanden:
        with Image.open(pad) as img:
            img = img.convert("RGBA") if img.mode in ("RGBA", "LA", "P") and img.mode != "RGB" else img.convert("RGB")
            resultaat = verwerk_afbeelding(img, args.warmte, args.contrast, args.verzadiging)

            uitvoerpad = args.uitvoermap / pad.name
            opslaan_kwargs = {}
            if pad.suffix.lower() in (".jpg", ".jpeg"):
                if resultaat.mode == "RGBA":
                    resultaat = resultaat.convert("RGB")
                opslaan_kwargs = {"quality": 92}
            elif pad.suffix.lower() == ".webp":
                opslaan_kwargs = {"quality": 92}

            resultaat.save(uitvoerpad, **opslaan_kwargs)
            print(f"{pad.name} -> {uitvoerpad}")

    print(f"\nKlaar: {len(bestanden)} foto's verwerkt naar {args.uitvoermap}")


if __name__ == "__main__":
    main()
