"use client"

import * as React from "react"
import * as TogglePrimitive from "@radix-ui/react-toggle"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const toggleVariants = cva(
 "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium hover:bg-bg-subtle hover:text-fg-muted disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-bg-subtle data-[state=on]:text-fg [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 focus-visible:border-line-strong focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus outline-none transition-[color,box-shadow] aria-invalid:border-danger/50 aria-invalid:border-danger whitespace-nowrap",
 {
 variants: {
 variant: {
 default: "bg-transparent",
 outline:
 "border border-line bg-transparent shadow-xs hover:bg-bg-subtle hover:text-fg",
 },
 size: {
 default: "min-h-11 px-2 min-w-11",
 sm: "min-h-11 px-1.5 min-w-11",
 lg: "min-h-12 px-2.5 min-w-12",
 },
 },
 defaultVariants: {
 variant: "default",
 size: "default",
 },
 }
)

function Toggle({
 className,
 variant,
 size,
 ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> &
 VariantProps<typeof toggleVariants>) {
 return (
 <TogglePrimitive.Root
 data-slot="toggle"
 className={cn(toggleVariants({ variant, size, className }))}
 {...props}
 />
 )
}

export { Toggle, toggleVariants }
