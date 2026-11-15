import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
 "inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-line-strong focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus aria-invalid:border-danger/50 aria-invalid:border-danger transition-[color,box-shadow] overflow-hidden",
 {
 variants: {
 variant: {
 default:
 "border-transparent bg-brand text-on-brand [a&]:hover:bg-brand-hover",
 secondary:
 "border-transparent bg-surface text-fg [a&]:hover:bg-surface/90",
 destructive:
 "border-transparent bg-danger text-white [a&]:hover:bg-danger/90 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus dark:bg-danger/60",
 outline:
 "text-fg [a&]:hover:bg-bg-subtle [a&]:hover:text-fg",
 },
 },
 defaultVariants: {
 variant: "default",
 },
 }
)

function Badge({
 className,
 variant,
 asChild = false,
 ...props
}: React.ComponentProps<"span"> &
 VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
 const Comp = asChild ? Slot : "span"

 return (
 <Comp
 data-slot="badge"
 className={cn(badgeVariants({ variant }), className)}
 {...props}
 />
 )
}

export { Badge, badgeVariants }
