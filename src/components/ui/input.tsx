import * as React from "react";
import { Input as HeroInput } from "@heroui/react";
import { cn } from "@/lib/utils";

export function Input({
  className,
  type,
  disabled,
  required,
  readOnly,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <HeroInput
      type={type}
      disabled={disabled}
      required={required}
      readOnly={readOnly}
      fullWidth
      className={cn(
        "h-10 w-full rounded-xl border-input bg-white px-3.5 text-sm shadow-field placeholder:text-muted-foreground/80",
        className,
      )}
      {...(props as unknown as React.ComponentProps<typeof HeroInput>)}
    />
  );
}
