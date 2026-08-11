#!/usr/bin/env bash
# scripts/avatar-assets/generate-male-poses.sh
# Generates 18 consistent poses of a male mid-age bearded character.
#
# CRITICAL CONSISTENCY RULES:
# 1. Every pose uses the EXACT same character description (face, hair, beard,
#    eyes, skin, suit color, shoes) — only the body language changes.
# 2. Background is a SOLID flat bottle green (#00FF7F) — no gradient, no
#    variation, no lighting falloff. This makes chroma-key removal perfect.
# 3. Same body framing: head-to-toe, centered, same camera distance.
# 4. Professional Pixar/DreamWorks render quality.

set -e

RAW_DIR="$(dirname "$0")/raw"
mkdir -p "$RAW_DIR"

SIZE="864x1152"

# IDENTICAL character spec for every single pose
CHAR="Professional 3D animated character render in the style of Pixar and DreamWorks. The character is the EXACT SAME person in every image: a distinguished middle-aged man, exactly 45 years old, warm medium tan skin tone (same shade in every image), short neatly styled dark brown-black hair combed back with slight grey only at the temples, full neatly trimmed short beard dark brown-black color same as hair, warm brown eyes, thick modern rectangular black frame glasses, strong jawline, slight confident smile. He wears the EXACT SAME outfit in every image: a well-tailored dark charcoal grey black suit jacket (same color same shade), crisp clean white dress shirt buttoned at collar no tie, dark charcoal grey trousers matching the jacket, polished black leather dress shoes. Full body visible from top of head to bottom of shoes, standing perfectly centered in the exact middle of the frame, facing forward toward camera, same camera angle and same camera distance in every single image like a character model turnaround sheet. The background is a completely flat solid uniform bright bottle green color hex 00FF7F with absolutely NO gradient NO lighting variation NO shadows NO highlights NO vignette just one solid flat green color filling the entire background. Flat even front-facing studio lighting with NO drop shadow NO contact shadow NO ground shadow the character appears to float in front of the solid green background. Ultra high quality professional 3D animation studio render, smooth subsurface scattering, clean topology, photorealistic fabric textures, 8K detail. The character must look identical across all poses — same face same hair same beard same eyes same skin tone same suit color same body proportions."

generate() {
  local name="$1"
  local action="$2"
  local outfile="$RAW_DIR/$name.png"

  if [ -f "$outfile" ]; then
    echo "  ✓ $name exists, skipping"
    return 0
  fi

  echo -n "  $name... "
  if z-ai image -p "$CHAR. ONLY THIS POSE CHANGES: $action. Everything else about the character and background stays exactly identical." -o "$outfile" -s "$SIZE" 2>&1 | grep -q "completed\|saved"; then
    echo "✓"
  else
    echo "✗ FAILED"
  fi
  sleep 2
}

echo "=== Male Avatar: 18 poses, strict consistency ==="
echo "Character: SAME man, SAME face, SAME suit, SAME body size in every pose"
echo "Background: solid flat #00FF7F bottle green (NO gradient)"
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
