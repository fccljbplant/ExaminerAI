"use client"

import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { CheckIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function Checkbox({
 className,
 ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
 return (
 <CheckboxPrimitive.Root
 data-slot="checkbox"
 className={cn(
 "peer border-line dark:bg-surface-raised/30 data-[state=checked]:bg-brand data-[state=checked]:text-on-brand dark:data-[state=checked]:bg-brand data-[state=checked]:border-brand focus-visible:border-line-strong focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus aria-invalid:border-danger/50 aria-invalid:border-danger size-4 shrink-0 rounded-[4px] border shadow-xs transition-shadow outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50",
 className
 )}
 {...props}
 >
 <CheckboxPrimitive.Indicator
 data-slot="checkbox-indicator"
 className="flex items-center justify-center text-current transition-none"
 >
 <CheckIcon className="size-3.5" />
 </CheckboxPrimitive.Indicator>
 </CheckboxPrimitive.Root>
 )
}

export { Checkbox }
