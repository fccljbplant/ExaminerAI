#!/usr/bin/env bash
# scripts/avatar-assets/generate-poses.sh
# Generates 18 consistent poses for the tutor avatar.
#
# CRITICAL: Every pose uses the EXACT same character description to ensure
# the AI generates the same character (same face, same outfit, same scale).
# The only thing that changes between poses is the body language.

set -e

RAW_DIR="$(dirname "$0")/raw"
mkdir -p "$RAW_DIR"

SIZE="864x1152"

# Exact character spec — identical for every pose
CHAR="3D Pixar-style character: a friendly female teacher in her early 30s, light skin tone, brown hair in a neat low bun, round thin black glasses, wearing a sage green cardigan over a plain white tee, grey trousers, brown leather loafers. Full body visible from head to toe, standing perfectly centered in frame, facing forward, same camera angle and distance as a character reference sheet, flat studio lighting from front, completely plain pure white background #FFFFFF, absolutely NO ground shadow NO drop shadow NO contact shadow NO ambient occlusion shadow, character appears to float, clean Pixar render quality, smooth subsurface scattering, high detail, professional 3D animation still"

generate() {
  local name="$1"
  local action="$2"
  local outfile="$RAW_DIR/$name.png"

  if [ -f "$outfile" ]; then
    echo "  ✓ $name already exists, skipping"
    return 0
  fi

  echo -n "  $name... "
  z-ai image -p "$CHAR. In this pose: $action" -o "$outfile" -s "$SIZE" 2>&1 | grep -q "completed\|saved" && echo "✓" || echo "✗ FAILED"
  sleep 2
}

echo "=== Generating 18 consistent poses ==="
echo "Character: sage cardigan, white tee, grey trousers, brown loafers, low bun, round glasses"
echo ""

# Idle + talk loops
generate "idle"      "standing perfectly still, arms relaxed at sides, gentle closed-mouth smile, looking at camera, neutral breathing pose"
generate "talk"      "mouth open mid-speech, one hand raised to chest height palm-up, conversational gesture, warm expression"
generate "talk-soft" "mouth slightly open, speaking softly, both hands resting at waist height, calm gentle expression, subtle smile"
generate "talk-mid"  "mouth moderately open speaking with emphasis, right hand raised to shoulder height gesturing, eyebrows slightly raised, engaged expression"
generate "talk-wide" "mouth wide open animated speech, both hands raised to shoulder height gesturing expressively, big smile, enthusiastic"

# Greetings
generate "wavehi"    "waving hello with right hand raised above head height palm forward, big warm smile, welcoming pose"
generate "wavebye"   "waving goodbye with right hand raised to shoulder height palm forward, warm farewell smile"

# Teaching gestures
generate "point"     "pointing right with right arm extended at shoulder height index finger out, left hand on hip, looking right, focused teaching gesture"
generate "explain"   "both hands open palms-up at waist height gesturing as if explaining a concept, mouth open mid-speech, engaged teaching expression"
generate "question"  "right hand raised with index finger pointing up, head tilted slightly, eyebrows raised, mouth slightly open, curious questioning expression"
generate "write"     "holding a small notebook in left hand and pen in right hand writing, looking down at notebook, focused expression"

# Emotional reactions
generate "thumbsup"  "right hand giving thumbs up at chest height, fist closed thumb up, big encouraging smile, celebratory"
generate "cheer"     "both arms raised high above head fists clenched, big joyful smile, triumphant celebration pose"
generate "fistpump"  "right fist pumped at shoulder height arm bent, big triumphant smile, motivational celebration"
generate "comfort"   "both hands extended forward palms up at waist height, warm empathetic smile, head slightly tilted, reassuring pose"
generate "think"     "right hand on chin, elbow resting on left arm crossed at waist, looking up and to the side, thoughtful expression eyebrows furrowed"
generate "listen"    "hands clasped together at waist height, head tilted slightly, gentle smile, leaning in attentively listening"
generate "jump"      "both feet off ground mid-jump, arms raised upward, big joyful smile, energetic celebration"

echo ""
echo "=== Done. Files: $(ls -1 $RAW_DIR/*.png 2>/dev/null | wc -l) ==="
