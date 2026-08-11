#!/usr/bin/env python3
"""
scripts/avatar-assets/process-sprites.py
Processes raw AI-generated character poses into transparent WebP sprite sheets.

For each pose:
  1. Open the raw PNG (864x1152, white background)
  2. Remove white background + grey haze + shadows → transparent
  3. Trim to character bounding box
  4. Normalize: scale all characters to the SAME height (so they're consistent)
  5. Center horizontally on a 360x450 transparent canvas
  6. Save as WebP with alpha

The normalization step is critical — without it, the AI generates the character
at slightly different scales per pose, causing the avatar to "jump size" when
switching gestures.
"""

import os
import json
from pathlib import Path
from PIL import Image

RAW_DIR = Path(__file__).parent / "raw"
OUT_DIR = Path(__file__).parent.parent.parent / "public" / "avatars"
TARGET_W = 360
TARGET_H = 450

# All 18 poses
POSE_MAP = {
    "idle": "idle.webp", "listen": "listen.webp", "think": "think.webp",
    "explain": "explain.webp", "talk": "talk.webp", "talk-soft": "talk-soft.webp",
    "talk-mid": "talk-mid.webp", "talk-wide": "talk-wide.webp",
    "wavehi": "wavehi.webp", "wavebye": "wavebye.webp",
    "thumbsup": "thumbsup.webp", "cheer": "cheer.webp", "fistpump": "fistpump.webp",
    "comfort": "comfort.webp", "point": "point.webp", "question": "question.webp",
    "write": "write.webp", "jump": "jump.webp",
}

# Target character height in the final 450px frame (leaves 20px margin top+bottom)
# All poses are scaled so the character's opaque content fills this height.
# This eliminates the "different sizes" problem.
TARGET_CHAR_HEIGHT = 410
TARGET_CHAR_WIDTH = 280  # max width before scaling down


def remove_background(img: Image.Image) -> Image.Image:
    """Remove white background + grey haze + shadows → transparent."""
    img = img.convert("RGBA")
    data = img.getdata()
    new_data = []

    for r, g, b, a in data:
        max_c = max(r, g, b)
        min_c = min(r, g, b)
        brightness = (r + g + b) / 3
        saturation = (max_c - min_c) / max_c if max_c > 0 else 0

        # Pure white background → transparent
        if min_c >= 225:
            new_data.append((r, g, b, 0))
        # Light grey haze (bright + low saturation) → transparent
        elif brightness >= 130 and saturation < 0.12:
            if brightness >= 200:
                new_data.append((r, g, b, 0))
            else:
                alpha = int(255 * (200 - brightness) / 70)
                new_data.append((r, g, b, max(0, alpha)))
        # Dark grey contact shadow → transparent
        elif brightness < 80 and saturation < 0.08:
            new_data.append((r, g, b, 0))
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

    1. Scale so the character height = TARGET_CHAR_HEIGHT (410px)
    2. If the character is wider than TARGET_CHAR_WIDTH (280px) after scaling,
       scale down further to fit the width.
    3. Center on a 360x450 transparent canvas, shifted up 10px for shadow room.
    """
    if img.mode != "RGBA":
        img = img.convert("RGBA")

    # Step 1: Scale to target height
    scale_h = TARGET_CHAR_HEIGHT / img.height
    new_w = int(img.width * scale_h)
    new_h = TARGET_CHAR_HEIGHT

    # Step 2: If too wide, scale down to fit width
    if new_w > TARGET_CHAR_WIDTH:
        scale_w = TARGET_CHAR_WIDTH / new_w
        new_w = int(new_w * scale_w)
        new_h = int(new_h * scale_w)

    resized = img.resize((new_w, new_h), Image.Resampling.LANCZOS)

    # Step 3: Center on transparent canvas
    canvas = Image.new("RGBA", (TARGET_W, TARGET_H), (0, 0, 0, 0))
    offset_x = (TARGET_W - new_w) // 2
    offset_y = max(0, (TARGET_H - new_h) // 2 - 10)  # shift up for shadow
    canvas.paste(resized, (offset_x, offset_y), resized)
    return canvas


def process_pose(raw_path: Path, out_path: Path) -> dict:
    """Process a single pose."""
    print(f"  {raw_path.name}...", end=" ")
    img = Image.open(raw_path)
    original_size = img.size
    img = remove_background(img)
    img = trim_to_content(img, padding=4)
    trimmed_size = img.size
    img = normalize_to_frame(img)

    # Verify: count opaque pixels for consistency check
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
    print("=== Sprite Processing (18 poses, normalized + shadow-free) ===")
    print(f"Target frame: {TARGET_W}x{TARGET_H}")
    print(f"Target character height: {TARGET_CHAR_HEIGHT}px (normalized for consistency)")
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
            "character": "TraineesAI Tutor — 3D Pixar-style female teacher",
            "style": "Baked-3D sprite strips (pre-rendered 3D, played as 2D)",
            "frameSize": {"width": TARGET_W, "height": TARGET_H},
            "normalizedCharHeight": TARGET_CHAR_HEIGHT,
            "format": "WebP with alpha transparency",
            "shadowStyle": "CSS ellipse (.ta-shadow) — NOT baked into sprite",
            "sheets": manifest,
        }, f, indent=2)

    # Consistency report
    opaque_pcts = [e["opaquePercent"] for e in manifest]
    print()
    print(f"=== Complete: {success} success, {failed} failed ===")
    print(f"Opaque %: min={min(opaque_pcts)} max={max(opaque_pcts)} avg={sum(opaque_pcts)//len(opaque_pcts)}")
    print(f"Total: {sum(e['sizeBytes'] for e in manifest) / 1024:.1f} KB")


if __name__ == "__main__":
    main()
