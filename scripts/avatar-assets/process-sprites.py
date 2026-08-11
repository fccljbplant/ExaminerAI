#!/usr/bin/env python3
"""
scripts/avatar-assets/process-sprites.py
Processes raw AI-generated character poses into transparent WebP sprite sheets.

For each pose:
  1. Open the raw PNG (864x1152, white background)
  2. Remove the white background + any shadow/haze → transparent
  3. Crop tightly to the character bounding box (trim transparent borders)
  4. Resize to 360x450 (target sprite frame size), centered
  5. Save as a single-frame WebP with alpha transparency

The shadow under the avatar is NOT baked into the sprite — it's rendered
as a CSS ellipse in the TutorAvatar component (ta-shadow class). This keeps
the sprite clean + allows the shadow to animate independently.
"""

import os
import json
from pathlib import Path
from PIL import Image

# Configuration
RAW_DIR = Path(__file__).parent / "raw"
OUT_DIR = Path(__file__).parent.parent.parent / "public" / "avatars"
TARGET_W = 360
TARGET_H = 450

# All 18 pose → sprite sheet mappings (matches TutorAvatar SHEETS keys)
POSE_MAP = {
    "idle":      "idle.webp",
    "listen":    "listen.webp",
    "think":     "think.webp",
    "explain":   "explain.webp",
    "talk":      "talk.webp",
    "talk-soft": "talk-soft.webp",
    "talk-mid":  "talk-mid.webp",
    "talk-wide": "talk-wide.webp",
    "wavehi":    "wavehi.webp",
    "wavebye":   "wavebye.webp",
    "thumbsup":  "thumbsup.webp",
    "cheer":     "cheer.webp",
    "fistpump":  "fistpump.webp",
    "comfort":   "comfort.webp",
    "point":     "point.webp",
    "question":  "question.webp",
    "write":     "write.webp",
    "jump":      "jump.webp",
}


def remove_background(img: Image.Image) -> Image.Image:
    """Remove white background + grey shadow haze → transparent.

    The AI-generated images have:
      1. Pure white background (RGB > 240 on all channels)
      2. Anti-aliased edges (light grey pixels around the character)
      3. Sometimes a soft contact shadow under the character (dark grey)

    Strategy:
      - Pure white → transparent
      - Light grey (bright + low saturation) → transparent (anti-alias + haze)
      - Dark grey shadow pixels (dark + low saturation, NOT part of character) → transparent
      - Colored pixels (character) → opaque
    """
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
        # Light grey anti-alias / haze (bright + low saturation) → transparent
        elif brightness >= 130 and saturation < 0.12:
            # Gradient: brighter = more transparent
            if brightness >= 200:
                new_data.append((r, g, b, 0))
            else:
                alpha = int(255 * (200 - brightness) / 70)
                new_data.append((r, g, b, max(0, alpha)))
        # Dark grey contact shadow (dark + very low saturation, not character clothing)
        # Character clothing is sage green (saturation > 0.2), grey trousers (saturation ~0.05)
        # but trousers are mid-grey (brightness ~100-150), shadow is darker (brightness < 80)
        elif brightness < 80 and saturation < 0.08:
            new_data.append((r, g, b, 0))
        else:
            # Character pixel → fully opaque
            new_data.append((r, g, b, 255))

    img.putdata(new_data)
    return img


def trim_to_content(img: Image.Image, padding: int = 6) -> Image.Image:
    """Crop tightly to the bounding box of non-transparent content."""
    if img.mode != "RGBA":
        img = img.convert("RGBA")
    alpha = img.getchannel("A")
    bbox = alpha.getbbox()
    if bbox is None:
        return img
    # Tight crop with small padding
    left = max(0, bbox[0] - padding)
    top = max(0, bbox[1] - padding)
    right = min(img.width, bbox[2] + padding)
    bottom = min(img.height, bbox[3] + padding)
    return img.crop((left, top, right, bottom))


def resize_to_frame(img: Image.Image) -> Image.Image:
    """Resize to fit within TARGET_W x TARGET_H, preserving aspect ratio.
    Center the character on a transparent canvas. The character should fill
    most of the frame vertically (leave a small margin at top + bottom for
    the CSS shadow ellipse below)."""
    if img.mode != "RGBA":
        img = img.convert("RGBA")
    # Scale to fit width (character is taller than wide in most poses)
    scale = min(TARGET_W / img.width, TARGET_H / img.height)
    new_w = int(img.width * scale)
    new_h = int(img.height * scale)
    resized = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
    # Center on transparent canvas, shifted up slightly to leave room for shadow
    canvas = Image.new("RGBA", (TARGET_W, TARGET_H), (0, 0, 0, 0))
    offset_x = (TARGET_W - new_w) // 2
    offset_y = max(0, (TARGET_H - new_h) // 2 - 10)  # shift up 10px for shadow room
    canvas.paste(resized, (offset_x, offset_y), resized)
    return canvas


def process_pose(raw_path: Path, out_path: Path) -> dict:
    """Process a single pose: remove bg, trim, resize, save as WebP."""
    print(f"  Processing: {raw_path.name}...")
    img = Image.open(raw_path)
    print(f"    Original: {img.size}")
    img = remove_background(img)
    img = trim_to_content(img, padding=6)
    print(f"    Trimmed: {img.size}")
    img = resize_to_frame(img)
    print(f"    Final: {img.size}")
    img.save(out_path, format="WEBP", quality=90, lossless=False, method=6)
    file_size = out_path.stat().st_size
    print(f"    Saved: {out_path.name} ({file_size / 1024:.1f} KB)")
    return {
        "name": out_path.stem,
        "file": out_path.name,
        "width": TARGET_W,
        "height": TARGET_H,
        "frames": 1,
        "sizeBytes": file_size,
    }


def main():
    print("=== Sprite Processing (all 18 poses, shadow-free) ===")
    print(f"Raw dir: {RAW_DIR}")
    print(f"Output dir: {OUT_DIR}")
    print(f"Target frame: {TARGET_W}x{TARGET_H}")
    print()
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    manifest = []
    success = 0
    failed = 0
    for pose_name, out_file in POSE_MAP.items():
        raw_file = f"{pose_name}.png"
        raw_path = RAW_DIR / raw_file
        out_path = OUT_DIR / out_file
        if not raw_path.exists():
            print(f"  ✗ Missing: {raw_file}")
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
            "format": "WebP with alpha transparency",
            "shadowStyle": "CSS ellipse (.ta-shadow) — NOT baked into sprite",
            "sheets": manifest,
        }, f, indent=2)
    print()
    print(f"=== Complete: {success} success, {failed} failed ===")
    print(f"Manifest: {manifest_path}")
    print(f"Total: {sum(e['sizeBytes'] for e in manifest) / 1024:.1f} KB")


if __name__ == "__main__":
    main()
