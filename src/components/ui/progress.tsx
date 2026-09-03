"use client";

import { ProgressBar } from "@heroui/react";
import { cn } from "@/lib/utils";

export function Progress({
  className,
  value = 0,
  ...props
}: Omit<React.ComponentProps<typeof ProgressBar>, "children">) {
  return (
    <ProgressBar
      value={value}
      color="accent"
      className="w-full"
      {...props}
      aria-label={props["aria-label"] ?? "Progress"}
    >
      <ProgressBar.Track
        className={cn("h-2 rounded-full bg-default", className)}
      >
        <ProgressBar.Fill className="rounded-full bg-accent transition-[width]" />
      </ProgressBar.Track>
    </ProgressBar>
  );
}
