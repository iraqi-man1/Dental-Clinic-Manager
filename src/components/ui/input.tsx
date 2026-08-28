import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({
  className,
  type,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-lg border border-input bg-background px-3.5 py-2 text-sm shadow-[inset_0_1px_1px_rgba(15,23,42,.025)] outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/85 hover:border-slate-400 focus:border-primary focus:ring-3 focus:ring-primary/12 disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
