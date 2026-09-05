import * as React from "react";
import { cn } from "@/lib/utils";

type NativeSelectProps = Omit<React.ComponentProps<"select">, "multiple" | "size">;

function preserveOptionValues(children: React.ReactNode): React.ReactNode {
  return React.Children.map(children, (child) => {
    if (!React.isValidElement(child)) return child;
    if (child.type === React.Fragment || child.type === "optgroup") {
      const group = child as React.ReactElement<{ children?: React.ReactNode }>;
      return React.cloneElement(group, {}, preserveOptionValues(group.props.children));
    }
    if (child.type !== "option") return child;
    const option = child as React.ReactElement<React.ComponentProps<"option">>;
    return React.cloneElement(option, {
      // The document translator changes displayed option text in Arabic. An
      // explicit value keeps that display change out of persisted form data.
      value: option.props.value ?? React.Children.toArray(option.props.children).join(""),
    });
  });
}

// Preserve native options, FormData, validation, and handlers that reset the
// selected value after adding an item while following shadcn Native Select.
export function Select({ className, style, children, ...props }: NativeSelectProps) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        "h-10 min-w-0 appearance-none rounded-lg border border-input bg-background bg-[length:16px_16px] bg-[position:right_0.75rem_center] bg-no-repeat px-3 py-2 text-sm text-foreground shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 rtl:bg-[position:left_0.75rem_center]",
        className,
        "pe-9",
      )}
      style={{
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364758b' stroke-width='1.75' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        ...style,
      }}
      {...props}
    >
      {preserveOptionValues(children)}
    </select>
  );
}
