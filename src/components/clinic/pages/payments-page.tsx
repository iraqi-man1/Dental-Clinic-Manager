"use client";

import { FormEvent, useMemo, useState, type ComponentProps } from "react";
import {
  AlertTriangle,
  Banknote,
  Download,
  Plus,
  Printer,
  ReceiptText,
  Search,
  Undo2,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useClinicPreferences } from "@/lib/clinic-preferences";
import { DEFAULT_CLINIC_TIME_ZONE, clinicTodayKey } from "@/lib/clinic-time";
import type { ClinicInfo, ClinicRole, Payment, PaymentReceipt } from "@/lib/types";
import {
  DataTable,
  EmptyState,
  FilterBar,
  StatCard,
  type DataTableColumn,
} from "@/components/clinic/app-ui";

export type RecordPaymentInput = {
  invoiceId: string;
  amount: number;
  method: Payment["method"];
  reference?: string;
};

export type ReversePaymentInput = { paymentId: string; reason: string };

type StatTone = NonNullable<ComponentProps<typeof StatCard>["tone"]>;

const PAYMENT_METHODS: Payment["method"][] = ["Card", "Cash", "Insurance", "Bank transfer"];
const STATUS_FILTERS = ["All", "Paid", "Partial", "Unpaid", "Overdue"] as const;
const RECORD_PAYMENT_ROLES: ClinicRole[] = ["owner", "admin", "billing", "front_desk", "assistant"];
const REVERSE_PAYMENT_ROLES: ClinicRole[] = ["owner", "admin"];
// Touch targets are 44px on phones and the desktop size from the sm breakpoint.
const TOUCH_HEIGHT = "h-11 sm:h-10";
const TOUCH_ICON = "size-11 sm:size-10";

const toCents = (value: number) => Math.round(value * 100);

/** Payment dates are formatted from the `paidAt` instant in the clinic zone and the active locale. */
const PAYMENT_DATE_OPTIONS: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };

/** Balance still owed on an invoice, derived from the loader's totals. The loader supplies the status. */
const remainingOf = (payment: Payment) => Math.max(0, payment.total - payment.discount - payment.paid);

const statusVariant = (s: Payment["status"]) =>
  s === "Paid" ? "success" : s === "Overdue" || s === "Unpaid" ? "danger" : "warning";

