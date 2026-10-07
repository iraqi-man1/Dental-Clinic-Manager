import * as React from "react";
import { cn } from "@/lib/utils";

type NativeSelectProps = Omit<React.ComponentProps<"select">, "multiple" | "size">;

// A native select keeps its options, FormData, validation, and form reset behaviour. Pages pass
// explicit option values whenever the visible label is translated, so stored values stay stable.
export function Select({ className, style, children, ...props }: NativeSelectProps) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        "h-10 min-w-0 appearance-none rounded-lg border border-input bg-background bg-[length:16px_16px] bg-[position:right_0.75rem_center] bg-no-repeat px-3 py-2 text-sm text-foreground shadow-xs outline-none transition-[color,box-shadow] max-sm:min-h-11 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 rtl:bg-[position:left_0.75rem_center]",
        className,
        "pe-9",
      )}
      style={{
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364758b' stroke-width='1.75' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        ...style,
      }}
      {...props}
    >
      {children}
    </select>
  );
}
