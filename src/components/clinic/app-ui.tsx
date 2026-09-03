"use client";

import type { ComponentType, ReactNode } from "react";
import {
  EmptyState as HeroEmptyState,
  Fieldset,
  Pagination,
  Skeleton,
  Table,
} from "@heroui/react";
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
    <header className="mb-6 flex flex-col justify-between gap-4 lg:mb-7 lg:flex-row lg:items-end">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold leading-8 tracking-[-0.035em] text-foreground sm:text-[1.75rem]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-3xl text-sm leading-5 text-muted-foreground">
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
        <h2 className="text-base font-bold leading-6 tracking-[-0.018em] text-foreground">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 max-w-2xl text-xs leading-[1.45] text-muted-foreground sm:text-sm">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

const toneStyles = {
  accent: "bg-accent-soft text-accent-soft-foreground",
  info: "bg-sky-50 text-sky-700",
  success: "bg-success-soft text-success-soft-foreground",
  warning: "bg-warning-soft text-warning-soft-foreground",
  danger: "bg-danger-soft text-danger-soft-foreground",
  neutral: "bg-default text-default-foreground",
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
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="p-4 sm:p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div
            className={cn(
              "grid size-10 shrink-0 place-items-center rounded-xl",
              toneStyles[tone],
            )}
          >
            <Icon className="size-[18px]" />
          </div>
          {accessory}
        </div>
        <p className="text-[11px] font-bold uppercase leading-4 tracking-[0.07em] text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 text-2xl font-bold leading-8 tracking-[-0.03em] text-foreground">
          {value}
        </p>
        {note ? (
          <p className="mt-1 text-xs leading-4 text-muted-foreground">{note}</p>
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
        "flex flex-col gap-3 rounded-2xl border border-border bg-surface p-3 shadow-card sm:flex-row sm:items-center sm:p-4",
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
    <Fieldset className={cn("space-y-5", className)}>
      <div>
        <Fieldset.Legend className="text-sm font-bold text-foreground">
          {title}
        </Fieldset.Legend>
        {description ? (
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      <Fieldset.Group className="grid gap-4">{children}</Fieldset.Group>
      {actions ? <Fieldset.Actions>{actions}</Fieldset.Actions> : null}
    </Fieldset>
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
    <HeroEmptyState
      className={cn(
        "grid min-h-56 place-items-center rounded-2xl border border-dashed border-border bg-surface-secondary/55 p-8 text-center",
        className,
      )}
    >
      <div className="grid size-12 place-items-center rounded-2xl bg-default text-muted-foreground">
        <Icon className="size-5" />
      </div>
      <div className="mt-4 max-w-sm">
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
        <p className="mt-1.5 text-sm leading-5 text-muted-foreground">
          {description}
        </p>
      </div>
      {action ? <div className="mt-5">{action}</div> : null}
    </HeroEmptyState>
  );
}

export type DataTableColumn<T> = {
  key: string;
  label: ReactNode;
  render: (row: T) => ReactNode;
  isRowHeader?: boolean;
  className?: string;
};

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
    <Table className={cn("rounded-2xl", className)} variant="secondary">
      <Table.ScrollContainer className="overflow-x-auto">
        <Table.Content
          aria-label={ariaLabel}
          className={cn("min-w-full text-sm", contentClassName)}
        >
          <Table.Header>
            {columns.map((column) => (
              <Table.Column
                id={column.key}
                key={column.key}
                isRowHeader={column.isRowHeader}
                className={column.className}
              >
                {column.label}
              </Table.Column>
            ))}
          </Table.Header>
          <Table.Body>
            {rows.map((row) => (
              <Table.Row
                id={getRowKey(row)}
                key={getRowKey(row)}
                onAction={onRowAction ? () => onRowAction(row) : undefined}
                className={onRowAction ? "cursor-pointer" : undefined}
              >
                {columns.map((column) => (
                  <Table.Cell key={column.key} className={column.className}>
                    {column.render(row)}
                  </Table.Cell>
                ))}
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
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
    <Pagination size="sm" className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
      <Pagination.Summary className="text-xs text-muted-foreground">
        {summary ?? `Page ${page} of ${pages}`}
      </Pagination.Summary>
      <Pagination.Content>
        <Pagination.Item>
          <Pagination.Previous
            aria-label="Previous page"
            isDisabled={page <= 1}
            onPress={() => onChange(page - 1)}
          >
            <ArrowLeft className="size-4 rtl:rotate-180" />
          </Pagination.Previous>
        </Pagination.Item>
        {shown.map((number) => (
          <Pagination.Item key={number}>
            <Pagination.Link
              isActive={number === page}
              onPress={() => onChange(number)}
            >
              {number}
            </Pagination.Link>
          </Pagination.Item>
        ))}
        <Pagination.Item>
          <Pagination.Next
            aria-label="Next page"
            isDisabled={page >= pages}
            onPress={() => onChange(page + 1)}
          >
            <ArrowRight className="size-4 rtl:rotate-180" />
          </Pagination.Next>
        </Pagination.Item>
      </Pagination.Content>
    </Pagination>
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
