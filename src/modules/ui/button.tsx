import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
 "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-line-strong focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus aria-invalid:border-danger/50 aria-invalid:border-danger",
 {
 variants: {
 variant: {
 default:
 "bg-brand text-on-brand shadow-xs hover:bg-brand-hover",
 destructive:
 "bg-danger text-white shadow-xs hover:bg-danger/90 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus dark:bg-danger/60",
 outline:
 "border bg-bg shadow-xs hover:bg-bg-subtle hover:text-fg dark:bg-surface-raised/30 dark:border-line dark:hover:bg-surface-raised/50",
 secondary:
 "bg-surface text-fg shadow-xs hover:bg-surface/80",
 ghost:
 "hover:bg-bg-subtle hover:text-fg dark:hover:bg-bg-subtle/50",
 link: "text-brand underline-offset-4 hover:underline",
 },
 size: {
 default: "min-h-11 px-4 py-2 has-[>svg]:px-3",
 sm: "min-h-11 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
 lg: "min-h-12 rounded-md px-6 has-[>svg]:px-4",
 icon: "size-11",
 },
 },
 defaultVariants: {
 variant: "default",
 size: "default",
 },
 }
)

function Button({
 className,
 variant,
 size,
 asChild = false,
 ...props
}: React.ComponentProps<"button"> &
 VariantProps<typeof buttonVariants> & {
 asChild?: boolean
 }) {
 const Comp = asChild ? Slot : "button"

 return (
 <Comp
 data-slot="button"
 className={cn(buttonVariants({ variant, size, className }))}
 {...props}
 />
 )
}

export { Button, buttonVariants }
