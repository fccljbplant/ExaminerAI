#!/usr/bin/env python3
"""
scripts/avatar-assets/process-sprites.py
Processes raw AI-generated character poses into transparent WebP sprite sheets.

Background: bright bottle green (#00A86B) — used as a chroma key for clean
background removal. This is far more reliable than white-background removal
because the green color is distinct from any natural skin/clothing color.

For each pose:
  1. Open the raw PNG (864x1152, bottle green background)
  2. Chroma-key: remove all green-dominant pixels → transparent
  3. Trim to character bounding box
  4. Normalize: scale all characters to the SAME height (consistent body size)
  5. Center horizontally on a 360x450 transparent canvas
  6. Save as WebP with alpha
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

# Target character height — all poses scaled to this for consistent body size
TARGET_CHAR_HEIGHT = 410
TARGET_CHAR_WIDTH = 280


def remove_green_background(img: Image.Image) -> Image.Image:
    """Chroma-key removal: remove bottle green (#00A86B) background.

    The AI doesn't always generate pure bottle green — it can be dark teal,
    bright green, or anywhere in between. We use a multi-criteria approach:

    A pixel is "background" if ANY of these are true:
      1. Green is strongly dominant (g - max(r,b) > 15) — pure green screen
      2. Green is mildly dominant (g - max(r,b) > 3) AND the pixel is dark
         (brightness < 200) — catches dark teal variants
      3. The pixel is in the green hue range (g > r AND g > b) with low
         saturation on red+blue — catches washed-out green

    Anti-aliased edges get gradient alpha.
    """
    img = img.convert("RGBA")
    data = img.getdata()
    new_data = []

    for r, g, b, a in data:
        green_dominance = g - max(r, b)
        brightness = (r + g + b) / 3

        is_bg = False
        alpha = 255

        # Criterion 1: Strong green dominance → definitely background
        if green_dominance > 15:
            is_bg = True
            if green_dominance > 40:
                alpha = 0
            else:
                alpha = int(255 * (1 - green_dominance / 40))
        # Criterion 2: Mild green dominance + dark pixel (dark teal bg)
        elif green_dominance > 3 and brightness < 200:
            is_bg = True
            if green_dominance > 10:
                alpha = 0
            else:
                alpha = int(255 * (1 - green_dominance / 10))
        # Criterion 3: Green is the max channel + low red (washed green)
        elif g > r and g >= b and r < 100 and brightness < 220:
            is_bg = True
            alpha = int(255 * max(0, (r - 50) / 50))

        if is_bg:
            new_data.append((r, g, b, max(0, alpha)))
        else:
            new_data.append((r, g, b, 255))

    img.putdata(new_data)
    return img


def trim_to_content(img: Image.Image, padding: int = 4) -> Image.Image:
    """Crop tightly to the bounding box of non-transparent content."""
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
    """Scale the character to a FIXED height so all poses are the same size.

    1. Scale so character height = TARGET_CHAR_HEIGHT (410px)
    2. If too wide, scale down to fit TARGET_CHAR_WIDTH (280px)
    3. Center on transparent canvas, shifted up 10px for shadow room
    """
    if img.mode != "RGBA":
        img = img.convert("RGBA")

    # Scale to target height
    scale_h = TARGET_CHAR_HEIGHT / img.height
    new_w = int(img.width * scale_h)
    new_h = TARGET_CHAR_HEIGHT

    # If too wide, scale down further
    if new_w > TARGET_CHAR_WIDTH:
        scale_w = TARGET_CHAR_WIDTH / new_w
        new_w = int(new_w * scale_w)
        new_h = int(new_h * scale_w)

    resized = img.resize((new_w, new_h), Image.Resampling.LANCZOS)

    # Center on transparent canvas
    canvas = Image.new("RGBA", (TARGET_W, TARGET_H), (0, 0, 0, 0))
    offset_x = (TARGET_W - new_w) // 2
    offset_y = max(0, (TARGET_H - new_h) // 2 - 10)
    canvas.paste(resized, (offset_x, offset_y), resized)
    return canvas


def process_pose(raw_path: Path, out_path: Path) -> dict:
    """Process a single pose."""
    print(f"  {raw_path.name}...", end=" ")
    img = Image.open(raw_path)
    original_size = img.size
    img = remove_green_background(img)
    img = trim_to_content(img, padding=4)
    trimmed_size = img.size
    img = normalize_to_frame(img)

    # Verify: count opaque pixels
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
    print(f"Background removal: bottle green #00A86B chroma key")
    print(f"Target frame: {TARGET_W}x{TARGET_H}")
    print(f"Target character height: {TARGET_CHAR_HEIGHT}px (normalized)")
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

    # Write manifest
    manifest_path = OUT_DIR / "manifest.json"
    with open(manifest_path, "w") as f:
        json.dump({
            "character": "TraineesAI Tutor — 3D Pixar-style middle-aged man with beard and glasses",
            "style": "Baked-3D sprite strips (pre-rendered 3D, played as 2D)",
            "frameSize": {"width": TARGET_W, "height": TARGET_H},
            "normalizedCharHeight": TARGET_CHAR_HEIGHT,
            "backgroundRemoval": "Chroma key — bottle green #00A86B",
            "format": "WebP with alpha transparency",
            "shadowStyle": "CSS ellipse (.ta-shadow) — NOT baked into sprite",
            "sheets": manifest,
        }, f, indent=2)

    opaque_pcts = [e["opaquePercent"] for e in manifest]
    print()
    print(f"=== Complete: {success} success, {failed} failed ===")
    print(f"Opaque %: min={min(opaque_pcts)} max={max(opaque_pcts)} avg={sum(opaque_pcts)//len(opaque_pcts)}")
    print(f"Total: {sum(e['sizeBytes'] for e in manifest) / 1024:.1f} KB")


if __name__ == "__main__":
    main()
