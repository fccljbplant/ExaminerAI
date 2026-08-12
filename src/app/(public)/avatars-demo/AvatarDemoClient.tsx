"use client";

// src/app/(public)/avatars-demo/AvatarDemoClient.tsx — Living Portrait Tutor Badge demo.
// Shows the badge with all expression recipes + gesture triggers.

import { AvatarDock, tutor } from "@/components/learn/TutorBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const GESTURES: { name: string; gesture: string; description: string }[] = [
  { name: "Hello", gesture: "hello", description: "Session start greeting" },
  { name: "Talk", gesture: "talk", description: "TTS speaking (amplitude mouth)" },
  { name: "Listen", gesture: "listen", description: "Student speaking" },
  { name: "Think", gesture: "think", description: "Processing question" },
  { name: "Idea", gesture: "idea", description: "Slide highlight / aha moment" },
  { name: "Praise", gesture: "praise", description: "Correct answer" },
  { name: "Celebrate", gesture: "celebrate", description: "Badge / XP earned" },
  { name: "Comfort", gesture: "comfort", description: "Wrong answer — reassurance" },
  { name: "Oops", gesture: "oops", description: "Minor mistake" },
  { name: "Surprised", gesture: "surprised", description: "Unexpected result" },
  { name: "Wink", gesture: "wink", description: "Playful" },
  { name: "Determined", gesture: "determined", description: "Motivation" },
  { name: "Laugh", gesture: "laugh", description: "Joyful moment" },
  { name: "Focus", gesture: "focus", description: "Deep work mode" },
  { name: "Streak", gesture: "streak", description: "Streak milestone" },
  { name: "Level Up", gesture: "levelup", description: "Level raised" },
  { name: "Confused", gesture: "confused", description: "Needs clarification" },
  { name: "Proud", gesture: "proud", description: "Achievement" },
  { name: "Shy", gesture: "shy", description: "Timid" },
  { name: "Bye", gesture: "bye", description: "Session end" },
];

const MOOD_RINGS: { color: string; emotion: string }[] = [
  { color: "#22c55e", emotion: "Positive (hello, praise)" },
  { color: "#3b82f6", emotion: "Speaking (talk, comfort)" },
  { color: "#14b8a6", emotion: "Listening" },
  { color: "#f59e0b", emotion: "Thinking / Oops" },
  { color: "#fbbf24", emotion: "Celebration (gold)" },
  { color: "#ef4444", emotion: "Determined" },
  { color: "#8b5cf6", emotion: "Confused" },
  { color: "#f472b6", emotion: "Shy" },
];

export default function AvatarDemoClient() {
  return (
    <div className="space-y-6">
      {/* Intro */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-5 space-y-2">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
            Living Portrait Tutor Badge v1
          </div>
          <h1 className="text-xl font-bold">AI Tutor Avatar — One Face, Code-Driven Acting</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            ONE locked face photo + 100% code-driven animation. SVG overlays for brows, eyes,
            mouth. Emoji FX + CSS particles for celebrations. Mood ring colors for emotions.
            Amplitude-synced mouth while talking. Natural blinking. The face never changes —
            the code does the acting.
          </p>
        </CardContent>
      </Card>

      {/* Gesture triggers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Trigger Expressions (20 recipes)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Click any button to trigger that expression. The badge (bottom-right) will animate
            with SVG overlays, FX, mood ring, and motion. Each expression auto-returns to idle.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {GESTURES.map((g) => (
              <div key={g.gesture} className="space-y-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    if (g.gesture === "talk") {
                      tutor.say("This is how I look when I'm speaking to you.");
                    } else {
                      tutor.play(g.gesture);
                    }
                  }}
                >
                  {g.name}
                </Button>
                <p className="text-[10px] text-muted-foreground text-center">{g.description}</p>
              </div>
            ))}
          </div>
          <div className="pt-2 border-t">
            <Button
              size="sm"
              onClick={() => tutor.say("Hi! I'm your AI tutor. Today we'll learn something amazing together!")}
            >
              Say Greeting (TTS + Caption + Talk Animation)
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Mood ring legend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mood Ring Legend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {MOOD_RINGS.map((r) => (
              <div key={r.color} className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full border-2" style={{ borderColor: r.color, boxShadow: `0 0 8px ${r.color}40` }} />
                <span className="text-xs text-muted-foreground">{r.emotion}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Layer anatomy */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Layer Anatomy (back → front)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-2 text-xs">
            {[
              "0. Circle frame + mood ring",
              "1. Inner backdrop (radial)",
              "2. Face photo (circular crop, breathing)",
              "3. Brows overlay (SVG: 6 shapes)",
              "4. Eyes overlay (SVG: 10 shapes)",
              "5. Mouth overlay (SVG: 9 shapes)",
              "6. FX layer (emoji + CSS particles)",
              "7. Props layer (emoji hands/objects)",
              "8. Shine layer (glasses glint)",
              "9. Outside: caption + shadow",
            ].map((layer) => (
              <div key={layer} className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">{layer.split(".")[0]}</Badge>
                <span className="text-muted-foreground">{layer.split(".").slice(1).join(".").trim()}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* The floating dock — renders the badge */}
      <AvatarDock />

      {/* Tip */}
      <div className="text-center text-xs text-muted-foreground py-4">
        The badge is draggable — grab it and snap to any corner. Click to cycle sizes
        (full → mini → dot). The face blinks naturally every 3-6 seconds and breathes when idle.
      </div>
    </div>
  );
}
