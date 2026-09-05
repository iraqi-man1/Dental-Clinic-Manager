"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  Banknote,
  CreditCard,
  Download,
  Plus,
  Printer,
  ReceiptText,
  Search,
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
import { useClinicPreferences } from "@/lib/clinic-preferences";
import type { ClinicRole, Payment, PaymentReceipt } from "@/lib/types";
import {
  DataTable,
  EmptyState,
  FilterBar,
  StatCard,
  type DataTableColumn,
} from "@/components/clinic/app-ui";

const statusVariant = (s: Payment["status"]) =>
  s === "Paid" ? "success" : s === "Overdue" || s === "Unpaid" ? "danger" : "warning";

function PaymentDialog({
  payments,
  onAdd,
}: {
  payments: Payment[];
  onAdd: (input: { invoiceId: string; amount: number; method: Payment["method"]; reference?: string }) => Promise<boolean>;
}) {
  const { formatMoney } = useClinicPreferences();
  const [open, setOpen] = useState(false);
  const [invoiceId, setInvoiceId] = useState("");
  const [saving, setSaving] = useState(false);
  const outstanding = payments.filter((payment) => payment.total - payment.paid - payment.discount > 0);
  const selected = outstanding.find((payment) => payment.id === invoiceId) ?? outstanding[0];
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const f = new FormData(e.currentTarget);
    const saved = await onAdd({
      invoiceId: String(f.get("invoiceId")),
      amount: Number(f.get("amount")),
      method: f.get("method") as Payment["method"],
      reference: String(f.get("reference") ?? ""),
    });
    setSaving(false);
    if (saved) setOpen(false);
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)}>
        <Plus />
        Record payment
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record a payment</DialogTitle>
          <DialogDescription>
            Apply a partial or full payment to an appointment balance.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-xs font-semibold">
            Patient · appointment treatment
            <Select
              name="invoiceId"
              value={invoiceId || outstanding[0]?.id || ""}
              onChange={(event) => setInvoiceId(event.target.value)}
              required
              className="mt-1.5 h-10 w-full rounded-xl border bg-white px-3 text-sm"
            >
              {outstanding.map((payment) => (
                <option key={payment.id} value={payment.id} data-no-translate>{payment.patientName} · {payment.treatment} · {formatMoney(payment.total - payment.paid - payment.discount)}</option>
              ))}
            </Select>
          </label>
          {selected && <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center text-xs"><div><p className="text-muted-foreground">Original price</p><p className="mt-1 font-bold">{formatMoney(selected.originalPrice)}</p></div><div><p className="text-muted-foreground">Paid</p><p className="mt-1 font-bold text-emerald-700">{formatMoney(selected.paid)}</p></div><div><p className="text-muted-foreground">Remaining</p><p className="mt-1 font-bold text-amber-700">{formatMoney(selected.total - selected.paid - selected.discount)}</p></div></div>}
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-semibold">
              Amount paid now
              <Input
                name="amount"
                required
                type="number"
                min="1"
                max={selected ? selected.total - selected.paid - selected.discount : undefined}
                step=".01"
                className="mt-1.5"
                placeholder="0"
              />
            </label>
            <label className="text-xs font-semibold">
              Reference
              <Input name="reference" className="mt-1.5" placeholder="Optional" />
            </label>
            <label className="text-xs font-semibold">
              Method
              <Select
                name="method"
                className="mt-1.5 h-10 w-full rounded-xl border bg-white px-3 text-sm"
              >
                <option>Card</option>
                <option>Cash</option>
                <option>Insurance</option>
                <option>Bank transfer</option>
              </Select>
            </label>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !outstanding.length}>{saving ? "Saving…" : "Save payment"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Receipt({
  receipt,
  clinic,
  open,
  onOpenChange,
}: {
  receipt: { payment: Payment; transaction?: PaymentReceipt } | null;
  clinic: { name: string; phone?: string; address?: Record<string, string> };
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { formatMoney } = useClinicPreferences();
  if (!receipt) return null;
  const { payment, transaction } = receipt;
  const displayClinic = transaction?.clinic?.name ? transaction.clinic : clinic;
  const remaining = transaction?.remaining ?? Math.max(0, payment.total - payment.paid - payment.discount);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="max-w-md print:max-w-none print:border-0 print:shadow-none">
        <DialogTitle className="sr-only">Receipt</DialogTitle>
        <div className="print-area">
          <div className="border-b border-dashed pb-5 text-center">
            <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary text-xl font-black text-white">
              B
            </div>
            <h2 className="mt-3 text-xl font-bold">
              {displayClinic.name}
            </h2>
            <p className="text-xs text-muted-foreground">
              {[displayClinic.phone, displayClinic.address?.street, displayClinic.address?.city].filter(Boolean).join(" · ") || "Clinic information"}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 border-b border-dashed py-5 text-xs">
            <div>
              <p className="text-muted-foreground">Receipt number</p>
              <p className="mt-1 font-bold">{transaction?.receiptNumber ?? payment.receiptNumber ?? payment.invoice}</p>
              <p className="mt-3 text-muted-foreground">Patient</p>
              <p className="mt-1 font-bold" data-no-translate>{payment.patientName}</p>
            </div>
            <div className="text-right">
              <p className="text-muted-foreground">Payment date</p>
              <p className="mt-1 font-bold">{transaction?.date ?? payment.date}</p>
              <p className="mt-3 text-muted-foreground">Method</p>
              <p className="mt-1 font-bold">{transaction?.method ?? payment.method}</p>
            </div>
          </div>
          <div className="space-y-3 border-b border-dashed py-5 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Treatment</span>
              <span className="text-end font-semibold" data-no-translate>{transaction?.treatment ?? payment.treatment}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Original price</span>
              <span>{formatMoney(transaction?.originalPrice ?? payment.originalPrice)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Discount</span>
              <span>-{formatMoney(payment.discount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold">Amount paid</span>
              <span className="font-bold text-primary">
                {formatMoney(transaction?.amount ?? payment.lastPaymentAmount ?? payment.paid)}
              </span>
            </div>
            <div className="flex justify-between border-t pt-3">
              <span className="font-bold">Remaining balance</span>
              <span className="font-bold">{formatMoney(remaining)}</span>
            </div>
          </div>
          <p className="pt-5 text-center text-xs text-muted-foreground">
            Thank you for choosing {displayClinic.name}. This receipt was generated
            electronically.
          </p>
        </div>
        <DialogFooter className="print:hidden">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={() => window.print()}>
            <Printer />
            Print receipt
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
}: {
  payments: Payment[];
  clinic: { name: string; phone?: string; address?: Record<string, string> };
  role: ClinicRole;
  onAdd: (input: { invoiceId: string; amount: number; method: Payment["method"]; reference?: string }) => Promise<boolean>;
}) {
  const { formatMoney } = useClinicPreferences();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [receipt, setReceipt] = useState<{ payment: Payment; transaction?: PaymentReceipt } | null>(null);
  const canViewAnalytics = role === "owner" || role === "admin";
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
  const revenue = payments.reduce((s, p) => s + p.paid, 0),
    outstanding = payments.reduce(
      (s, p) => s + Math.max(0, p.total - p.paid - p.discount),
      0,
    );
  const columns: DataTableColumn<Payment>[] = [
    { key: "invoice", label: "Invoice", isRowHeader: true, render: (payment) => <span className="text-xs font-bold text-primary">{payment.invoice}</span> },
    { key: "patient", label: "Patient", render: (payment) => <span className="min-w-36 text-sm font-semibold" data-no-translate>{payment.patientName}</span> },
    {
      key: "treatment",
      label: "Treatment",
      render: (payment) => <div className="min-w-44" data-no-translate><p className="text-xs font-semibold">{payment.treatment}</p><p className="text-[10px] text-muted-foreground">Original: {formatMoney(payment.originalPrice)}</p></div>,
    },
    { key: "date", label: "Date", render: (payment) => <span className="text-xs text-muted-foreground">{payment.date}</span> },
    { key: "total", label: "Total", render: (payment) => <span className="text-sm font-semibold">{formatMoney(payment.total)}</span> },
    { key: "paid", label: "Paid", render: (payment) => <span className="text-sm font-semibold text-success">{formatMoney(payment.paid)}</span> },
    { key: "remaining", label: "Remaining", render: (payment) => <span className="text-sm font-semibold">{formatMoney(Math.max(0, payment.total - payment.paid - payment.discount))}</span> },
    { key: "method", label: "Method", render: (payment) => <span className="text-xs">{payment.method}</span> },
    { key: "status", label: "Status", render: (payment) => <Badge variant={statusVariant(payment.status)}>{payment.status}</Badge> },
    {
      key: "actions",
      label: <span className="sr-only">Receipts</span>,
      render: (payment) => payment.receipts?.length ? (
        <div className="flex flex-wrap justify-end gap-1">
          {payment.receipts.map((transaction, index) => <Button key={transaction.id} variant="ghost" size="icon" onClick={() => setReceipt({ payment, transaction })} title={`${transaction.receiptNumber} · payment ${index + 1}`}><Printer /></Button>)}
        </div>
      ) : payment.paid > 0 ? <Button variant="ghost" size="icon" onClick={() => setReceipt({ payment })} title="View receipt"><Printer /></Button> : null,
    },
  ];
  return (
    <div className="space-y-5">
      {canViewAnalytics && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Collected this month",
            value: formatMoney(revenue),
            detail: "+16.8% from July",
            icon: Banknote,
            color: "bg-emerald-50 text-emerald-700",
          },
          {
            label: "Outstanding balance",
            value: formatMoney(outstanding),
            detail: "18 open invoices",
            icon: WalletCards,
            color: "bg-amber-50 text-amber-700",
          },
          {
            label: "Insurance pending",
            value: formatMoney(4620),
            detail: "9 claims in review",
            icon: ReceiptText,
            color: "bg-blue-50 text-blue-700",
          },
          {
            label: "Installments due",
            value: formatMoney(2840),
            detail: "Next 30 days",
            icon: CreditCard,
            color: "bg-violet-50 text-violet-700",
          },
        ].map((s, index) => (
          <StatCard
            key={s.label}
            label={s.label}
            value={s.value}
            note={s.detail}
            icon={s.icon}
            tone={index === 0 ? "success" : index === 1 ? "warning" : index === 2 ? "info" : "accent"}
          />
        ))}
      </div>}
      <FilterBar className="justify-between">
        <div className="flex flex-1 gap-2">
          <div className="relative max-w-md flex-1">
            <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-white ps-9"
              placeholder="Search invoices or patients…"
            />
          </div>
          <Select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-xl border bg-white px-3 text-sm"
          >
            <option>All</option>
            <option>Paid</option>
            <option>Partial</option>
            <option>Unpaid</option>
            <option>Overdue</option>
          </Select>
        </div>
        <div className="flex gap-2">
          {canViewAnalytics && <Button
            variant="outline"
            onClick={() => toast.success("Payment report exported")}
          >
            <Download />
            Export
          </Button>}
          <PaymentDialog payments={payments} onAdd={onAdd} />
        </div>
      </FilterBar>
      <Card className="overflow-hidden">
        {visible.length ? <DataTable ariaLabel="Payments and invoices" columns={columns} rows={visible} getRowKey={(payment) => payment.id} contentClassName="min-w-[900px]" /> : <EmptyState icon={ReceiptText} title="No payments found" description="Try a different patient, invoice, or status filter." className="m-5" />}
      </Card>
      <Receipt
        receipt={receipt}
        clinic={clinic}
        open={Boolean(receipt)}
        onOpenChange={(v) => !v && setReceipt(null)}
      />
    </div>
  );
}
