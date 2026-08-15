"use client";

// PrintButton — client-side print/download trigger for the certificate
// verify page (which is a server component, so event handlers must live
// in a client boundary).

import { Button } from "@/modules/ui/button";
import { Download } from "lucide-react";

export function PrintButton({ className }: { className?: string }) {
  return (
    <Button
      variant="outline"
      size="sm"
      className={className}
      onClick={() => window.print()}
    >
      <Download className="h-4 w-4" /> Download PDF
    </Button>
  );
}
