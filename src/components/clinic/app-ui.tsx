"use client";

import type { ComponentType, ReactNode } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  status,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  status?: ReactNode;
}) {
  return (
    <header className="mb-7 flex flex-col justify-between gap-4 lg:mb-8 lg:flex-row lg:items-end">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold leading-9 tracking-[-0.035em] text-foreground sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions || status ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {status}
          {actions}
        </div>
      ) : null}
    </header>
  );
}

export function SectionHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col justify-between gap-3 sm:flex-row sm:items-center",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-base font-semibold leading-6 tracking-[-0.018em] text-foreground">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm leading-5 text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

const toneStyles = {
  accent: "bg-primary/8 text-primary",
  info: "bg-sky-50 text-sky-700",
  success: "bg-success-soft text-success-soft-foreground",
  warning: "bg-warning-soft text-warning-soft-foreground",
  danger: "bg-danger-soft text-danger-soft-foreground",
  neutral: "bg-muted text-muted-foreground",
};

export function StatCard({
  label,
  value,
  note,
  icon: Icon,
  tone = "accent",
  accessory,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  note?: ReactNode;
  icon: ComponentType<{ className?: string }>;
  tone?: keyof typeof toneStyles;
  accessory?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("overflow-hidden bg-card", className)}>
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium leading-5 text-muted-foreground">
            {label}
          </p>
          <div
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-lg",
              toneStyles[tone],
            )}
          >
            <Icon className="size-[18px]" />
          </div>
        </div>
        <p className="mt-3 text-[1.875rem] font-semibold leading-9 tracking-[-0.04em] text-foreground tabular-nums">
          {value}
        </p>
        {note || accessory ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            {note ? <p className="text-xs leading-5 text-muted-foreground">{note}</p> : null}
            {accessory}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function FilterBar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-xs sm:flex-row sm:items-center sm:p-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function FormSection({
  title,
  description,
  children,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={cn("min-w-0 space-y-5", className)}>
      <legend className="text-sm font-semibold text-foreground">{title}</legend>
      {description ? <p className="text-sm leading-5 text-muted-foreground">{description}</p> : null}
      <div className="grid gap-4">{children}</div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </fieldset>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: ComponentType<{ className?: string }>;
  title: ReactNode;
  description: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center",
        className,
      )}
    >
      <div className="grid size-12 place-items-center rounded-xl border border-border bg-card text-muted-foreground shadow-xs">
        <Icon className="size-5" />
      </div>
      <div className="mt-4 max-w-sm">
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
        <p className="mt-1.5 text-sm leading-5 text-muted-foreground">
          {description}
        </p>
      </div>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export type DataTableColumn<T> = {
  key: string;
  label: ReactNode;
  render: (row: T) => ReactNode;
  isRowHeader?: boolean;
  className?: string;
};

const rowControlSelector = [
  "a", "button", "input", "select", "textarea", "label",
  "[role='button']", "[role='checkbox']", "[role='switch']",
  "[role='link']", "[role='combobox']", "[contenteditable='true']",
].join(", ");

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  ariaLabel,
  className,
  contentClassName,
  onRowAction,
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  ariaLabel: string;
  className?: string;
  contentClassName?: string;
  onRowAction?: (row: T) => void;
}) {
  return (
    <div className={cn("overflow-hidden rounded-xl bg-card", className)}>
      <Table
        aria-label={ariaLabel}
        className={cn("min-w-full text-sm", contentClassName)}
      >
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((column) => (
              <TableHead
                key={column.key}
                scope="col"
                className={column.className}
              >
                {column.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={getRowKey(row)}
              tabIndex={onRowAction ? 0 : undefined}
              onClick={onRowAction ? (event) => {
                if (event.defaultPrevented) return;
                const target = event.target;
                if (target instanceof Element && target.closest(rowControlSelector)) return;
                onRowAction(row);
              } : undefined}
              onKeyDown={onRowAction ? (event) => {
                if (event.target !== event.currentTarget || event.defaultPrevented) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onRowAction(row);
                }
              } : undefined}
              className={onRowAction ? "cursor-pointer focus-visible:bg-primary/5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring" : undefined}
            >
              {columns.map((column) => (
                column.isRowHeader ? (
                  <th key={column.key} scope="row" className={cn("px-5 py-4 text-start align-middle font-normal", column.className)}>
                    {column.render(row)}
                  </th>
                ) : (
                  <TableCell key={column.key} className={column.className}>
                    {column.render(row)}
                  </TableCell>
                )
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function TablePagination({
  page,
  pages,
  onChange,
  summary,
}: {
  page: number;
  pages: number;
  onChange: (page: number) => void;
  summary?: ReactNode;
}) {
  const shown = Array.from({ length: Math.min(pages, 5) }, (_, index) => {
    if (pages <= 5) return index + 1;
    const start = Math.min(Math.max(1, page - 2), pages - 4);
    return start + index;
  });

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-4">
      <p className="text-sm text-muted-foreground">
        {summary ?? <><span>Page</span> {page} <span>of</span> {pages}</>}
      </p>
      <ul className="flex items-center gap-1">
        <li>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8"
            aria-label="Previous page"
            disabled={page <= 1}
            onClick={() => onChange(page - 1)}
          >
            <ArrowLeft className="size-4 rtl:rotate-180" />
          </Button>
        </li>
        {shown.map((number) => (
          <li key={number}>
            <Button
              type="button"
              variant={number === page ? "secondary" : "ghost"}
              size="icon"
              className={cn("size-8 text-xs", number === page && "bg-primary/8 text-primary")}
              aria-current={number === page ? "page" : undefined}
              onClick={() => onChange(number)}
            >
              {number}
            </Button>
          </li>
        ))}
        <li>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8"
            aria-label="Next page"
            disabled={page >= pages}
            onClick={() => onChange(page + 1)}
          >
            <ArrowRight className="size-4 rtl:rotate-180" />
          </Button>
        </li>
      </ul>
    </nav>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description: ReactNode;
  confirmLabel?: ReactNode;
  cancelLabel?: ReactNode;
  destructive?: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mb-1 grid size-10 place-items-center rounded-xl bg-danger-soft text-danger-soft-foreground">
            <AlertTriangle className="size-5" />
          </div>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-5" aria-label="Loading page">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Card key={index}>
            <CardContent className="space-y-3 p-5">
              <Skeleton className="size-10 rounded-xl" />
              <Skeleton className="h-3 w-24 rounded-full" />
              <Skeleton className="h-7 w-32 rounded-lg" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="space-y-3 p-5">
          <Skeleton className="h-5 w-40 rounded-lg" />
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-12 w-full rounded-xl" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
