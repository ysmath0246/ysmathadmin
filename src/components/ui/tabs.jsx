// src/components/ui/tabs.jsx
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { clsx } from "clsx"

export const Tabs = TabsPrimitive.Root

export const TabsList = ({ className, ...props }) => (
  <TabsPrimitive.List
    className={clsx("inline-flex h-10 items-center justify-center rounded-md bg-gray-100 p-1 text-gray-500", className)}
    {...props}
  />
)

export const TabsTrigger = ({ className, ...props }) => (
  <TabsPrimitive.Trigger
    className={clsx(
      "inline-flex items-center justify-center rounded-sm px-3 py-1.5 text-sm font-medium transition-all",
      "data-[state=active]:bg-white data-[state=active]:text-gray-900",
      className
    )}
    {...props}
  />
)

export const TabsContent = ({ className, ...props }) => (
  <TabsPrimitive.Content
    className={clsx("mt-2 rounded-md border p-4", className)}
    {...props}
  />
)
