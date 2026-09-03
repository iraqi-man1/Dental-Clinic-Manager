import * as React from "react";
import { Chip } from "@heroui/react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex min-h-5 items-center rounded-lg px-2 py-0.5 text-[10px] font-bold leading-none tracking-[.01em]",
  {
    variants: {
      variant: {
        default: "border-primary/15 bg-primary/10 text-primary",
        success: "border-emerald-200/70 bg-emerald-50 text-emerald-700",
        warning: "border-amber-200/70 bg-amber-50 text-amber-700",
        danger: "border-rose-200/70 bg-rose-50 text-rose-700",
        secondary: "bg-secondary text-secondary-foreground",
        outline: "border border-border bg-background text-muted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Badge({
  className,
  variant,
  children,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  const color = {
    default: "accent",
    success: "success",
    warning: "warning",
    danger: "danger",
    secondary: "default",
    outline: "default",
  }[variant ?? "default"] as
    | "accent"
    | "success"
    | "warning"
    | "danger"
    | "default";
  const chipVariant = variant === "outline" ? "tertiary" : "soft";
  return (
    <Chip
      {...props}
      color={color}
      size="sm"
      variant={chipVariant}
      className={cn(badgeVariants({ variant }), className)}
    >
      {children}
    </Chip>
  );
}
