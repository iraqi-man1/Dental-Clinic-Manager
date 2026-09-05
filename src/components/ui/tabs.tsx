"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { useClinicPreferences } from "@/lib/clinic-preferences";
import { cn } from "@/lib/utils";

export function Tabs({ className, dir, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  const { language } = useClinicPreferences();
  return <TabsPrimitive.Root data-slot="tabs" dir={dir ?? (language === "ar" ? "rtl" : "ltr")} className={cn("min-w-0", className)} {...props} />;
}

export function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  const { t } = useClinicPreferences();
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      aria-label={t("Page sections")}
      className={cn("inline-flex h-10 w-fit items-center justify-center gap-1 rounded-lg bg-muted p-1 text-muted-foreground", className)}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn("inline-flex h-8 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 text-sm font-medium outline-none transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:ring-ring/20 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm [&_svg]:size-4", className)}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content data-slot="tabs-content" className={cn("mt-4 min-w-0 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/20", className)} {...props} />;
}
