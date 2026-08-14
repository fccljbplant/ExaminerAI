"use client";

import { useRef, useState } from "react";
import { ImagePlus, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * modules/ui — MediaCapture (REDESIGN-P2 §1.4)
 *
 * Registry-driven file picker for submission parts. Reads the picked
 * file (name / mime / size / inline dataUrl for small binaries) and
 * hands it to the caller — this primitive never uploads or extracts
 * anything itself; pages orchestrate POST /v2/uploads for docx/pdf.
 *
 * Capture hints come from SubmissionTypeRow rows (zero-code domains);
 * the input honours `capture` on mobile camera-capable devices.
 */

export interface MediaCaptureFile {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  /** Inline base64 data URL when the file is small enough to store
   *  inline (≤6MB); null otherwise — callers surface an oversize error. */
  dataUrl: string | null;
}

export interface MediaCaptureProps {
  accept?: string;
  capture?: boolean | "user" | "environment";
  captureHint?: string;
  /** Max bytes accepted — default 10MB (upload pipeline ceiling). */
  maxBytes?: number;
  disabled?: boolean;
  label?: string;
  className?: string;
  onFile: (file: MediaCaptureFile) => void;
  onError?: (message: string) => void;
}

/** Inline-storage ceiling — mirrors PartInputSchema.sizeBytes max. */
const INLINE_MAX_BYTES = 6_000_000;

export function MediaCapture({
  accept = "image/*",
  capture,
  captureHint,
  maxBytes = 10_000_000,
  disabled,
  label = "Choose file",
  className,
  onFile,
  onError,
}: MediaCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset so re-picking the same file re-fires change.
    e.target.value = "";
    if (!file) return;

    if (file.size > maxBytes) {
      onError?.(
        `"${file.name}" is too large (${Math.round(file.size / 1024 / 1024)}MB — max ${Math.round(maxBytes / 1024 / 1024)}MB).`,
      );
      return;
    }

    setBusy(true);
    if (file.size <= INLINE_MAX_BYTES) {
      const reader = new FileReader();
      reader.onload = () => {
        setBusy(false);
        onFile({
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          dataUrl: typeof reader.result === "string" ? reader.result : null,
        });
      };
      reader.onerror = () => {
        setBusy(false);
        onError?.("Could not read that file — please try again.");
      };
      reader.readAsDataURL(file);
    } else {
      setBusy(false);
      onFile({
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        dataUrl: null,
      });
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        capture={capture ?? undefined}
        disabled={disabled || busy}
        onChange={handleChange}
        className="sr-only"
        aria-label={label}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || busy}
        className={cn(
          "flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-line-strong bg-bg-subtle px-3 py-2.5 text-sm font-medium text-fg-secondary",
          "transition-colors hover:bg-surface hover:text-fg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus",
          "disabled:opacity-50"
        )}
      >
        {accept.startsWith("image/") && !accept.includes("pdf") ? (
          <ImagePlus className="h-4 w-4 shrink-0" aria-hidden />
        ) : (
          <Upload className="h-4 w-4 shrink-0" aria-hidden />
        )}
        <span className="min-w-0 truncate">{busy ? "Reading…" : label}</span>
      </button>
      {captureHint && (
        <p className="text-xs text-fg-muted">{captureHint}</p>
      )}
    </div>
  );
}
