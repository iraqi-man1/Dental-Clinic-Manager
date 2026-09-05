"use client";

import type { ComponentProps } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function Checkbox({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  return (
    <span className="relative inline-flex size-4 shrink-0 align-middle">
      <input
        data-slot="checkbox"
        type="checkbox"
        className={cn(
          "peer size-4 cursor-pointer appearance-none rounded-[4px] border border-input bg-background shadow-xs transition-colors checked:border-primary checked:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
      <Check aria-hidden="true" className="pointer-events-none absolute inset-0 hidden size-4 stroke-[3] p-0.5 text-primary-foreground peer-checked:block peer-disabled:opacity-50" />
    </span>
  );
}
