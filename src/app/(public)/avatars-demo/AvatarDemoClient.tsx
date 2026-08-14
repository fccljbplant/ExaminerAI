"use client";

// src/app/(public)/avatars-demo/AvatarDemoClient.tsx — Code-drawn 2D avatar demo.
// The entire character is drawn in SVG code — only eyes + lips animate.

import { AvatarDock, tutor } from "@/components/learn/TutorBadge";
import { Button } from "@/modules/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/modules/ui/card";

const GESTURES: { name: string; gesture: string; description: string }[] = [
  { name: "Hello", gesture: "hello", description: "Happy eyes + smile" },
  { name: "Talk", gesture: "talk", description: "Amplitude-synced mouth" },
  { name: "Listen", gesture: "listen", description: "Idle eyes, relaxed mouth" },
  { name: "Think", gesture: "think", description: "Gaze up-left" },
  { name: "Idea", gesture: "idea", description: "Wide eyes + O mouth" },
  { name: "Praise", gesture: "praise", description: "Happy eyes + smile" },
  { name: "Celebrate", gesture: "celebrate", description: "Happy + smile" },
  { name: "Comfort", gesture: "comfort", description: "Soft smile" },
  { name: "Oops", gesture: "oops", description: "O mouth" },
  { name: "Wink", gesture: "wink", description: "One eye closed + smile" },
  { name: "Bye", gesture: "bye", description: "Happy + smile" },
  { name: "Idle", gesture: "idle", description: "Natural blink + gaze drift" },
];

export default function AvatarDemoClient() {
  return (
    <div className="space-y-6">
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-5 space-y-2">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
            Code-Drawn 2D Avatar
          </div>
          <h1 className="text-xl font-bold">AI Tutor — Entirely SVG, Only Eyes + Lips Animate</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            The entire character is drawn in code (SVG) — no photo, no raster assets.
            Only the eyes (blink, gaze, happy, wide, wink) and lips (idle, smile, talk, O)
            animate. Natural blink every 2-6 seconds + micro gaze drift. 100% consistent
            by definition — it&apos;s code, not AI-generated images.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Trigger Gestures</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Click any button. The avatar (bottom-right) animates only eyes + lips.
            Natural blinks happen every 2-6 seconds when idle.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {GESTURES.map((g) => (
              <div key={g.gesture} className="space-y-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    if (g.gesture === "talk") {
                      tutor.say("Hello! I'm your tutor. Let's learn something great today!");
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

      <AvatarDock />

      <div className="text-center text-xs text-muted-foreground py-4">
        The avatar is drawn entirely in SVG code — no images. Drag the dock to reposition,
        click to cycle sizes (full → mini → dot). Eyes blink naturally and drift gaze when idle.
      </div>
    </div>
  );
}
