"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Plus, RefreshCw, ServerCog, X } from "lucide-react";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useApi } from "@/modules/learner-portal/use-api";

/**
 * modules/org-portal — O3 Registries editor (REDESIGN-P3 §O3, W7)
 *
 * Zero-code domains: adding a submission type, rubric template or
 * category for the org is a RegistryRow insert, never code. Kind tabs
 * (submission_type / rubric_template / category); org overrides shadow
 * platform defaults by key; defaults are read-only.
 */

interface RegistryRowView {
  id: string;
  kind: string;
  key: string;
  label: string;
  config: unknown;
  sortOrder: number;
  isActive: boolean;
  isOrgOverride: boolean;
}

interface RegistriesData {
  kind: string;
  items: RegistryRowView[];
}

const KINDS = [
  { key: "submission_type", label: "Submission types" },
  { key: "rubric_template", label: "Rubric templates" },
  { key: "category", label: "Categories" },
] as const;

export function OrgRegistries() {
  const [kind, setKind] = useState<(typeof KINDS)[number]["key"]>("submission_type");
  const [showAdd, setShowAdd] = useState(false);
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [configText, setConfigText] = useState("");
  const [saving, setSaving] = useState(false);

  const { data, error, isLoading, retry } = useApi<RegistriesData>(
    `/api/v2/org/registries/${kind}`,
  );

  async function addRow(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      let config: Record<string, unknown> | undefined;
      if (configText.trim()) {
        try {
          config = JSON.parse(configText);
        } catch {
          toast.error("Config must be valid JSON");
          setSaving(false);
          return;
        }
      }
      await api.post(`/api/v2/org/registries/${kind}`, { key, label, config });
      toast.success("Registry row added", { description: `${label} now overrides the default.` });
      setKey("");
      setLabel("");
      setConfigText("");
      setShowAdd(false);
      retry();
    } catch (e) {
      toast.error("Couldn't add registry row", {
        description: e instanceof Error ? e.message : "Try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function toggle(row: RegistryRowView) {
    if (!row.isOrgOverride) return; // defaults are read-only
    try {
      await api.patch(`/api/v2/org/registries/${row.id}`, { isActive: !row.isActive });
      retry();
    } catch (e) {
      toast.error("Couldn't update row", {
        description: e instanceof Error ? e.message : "Try again.",
      });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-fg md:text-xl">Registries</h1>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-on-brand transition-colors hover:bg-brand-hover"
        >
          {showAdd ? (
            <>
              <X className="h-4 w-4" aria-hidden />
              Close
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" aria-hidden />
              Add row
            </>
          )}
        </button>
      </div>

      {/* kind tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {KINDS.map((k) => (
          <button
            key={k.key}
            type="button"
            onClick={() => setKind(k.key)}
            aria-pressed={kind === k.key}
            className={
              kind === k.key
                ? "shrink-0 rounded-full bg-brand px-3 py-1.5 text-xs font-medium text-on-brand"
                : "shrink-0 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-fg-secondary hover:border-line-strong"
            }
          >
            {k.label}
          </button>
        ))}
      </div>

      {/* add form */}
      {showAdd && (
        <form onSubmit={addRow} className="space-y-2 rounded-xl border border-line bg-surface p-4">
          <h2 className="text-sm font-semibold text-fg">New {kind.replace("_", " ")} row</h2>
          <div className="flex flex-col gap-2 md:flex-row">
            <input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              required
              placeholder="key (e.g. photo_evidence)"
              aria-label="Registry key"
              className="h-11 flex-1 rounded-lg border border-line bg-surface px-3 text-sm text-fg placeholder:text-fg-muted focus:border-brand focus:outline-none"
            />
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
              placeholder="Label shown to users"
              aria-label="Registry label"
              className="h-11 flex-1 rounded-lg border border-line bg-surface px-3 text-sm text-fg placeholder:text-fg-muted focus:border-brand focus:outline-none"
            />
          </div>
          <textarea
            value={configText}
            onChange={(e) => setConfigText(e.target.value)}
            rows={3}
            placeholder='Optional config JSON, e.g. {"captureHint":"Wide angle","maxBytes":5000000}'
            aria-label="Config JSON"
            className="w-full resize-y rounded-lg border border-line bg-surface px-3 py-2 font-mono text-xs text-fg placeholder:text-fg-muted focus:border-brand focus:outline-none"
          />
          <button
            type="submit"
            disabled={saving}
            className="flex h-11 items-center justify-center rounded-lg bg-brand px-4 text-sm font-medium text-on-brand transition-colors hover:bg-brand-hover disabled:opacity-50"
          >
            {saving ? "Saving…" : "Add row"}
          </button>
        </form>
      )}

      {isLoading ? (
        <RegistrySkeleton />
      ) : error ? (
        <div role="alert" className="rounded-xl border border-line bg-surface p-8 text-center">
          <AlertTriangle className="mx-auto h-6 w-6 text-danger" aria-hidden />
          <p className="mt-3 text-sm font-semibold text-fg">Couldn&apos;t load registries</p>
          <p className="mt-1 text-xs text-fg-muted">{error}</p>
          <button
            type="button"
            onClick={retry}
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-line px-4 text-sm font-semibold text-fg transition-colors hover:bg-bg-subtle"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Retry
          </button>
        </div>
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {data?.items.map((row) => (
            <div key={row.id} className="flex min-h-14 items-center gap-3 px-4 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg-subtle text-fg-secondary">
                <ServerCog className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-fg">{row.label}</p>
                <p className="truncate text-xs text-fg-muted">
                  {row.key}
                  {row.isOrgOverride ? " · org override" : " · platform default"}
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-md px-2 py-0.5 text-xs font-medium",
                  row.isActive ? "bg-success-subtle text-success-on" : "bg-bg-subtle text-fg-muted",
                )}
              >
                {row.isActive ? "Active" : "Disabled"}
              </span>
              {row.isOrgOverride && (
                <button
                  type="button"
                  role="switch"
                  aria-checked={row.isActive}
                  aria-label={`Toggle ${row.label}`}
                  onClick={() => toggle(row)}
                  className={
                    row.isActive
                      ? "relative h-7 w-12 shrink-0 rounded-full bg-brand transition-colors"
                      : "relative h-7 w-12 shrink-0 rounded-full bg-bg-subtle transition-colors"
                  }
                >
                  <span
                    className={
                      row.isActive
                        ? "absolute left-6 top-0.5 h-6 w-6 rounded-full bg-surface shadow transition-all"
                        : "absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-surface shadow transition-all"
                    }
                  />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RegistrySkeleton() {
  return (
    <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface" aria-busy="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex animate-pulse items-center gap-3 px-4 py-3">
          <div className="h-9 w-9 rounded-lg bg-bg-subtle" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-1/3 rounded bg-bg-subtle" />
            <div className="h-3 w-1/2 rounded bg-bg-subtle" />
          </div>
        </div>
      ))}
    </div>
  );
}
