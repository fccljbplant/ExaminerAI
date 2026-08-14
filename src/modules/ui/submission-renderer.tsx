import {
  CheckSquare,
  ExternalLink,
  FileText,
  ImageOff,
  Link2,
  MessageSquareWarning,
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * modules/ui — SubmissionRenderer (REDESIGN-P2 §1.4)
 *
 * Renders ANY submission part type from registry data — one component,
 * zero domain code. Read-only; used by the learner (review own work)
 * and the instructor (I4 review).
 *
 * Text-only AI law (P2 §3.4): file parts surface extracted text; when
 * extraction failed the renderer shows the explicit degradation notice
 * instead of pretending content is readable. Photo/video parts render
 * the artifact for the HUMAN reviewer only.
 */

export interface RenderedPart {
  type: string;
  text?: string | null;
  url?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  dataUrl?: string | null;
  extractedText?: string | null;
  extractionStatus?: string;
  checklist?: Array<{ label: string; checked: boolean }> | null;
}

export interface SubmissionRendererProps {
  part: RenderedPart;
  className?: string;
  /** Optional caption under the artifact (e.g. capture hint). */
  caption?: string;
}

const PANEL = "rounded-xl border border-line bg-surface";

export function SubmissionRenderer({ part, className, caption }: SubmissionRendererProps) {
  switch (part.type) {
    case "text":
      return (
        <div className={cn(PANEL, "px-4 py-3", className)}>
          {part.text?.trim() ? (
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-fg">
              {part.text.trim()}
            </p>
          ) : (
            <EmptyNotice label="No written answer" />
          )}
        </div>
      );

    case "link":
      return (
        <div className={cn(PANEL, "p-4", className)}>
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-subtle text-fg">
              <Link2 className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-fg">Live artifact</p>
              {part.url ? (
                <a
                  href={part.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate text-sm text-fg-secondary underline decoration-line hover:text-fg"
                >
                  <span className="truncate">{part.url}</span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
                </a>
              ) : (
                <p className="mt-0.5 text-xs text-fg-muted">No link provided.</p>
              )}
            </div>
          </div>
        </div>
      );

    case "checklist":
      return (
        <div className={cn(PANEL, "divide-y divide-line", className)}>
          {(part.checklist ?? []).map((item, i) => (
            <div key={i} className="flex min-h-11 items-center gap-3 px-4 py-2.5">
              <CheckSquare
                className={cn(
                  "h-4 w-4 shrink-0",
                  item.checked ? "text-success" : "text-fg-muted"
                )}
                aria-hidden
              />
              <span
                className={cn(
                  "text-sm",
                  item.checked ? "text-fg" : "text-fg-muted line-through"
                )}
              >
                {item.label}
              </span>
            </div>
          ))}
          {!part.checklist?.length && <EmptyNotice label="Empty checklist" />}
        </div>
      );

    case "photo":
      if (part.dataUrl || part.url) {
        return (
          <figure className={cn(PANEL, "overflow-hidden", className)}>
            {/* Self-hosted evidence bytes — the optimizer would re-fetch the data URL. */}
            <img
              src={part.dataUrl ?? part.url ?? ""}
              alt={part.fileName ?? "Photo evidence"}
              className="max-h-96 w-full object-contain bg-bg-subtle"
            />
            {caption && (
              <figcaption className="px-4 py-2 text-xs text-fg-muted">{caption}</figcaption>
            )}
          </figure>
        );
      }
      return (
        <div className={cn(PANEL, className)}>
          <EmptyNotice
            icon={ImageOff}
            label={part.fileName ?? "Photo evidence"}
            detail="No image available to preview."
          />
        </div>
      );

    case "video":
      return (
        <div className={cn(PANEL, "p-4", className)}>
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-subtle text-fg">
              <Video className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-fg">Video evidence</p>
              {part.url ? (
                <a
                  href={part.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate text-sm text-fg-secondary underline decoration-line hover:text-fg"
                >
                  <span className="truncate">{part.fileName ?? part.url}</span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
                </a>
              ) : (
                <p className="mt-0.5 text-xs text-fg-muted">No video reference.</p>
              )}
            </div>
          </div>
        </div>
      );

    case "file":
      return (
        <div className={cn(PANEL, "overflow-hidden", className)}>
          <div className="flex items-center gap-3 border-b border-line px-4 py-3">
            <FileText className="h-4 w-4 shrink-0 text-fg-secondary" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-fg">
                {part.fileName ?? "Document"}
              </p>
              {part.sizeBytes != null && (
                <p className="text-xs text-fg-muted">
                  {Math.round(part.sizeBytes / 1024)} KB
                </p>
              )}
            </div>
          </div>
          {part.extractionStatus === "failed" ? (
            <EmptyNotice
              icon={MessageSquareWarning}
              label="Text-only AI — nothing readable here yet"
              detail="This file could not be converted to text. A human reviewer can still assess it."
            />
          ) : part.extractedText?.trim() ? (
            <p className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words px-4 py-3 text-sm leading-relaxed text-fg">
              {part.extractedText.trim()}
            </p>
          ) : (
            <EmptyNotice label="No text extracted yet" detail="Extraction pending." />
          )}
        </div>
      );

    default:
      return (
        <div className={cn(PANEL, className)}>
          <EmptyNotice label={`Unsupported part type: ${part.type}`} />
        </div>
      );
  }
}

function EmptyNotice({
  icon: Icon = FileText,
  label,
  detail,
}: {
  icon?: typeof FileText;
  label: string;
  detail?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 px-4 py-6 text-center">
      <Icon className="h-5 w-5 text-fg-muted" aria-hidden />
      <p className="text-sm font-medium text-fg-secondary">{label}</p>
      {detail && <p className="max-w-sm text-xs text-fg-muted">{detail}</p>}
    </div>
  );
}
