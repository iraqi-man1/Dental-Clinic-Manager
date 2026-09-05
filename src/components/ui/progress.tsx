"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { useClinicPreferences } from "@/lib/clinic-preferences";
import { cn } from "@/lib/utils";

export function Progress({
  className,
  value = 0,
  max = 100,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  const { t } = useClinicPreferences();
  const limit = Number.isFinite(max) && max > 0 ? max : 100;
  const normalized = value === null ? null : Math.min(limit, Math.max(0, Number.isFinite(value) ? value : 0));

  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      value={normalized}
      max={limit}
      aria-label={t("Progress")}
      className={cn("relative h-2 w-full overflow-hidden rounded-full bg-muted", className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none data-[state=indeterminate]:animate-pulse"
        style={{ width: `${normalized === null ? 100 : (normalized / limit) * 100}%` }}
      />
    </ProgressPrimitive.Root>
  );
}
