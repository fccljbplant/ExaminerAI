#!/usr/bin/env python3
"""
scripts/avatar-assets/process-sprites.py
Processes raw AI-generated character poses into transparent WebP sprite sheets.

For each pose:
  1. Open the raw PNG (864x1152, white background)
  2. Remove the white background → make it transparent
  3. Crop to the character bounding box (trim transparent borders)
  4. Resize to 360x450 (target sprite frame size)
  5. Save as a single-frame WebP with alpha transparency

The sprite sheet format expected by TutorAvatar.tsx is a horizontal strip
of frames, each 360x450 pixels. For now, each pose is a single frame (1-frame
strip). The canvas player in TutorAvatar handles single-frame sheets correctly
(it just shows the one frame on loop).

Later, a 3D artist can replace these with true multi-frame animation strips
(8-16 frames per gesture) without changing the TutorAvatar code at all.
"""

import os
import sys
from pathlib import Path
from PIL import Image, ImageChops

# Configuration
RAW_DIR = Path(__file__).parent / "raw"
OUT_DIR = Path(__file__).parent.parent.parent / "public" / "avatars"
TARGET_W = 360
TARGET_H = 450
BG_THRESHOLD = 240  # Pixels brighter than this (on all channels) are considered background

# Pose name → sprite sheet name mapping (matches TutorAvatar SHEETS keys)
# We generate single-frame sheets for each pose.
# For talk loops, we could combine soft+mid+wide into a 3-frame strip,
# but the TutorAvatar code selects between them by amplitude, so they
# stay as separate single-frame sheets.
POSE_MAP = {
    "idle":      "idle.webp",
    "talk-soft": "talk-soft.webp",
    "talk-mid":  "talk-mid.webp",
    "talk-wide": "talk-wide.webp",
    "wavehi":    "wavehi.webp",
    "point":     "point.webp",
    "thumbsup":  "thumbsup.webp",
    "think":     "think.webp",
    "cheer":     "cheer.webp",
    "comfort":   "comfort.webp",
    "wavebye":   "wavebye.webp",
}


def remove_white_background(img: Image.Image) -> Image.Image:
    """Remove white/light-grey background pixels → transparent.

    The AI-generated images have a white background with a soft shadow
    that creates light grey pixels around the character. We need to remove
    both the pure white background AND the grey shadow halo.

    Strategy:
      1. Pixels that are near-white (all channels > 200) → transparent
      2. Pixels that are light grey (all channels > 150, low saturation) → transparent
      3. Anti-aliased edges → gradient alpha
    """
    img = img.convert("RGBA")
    data = img.getdata()
    new_data = []

    for r, g, b, a in data:
        # Calculate brightness and saturation
        max_c = max(r, g, b)
        min_c = min(r, g, b)
        brightness = (r + g + b) / 3
        saturation = (max_c - min_c) / max_c if max_c > 0 else 0

        # Pure white background → transparent
        if min_c >= 230:
            new_data.append((r, g, b, 0))
        # Light grey shadow halo (bright + low saturation) → transparent
        elif brightness >= 150 and saturation < 0.15:
            # Gradient: brighter = more transparent
            alpha = int(255 * max(0, (1 - (brightness - 150) / 80)))
            if alpha < 30:
                new_data.append((r, g, b, 0))
            else:
                new_data.append((r, g, b, alpha))
        # Anti-aliased edge of white background → partial transparency
        elif min_c >= 200 and saturation < 0.1:
            alpha = int(255 * (230 - min_c) / 30)
            new_data.append((r, g, b, alpha))
        else:
            # Character pixel → fully opaque
            new_data.append((r, g, b, 255))

    img.putdata(new_data)
    return img


def trim_to_content(img: Image.Image, padding: int = 12) -> tuple[Image.Image, int, int]:
    """Crop to the bounding box of non-transparent content.
    Returns (cropped_image, offset_x, offset_y).
    """
    # Get the alpha channel
    if img.mode != "RGBA":
        img = img.convert("RGBA")

    alpha = img.getchannel("A")
    bbox = alpha.getbbox()

    if bbox is None:
        # No content found — return the original
        return img, 0, 0

    # Add padding around the content
    left = max(0, bbox[0] - padding)
    top = max(0, bbox[1] - padding)
    right = min(img.width, bbox[2] + padding)
    bottom = min(img.height, bbox[3] + padding)

    cropped = img.crop((left, top, right, bottom))
    return cropped, left, top


def resize_to_frame(img: Image.Image) -> Image.Image:
    """Resize the image to fit within TARGET_W x TARGET_H, preserving aspect ratio.
    The character is centered on a transparent canvas of exactly TARGET_W x TARGET_H.
    """
    if img.mode != "RGBA":
        img = img.convert("RGBA")

    # Calculate scale to fit within the target frame
    scale = min(TARGET_W / img.width, TARGET_H / img.height)
    new_w = int(img.width * scale)
    new_h = int(img.height * scale)

    # Resize with high-quality LANCZOS resampling
    resized = img.resize((new_w, new_h), Image.Resampling.LANCZOS)

    # Create a transparent canvas and center the character
    canvas = Image.new("RGBA", (TARGET_W, TARGET_H), (0, 0, 0, 0))
    offset_x = (TARGET_W - new_w) // 2
    offset_y = (TARGET_H - new_h) // 2
    canvas.paste(resized, (offset_x, offset_y), resized)

    return canvas


def process_pose(raw_path: Path, out_path: Path) -> dict:
    """Process a single pose: remove bg, trim, resize, save as WebP."""
    print(f"  Processing: {raw_path.name}...")

    # Open the raw image
    img = Image.open(raw_path)
    print(f"    Original size: {img.size}")

    # Remove white background
    img = remove_white_background(img)

    # Trim to content
    img, _, _ = trim_to_content(img, padding=8)
    print(f"    Trimmed size: {img.size}")

    # Resize to target frame (360x450, centered, aspect-preserving)
    img = resize_to_frame(img)
    print(f"    Final size: {img.size}")

    # Save as WebP with transparency
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
    print("=== Sprite Processing ===")
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
            print(f"  ✗ Missing raw file: {raw_file}")
            failed += 1
            continue

        try:
            entry = process_pose(raw_path, out_path)
            manifest.append(entry)
            success += 1
        except Exception as e:
            print(f"  ✗ Failed to process {pose_name}: {e}")
            failed += 1

    # Write manifest.json
    manifest_path = OUT_DIR / "manifest.json"
    import json
    with open(manifest_path, "w") as f:
        json.dump({
            "character": "TraineesAI Tutor — 3D Pixar-style female teacher",
            "style": "Baked-3D sprite strips (pre-rendered 3D, played as 2D)",
            "frameSize": { "width": TARGET_W, "height": TARGET_H },
            "format": "WebP with alpha transparency",
            "sheets": manifest,
        }, f, indent=2)
    print()
    print(f"=== Complete: {success} success, {failed} failed ===")
    print(f"Manifest: {manifest_path}")
    print(f"Total size: {sum(e['sizeBytes'] for e in manifest) / 1024:.1f} KB")


if __name__ == "__main__":
    main()
