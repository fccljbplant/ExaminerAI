"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

function Tabs({
 className,
 ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
 return (
 <TabsPrimitive.Root
 data-slot="tabs"
 className={cn("flex flex-col gap-3", className)}
 {...props}
 />
 )
}

function TabsList({
 className,
 ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
 return (
 <TabsPrimitive.List
 data-slot="tabs-list"
 className={cn(
 "bg-bg-subtle/60 text-fg-muted inline-flex h-10 w-fit items-center justify-center rounded-xl p-1 gap-0.5 border border-line/50",
 className
 )}
 {...props}
 />
 )
}

function TabsTrigger({
 className,
 ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
 return (
 <TabsPrimitive.Trigger
 data-slot="tabs-trigger"
 className={cn(
 "data-[state=active]:bg-brand data-[state=active]:text-on-brand data-[state=active]:shadow-sm",
 "focus-visible:border-line-strong focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus focus-visible:outline-1",
 "text-fg/70 dark:text-fg-muted",
 "inline-flex h-[calc(100%-2px)] flex-1 items-center justify-center gap-1.5 rounded-lg border border-transparent px-3 py-1 text-sm font-medium whitespace-nowrap transition-all",
 "hover:text-fg hover:bg-bg-subtle/50",
 "disabled:pointer-events-none disabled:opacity-50",
 "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
 className
 )}
 {...props}
 />
 )
}

function TabsContent({
 className,
 ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
 return (
 <TabsPrimitive.Content
 data-slot="tabs-content"
 className={cn("flex-1 outline-none", className)}
 {...props}
 />
 )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
