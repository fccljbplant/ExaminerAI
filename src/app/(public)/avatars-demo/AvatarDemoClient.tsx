"use client";

// src/app/(public)/avatars-demo/AvatarDemoClient.tsx — Interactive avatar demo.
// Shows the smooth crossfade system + gesture buttons + the floating dock.

import { AvatarDock, tutor } from "@/components/learn/TutorAvatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const GESTURES: { name: string; gesture: string; description: string }[] = [
  { name: "Wave Hi", gesture: "wavehi", description: "Greeting on session start" },
  { name: "Explain", gesture: "explain", description: "Teaching a concept" },
  { name: "Talk Soft", gesture: "talkSoft", description: "Low amplitude speech" },
  { name: "Talk Mid", gesture: "talkMid", description: "Medium amplitude speech" },
  { name: "Talk Wide", gesture: "talkWide", description: "High amplitude speech" },
  { name: "Point", gesture: "point", description: "Highlighting a slide element" },
  { name: "Thumbs Up", gesture: "thumbsup", description: "Correct answer" },
  { name: "Think", gesture: "think", description: "Processing a question" },
  { name: "Cheer", gesture: "cheer", description: "Badge / celebration" },
  { name: "Comfort", gesture: "comfort", description: "Wrong answer — reassurance" },
  { name: "Question", gesture: "question", description: "Asking a check question" },
  { name: "Fist Pump", gesture: "fistpump", description: "Motivation" },
  { name: "Listen", gesture: "listen", description: "Student speaking" },
  { name: "Write", gesture: "write", description: "Taking notes" },
  { name: "Jump", gesture: "jump", description: "Level up celebration" },
  { name: "Wave Bye", gesture: "wavebye", description: "Session end" },
];

const SPRITE_SHEETS: { name: string; file: string }[] = [
  { name: "idle", file: "/avatars/idle.webp" },
  { name: "listen", file: "/avatars/listen.webp" },
  { name: "think", file: "/avatars/think.webp" },
  { name: "explain", file: "/avatars/explain.webp" },
  { name: "talk", file: "/avatars/talk.webp" },
  { name: "talk-soft", file: "/avatars/talk-soft.webp" },
  { name: "talk-mid", file: "/avatars/talk-mid.webp" },
  { name: "talk-wide", file: "/avatars/talk-wide.webp" },
  { name: "wavehi", file: "/avatars/wavehi.webp" },
  { name: "wavebye", file: "/avatars/wavebye.webp" },
  { name: "thumbsup", file: "/avatars/thumbsup.webp" },
  { name: "cheer", file: "/avatars/cheer.webp" },
  { name: "fistpump", file: "/avatars/fistpump.webp" },
  { name: "comfort", file: "/avatars/comfort.webp" },
  { name: "point", file: "/avatars/point.webp" },
  { name: "question", file: "/avatars/question.webp" },
  { name: "write", file: "/avatars/write.webp" },
  { name: "jump", file: "/avatars/jump.webp" },
];

export default function AvatarDemoClient() {
  return (
    <div className="space-y-6">
      {/* Intro */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-5 space-y-2">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
            Baked-3D Sprite System v3 — Smooth Crossfade
          </div>
          <h1 className="text-xl font-bold">AI Tutor Avatar Demo</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            IMG-based crossfade (not canvas) for buttery-smooth gesture transitions.
            3-state system: active → exiting (scale + blur) → next active (scale in from 0.96).
            Idle breathing animation + CSS sphere shadow + professional floating dock.
          </p>
        </CardContent>
      </Card>

      {/* Gesture triggers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Trigger Gestures — Smooth Crossfade</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-xs text-muted-foreground mb-2">
              Click a button to trigger a gesture. The avatar crossfades smoothly between poses.
              The floating dock (bottom-right) animates in real-time.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
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
              Say Greeting (TTS + Caption + Crossfade)
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sprite sheet gallery */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All 18 Sprites — 360×450 Transparent WebP</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            All 18 baked-3D sprite sheets. Each is a 360×450 transparent WebP with chroma-key
            background removal. Click any sprite to trigger that gesture.
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {SPRITE_SHEETS.map((s) => (
              <div key={s.name} className="space-y-1">
                <button
                  className="rounded-lg border bg-card p-2 flex items-center justify-center h-32 hover:border-primary/40 hover:shadow-md transition-all cursor-pointer w-full"
                  onClick={() => tutor.play(s.name as any)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.file}
                    alt={s.name}
                    className="max-h-full max-w-full"
                  />
                </button>
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
        The avatar dock is draggable — grab it and snap it to any corner.
        Click it to cycle sizes (full → mini → dot). The avatar breathes when idle
        and crossfades smoothly between gestures.
      </div>
    </div>
  );
}
