// scripts/avatar-assets/generate-poses.ts
// Generates the 11 key poses for the tutor avatar character.
// Character: 3D Pixar-style friendly female teacher, brown low bun hair,
// round glasses, sage green cardigan, white tee, grey trousers, brown loafers.
// Soft lighting, plain white background (will be made transparent in post-processing).

import ZAI from "z-ai-web-dev-sdk";
import fs from "fs";
import path from "path";

const OUTPUT_DIR = path.join(__dirname, "raw");
const SIZE = "864x1152"; // Portrait, closest to 360x450 (4:5 ratio)

const STYLE = `3D Pixar-style character render, friendly female teacher in her 30s,
brown hair in a low bun, round black glasses, sage green cardigan over white tee,
grey trousers, brown loafers, soft warm studio lighting, plain pure white background,
full body shot, centered, professional 3D animation render quality, smooth subsurface scattering,
clean topology look, high quality, detailed`;

interface Pose { name: string; prompt: string; }

const POSES: Pose[] = [
  {
    name: "idle",
    prompt: `${STYLE}. She is standing relaxed facing forward, arms at her sides, gentle warm smile, eyes open and looking at viewer, slight head tilt, calm friendly pose`,
  },
  {
    name: "talk-soft",
    prompt: `${STYLE}. She is standing facing forward, mouth slightly open as if speaking softly, one hand raised at chest height with palm up in a gentle gesture, warm expression, mid-conversation pose`,
  },
  {
    name: "talk-mid",
    prompt: `${STYLE}. She is standing facing forward, mouth moderately open as if speaking with emphasis, one hand raised at shoulder height gesturing, eyebrows slightly raised, engaged teaching expression`,
  },
  {
    name: "talk-wide",
    prompt: `${STYLE}. She is standing facing forward, mouth wide open in animated speech, both hands raised at shoulder height gesturing expressively, big smile, energetic enthusiastic expression`,
  },
  {
    name: "wavehi",
    prompt: `${STYLE}. She is waving hello with her right hand raised high at head height, palm facing forward, big warm smile, welcoming greeting pose, left hand at her side`,
  },
  {
    name: "point",
    prompt: `${STYLE}. She is pointing to her right with her right arm extended, index finger pointing, left hand on hip, looking in the direction she points, teaching gesture, focused expression`,
  },
  {
    name: "thumbsup",
    prompt: `${STYLE}. She is giving a thumbs up with her right hand, fist closed thumb extended upward at chest height, left hand at her side, big encouraging smile, celebratory pose`,
  },
  {
    name: "think",
    prompt: `${STYLE}. She is thinking with her right hand on her chin, elbow resting on her left arm, looking up and to the side with a thoughtful expression, eyebrows furrowed slightly, contemplative pose`,
  },
  {
    name: "cheer",
    prompt: `${STYLE}. She is cheering with both arms raised high above her head, fists clenched in celebration, big joyful smile, excited triumphant expression, energetic victory pose`,
  },
  {
    name: "comfort",
    prompt: `${STYLE}. She is in a comforting pose with both hands extended forward palms up in a gentle open gesture, warm empathetic smile, head slightly tilted, reassuring supportive expression`,
  },
  {
    name: "wavebye",
    prompt: `${STYLE}. She is waving goodbye with her right hand raised at shoulder height, palm facing forward waving, warm farewell smile, left hand at her side, parting gesture`,
  },
];

async function generatePose(zai: any, pose: Pose): Promise<boolean> {
  const outputPath = path.join(OUTPUT_DIR, `${pose.name}.png`);
  if (fs.existsSync(outputPath)) {
    console.log(`  ✓ ${pose.name} already exists, skipping`);
    return true;
  }
  try {
    console.log(`  Generating: ${pose.name}...`);
    const response = await zai.images.generations.create({
      prompt: pose.prompt,
      size: SIZE as any,
    });
    const imageBase64 = response.data[0].base64;
    const buffer = Buffer.from(imageBase64, "base64");
    fs.writeFileSync(outputPath, buffer);
    console.log(`  ✓ ${pose.name} saved (${(buffer.length / 1024).toFixed(1)} KB)`);
    return true;
  } catch (err) {
    console.error(`  ✗ ${pose.name} failed:`, err instanceof Error ? err.message : String(err));
    return false;
  }
}

async function main() {
  console.log("=== Tutor Avatar Asset Generation ===");
  console.log(`Output: ${OUTPUT_DIR}`);
  console.log(`Size: ${SIZE}`);
  console.log(`Poses: ${POSES.length}`);
  console.log("");
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const zai = await ZAI.create();
  let success = 0, failed = 0;
  for (const pose of POSES) {
    const ok = await generatePose(zai, pose);
    if (ok) success++; else failed++;
  }
  console.log("");
  console.log(`=== Complete: ${success} success, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
