import { BadgeCheck, CircleDashed, Hourglass } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * modules/ui — SignOffCard (REDESIGN-P2 §1.4)
 *
 * Ordered multi-signer chain status (HSE-style). Shows each chain member
 * in order with signed / pending / blocked-by-predecessor state, plus the
 * overall submission status. Pure presentational — the ordered-chain
 * rules live in modules/submission/lib/lifecycle.ts.
 */

export interface SignOffMemberView {
  signerId: string;
  signerName: string;
  signerRole: string;
}

export interface SignOffRecordView {
  signerId: string;
  order: number;
}

export interface SignOffCardProps {
  milestoneLabel?: string;
  chain: SignOffMemberView[];
  done: SignOffRecordView[];
  status?: string;
  className?: string;
}

export function SignOffCard({
  milestoneLabel = "Milestone",
  chain,
  done,
  status,
  className,
}: SignOffCardProps) {
  const doneIds = new Set(done.map((d) => d.signerId));
  // A member may only sign once every lower-order member has signed.
  const firstPending = chain.find((m) => !doneIds.has(m.signerId));

  return (
    <div className={cn("overflow-hidden rounded-xl border border-line bg-surface", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <p className="text-sm font-semibold text-fg">{milestoneLabel} — sign-off</p>
        {status && (
          <span
            className={cn(
              "rounded-md px-2 py-0.5 text-xs font-medium",
              status === "signed_off"
                ? "bg-success-subtle text-success-on"
                : "bg-warning-subtle text-warning-on"
            )}
          >
            {status === "signed_off" ? "Signed off" : status.replaceAll("_", " ")}
          </span>
        )}
      </div>

      {chain.length === 0 ? (
        <p className="px-4 py-4 text-sm text-fg-muted">
          No sign-off chain — a single reviewer approval completes this work.
        </p>
      ) : (
        <ol className="divide-y divide-line">
          {chain.map((m, i) => {
            const signed = doneIds.has(m.signerId);
            const blocked = !signed && firstPending?.signerId !== m.signerId;
            return (
              <li key={m.signerId} className="flex min-h-11 items-center gap-3 px-4 py-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-bg-subtle text-xs font-medium tabular-nums text-fg-secondary">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-fg">
                    {m.signerName || `Signer ${i + 1}`}
                  </p>
                  <p className="text-xs text-fg-muted">{m.signerRole}</p>
                </div>
                {signed ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-success-on">
                    <BadgeCheck className="h-4 w-4 text-success" aria-hidden />
                    Signed
                  </span>
                ) : blocked ? (
                  <span className="inline-flex items-center gap-1 text-xs text-fg-muted">
                    <Hourglass className="h-4 w-4" aria-hidden />
                    Waiting
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-warning-on">
                    <CircleDashed className="h-4 w-4 text-warning" aria-hidden />
                    Next
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
