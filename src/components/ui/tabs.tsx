"use client";

import { Tabs as HeroTabs } from "@heroui/react";
import { cn } from "@/lib/utils";

type TabsProps = Omit<
  React.ComponentProps<typeof HeroTabs>,
  "selectedKey" | "defaultSelectedKey" | "onSelectionChange" | "children"
> & {
  children: React.ReactNode;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
};

export function Tabs({
  value,
  defaultValue,
  onValueChange,
  className,
  ...props
}: TabsProps) {
  return (
    <HeroTabs
      selectedKey={value}
      defaultSelectedKey={defaultValue}
      onSelectionChange={(key) => onValueChange?.(String(key))}
      className={cn("gap-0", className)}
      {...props}
    />
  );
}

export function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof HeroTabs.List>) {
  return (
    <HeroTabs.ListContainer className="w-fit max-w-full rounded-xl border border-border bg-default">
      <HeroTabs.List
        aria-label="Page sections"
        className={cn("inline-flex h-10 items-center p-1", className)}
        {...props}
      />
    </HeroTabs.ListContainer>
  );
}

export function TabsTrigger({
  className,
  value,
  children,
  ...props
}: Omit<React.ComponentProps<typeof HeroTabs.Tab>, "id" | "children"> & {
  value: string;
  children: React.ReactNode;
}) {
  return (
    <HeroTabs.Tab
      id={value}
      className={cn(
        "inline-flex h-8 items-center justify-center rounded-lg px-3 text-sm font-semibold text-muted-foreground transition data-[selected=true]:text-foreground",
        className,
      )}
      {...props}
    >
      {children}
      <HeroTabs.Indicator className="rounded-lg bg-white shadow-surface" />
    </HeroTabs.Tab>
  );
}

export function TabsContent({
  className,
  value,
  ...props
}: Omit<React.ComponentProps<typeof HeroTabs.Panel>, "id" | "children"> & {
  value: string;
  children: React.ReactNode;
}) {
  return (
    <HeroTabs.Panel
      id={value}
      className={cn("mt-4 p-0 outline-none", className)}
      {...props}
    />
  );
}
