import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex min-h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-[10px] font-semibold leading-4 [&_svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-primary/15 bg-primary/10 text-primary",
        success: "border-emerald-200/70 bg-emerald-50 text-emerald-700",
        warning: "border-amber-200/70 bg-amber-50 text-amber-700",
        danger: "border-rose-200/70 bg-rose-50 text-rose-700",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "border-border bg-background text-muted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}
