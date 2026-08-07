"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FilterProps {
  categories: readonly { value: string; label: string }[];
  levels: readonly { value: string; label: string }[];
  current: {
    category?: string;
    level?: string;
    search?: string;
    featured?: boolean;
    free?: boolean;
  };
}

/** Client-side filter bar. Pushes filter state into the URL so the server
 *  component re-renders with the new data. */
export function MarketplaceFilters({ categories, levels, current }: FilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const updateParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      if (value === null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      startTransition(() => {
        router.push(`/courses?${params.toString()}`, { scroll: false });
      });
    },
    [router, searchParams, startTransition]
  );

  const toggleFlag = useCallback(
    (key: "featured" | "free", on: boolean) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      if (on) params.set(key, "1");
      else params.delete(key);
      startTransition(() => {
        router.push(`/courses?${params.toString()}`, { scroll: false });
      });
    },
    [router, searchParams, startTransition]
  );

  const hasActiveFilters =
    current.category || current.level || current.search || current.featured || current.free;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search courses, skills, technologies…"
          defaultValue={current.search ?? ""}
          onChange={(e) => {
            // Debounce-ish: rely on the user pausing. We don't want a network
            // round-trip on every keystroke, so we update on blur OR every 350ms.
            const value = e.target.value;
            window.clearTimeout((window as any).__marketplaceSearchTimer);
            (window as any).__marketplaceSearchTimer = window.setTimeout(() => {
              updateParam("search", value || null);
            }, 350);
          }}
          className="pl-8"
        />
      </div>

      {/* Category */}
      <Select
        value={current.category ?? "all"}
        onValueChange={(v) => updateParam("category", v === "all" ? null : v)}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All categories</SelectItem>
          {categories.map((c) => (
            <SelectItem key={c.value} value={c.value}>
              {c.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Level */}
      <Select
        value={current.level ?? "all"}
        onValueChange={(v) => updateParam("level", v === "all" ? null : v)}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Level" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All levels</SelectItem>
          {levels.map((l) => (
            <SelectItem key={l.value} value={l.value}>
              {l.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Free only */}
      <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
        <Checkbox
          checked={current.free ?? false}
          onCheckedChange={(v) => toggleFlag("free", v === true)}
        />
        Free only
      </label>

      {/* Clear */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/courses", { scroll: false })}
          disabled={isPending}
        >
          <X className="h-3.5 w-3.5" /> Clear
        </Button>
      )}
    </div>
  );
}
