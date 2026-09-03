"use client";

import * as React from "react";
import { Modal } from "@heroui/react";
import { cn } from "@/lib/utils";

type DialogProps = {
  children: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function Dialog({ children, open, defaultOpen, onOpenChange }: DialogProps) {
  return (
    <Modal isOpen={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      {children}
    </Modal>
  );
}

export const DialogTrigger = Modal.Trigger;
export const DialogClose = Modal.CloseTrigger;

export function DialogContent({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Modal.Backdrop variant="blur">
      <Modal.Container size="lg" placement="auto" scroll="inside">
        <Modal.Dialog
          className={cn(
            "max-h-[calc(100dvh-2rem)] max-w-lg rounded-3xl border-border bg-overlay p-5 shadow-overlay sm:p-6",
            className,
          )}
        >
          <Modal.CloseTrigger aria-label="Close" />
          {children}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

export function DialogHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <Modal.Header className={cn("space-y-1.5", className)} {...props} />;
}

export function DialogTitle({
  className,
  ...props
}: React.ComponentProps<"h2">) {
  return (
    <Modal.Heading
      className={cn("text-lg font-bold tracking-[-0.02em]", className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "max-w-prose text-sm leading-5 text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function DialogFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <Modal.Footer
      className={cn(
        "mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}
