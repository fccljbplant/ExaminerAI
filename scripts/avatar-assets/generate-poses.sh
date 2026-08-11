#!/usr/bin/env bash
# scripts/avatar-assets/generate-poses.sh
# Generates 11 key poses for the tutor avatar using the z-ai CLI.
# Each pose is a 3D Pixar-style character on white background.

set -e

RAW_DIR="$(dirname "$0")/raw"
mkdir -p "$RAW_DIR"

SIZE="864x1152"

# Shared style prefix for character consistency
STYLE="3D Pixar-style character render, friendly female teacher in her 30s, brown hair in a low bun, round black glasses, sage green cardigan over white tee, grey trousers, brown loafers, soft warm studio lighting, plain pure white background, full body shot, centered, professional 3D animation render quality, smooth subsurface scattering, clean topology look, high quality, detailed"

generate() {
  local name="$1"
  local action="$2"
  local outfile="$RAW_DIR/$name.png"

  if [ -f "$outfile" ]; then
    echo "  ✓ $name already exists, skipping"
    return 0
  fi

  echo "  Generating: $name..."
  if z-ai image -p "$STYLE. $action" -o "$outfile" -s "$SIZE" 2>&1 | grep -q "saved\|Image saved\|✓"; then
    echo "  ✓ $name saved"
  elif [ -f "$outfile" ]; then
    echo "  ✓ $name saved"
  else
    echo "  ✗ $name failed"
    return 1
  fi
  return 0
}

echo "=== Tutor Avatar Asset Generation ==="
echo "Output: $RAW_DIR"
echo "Size: $SIZE"
echo ""

generate "idle"      "She is standing relaxed facing forward, arms at her sides, gentle warm smile, eyes open and looking at viewer, slight head tilt, calm friendly pose"
generate "talk-soft" "She is standing facing forward, mouth slightly open as if speaking softly, one hand raised at chest height with palm up in a gentle gesture, warm expression, mid-conversation pose"
generate "talk-mid"  "She is standing facing forward, mouth moderately open as if speaking with emphasis, one hand raised at shoulder height gesturing, eyebrows slightly raised, engaged teaching expression"
generate "talk-wide" "She is standing facing forward, mouth wide open in animated speech, both hands raised at shoulder height gesturing expressively, big smile, energetic enthusiastic expression"
generate "wavehi"    "She is waving hello with her right hand raised high at head height, palm facing forward, big warm smile, welcoming greeting pose, left hand at her side"
generate "point"     "She is pointing to her right with her right arm extended, index finger pointing, left hand on hip, looking in the direction she points, teaching gesture, focused expression"
generate "thumbsup"  "She is giving a thumbs up with her right hand, fist closed thumb extended upward at chest height, left hand at her side, big encouraging smile, celebratory pose"
generate "think"     "She is thinking with her right hand on her chin, elbow resting on her left arm, looking up and to the side with a thoughtful expression, eyebrows furrowed slightly, contemplative pose"
generate "cheer"     "She is cheering with both arms raised high above her head, fists clenched in celebration, big joyful smile, excited triumphant expression, energetic victory pose"
generate "comfort"   "She is in a comforting pose with both hands extended forward palms up in a gentle open gesture, warm empathetic smile, head slightly tilted, reassuring supportive expression"
generate "wavebye"   "She is waving goodbye with her right hand raised at shoulder height, palm facing forward waving, warm farewell smile, left hand at her side, parting gesture"

echo ""
echo "=== Generation complete ==="
echo "Files in $RAW_DIR:"
ls -1 "$RAW_DIR"/*.png 2>/dev/null | wc -l
echo "images generated"
