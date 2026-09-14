#!/usr/bin/env python3
"""Extract approved badge artwork from supplied composite reference sheets."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


PROFICIENCY_CROPS = {
    "target": (205, 75, 530, 390),
    "arts": (655, 60, 950, 390),
    "bugler": (1080, 65, 1390, 385),
    "bandsman": (1515, 55, 1810, 390),
    "camping": (205, 405, 560, 725),
    "christian_education": (650, 395, 960, 725),
    "drill": (1080, 405, 1390, 725),
    "communication": (1490, 405, 1820, 725),
    "community_service": (1935, 405, 2280, 725),
    "computer_knowledge": (205, 725, 555, 1055),
    "crafts": (650, 725, 965, 1055),
    "drummer": (1490, 725, 1820, 1055),
    "environmental_conservation": (1930, 725, 2290, 1060),
    "expedition": (205, 1045, 550, 1390),
    "financial_stewardship": (650, 1045, 980, 1390),
    "fire_rescue": (1080, 1045, 1395, 1390),
    "first_aid": (1495, 1045, 1820, 1390),
    "gymnastics": (1935, 1045, 2280, 1390),
    "hobbies": (205, 1375, 545, 1710),
    "international_relations": (650, 1375, 965, 1710),
    "life_saving": (1490, 1375, 1820, 1710),
    "nature_awareness": (1930, 1375, 2290, 1710),
    "physical_training": (205, 1690, 555, 2055),
    "piper": (650, 1690, 965, 2055),
    "recruitment": (1080, 1690, 1395, 2055),
    "safety": (1490, 1690, 1820, 2055),
    "social_entrepreneurship": (1930, 1690, 2290, 2055),
    "sports": (425, 2060, 750, 2440),
    "sustainability": (845, 2060, 1160, 2440),
    "swimming": (1275, 2060, 1600, 2440),
    "water_adventure": (1690, 2060, 2040, 2440),
}

SPECIAL_CROPS = {
    "founders_award": (315, 10, 610, 335),
    "presidents_award": (340, 330, 590, 610),
    "scholastics_gold": (5, 600, 310, 900),
    "scholastics_silver": (305, 600, 610, 900),
    "scholastics_bronze": (615, 600, 915, 900),
    "long_year_service": (5, 880, 305, 1170),
    "nco_proficiency": (310, 875, 615, 1170),
    "three_year_service": (620, 875, 915, 1170),
    "duke_of_edinburgh_bronze": (20, 1140, 310, 1410),
    "one_year_service": (315, 1140, 610, 1410),
    "link_badge": (620, 1140, 915, 1410),
}


def remove_white_background(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = []
    for red, green, blue, alpha in rgba.getdata():
        whiteness = min(red, green, blue)
        if whiteness >= 248:
            alpha = 0
        elif whiteness > 225:
            alpha = min(alpha, int((248 - whiteness) / 23 * 255))
        pixels.append((red, green, blue, alpha))
    rgba.putdata(pixels)
    return rgba


def normalise_badge(image: Image.Image, remove_white: bool) -> Image.Image:
    badge = remove_white_background(image) if remove_white else image.convert("RGBA")
    alpha_box = badge.getchannel("A").getbbox()
    if alpha_box:
        badge = badge.crop(alpha_box)
    badge.thumbnail((440, 440), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    canvas.alpha_composite(badge, ((512 - badge.width) // 2, (512 - badge.height) // 2))
    return canvas


def extract(sheet: Path, crops: dict[str, tuple[int, int, int, int]], output: Path, remove_white: bool) -> None:
    source = Image.open(sheet)
    for key, bounds in crops.items():
        badge = normalise_badge(source.crop(bounds), remove_white)
        badge.save(output / f"{key}.webp", "WEBP", quality=92, method=6)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--proficiency-sheet", required=True, type=Path)
    parser.add_argument("--special-sheet", required=True, type=Path)
    parser.add_argument("--output", default=Path("public/award-badges"), type=Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    extract(args.proficiency_sheet, PROFICIENCY_CROPS, args.output, False)
    extract(args.special_sheet, SPECIAL_CROPS, args.output, True)


if __name__ == "__main__":
    main()
