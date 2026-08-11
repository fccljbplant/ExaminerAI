"use client";

// src/app/(public)/avatars-demo/AvatarDemoClient.tsx — Interactive avatar demo.
// Shows all 11 baked-3D sprite poses + gesture buttons + the floating dock.

import { AvatarDock, tutor } from "@/components/learn/TutorAvatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const GESTURES: { name: string; gesture: string; description: string }[] = [
  { name: "Wave Hi", gesture: "wavehi", description: "Greeting on session start" },
  { name: "Talk Soft", gesture: "talkSoft", description: "Low amplitude speech" },
  { name: "Talk Mid", gesture: "talkMid", description: "Medium amplitude speech" },
  { name: "Talk Wide", gesture: "talkWide", description: "High amplitude speech" },
  { name: "Point", gesture: "point", description: "Highlighting a slide element" },
  { name: "Thumbs Up", gesture: "thumbsup", description: "Correct answer" },
  { name: "Think", gesture: "think", description: "Processing a question" },
  { name: "Cheer", gesture: "cheer", description: "Badge / celebration" },
  { name: "Comfort", gesture: "comfort", description: "Wrong answer — reassurance" },
  { name: "Wave Bye", gesture: "wavebye", description: "Session end" },
];

const SPRITE_SHEETS: { name: string; file: string }[] = [
  { name: "idle", file: "/avatars/idle.webp" },
  { name: "talk-soft", file: "/avatars/talk-soft.webp" },
  { name: "talk-mid", file: "/avatars/talk-mid.webp" },
  { name: "talk-wide", file: "/avatars/talk-wide.webp" },
  { name: "wavehi", file: "/avatars/wavehi.webp" },
  { name: "point", file: "/avatars/point.webp" },
  { name: "thumbsup", file: "/avatars/thumbsup.webp" },
  { name: "think", file: "/avatars/think.webp" },
  { name: "cheer", file: "/avatars/cheer.webp" },
  { name: "comfort", file: "/avatars/comfort.webp" },
  { name: "wavebye", file: "/avatars/wavebye.webp" },
];

export default function AvatarDemoClient() {
  return (
    <div className="space-y-6">
      {/* Intro */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-5 space-y-2">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
            Baked-3D Sprite System
          </div>
          <h1 className="text-xl font-bold">AI Tutor Avatar Demo</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Pre-rendered Pixar-style 3D character played as lightweight 2D sprite frames.
            Transparent WebP, 360×450 per frame, ~350 KB total. The floating dock (bottom-right)
            is fully interactive — drag it, click it to resize, or use the buttons below to trigger gestures.
          </p>
        </CardContent>
      </Card>

      {/* Gesture triggers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Trigger Gestures</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-xs text-muted-foreground mb-2">
              Click a button to trigger a one-shot gesture or talk variant.
              The floating dock (bottom-right) will animate.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {GESTURES.map((g) => (
              <div key={g.gesture} className="space-y-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    if (g.gesture.startsWith("talk")) {
                      tutor.caption("This is how I look when I'm speaking.");
                      tutor.emit("tts");
                      setTimeout(() => tutor.emit("tts:end"), 3000);
                    } else {
                      tutor.play(g.gesture as any);
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
              Say Greeting (TTS + Caption)
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sprite sheet gallery */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sprite Sheets</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            All 11 baked-3D sprite sheets. Each is a 360×450 transparent WebP.
            Total: ~350 KB. Missing gestures (explain, listen, talk, fistpump, question, write, jump)
            fall back to the procedural canvas placeholder.
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {SPRITE_SHEETS.map((s) => (
              <div key={s.name} className="space-y-1">
                <div className="rounded-lg border bg-card p-2 flex items-center justify-center h-32">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.file}
                    alt={s.name}
                    className="max-h-full max-w-full"
                    style={{ imageRendering: "auto" }}
                  />
                </div>
                <div className="text-center">
                  <Badge variant="outline" className="text-[10px]">{s.name}</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* The floating dock — renders the avatar overlay */}
      <AvatarDock />

      {/* Tip */}
      <div className="text-center text-xs text-muted-foreground py-4">
        💡 The avatar dock is draggable — grab it and snap it to any corner.
        Click it to cycle sizes (full → mini → dot).
      </div>
    </div>
  );
}