function csvCell(value: string | number) {
  if (typeof value === "number") return String(value);
  // Spreadsheet apps run text that starts with these characters as formulas.
  const text = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function RecordPaymentDialog({
  payments,
  onAdd,
}: {
  payments: Payment[];
  onAdd: (input: RecordPaymentInput) => Promise<boolean>;
}) {
  const { formatMoney, t } = useClinicPreferences();
  const [open, setOpen] = useState(false);
  const [invoiceId, setInvoiceId] = useState("");
  const [method, setMethod] = useState<Payment["method"]>("Card");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const outstanding = payments.filter((payment) => remainingOf(payment) > 0);
  const selected = outstanding.find((payment) => payment.id === invoiceId) ?? outstanding[0];
  const selectedRemaining = selected ? remainingOf(selected) : 0;

  const openDialog = () => {
    setError(null);
    setOpen(true);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    const amount = Number(form.get("amount"));
    if (!Number.isFinite(amount) || toCents(amount) <= 0) {
      setError(t("Enter an amount greater than zero."));
      return;
    }
    if (toCents(amount) > toCents(selectedRemaining)) {
      setError(t("The amount cannot be more than the remaining balance."));
      return;
    }
    const reference = String(form.get("reference") ?? "");
    setError(null);
    setSaving(true);
    try {
      const saved = await onAdd({
        invoiceId: selected.id,
        amount: toCents(amount) / 100,
        method,
        reference: reference || undefined,
      });
      if (saved) setOpen(false);
      else setError(t("The payment was not recorded. Check the amount and try again."));
    } catch {
      setError(t("Payment could not be recorded"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!saving) setOpen(value); }}>
      <Button className={TOUCH_HEIGHT} onClick={openDialog}>
        <Plus />
        {t("Record payment")}
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("Record a payment")}</DialogTitle>
          <DialogDescription>
            {t("Apply a partial or full payment to an appointment balance.")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-4">
          <label className="block text-xs font-semibold">
            {t("Patient · appointment treatment")}
            <Select
              name="invoiceId"
              value={selected?.id ?? ""}
              onChange={(event) => setInvoiceId(event.target.value)}
              required
              disabled={!outstanding.length}
              className={`mt-1.5 ${TOUCH_HEIGHT} w-full rounded-xl border bg-white px-3 text-sm`}
            >
              {outstanding.map((payment) => (
                <option key={payment.id} value={payment.id} data-no-translate>
                  {`${payment.patientName} · ${payment.treatment} · ${formatMoney(remainingOf(payment))}`}
                </option>
              ))}
            </Select>
          </label>
          {!outstanding.length && (
            <p className="text-xs text-muted-foreground">{t("No invoices have a balance to collect.")}</p>
          )}
          {selected && (
            <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center text-xs">
              <div>
                <p className="text-muted-foreground">{t("Original price")}</p>
                <p className="mt-1 font-bold">{formatMoney(selected.originalPrice)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t("Paid")}</p>
                <p className="mt-1 font-bold text-emerald-700">{formatMoney(selected.paid)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t("Remaining")}</p>
                <p className="mt-1 font-bold text-amber-700">{formatMoney(selectedRemaining)}</p>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-semibold">
              {t("Amount paid now")}
              <Input
                name="amount"
                required
                type="number"
                step="0.01"
                inputMode="decimal"
                className={`mt-1.5 ${TOUCH_HEIGHT}`}
                placeholder="0"
                aria-invalid={error ? true : undefined}
              />
            </label>
            <label className="text-xs font-semibold">
              {t("Reference")}
              <Input name="reference" className={`mt-1.5 ${TOUCH_HEIGHT}`} placeholder={t("Optional")} />
            </label>
            <label className="text-xs font-semibold">
              {t("Method")}
              <Select
                name="method"
                value={method}
                onChange={(event) => setMethod(event.target.value as Payment["method"])}
                className={`mt-1.5 ${TOUCH_HEIGHT} w-full rounded-xl border bg-white px-3 text-sm`}
              >
                {PAYMENT_METHODS.map((option) => (
                  <option key={option} value={option}>
                    {t(option)}
                  </option>
                ))}
              </Select>
            </label>
          </div>
          {error && (
            <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-xs text-danger-soft-foreground">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" className={TOUCH_HEIGHT} onClick={() => setOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button type="submit" className={TOUCH_HEIGHT} disabled={saving || !selected}>
              {saving ? t("Saving…") : t("Save payment")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReversePaymentDialog({
  payment,
  transaction,
  onClose,
  onReverse,
}: {
  payment: Payment;
  transaction: PaymentReceipt;
  onClose: () => void;
  onReverse: (input: ReversePaymentInput) => Promise<boolean>;
}) {
  const { formatMoney, t } = useClinicPreferences();
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = reason.trim();
    if (!trimmed) {
      setError(t("Enter a reason before reversing this payment."));
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const reversed = await onReverse({ paymentId: transaction.id, reason: trimmed });
      if (reversed) onClose();
      else setError(t("The payment could not be reversed. Check the reason and try again."));
    } catch {
      setError(t("The payment could not be reversed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(value) => { if (!value && !saving) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("Reverse payment")}</DialogTitle>
          <DialogDescription>
            {t("Reversing removes this payment from the invoice balance. The reason is kept in the audit record.")}
          </DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-xs">
          <div>
            <dt className="text-muted-foreground">{t("Receipt number")}</dt>
            <dd className="mt-1 font-bold" data-no-translate>{transaction.receiptNumber}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("Amount paid")}</dt>
            <dd className="mt-1 font-bold">{formatMoney(transaction.amount)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("Patient")}</dt>
            <dd className="mt-1 font-bold" data-no-translate>{payment.patientName}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("Invoice")}</dt>
            <dd className="mt-1 font-bold" data-no-translate>{payment.invoice}</dd>
          </div>
        </dl>
        <form onSubmit={submit} noValidate className="space-y-4">
          <label className="block text-xs font-semibold">
            {t("Reason for reversal")}
            <Textarea
              name="reason"
              required
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="mt-1.5 min-h-24 text-sm"
              aria-invalid={error ? true : undefined}
              placeholder={t("Explain why this payment is being reversed")}
            />
          </label>
          {error && (
            <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-xs text-danger-soft-foreground">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" className={TOUCH_HEIGHT} onClick={onClose} disabled={saving}>
              {t("Cancel")}
            </Button>
            <Button type="submit" variant="destructive" className={TOUCH_HEIGHT} disabled={saving}>
              {saving ? t("Reversing…") : t("Reverse payment")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Receipt({
  receipt,
  clinic,
  timeZone,
  open,
  onOpenChange,
}: {
  receipt: { payment: Payment; transaction?: PaymentReceipt } | null;
  clinic: { name: string; phone?: string; address?: Record<string, string> };
  timeZone: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { formatDate, formatMoney, t } = useClinicPreferences();
  if (!receipt) return null;
  const { payment, transaction } = receipt;
  const displayClinic = transaction?.clinic?.name ? transaction.clinic : clinic;
  const remaining = transaction?.remaining ?? remainingOf(payment);
  const paidAt = transaction?.paidAt ?? payment.paidAt;
  const paidOn = paidAt
    ? formatDate(paidAt, { timeZone, ...PAYMENT_DATE_OPTIONS })
    : (transaction?.date ?? payment.date);
  const clinicLine = [displayClinic.phone, displayClinic.address?.street, displayClinic.address?.city]
    .filter(Boolean)
    .join(" · ");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="max-w-md print:max-w-none print:border-0 print:shadow-none">
        <DialogTitle className="sr-only">{t("Receipt")}</DialogTitle>
        <div className="print-area">
          <div className="border-b border-dashed pb-5 text-center">
            <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary text-xl font-black text-white">
              B
            </div>
            <h2 className="mt-3 text-xl font-bold" data-no-translate>
              {displayClinic.name}
            </h2>
            <p className="text-xs text-muted-foreground" data-no-translate>
              {clinicLine || t("Clinic information")}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 border-b border-dashed py-5 text-xs">
            <div>
              <p className="text-muted-foreground">{t("Receipt number")}</p>
              <p className="mt-1 font-bold" data-no-translate>
                {transaction?.receiptNumber ?? payment.receiptNumber ?? payment.invoice}
              </p>
              <p className="mt-3 text-muted-foreground">{t("Patient")}</p>
              <p className="mt-1 font-bold" data-no-translate>{payment.patientName}</p>
            </div>
            <div className="text-end">
              <p className="text-muted-foreground">{t("Payment date")}</p>
              <p className="mt-1 font-bold">{paidOn}</p>
              <p className="mt-3 text-muted-foreground">{t("Method")}</p>
              <p className="mt-1 font-bold">{t(transaction?.method ?? payment.method)}</p>
            </div>
          </div>
          <div className="space-y-3 border-b border-dashed py-5 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">{t("Treatment")}</span>
              <span className="text-end font-semibold" data-no-translate>{transaction?.treatment ?? payment.treatment}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("Original price")}</span>
              <span>{formatMoney(transaction?.originalPrice ?? payment.originalPrice)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("Discount")}</span>
              <span>-{formatMoney(payment.discount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold">{t("Amount paid")}</span>
              <span className="font-bold text-primary">
                {formatMoney(transaction?.amount ?? payment.lastPaymentAmount ?? payment.paid)}
              </span>
            </div>
            <div className="flex justify-between border-t pt-3">
              <span className="font-bold">{t("Remaining balance")}</span>
              <span className="font-bold">{formatMoney(remaining)}</span>
            </div>
          </div>
          <p className="pt-5 text-center text-xs text-muted-foreground">
            {t("Thank you for choosing {name}. This receipt was generated electronically.", {
              name: displayClinic.name,
            })}
          </p>
        </div>
        <DialogFooter className="print:hidden">
          <Button variant="outline" className={TOUCH_HEIGHT} onClick={() => onOpenChange(false)}>
            {t("Close")}
          </Button>
          <Button className={TOUCH_HEIGHT} onClick={() => window.print()}>
            <Printer />
            {t("Print receipt")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PaymentsPage({
  payments,
  clinic,
  role,
  onAdd,
  onReverse,
}: {
  payments: Payment[];
  clinic: Pick<ClinicInfo, "name" | "phone" | "address" | "timezone">;
  role: ClinicRole;
  onAdd: (input: RecordPaymentInput) => Promise<boolean>;
  onReverse: (input: ReversePaymentInput) => Promise<boolean>;
}) {
  const { formatDate, formatMoney, t } = useClinicPreferences();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<(typeof STATUS_FILTERS)[number]>("All");
  const [receipt, setReceipt] = useState<{ payment: Payment; transaction?: PaymentReceipt } | null>(null);
  const [reversal, setReversal] = useState<{ payment: Payment; transaction: PaymentReceipt } | null>(null);
  const canViewAnalytics = role === "owner" || role === "admin";
  const canRecordPayment = RECORD_PAYMENT_ROLES.includes(role);
  const canReversePayment = REVERSE_PAYMENT_ROLES.includes(role);
  const timeZone = clinic.timezone ?? DEFAULT_CLINIC_TIME_ZONE;
  // The English `date` label is a fallback for a record without an instant. Localized output uses `paidAt`.
  const paymentDateText = (payment: Payment) =>
    payment.paidAt ? formatDate(payment.paidAt, { timeZone, ...PAYMENT_DATE_OPTIONS }) : payment.date;
  const visible = useMemo(
    () =>
      payments.filter(
        (p) =>
          (filter === "All" || p.status === filter) &&
          `${p.patientName} ${p.invoice}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [payments, search, filter],
  );

  const collected = payments.reduce((sum, p) => sum + p.paid, 0);
  const openInvoices = payments.filter((p) => remainingOf(p) > 0);
  const outstanding = openInvoices.reduce((sum, p) => sum + remainingOf(p), 0);
  const partlyPaid = payments.filter((p) => p.status === "Partial");
  const overdue = payments.filter((p) => p.status === "Overdue");
  const sumRemaining = (list: Payment[]) => list.reduce((sum, p) => sum + remainingOf(p), 0);

  const stats: { label: string; value: string; note: string; icon: typeof Banknote; tone: StatTone }[] = [
    {
      label: t("Total collected"),
      value: formatMoney(collected),
      note: t("{count} invoices", { count: payments.length }),
      icon: Banknote,
      tone: "success",
    },
    {
      label: t("Outstanding balance"),
      value: formatMoney(outstanding),
      note: t("{count} open invoices", { count: openInvoices.length }),
      icon: WalletCards,
      tone: "warning",
    },
    {
      label: t("Partly paid"),
      value: String(partlyPaid.length),
      note: t("{amount} still due", { amount: formatMoney(sumRemaining(partlyPaid)) }),
      icon: ReceiptText,
      tone: "info",
    },
    {
      label: t("Overdue"),
      value: String(overdue.length),
      note: t("{amount} still due", { amount: formatMoney(sumRemaining(overdue)) }),
      icon: AlertTriangle,
      tone: "danger",
    },
  ];

  const exportVisible = () => {
    try {
      const rows: (string | number)[][] = [
        [t("Invoice"), t("Patient"), t("Treatment"), t("Date"), t("Total"), t("Discount"), t("Paid"), t("Remaining"), t("Method"), t("Status")],
        ...visible.map((payment) => [
          payment.invoice,
          payment.patientName,
          payment.treatment,
          paymentDateText(payment),
          payment.total,
          payment.discount,
          payment.paid,
          remainingOf(payment),
          payment.method,
          payment.status,
        ]),
      ];
      downloadCsv(`payments-${clinicTodayKey(timeZone)}.csv`, rows);
      toast.success(t("Payment report exported"));
    } catch {
      toast.error(t("Report could not be downloaded"));
    }
  };

  const columns: DataTableColumn<Payment>[] = [
    {
      key: "invoice",
      label: t("Invoice"),
      isRowHeader: true,
      render: (payment) => <span className="text-xs font-bold text-primary" data-no-translate>{payment.invoice}</span>,
    },
    {
      key: "patient",
      label: t("Patient"),
      render: (payment) => <span className="min-w-36 text-sm font-semibold" data-no-translate>{payment.patientName}</span>,
    },
    {
      key: "treatment",
      label: t("Treatment"),
      render: (payment) => (
        <div className="min-w-44">
          <p className="text-xs font-semibold" data-no-translate>{payment.treatment}</p>
          <p className="text-[10px] text-muted-foreground">
            {t("Original: {amount}", { amount: formatMoney(payment.originalPrice) })}
          </p>
        </div>
      ),
    },
    { key: "date", label: t("Date"), render: (payment) => <span className="text-xs text-muted-foreground">{paymentDateText(payment)}</span> },
    { key: "total", label: t("Total"), render: (payment) => <span className="text-sm font-semibold">{formatMoney(payment.total)}</span> },
    { key: "paid", label: t("Paid"), render: (payment) => <span className="text-sm font-semibold text-success">{formatMoney(payment.paid)}</span> },
    { key: "remaining", label: t("Remaining"), render: (payment) => <span className="text-sm font-semibold">{formatMoney(remainingOf(payment))}</span> },
    { key: "method", label: t("Method"), render: (payment) => <span className="text-xs">{t(payment.method)}</span> },
    { key: "status", label: t("Status"), render: (payment) => <Badge variant={statusVariant(payment.status)}>{t(payment.status)}</Badge> },
    {
      key: "actions",
      label: <span className="sr-only">{t("Receipts")}</span>,
      render: (payment) => {
        const receipts = payment.receipts ?? [];
        if (!receipts.length) {
          return payment.paid > 0 ? (
            <Button variant="ghost" size="icon" className={TOUCH_ICON} onClick={() => setReceipt({ payment })} title={t("View receipt")} aria-label={t("View receipt")}>
              <Printer />
            </Button>
          ) : null;
        }
        return (
          <div className="flex flex-wrap justify-end gap-1">
            {receipts.map((transaction, index) => (
              <div key={transaction.id} className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className={TOUCH_ICON}
                  onClick={() => setReceipt({ payment, transaction })}
                  title={`${transaction.receiptNumber} · ${t("Payment {index}", { index: index + 1 })}`}
                  aria-label={t("View receipt {number}", { number: transaction.receiptNumber })}
                >
                  <Printer />
                </Button>
                {canReversePayment && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`${TOUCH_ICON} text-danger`}
                    onClick={() => setReversal({ payment, transaction })}
                    title={t("Reverse payment")}
                    aria-label={t("Reverse payment {number}", { number: transaction.receiptNumber })}
                  >
                    <Undo2 />
                  </Button>
                )}
              </div>
            ))}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-5">
      {canViewAnalytics && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((s) => (
            <StatCard key={s.label} label={s.label} value={s.value} note={s.note} icon={s.icon} tone={s.tone} />
          ))}
        </div>
      )}
      <FilterBar className="justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row">
          <div className="relative max-w-md flex-1">
            <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`bg-white ps-9 ${TOUCH_HEIGHT}`}
              placeholder={t("Search invoices or patients…")}
              aria-label={t("Search invoices or patients…")}
            />
          </div>
          <Select
            value={filter}
            onChange={(e) => setFilter(e.target.value as (typeof STATUS_FILTERS)[number])}
            aria-label={t("Status")}
            className={`${TOUCH_HEIGHT} rounded-xl border bg-white px-3 text-sm`}
          >
            {STATUS_FILTERS.map((option) => (
              <option key={option} value={option}>
                {t(option)}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-wrap gap-2">
          {canViewAnalytics && (
            <Button variant="outline" className={TOUCH_HEIGHT} onClick={exportVisible} disabled={!visible.length}>
              <Download />
              {t("Export")}
            </Button>
          )}
          {canRecordPayment && <RecordPaymentDialog payments={payments} onAdd={onAdd} />}
        </div>
      </FilterBar>
      <Card className="overflow-hidden">
        {visible.length ? (
          <DataTable
            ariaLabel={t("Payments and invoices")}
            columns={columns}
            rows={visible}
            getRowKey={(payment) => payment.id}
            contentClassName="min-w-[900px]"
          />
        ) : (
          <EmptyState
            icon={ReceiptText}
            title={t("No payments found")}
            description={t("Try a different patient, invoice, or status filter.")}
            className="m-5"
          />
        )}
      </Card>
      <Receipt
        receipt={receipt}
        clinic={clinic}
        timeZone={timeZone}
        open={Boolean(receipt)}
        onOpenChange={(v) => !v && setReceipt(null)}
      />
      {reversal && (
        <ReversePaymentDialog
          payment={reversal.payment}
          transaction={reversal.transaction}
          onClose={() => setReversal(null)}
          onReverse={onReverse}
        />
      )}
    </div>
  );
}
