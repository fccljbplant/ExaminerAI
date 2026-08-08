"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  ImageIcon, Search, Upload, Check, Loader2, ExternalLink, X, Sparkles,
} from "lucide-react";

/**
 * CourseThumbnailPicker — examiner-facing thumbnail picker for a Course.
 *
 * Three sources of thumbnail, all stored as the course's `thumbnailUrl`:
 *
 *   1. Unsplash Source API — 12 random stock photos for the query. No API
 *      key needed. URL form:
 *        https://picsum.photos/seed/{query}/600/400{n}
 *      Each `sig` value yields a different image, so we generate 12 sigs.
 *
 *   2. File upload — converted to a base64 data URL on the client so it
 *      can be persisted in the `thumbnailUrl` column. Kept under 500KB
 *      (rejected if larger) so the row doesn't bloat.
 *
 *   3. External AI generators — links to Craiyon + Canva so the user can
 *      generate a custom image, download it, then upload via (2).
 *
 * Props:
 *   - currentUrl   — the course's existing thumbnailUrl (may be null)
 *   - onSelect     — callback fired with the new URL when confirmed
 *   - courseName   — used to auto-populate the search query
 *   - category     — appended to the search query for better relevance
 */
export default function CourseThumbnailPicker({
  currentUrl,
  onSelect,
  courseName,
  category,
}: {
  currentUrl: string | null;
  onSelect: (url: string) => void;
  courseName: string;
  category: string;
}) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [loadingRefresh, setLoadingRefresh] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Build 12 Unsplash URLs with different sig values.
  const refreshImages = (query: string) => {
    const q = encodeURIComponent(query.trim() || "professional training");
    const urls = Array.from(
      { length: 12 },
      (_, i) => `https://picsum.photos/seed/${q}/600/400${i + 1}`
    );
    setImages(urls);
    setSelected(null);
    setLoadingRefresh(true);
    // Brief loading indicator — the images themselves stream in async.
    setTimeout(() => setLoadingRefresh(false), 800);
  };

  // Auto-populate the search box with courseName + category label.
  useEffect(() => {
    if (open && !searchQuery) {
      const catLabel = category
        ? category.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
        : "";
      const q = [courseName, catLabel].filter(Boolean).join(" ").trim();
      setSearchQuery(q);
      refreshImages(q);
    }
  }, [open]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    refreshImages(searchQuery);
  };

  // File upload → base64 data URL (kept < 500KB to fit in the column).
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setUploadError("Please select an image file.");
      return;
    }
    const MAX_BYTES = 500 * 1024; // 500 KB
    if (file.size > MAX_BYTES) {
      setUploadError(`File is too large (${(file.size / 1024).toFixed(0)} KB). Maximum is 500 KB.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        setSelected(result);
        setUploadError(null);
      }
    };
    reader.onerror = () => setUploadError("Failed to read file.");
    reader.readAsDataURL(file);
  };

  const handleConfirm = () => {
    if (selected) {
      onSelect(selected);
      setOpen(false);
    }
  };

  const handleRemove = () => {
    onSelect("");
    setSelected(null);
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">Course thumbnail</Label>

      {/* Preview + actions */}
      <div className="flex items-start gap-3 rounded-md border border-border bg-background/50 p-3">
        <div className="relative h-20 w-32 flex-shrink-0 overflow-hidden rounded-md border border-border bg-muted">
          {currentUrl ? (
             
            <img src={currentUrl} alt="Course thumbnail" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <ImageIcon className="h-6 w-6 text-muted-foreground/50" />
            </div>
          )}
        </div>

        <div className="flex-1 space-y-1.5">
          <p className="text-[10px] text-muted-foreground leading-snug">
            Pick from <strong>Unsplash</strong> (free stock photos), upload your own image, or generate one with AI. Used on the marketplace card + course detail page.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="default" onClick={() => setOpen(true)} className="h-7 text-xs">
              <Search className="h-3 w-3" /> Search Images
            </Button>
            {currentUrl && (
              <Button type="button" size="sm" variant="outline" onClick={handleRemove} className="h-7 text-xs">
                <X className="h-3 w-3" /> Remove
              </Button>
            )}
          </div>
          {currentUrl && (
            <p className="text-[9px] text-muted-foreground truncate">
              {currentUrl.startsWith("data:") ? "Uploaded image" : currentUrl}
            </p>
          )}
        </div>
      </div>

      {/* Picker Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4" /> Choose a thumbnail
            </DialogTitle>
            <DialogDescription>
              Search free Unsplash stock photos, upload your own image, or generate one with AI.
            </DialogDescription>
          </DialogHeader>

          {/* Search row */}
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Unsplash — e.g. data science, marketing, leadership"
              className="flex-1"
            />
            <Button type="submit" size="sm">
              <Search className="h-3.5 w-3.5" /> Search
            </Button>
          </form>

          {/* Image grid */}
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {loadingRefresh && (
              <div className="col-span-full flex items-center justify-center py-8 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading images…
              </div>
            )}
            {!loadingRefresh && images.map((url, i) => (
              <button
                key={url}
                type="button"
                onClick={() => setSelected(url)}
                className={`relative aspect-[3/2] overflow-hidden rounded-md border-2 transition-all ${
                  selected === url
                    ? "border-primary ring-2 ring-primary/30"
                    : "border-transparent hover:border-primary/40"
                }`}
              >
                { }
                <img
                  src={url}
                  alt={`Unsplash result ${i + 1}`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  onError={(e) => {
                    // Unsplash Source occasionally rate-limits — hide broken tiles.
                    (e.currentTarget.parentElement as HTMLElement).style.display = "none";
                  }}
                />
                {selected === url && (
                  <span className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-3 w-3" />
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Selected preview */}
          {selected && (
            <div className="rounded-md border border-primary/30 bg-primary/5 p-2.5">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                  <Check className="h-3 w-3 mr-1" /> Selected
                </Badge>
                <span className="text-xs text-muted-foreground truncate">
                  {selected.startsWith("data:") ? "Uploaded image (base64)" : selected}
                </span>
              </div>
            </div>
          )}

          {/* File upload */}
          <div className="rounded-md border border-border bg-background/50 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-foreground">Upload your own image</p>
                <p className="text-[10px] text-muted-foreground">PNG, JPG, or WebP. Max 500 KB.</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="h-7 text-xs"
              >
                <Upload className="h-3 w-3" /> Choose File
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
            {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
          </div>

          {/* AI generator links */}
          <div className="rounded-md border border-border bg-background/50 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <p className="text-xs font-medium text-foreground">Generate with AI</p>
            </div>
            <p className="text-[10px] text-muted-foreground leading-snug">
              Generate a custom image, download it, then upload it above. Both services are free.
            </p>
            <div className="flex flex-wrap gap-2">
              <a
                href="https://www.craiyon.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs hover:bg-accent"
              >
                <ExternalLink className="h-3 w-3" /> Craiyon (free, no signup)
              </a>
              <a
                href="https://www.canva.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs hover:bg-accent"
              >
                <ExternalLink className="h-3 w-3" /> Canva Design
              </a>
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="button" onClick={handleConfirm} disabled={!selected}>
              <Check className="h-3.5 w-3.5" /> Use this image
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
