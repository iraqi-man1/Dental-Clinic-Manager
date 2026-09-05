"use client";

import { useState, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

type SwitchProps = Omit<ComponentProps<"button">, "defaultChecked"> & {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
};

export function Switch({ checked, defaultChecked = false, onCheckedChange, onClick, className, disabled, ...props }: SwitchProps) {
  const [uncontrolledChecked, setUncontrolledChecked] = useState(defaultChecked);
  const isChecked = checked ?? uncontrolledChecked;

  return (
    <button
      {...props}
      type="button"
      role="switch"
      aria-checked={isChecked}
      data-slot="switch"
      data-state={isChecked ? "checked" : "unchecked"}
      disabled={disabled}
      className={cn(
        "inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent bg-input p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary",
        className,
      )}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        if (checked === undefined) setUncontrolledChecked(!isChecked);
        onCheckedChange?.(!isChecked);
      }}
    >
      <span data-slot="switch-thumb" className={cn("pointer-events-none block size-4 rounded-full bg-white shadow-sm transition-transform", isChecked && "translate-x-5 rtl:-translate-x-5")} />
    </button>
  );
}
