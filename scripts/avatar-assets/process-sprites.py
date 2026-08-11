#!/usr/bin/env python3
"""
scripts/avatar-assets/process-sprites.py
Processes raw AI-generated character poses into transparent WebP sprite sheets.

Background: solid bottle green (chroma key) — removed via green-dominance check.
Normalization: all characters scaled to the SAME height + centered for smooth
motion transitions between gestures.
"""

import os
import json
from pathlib import Path
from PIL import Image

RAW_DIR = Path(__file__).parent / "raw"
OUT_DIR = Path(__file__).parent.parent.parent / "public" / "avatars"
TARGET_W = 360
TARGET_H = 450

POSE_MAP = {
    "idle": "idle.webp", "listen": "listen.webp", "think": "think.webp",
    "explain": "explain.webp", "talk": "talk.webp", "talk-soft": "talk-soft.webp",
    "talk-mid": "talk-mid.webp", "talk-wide": "talk-wide.webp",
    "wavehi": "wavehi.webp", "wavebye": "wavebye.webp",
    "thumbsup": "thumbsup.webp", "cheer": "cheer.webp", "fistpump": "fistpump.webp",
    "comfort": "comfort.webp", "point": "point.webp", "question": "question.webp",
    "write": "write.webp", "jump": "jump.webp",
}

# All characters scaled to this height for consistent body size
TARGET_CHAR_HEIGHT = 410
TARGET_CHAR_WIDTH = 280


def remove_green_background(img: Image.Image) -> Image.Image:
    """Chroma-key: remove solid green background → transparent.

    A pixel is "background" if green is the dominant channel by a margin.
    The AI generates slightly different green shades per image, so we use
    a generous threshold + gradient alpha at edges for smooth anti-aliasing.
    """
    img = img.convert("RGBA")
    data = img.getdata()
    new_data = []

    for r, g, b, a in data:
        green_dominance = g - max(r, b)

        if green_dominance > 10:
            # Green screen pixel → transparent
            if green_dominance > 35:
                new_data.append((r, g, b, 0))
            else:
                # Edge anti-alias — smooth gradient
                alpha = int(255 * (1 - green_dominance / 35))
                new_data.append((r, g, b, max(0, alpha)))
        else:
            # Character pixel → fully opaque
            new_data.append((r, g, b, 255))

    img.putdata(new_data)
    return img


def trim_to_content(img: Image.Image, padding: int = 4) -> Image.Image:
    """Crop tightly to the character bounding box."""
    if img.mode != "RGBA":
        img = img.convert("RGBA")
    alpha = img.getchannel("A")
    bbox = alpha.getbbox()
    if bbox is None:
        return img
    left = max(0, bbox[0] - padding)
    top = max(0, bbox[1] - padding)
    right = min(img.width, bbox[2] + padding)
    bottom = min(img.height, bbox[3] + padding)
    return img.crop((left, top, right, bottom))


def normalize_to_frame(img: Image.Image) -> Image.Image:
    """Scale character to FIXED height so all poses are the same body size.

    1. Scale so height = TARGET_CHAR_HEIGHT (410px)
    2. If too wide, scale down to fit TARGET_CHAR_WIDTH (280px)
    3. Center on 360x450 transparent canvas, shifted up 10px for shadow
    """
    if img.mode != "RGBA":
        img = img.convert("RGBA")

    scale_h = TARGET_CHAR_HEIGHT / img.height
    new_w = int(img.width * scale_h)
    new_h = TARGET_CHAR_HEIGHT

    if new_w > TARGET_CHAR_WIDTH:
        scale_w = TARGET_CHAR_WIDTH / new_w
        new_w = int(new_w * scale_w)
        new_h = int(new_h * scale_w)

    resized = img.resize((new_w, new_h), Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (TARGET_W, TARGET_H), (0, 0, 0, 0))
    offset_x = (TARGET_W - new_w) // 2
    offset_y = max(0, (TARGET_H - new_h) // 2 - 10)
    canvas.paste(resized, (offset_x, offset_y), resized)
    return canvas


def process_pose(raw_path: Path, out_path: Path) -> dict:
    """Process a single pose: chroma key → trim → normalize → save."""
    print(f"  {raw_path.name}...", end=" ")
    img = Image.open(raw_path)
    original_size = img.size
    img = remove_green_background(img)
    img = trim_to_content(img, padding=4)
    trimmed_size = img.size
    img = normalize_to_frame(img)

    alpha = img.getchannel("A")
    opaque = sum(1 for a in alpha.getdata() if a > 200)
    pct = opaque * 100 // (TARGET_W * TARGET_H)

    img.save(out_path, format="WEBP", quality=92, lossless=False, method=6)
    file_size = out_path.stat().st_size
    print(f"{original_size[0]}x{original_size[1]} → {trimmed_size[0]}x{trimmed_size[1]} → {TARGET_W}x{TARGET_H} ({pct}% opaque, {file_size//1024}KB)")

    return {
        "name": out_path.stem,
        "file": out_path.name,
        "width": TARGET_W,
        "height": TARGET_H,
        "frames": 1,
        "opaquePercent": pct,
        "sizeBytes": file_size,
    }


def main():
    print("=== Sprite Processing (18 poses, chroma-key green → transparent) ===")
    print(f"Target frame: {TARGET_W}x{TARGET_H}, char height: {TARGET_CHAR_HEIGHT}px")
    print()
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    manifest = []
    success = 0
    failed = 0
    for pose_name, out_file in POSE_MAP.items():
        raw_path = RAW_DIR / f"{pose_name}.png"
        out_path = OUT_DIR / out_file
        if not raw_path.exists():
            print(f"  ✗ Missing: {pose_name}.png")
            failed += 1
            continue
        try:
            entry = process_pose(raw_path, out_path)
            manifest.append(entry)
            success += 1
        except Exception as e:
            print(f"  ✗ Failed {pose_name}: {e}")
            failed += 1

    manifest_path = OUT_DIR / "manifest.json"
    with open(manifest_path, "w") as f:
        json.dump({
            "character": "TraineesAI Tutor — middle-aged man, beard, glasses, dark suit",
            "style": "Baked-3D sprite strips (Pixar/DreamWorks style)",
            "frameSize": {"width": TARGET_W, "height": TARGET_H},
            "normalizedCharHeight": TARGET_CHAR_HEIGHT,
            "backgroundRemoval": "Chroma key — solid bottle green",
            "format": "WebP with alpha transparency",
            "shadowStyle": "CSS ellipse (.ta-shadow)",
            "sheets": manifest,
        }, f, indent=2)

    opaque_pcts = [e["opaquePercent"] for e in manifest]
    print()
    print(f"=== Complete: {success} success, {failed} failed ===")
    print(f"Opaque %: min={min(opaque_pcts)} max={max(opaque_pcts)} avg={sum(opaque_pcts)//len(opaque_pcts)}")
    print(f"Total: {sum(e['sizeBytes'] for e in manifest) / 1024:.1f} KB")


if __name__ == "__main__":
    main()
