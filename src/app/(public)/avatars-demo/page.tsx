// src/app/(public)/avatars-demo/page.tsx — Avatar demo page.
// Shows all 11 baked-3D sprite poses + the floating dock + gesture buttons.
import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles, ArrowLeft } from "lucide-react";
import AvatarDemoClient from "./AvatarDemoClient";

export const metadata: Metadata = {
  title: "Avatar Demo — TraineesAI",
  description: "Interactive demo of the AI tutor avatar system.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function AvatarDemoPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <div className="ml-auto flex items-center gap-2 font-semibold">
            <Sparkles className="h-5 w-5 text-primary" />
            Avatar Demo
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <AvatarDemoClient />
      </main>
    </div>
  );
}
