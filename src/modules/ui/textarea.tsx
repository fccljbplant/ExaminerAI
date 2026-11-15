import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
 return (
 <textarea
 data-slot="textarea"
 className={cn(
 "border-line placeholder:text-fg-muted focus-visible:border-line-strong focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus aria-invalid:border-danger/50 aria-invalid:border-danger dark:bg-surface-raised/30 flex field-sizing-content min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
 className
 )}
 {...props}
 />
 )
}

export { Textarea }
