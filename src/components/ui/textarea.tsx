"use client";

import * as React from "react";
import { TextArea as HeroTextArea } from "@heroui/react";
import { cn } from "@/lib/utils";

export function Textarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <HeroTextArea
      fullWidth
      className={cn(
        "min-h-24 w-full resize-y rounded-xl border border-input bg-white px-3.5 py-3 text-sm shadow-field placeholder:text-muted-foreground/80",
        className,
      )}
      {...(props as unknown as React.ComponentProps<typeof HeroTextArea>)}
    />
  );
}
