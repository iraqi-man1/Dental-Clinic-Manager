import * as React from "react";
import { Button as HeroButton } from "@heroui/react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "shrink-0 rounded-xl font-semibold tracking-[-0.01em] [&_svg]:size-4",
  {
    variants: {
      variant: {
        default: "shadow-[0_1px_2px_rgba(15,23,42,.08)]",
        secondary: "",
        outline: "bg-surface",
        ghost: "",
        destructive: "",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-11 px-6",
        icon: "size-10 p-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export function Button({
  className,
  variant,
  size,
  disabled,
  type,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants>) {
  const heroVariant = {
    default: "primary",
    secondary: "secondary",
    outline: "outline",
    ghost: "ghost",
    destructive: "danger",
  }[variant ?? "default"] as
    | "primary"
    | "secondary"
    | "outline"
    | "ghost"
    | "danger";
  const heroSize = size === "sm" ? "sm" : size === "lg" ? "lg" : "md";
  return (
    <HeroButton
      {...(props as unknown as React.ComponentProps<typeof HeroButton>)}
      type={type}
      variant={heroVariant}
      size={heroSize}
      isIconOnly={size === "icon"}
      isDisabled={disabled}
      className={cn(buttonVariants({ variant, size }), className)}
    />
  );
}

export { buttonVariants };
