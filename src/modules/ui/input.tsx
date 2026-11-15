import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
 return (
 <input
 type={type}
 data-slot="input"
 className={cn(
 "file:text-fg placeholder:text-fg-muted selection:bg-brand selection:text-on-brand dark:bg-surface-raised/30 border-line flex min-h-11 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-9 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
 "focus-visible:border-line-strong focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus",
 "aria-invalid:border-danger/50 aria-invalid:border-danger",
 className
 )}
 {...props}
 />
 )
}

export { Input }
