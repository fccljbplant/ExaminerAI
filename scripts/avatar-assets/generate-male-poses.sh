#!/usr/bin/env bash
# scripts/avatar-assets/generate-male-poses.sh
# Generates 18 consistent poses of a male mid-age bearded character.
# Background: bright bottle green (#00A86B) for easy chroma-key removal.
# Outfit: dark grey/black suit, white shirt, nice style.
# Same body size + framing for smooth motion transitions.

set -e

RAW_DIR="$(dirname "$0")/raw"
mkdir -p "$RAW_DIR"

SIZE="864x1152"

# EXACT same character spec for every pose — ensures consistency
CHAR="3D Pixar-style character render of a distinguished middle-aged man, approximately 45 years old, neat trimmed grey beard, short dark hair with slight grey at temples, wearing modern thin-frame glasses, wearing a well-fitted dark charcoal grey suit jacket over a crisp white dress shirt (no tie), dark grey trousers, black dress shoes. Professional dignified appearance, warm friendly expression. Full body visible from head to toe, standing perfectly centered in frame, facing forward, same camera angle and distance for every pose (like a character model sheet). Flat even studio lighting from front, bright solid bottle green background color #00A86B (chroma key green for easy background removal), absolutely NO shadow on ground NO drop shadow NO contact shadow, character appears to float, clean professional 3D Pixar animation render quality, smooth subsurface scattering, high detail, consistent character design across all poses"

generate() {
  local name="$1"
  local action="$2"
  local outfile="$RAW_DIR/$name.png"

  if [ -f "$outfile" ]; then
    echo "  ✓ $name exists, skipping"
    return 0
  fi

  echo -n "  $name... "
  if z-ai image -p "$CHAR. POSE: $action" -o "$outfile" -s "$SIZE" 2>&1 | grep -q "completed\|saved"; then
    echo "✓"
  else
    echo "✗ FAILED"
  fi
  sleep 2
}

echo "=== Male Avatar: 18 consistent poses ==="
echo "Character: middle-aged man, grey beard, glasses, dark grey suit, white shirt"
echo "Background: bottle green #00A86B (chroma key)"
echo ""

generate "idle"      "standing still, arms relaxed at sides, gentle closed-mouth smile, looking at camera, neutral pose"
generate "talk"      "mouth open mid-speech, one hand raised to chest height palm-up, conversational gesture, warm expression"
generate "talk-soft" "mouth slightly open speaking softly, both hands resting at waist height, calm gentle expression, subtle smile"
generate "talk-mid"  "mouth moderately open speaking with emphasis, right hand raised to shoulder height gesturing, eyebrows slightly raised, engaged expression"
generate "talk-wide" "mouth wide open animated speech, both hands raised to shoulder height gesturing expressively, big smile, enthusiastic"
generate "wavehi"    "waving hello with right hand raised above head height palm forward, big warm smile, welcoming pose"
generate "wavebye"   "waving goodbye with right hand raised to shoulder height palm forward, warm farewell smile"
generate "point"     "pointing right with right arm extended at shoulder height index finger out, left hand on hip, looking right, focused teaching gesture"
generate "explain"   "both hands open palms-up at waist height gesturing as if explaining a concept, mouth open mid-speech, engaged teaching expression"
generate "question"  "right hand raised with index finger pointing up, head tilted slightly, eyebrows raised, mouth slightly open, curious questioning expression"
generate "write"     "holding a small notebook in left hand and pen in right hand writing, looking down at notebook, focused expression"
generate "thumbsup"  "right hand giving thumbs up at chest height, fist closed thumb up, big encouraging smile, celebratory"
generate "cheer"     "both arms raised high above head fists clenched, big joyful smile, triumphant celebration pose"
generate "fistpump"  "right fist pumped at shoulder height arm bent, big triumphant smile, motivational celebration"
generate "comfort"   "both hands extended forward palms up at waist height, warm empathetic smile, head slightly tilted, reassuring pose"
generate "think"     "right hand on chin, elbow resting on left arm crossed at waist, looking up and to the side, thoughtful expression eyebrows furrowed"
generate "listen"    "hands clasped together at waist height, head tilted slightly, gentle smile, leaning in attentively listening"
generate "jump"      "both feet off ground mid-jump, arms raised upward, big joyful smile, energetic celebration"

echo ""
echo "=== Done. Files: $(ls -1 $RAW_DIR/*.png 2>/dev/null | wc -l) ==="
