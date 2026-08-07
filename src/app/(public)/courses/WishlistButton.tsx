"use client";
import { useState } from "react";
import { Bookmark } from "lucide-react";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export default function WishlistButton({ courseId, variant = "icon" }: { courseId: string; variant?: "icon" | "button" }) {
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLoading(true);
    try {
      if (saved) {
        await api.del("/api/student/wishlist", { courseId });
        setSaved(false);
      } else {
        await api.post("/api/student/wishlist", { courseId });
        setSaved(true);
      }
    } catch { /* ignore — user may not be logged in */ }
    finally { setLoading(false); }
  };

  if (variant === "button") {
    return (
      <button
        onClick={toggle}
        disabled={loading}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
          saved ? "border-primary bg-primary/10 text-primary" : "border-border bg-background hover:bg-accent"
        )}
      >
        <Bookmark className={cn("h-3.5 w-3.5", saved && "fill-current")} />
        {saved ? "Saved" : "Save"}
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className="absolute top-2 right-2 z-10 rounded-full bg-black/40 backdrop-blur p-1.5 text-white hover:bg-black/60 transition-colors"
      aria-label={saved ? "Remove from wishlist" : "Add to wishlist"}
    >
      <Bookmark className={cn("h-4 w-4", saved && "fill-current")} />
    </button>
  );
}
