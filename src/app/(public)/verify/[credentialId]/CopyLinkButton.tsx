"use client";
// CopyLinkButton — client-side button that copies a URL to clipboard.
// Used on the certificate verify page (which is a server component).

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Link as LinkIcon } from "lucide-react";

export function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = url;
      document.body.appendChild(textarea);
      textarea.select();
      try { document.execCommand("copy"); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
      document.body.removeChild(textarea);
    }
  };

  return (
    <Button variant="ghost" size="sm" className="text-xs" onClick={copy}>
      {copied ? <Check className="h-3.5 w-3.5 mr-1 text-growth-sage" /> : <LinkIcon className="h-3.5 w-3.5 mr-1" />}
      {copied ? "Copied!" : "Copy Link"}
    </Button>
  );
}
