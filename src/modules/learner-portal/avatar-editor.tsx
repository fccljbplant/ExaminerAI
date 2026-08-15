"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, Loader2, Trash2, X } from "lucide-react";

/**
 * modules/learner-portal — AvatarEditor (W16: profile picture)
 *
 * Upload → crop (drag to pan, zoom slider, square crop) → resize to
 * 128×128 → compress to ≤20KB → PUT /api/auth/avatar. The server
 * re-validates the 20KB cap. Renders the current picture with a badge
 * icon overlay when one is provided.
 */

const TARGET_SIZE = 128;
const MAX_BYTES = 20_000;
const VIEW = 280; // crop viewport (square)

interface AvatarEditorProps {
  initial?: string | null;
  badgeIcon?: string | null;
  /** Called after a successful save (data URL) or removal (null). */
  onChange?: (dataUrl: string | null) => void;
}

export function AvatarEditor({ initial, badgeIcon, onChange }: AvatarEditorProps) {
  const [current, setCurrent] = useState<string | null>(initial ?? null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  // crop state
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, panX: 0, panY: 0 });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const drawPreview = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, VIEW, VIEW);
    const base = Math.min(img.naturalWidth, img.naturalHeight);
    const scale = (VIEW * zoom) / base;
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    const dx = (VIEW - dw) / 2 + pan.x;
    const dy = (VIEW - dh) / 2 + pan.y;
    ctx.drawImage(img, dx, dy, dw, dh);
  }, [zoom, pan]);

  useEffect(() => {
    if (editing) drawPreview();
  }, [editing, drawPreview]);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setEditing(true);
    };
    img.src = url;
    e.target.value = "";
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    setDragging(true);
    dragRef.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dragging) return;
    setPan({
      x: dragRef.current.panX + (e.clientX - dragRef.current.startX),
      y: dragRef.current.panY + (e.clientY - dragRef.current.startY),
    });
  }

  function onPointerUp() {
    setDragging(false);
  }

  /** Crop → resize → compress ≤20KB → data URL. */
  function compressToDataUrl(): string | null {
    const img = imgRef.current;
    if (!img) return null;
    const base = Math.min(img.naturalWidth, img.naturalHeight);
    const scale = (VIEW * zoom) / base;
    const srcW = TARGET_SIZE / scale;
    const sx = (img.naturalWidth - srcW) / 2 - pan.x / scale;
    const sy = (img.naturalHeight - srcW) / 2 - pan.y / scale;
    const out = document.createElement("canvas");
    out.width = TARGET_SIZE;
    out.height = TARGET_SIZE;
    const ctx = out.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#fff"; // canvas needs a literal fill color (JPEG has no alpha)
    ctx.fillRect(0, 0, TARGET_SIZE, TARGET_SIZE);
    ctx.drawImage(img, sx, sy, srcW, srcW, 0, 0, TARGET_SIZE, TARGET_SIZE);
    // quality loop: 0.9 → 0.4 until ≤20KB (jpeg)
    let quality = 0.9;
    let dataUrl = out.toDataURL("image/jpeg", quality);
    while (dataUrl.length > MAX_BYTES * 1.37 && quality > 0.35) {
      quality -= 0.1;
      dataUrl = out.toDataURL("image/jpeg", quality);
    }
    return dataUrl;
  }

  async function save() {
    const dataUrl = compressToDataUrl();
    if (!dataUrl) return;
    setBusy(true);
    try {
      const res = await fetch("/api/auth/avatar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(payload.error || "Upload failed");
      setCurrent(dataUrl);
      setEditing(false);
      onChange?.(dataUrl);
      toast.success("Profile picture saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch("/api/auth/avatar", { method: "DELETE" });
      if (!res.ok) throw new Error("Remove failed");
      setCurrent(null);
      onChange?.(null);
      toast.success("Profile picture removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Remove failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        {/* current picture + badge overlay */}
        <div className="relative">
          {current ? (
            <img
              src={current}
              alt="Your profile"
              className="h-16 w-16 rounded-full object-cover ring-1 ring-line"
            />
          ) : (
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-subtle text-lg font-semibold text-fg">
              ?
            </span>
          )}
          {badgeIcon && (
            <span
              title="Latest badge"
              className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface bg-brand-subtle text-sm"
            >
              {badgeIcon}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-hover">
            <ImagePlus className="h-4 w-4" aria-hidden />
            {current ? "Change picture" : "Upload picture"}
            <input type="file" accept="image/*" onChange={onFile} className="sr-only" />
          </label>
          {current && (
            <button
              type="button"
              onClick={() => void remove()}
              disabled={busy}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-semibold text-fg hover:border-danger hover:text-danger disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              Remove
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-fg-muted">
        Cropped square, resized to 128×128 and compressed to max 20KB automatically.
      </p>

      {/* crop modal */}
      {editing && (
        <div className="fixed inset-0 z-modal flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Crop profile picture">
          <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-fg">Crop your picture</h3>
              <button
                type="button"
                onClick={() => setEditing(false)}
                aria-label="Close cropper"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-fg-muted hover:bg-bg-subtle hover:text-fg"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <div className="mt-3 overflow-hidden rounded-xl border border-line">
              <canvas
                ref={canvasRef}
                width={VIEW}
                height={VIEW}
                className={dragging ? "cursor-grabbing" : "cursor-grab"}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              />
            </div>
            <label className="mt-3 flex items-center gap-2 text-xs font-medium text-fg-secondary">
              Zoom
              <input
                type="range"
                min={0.5}
                max={3}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1 accent-[var(--brand)]"
              />
            </label>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border border-line text-sm font-semibold text-fg hover:bg-bg-subtle"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void save()}
                disabled={busy}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand text-sm font-semibold text-on-brand disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
