"use client";

import * as React from "react";
import { Label, ListBox, Select as HeroSelect } from "@heroui/react";
import { cn } from "@/lib/utils";

type NativeSelectProps = Omit<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  "multiple" | "size"
>;

type SelectOption = {
  disabled?: boolean;
  label: string;
  noTranslate?: boolean;
  value: string;
};

const EMPTY_VALUE = "__clinic_empty_value__";

function collectOptions(children: React.ReactNode): SelectOption[] {
  const options: SelectOption[] = [];

  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    if (child.type === React.Fragment || child.type === "optgroup") {
      collectOptions(
        (child.props as { children?: React.ReactNode }).children,
      ).forEach((option) => options.push(option));
      return;
    }
    if (child.type !== "option") return;
    const props = child.props as React.OptionHTMLAttributes<HTMLOptionElement>;
    options.push({
      value: String(props.value ?? props.children ?? ""),
      label: React.Children.toArray(props.children).join(""),
      disabled: props.disabled,
      noTranslate: Boolean(props["data-no-translate" as keyof typeof props]),
    });
  });

  return options;
}

function toHeroValue(value: string | number | readonly string[] | undefined) {
  if (Array.isArray(value)) return String(value[0] ?? EMPTY_VALUE);
  if (value === undefined) return undefined;
  return String(value) || EMPTY_VALUE;
}

export function Select({
  children,
  className,
  defaultValue,
  disabled,
  name,
  onChange,
  required,
  value,
  ...props
}: NativeSelectProps) {
  const options = collectOptions(children);
  const ariaLabel = props["aria-label"] ?? name ?? "Select an option";
  const fullWidth = className?.includes("w-full") ?? false;

  return (
    <HeroSelect
      aria-label={ariaLabel}
      name={name}
      value={toHeroValue(value)}
      defaultValue={toHeroValue(defaultValue)}
      isDisabled={disabled}
      isRequired={required}
      fullWidth={fullWidth}
      className={cn(
        "border-0 bg-transparent p-0 shadow-none",
        fullWidth ? "w-full" : "min-w-[9rem]",
        className?.includes("mt-1.5") && "mt-1.5",
        className?.includes("mt-1") && "mt-1",
      )}
      onChange={(next) => {
        const nextValue = String(next ?? "");
        const normalized = nextValue === EMPTY_VALUE ? "" : nextValue;
        onChange?.({
          target: { value: normalized },
          currentTarget: { value: normalized },
        } as React.ChangeEvent<HTMLSelectElement>);
      }}
    >
      <HeroSelect.Trigger className="h-10 min-w-[9rem] rounded-xl border border-field-border bg-field px-3 text-sm shadow-field">
        <HeroSelect.Value />
        <HeroSelect.Indicator />
      </HeroSelect.Trigger>
      <HeroSelect.Popover className="min-w-(--trigger-width) rounded-2xl border border-border bg-overlay p-1.5 shadow-overlay">
        <ListBox aria-label={ariaLabel}>
          {options.map((option) => (
            <ListBox.Item
              id={option.value || EMPTY_VALUE}
              key={option.value || EMPTY_VALUE}
              textValue={option.label}
              isDisabled={option.disabled}
              className="rounded-xl px-3 py-2 text-sm data-[focused=true]:bg-accent-soft data-[selected=true]:text-accent-soft-foreground"
            >
              <Label data-no-translate={option.noTranslate || undefined}>
                {option.label}
              </Label>
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </HeroSelect.Popover>
    </HeroSelect>
  );
}
