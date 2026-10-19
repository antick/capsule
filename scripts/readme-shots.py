#!/usr/bin/env python3
"""Frames the README's pictures from the snapshot renders.

Render first, then frame:

    taskpolicy -b swift test --filter readmeGallery
    taskpolicy -b swift test --filter readmeSettings
    python3 -I scripts/readme-shots.py

Reads `.build/snapshots`, writes `docs/images`. Needs Pillow.
"""

import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SNAPS = os.path.join(ROOT, ".build", "snapshots")
OUT = os.path.join(ROOT, "docs", "images")
FONT = "/System/Library/Fonts/SFNS.ttf"
ROUNDED = "/System/Library/Fonts/SFNSRounded.ttf"

# Wallpapers: four corner colours, blended smoothly.
DUSK = ("#1E1B4B", "#4C1D95", "#0F172A", "#9D174D")
DAWN = ("#FDE2E4", "#E0E7FF", "#FFF1E6", "#DBEAFE")
NIGHT = ("#0B1120", "#1E293B", "#111827", "#312E81")

THEMES = [
    ("midnight", "Midnight", NIGHT), ("graphite", "Graphite", ("#3F3F46", "#27272A", "#52525B", "#18181B")),
    ("ink", "Ink", ("#1E3A8A", "#0F172A", "#172554", "#312E81")), ("aurora", "Aurora", DUSK),
    ("porcelain", "Porcelain", DAWN), ("linen", "Linen", ("#FDF6E3", "#F5E6CC", "#FFF8EE", "#EAD7B7")),
    ("sage", "Sage", ("#ECFDF5", "#D1E7DD", "#F0FDF4", "#BFD8C6")),
    ("blush", "Blush", ("#FFE4E6", "#FCE7F3", "#FFF1F2", "#F5D0FE")),
]


def hex_rgb(value):
    value = value.lstrip("#")
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))


def wallpaper(size, corners):
    """A soft four-corner gradient: a 2x2 image scaled up smoothly."""
    seed = Image.new("RGB", (2, 2))
    for (x, y), colour in zip([(0, 0), (1, 0), (0, 1), (1, 1)], corners):
        seed.putpixel((x, y), hex_rgb(colour))
    big = seed.resize((4, 4), Image.BILINEAR).resize(size, Image.BICUBIC)
    return big.filter(ImageFilter.GaussianBlur(size[0] / 40)).convert("RGBA")


def load(name):
    path = os.path.join(SNAPS, name + ".png")
    if not os.path.exists(path):
        sys.exit(f"missing {path}: run the snapshot tests first")
    image = Image.open(path).convert("RGBA")
    return image.crop(image.getbbox())


def rounded(image, radius):
    mask = Image.new("L", image.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, image.width, image.height], radius, fill=255)
    image = image.copy()
    image.putalpha(mask)
    return image


def drop(canvas, image, at, blur=40, alpha=110):
    """Pastes a window with a soft shadow under it."""
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    silhouette = Image.new("RGBA", image.size, (0, 0, 0, alpha))
    silhouette.putalpha(image.getchannel("A").point(lambda a: min(a, alpha)))
    shadow.paste(silhouette, (at[0], at[1] + blur // 2), silhouette)
    canvas.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(blur)))
    canvas.alpha_composite(image, at)


def save(image, name, width):
    """Saved at twice the width it is shown at, clear around the panels so
    the picture sits on GitHub's light and dark pages alike."""
    height = round(image.height * width / image.width)
    image.resize((width, height), Image.LANCZOS).save(os.path.join(OUT, name), optimize=True)
    print("wrote", name)


def screens(left, right, corners, name, size=(1180, 1180), gap=40):
    """Two desktops side by side, each with its dock against the right edge
    of the screen, as it sits on a Mac."""
    canvas = Image.new("RGBA", (size[0] * 2 + gap, size[1]), (0, 0, 0, 0))
    for index, (dock, tint) in enumerate([(left, corners[0]), (right, corners[1])]):
        screen = wallpaper(size, tint)
        image = load(dock)
        screen.alpha_composite(image, (size[0] - image.width, (size[1] - image.height) // 2))
        canvas.alpha_composite(rounded(screen, 44), (index * (size[0] + gap), 0))
    save(canvas, name, 1800)


def hero():
    screens("readme-midnight-rings-open", "readme-porcelain-gauges-open", (DUSK, DAWN), "hero.png")


def themes():
    tile_w, tile_h, gap = 520, 560, 32
    canvas = Image.new("RGBA", (4 * tile_w + 3 * gap, 2 * tile_h + gap), (0, 0, 0, 0))
    label = ImageFont.truetype(ROUNDED, 34)
    for index, (key, name, corners) in enumerate(THEMES):
        col, row = index % 4, index // 4
        tile = wallpaper((tile_w, tile_h), corners)
        rings, gauges = load(f"readme-{key}-rings-closed"), load(f"readme-{key}-gauges-closed")
        top = (tile_h - 50 - rings.height) // 2
        tile.alpha_composite(rings, (tile_w // 2 - rings.width - 6, top))
        tile.alpha_composite(gauges, (tile_w // 2 + 6, top))
        dark = key in ("midnight", "graphite", "ink", "aurora")
        draw = ImageDraw.Draw(tile)
        draw.text((tile_w // 2, tile_h - 56), name, font=label, anchor="mm",
                  fill=(255, 255, 255, 235) if dark else (30, 30, 34, 235))
        canvas.alpha_composite(rounded(tile, 36), (col * (tile_w + gap), row * (tile_h + gap)))
    save(canvas, "themes.png", 1600)


def top_edge():
    dock = load("readme-top-midnight")
    screen = wallpaper((2400, dock.height + 140), DUSK)
    screen.alpha_composite(dock, ((screen.width - dock.width) // 2, 0))
    save(rounded(screen, 44), "top-edge.png", 1800)


# The settings page's content pane, in pixels of `readme-settings-*.png`:
# offscreen renders draw the sidebar blank, so it is left out.
PANE_LEFT = 470


def settings(appearance, top, bottom, corners, name):
    page = Image.open(os.path.join(SNAPS, f"readme-settings-{appearance}.png")).convert("RGBA")
    window = rounded(page.crop((PANE_LEFT, top, page.width, bottom)), 26)
    canvas = wallpaper((window.width + 240, window.height + 240), corners)
    drop(canvas, window, (120, 100))
    save(rounded(canvas, 44), name, 1600)


def logo():
    icon = Image.open(os.path.join(ROOT, "Support", "CapsuleApp", "Resources", "AppIcon.png")).convert("RGBA")
    icon.resize((256, 256), Image.LANCZOS).save(os.path.join(OUT, "logo.png"), optimize=True)
    print("wrote logo.png")


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    logo()
    hero()
    themes()
    top_edge()
    settings("dark", 0, 1200, DUSK, "settings-appearance.png")
    settings("light", 1240, 2760, DAWN, "settings-meters-themes.png")
