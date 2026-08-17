"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * /verify — public certificate verification landing (2026-08-17).
 * Previously the footer linked here but only /verify/[credentialId]
 * existed, so the link 404'd. Enter a credential ID to verify.
 */

export default function VerifyPage() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const id = value.trim().replace(/^.*\/verify\//, "");
    if (!id) {
      setError("Enter a credential ID or a verify link.");
      return;
    }
    router.push(`/verify/${encodeURIComponent(id)}`);
  }

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-fg">Verify a certificate</h1>
      <p className="mt-2 text-sm text-fg-muted">
        Enter the credential ID from your certificate — or paste the whole verify link — to
        confirm it was issued by TraineesAI.
      </p>
      <form onSubmit={submit} className="mt-6 flex w-full flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError("");
          }}
          required
          placeholder="Credential ID or /verify/… link"
          aria-label="Credential ID"
          className="h-12 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-sm text-fg placeholder:text-fg-muted focus:border-brand focus:outline-none"
        />
        <button
          type="submit"
          className="inline-flex h-12 shrink-0 items-center justify-center rounded-lg bg-brand px-6 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-hover"
        >
          Verify
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
      <p className="mt-4 text-xs text-fg-muted">
        Example: <code className="rounded bg-bg-subtle px-1">/verify/cmv…</code> — the full
        verify link and the ID both work here.
      </p>
    </main>
  );
}
