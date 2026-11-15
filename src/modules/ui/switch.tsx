"use client"

import * as React from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

function Switch({
 className,
 ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
 return (
 <SwitchPrimitive.Root
 data-slot="switch"
 className={cn(
 "peer data-[state=checked]:bg-brand data-[state=unchecked]:bg-line-strong focus-visible:border-line-strong focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus dark:data-[state=unchecked]:bg-line-strong/80 inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50",
 className
 )}
 {...props}
 >
 <SwitchPrimitive.Thumb
 data-slot="switch-thumb"
 className={cn(
 "bg-bg dark:data-[state=unchecked]:bg-fg dark:data-[state=checked]:bg-on-brand pointer-events-none block size-4 rounded-full ring-0 transition-transform data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0"
 )}
 />
 </SwitchPrimitive.Root>
 )
}

export { Switch }
