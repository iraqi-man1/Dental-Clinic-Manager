"use client";

import { FormEvent, useMemo, useState, type ComponentProps } from "react";
import {
  AlertTriangle,
  Boxes,
  Minus,
  PackageCheck,
  Plus,
  Printer,
  Search,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { PrintActions } from "@/components/clinic/print-actions";
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
import type { ClinicInfo, ClinicRole, InventoryItem, PurchaseOrder, PurchaseOrderItem } from "@/lib/types";
import { useClinicPreferences } from "@/lib/clinic-preferences";
import { DEFAULT_CLINIC_TIME_ZONE, clinicTodayKey } from "@/lib/clinic-time";
import { createId } from "@/lib/ids";
import { cn } from "@/lib/utils";
import { persistPurchaseOrder } from "@/lib/supabase/clinic-data";
import {
  DataTable,
  EmptyState,
  FilterBar,
  StatCard,
  type DataTableColumn,
} from "@/components/clinic/app-ui";

export type AdjustStockInput = { itemId: string; delta: number; reason: string };

type StatTone = NonNullable<ComponentProps<typeof StatCard>["tone"]>;

/** Roles that can change stock and create purchase orders. The database enforces the same rule. */
const STOCK_MANAGER_ROLES: ClinicRole[] = ["owner", "admin", "assistant"];
const ALL_CATEGORIES = "All categories";
/** Stored in English so the audit trail does not depend on the workstation language. */
const MANUAL_ADJUSTMENT_REASON = "Manual adjustment";
// Touch targets are 44px on phones and the desktop size from the sm breakpoint.
const TOUCH_HEIGHT = "h-11 sm:h-10";
const TOUCH_ICON = "size-11 sm:size-10";
const TOUCH_STEPPER = "size-11 sm:size-8";

/** PO-YYYYMMDD-XXXXXX. The suffix comes from a random id, so two orders on one day do not collide. */
function purchaseOrderNumber(orderDate: string) {
  const suffix = createId().replaceAll("-", "").slice(0, 6).toUpperCase();
  return `PO-${orderDate.replaceAll("-", "")}-${suffix}`;
}

function StockAdjustDialog({
  item,
  direction,
  onClose,
  onAdjust,
}: {
  item: InventoryItem;
  direction: 1 | -1;
  onClose: () => void;
  onAdjust: (input: AdjustStockInput) => Promise<boolean>;
}) {
  const { t } = useClinicPreferences();
  const [mode, setMode] = useState<"add" | "remove">(direction > 0 ? "add" : "remove");
  const [amount, setAmount] = useState("1");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const quantity = Number(amount);
  const validQuantity = Number.isFinite(quantity) && quantity > 0;
  // Rounded to avoid binary floating-point noise in the stored quantity.
  const delta = Math.round((mode === "add" ? quantity : -quantity) * 1000) / 1000;
  const nextStock = Math.round((item.stock + delta) * 1000) / 1000;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validQuantity) {
      setError(t("Enter a quantity greater than zero."));
      return;
    }
    if (nextStock < 0) {
      setError(t("Stock cannot go below zero"));
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const saved = await onAdjust({
        itemId: item.id,
        delta,
        reason: reason.trim() || MANUAL_ADJUSTMENT_REASON,
      });
      if (saved) onClose();
      else setError(t("Stock could not be updated. Check the quantity and try again."));
    } catch {
      setError(t("Stock could not be updated"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(value) => { if (!value && !saving) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("Adjust stock")}</DialogTitle>
          <DialogDescription>
            {t("Each change is recorded as an inventory movement. Purchase orders never change stock.")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-sm font-semibold" data-no-translate>{item.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("Current stock: {quantity} {unit}", { quantity: item.stock, unit: item.unit })}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-semibold">
              {t("Change")}
              <Select
                value={mode}
                onChange={(event) => setMode(event.target.value as "add" | "remove")}
                className={`mt-1.5 ${TOUCH_HEIGHT} w-full rounded-xl border bg-white px-3 text-sm`}
              >
                <option value="add">{t("Add stock")}</option>
                <option value="remove">{t("Remove stock")}</option>
              </Select>
            </label>
            <label className="text-xs font-semibold">
              {t("Quantity")}
              <Input
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                required
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className={`mt-1.5 ${TOUCH_HEIGHT}`}
                aria-invalid={!validQuantity ? true : undefined}
              />
            </label>
          </div>
          <label className="block text-xs font-semibold">
            {t("Reason")}
            <Input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={t("Manual adjustment")}
              className={`mt-1.5 ${TOUCH_HEIGHT}`}
            />
          </label>
          {validQuantity && (
            <p className={cn("text-xs font-semibold", nextStock < 0 ? "text-danger" : "text-muted-foreground")}>
              {t("New stock: {quantity} {unit}", { quantity: nextStock, unit: item.unit })}
            </p>
          )}
          {error && (
            <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-xs text-danger-soft-foreground">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" className={TOUCH_HEIGHT} onClick={onClose} disabled={saving}>
              {t("Cancel")}
            </Button>
            <Button type="submit" className={TOUCH_HEIGHT} disabled={saving || !validQuantity}>
              {saving ? t("Saving…") : t("Save stock")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PurchaseOrderDialog({
  items,
  clinic,
  timeZone,
  open,
  onOpenChange,
}: {
  items: InventoryItem[];
  clinic: Pick<ClinicInfo, "name" | "phone" | "address">;
  timeZone: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useClinicPreferences();
  const [lines, setLines] = useState<PurchaseOrderItem[]>([]);
  const [preview, setPreview] = useState<PurchaseOrder | null>(null);
  const [saving, setSaving] = useState(false);
  const addExisting = (id: string) => {
    const item = items.find((candidate) => candidate.id === id);
    if (!item || lines.some((line) => line.inventoryItemId === id)) return;
    setLines((current) => [...current, { inventoryItemId: item.id, itemName: item.name, sku: item.sku, unit: item.unit, quantity: Math.max(1, item.minimum - item.stock), notes: "" }]);
  };
  const addManual = () => setLines((current) => [...current, { id: createId(), itemName: "", unit: "units", quantity: 1, notes: "" }]);
  const updateLine = (index: number, patch: Partial<PurchaseOrderItem>) => setLines((current) => current.map((line, position) => position === index ? { ...line, ...patch } : line));
  const closePreview = () => {
    // The order is saved, so the draft lines are cleared to prevent a duplicate order.
    setPreview(null);
    setLines([]);
    onOpenChange(false);
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!lines.length || lines.some((line) => !line.itemName.trim() || !(line.quantity > 0))) {
      toast.error(t("Add at least one valid purchase item"));
      return;
    }
    const form = new FormData(event.currentTarget);
    const orderDate = String(form.get("orderDate"));
    const order: PurchaseOrder = {
      id: createId(),
      orderNumber: purchaseOrderNumber(orderDate),
      orderDate,
      supplierName: String(form.get("supplierName") || ""),
      supplierContact: String(form.get("supplierContact") || ""),
      deliveryAddress: String(form.get("deliveryAddress") || ""),
      notes: String(form.get("notes") || ""),
      status: "issued",
      items: lines,
    };
    setSaving(true);
    try {
      const saved = await persistPurchaseOrder(order);
      if (!saved.ok) {
        toast.error(t(saved.error ?? "Purchase order could not be saved"));
        return;
      }
      setPreview({ ...order, id: saved.id ?? order.id });
      toast.success(t("Purchase order saved. Stock was not changed."));
    } catch {
      toast.error(t("Purchase order could not be saved"));
    } finally {
      setSaving(false);
    }
  };
  if (preview) return <Dialog open={open} onOpenChange={(value) => { if (!value) closePreview(); }}><DialogContent aria-describedby={undefined} className="max-w-3xl print:max-w-none print:border-0 print:shadow-none">
    <DialogTitle className="sr-only">{t("PURCHASE ORDER")}</DialogTitle>
    <div className="print-area bg-white p-2 text-slate-950">
      <div className="flex items-start justify-between gap-4 border-b-2 border-primary pb-5"><div><p className="text-xl font-bold" data-no-translate>{clinic.name}</p><p className="mt-1 text-xs text-muted-foreground" data-no-translate>{Object.values(clinic.address ?? {}).filter(Boolean).join(", ")}</p><p className="text-xs text-muted-foreground" data-no-translate>{clinic.phone}</p></div><div className="text-end"><h2 className="text-2xl font-bold">{t("PURCHASE ORDER")}</h2><p className="mt-1 font-mono text-xs" data-no-translate>{preview.orderNumber}</p><p className="mt-1 text-xs" data-no-translate>{preview.orderDate}</p></div></div>
      <div className="grid grid-cols-2 gap-6 py-5 text-sm"><div><p className="text-[10px] font-bold uppercase text-muted-foreground">{t("Supplier")}</p><p className="mt-1 font-semibold" data-no-translate>{preview.supplierName || t("Open supplier")}</p><p className="text-xs" data-no-translate>{preview.supplierContact}</p></div><div><p className="text-[10px] font-bold uppercase text-muted-foreground">{t("Deliver to")}</p><p className="mt-1 text-xs" data-no-translate>{preview.deliveryAddress || Object.values(clinic.address ?? {}).filter(Boolean).join(", ")}</p></div></div>
      <table className="w-full border-collapse text-sm"><thead><tr className="bg-slate-100 text-start text-[10px] uppercase"><th className="p-2 text-start">#</th><th className="p-2 text-start">{t("Item")}</th><th className="p-2 text-start">{t("SKU")}</th><th className="p-2 text-start">{t("Quantity")}</th><th className="p-2 text-start">{t("Notes")}</th></tr></thead><tbody>{preview.items.map((line, index) => <tr key={line.id ?? line.inventoryItemId ?? index} className="border-b"><td className="p-2">{index + 1}</td><td className="p-2 font-semibold" data-no-translate>{line.itemName}</td><td className="p-2 font-mono text-xs" data-no-translate>{line.sku || "—"}</td><td className="p-2" data-no-translate>{line.quantity} {line.unit}</td><td className="p-2 text-xs" data-no-translate>{line.notes || "—"}</td></tr>)}</tbody></table>
      {preview.notes && <div className="mt-5 rounded-xl bg-slate-50 p-3 text-xs"><strong>{t("Order notes:")}</strong> <span data-no-translate>{preview.notes}</span></div>}
      <div className="mt-12 grid grid-cols-2 gap-16 text-center text-xs"><div className="border-t pt-2">{t("Prepared by")}</div><div className="border-t pt-2">{t("Authorized signature")}</div></div>
    </div>
    <DialogFooter className="print:hidden"><Button variant="outline" className={TOUCH_HEIGHT} onClick={closePreview}>{t("Close")}</Button><PrintActions filename={preview.orderNumber} /></DialogFooter>
  </DialogContent></Dialog>;
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>{t("Create purchase order")}</DialogTitle><DialogDescription>{t("Select stock items or add any material manually. Saving this order does not change inventory quantities.")}</DialogDescription></DialogHeader>
    <form onSubmit={submit} className="space-y-4"><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold">{t("Order date")}<Input name="orderDate" type="date" required defaultValue={clinicTodayKey(timeZone)} className={cn("mt-1.5", TOUCH_HEIGHT)} /></label><label className="text-xs font-semibold">{t("Supplier name")}<Input name="supplierName" className={cn("mt-1.5", TOUCH_HEIGHT)} /></label><label className="text-xs font-semibold">{t("Supplier contact")}<Input name="supplierContact" className={cn("mt-1.5", TOUCH_HEIGHT)} /></label><label className="text-xs font-semibold">{t("Delivery address")}<Input name="deliveryAddress" className={cn("mt-1.5", TOUCH_HEIGHT)} /></label></div>
      <div className="rounded-2xl border p-4"><div className="flex flex-wrap gap-2"><Select aria-label={t("Select inventory item…")} defaultValue="" onChange={(event) => { addExisting(event.target.value); event.target.value = ""; }} className={cn("min-w-60 flex-1 rounded-xl border bg-white px-3 text-sm", TOUCH_HEIGHT)}><option value="">{t("Select inventory item…")}</option>{items.map((item) => <option key={item.id} value={item.id} data-no-translate>{`${item.name} · ${item.stock} ${item.unit}`}</option>)}</Select><Button type="button" variant="outline" className={TOUCH_HEIGHT} onClick={addManual}><Plus /> {t("Manual item")}</Button></div>
        <div className="mt-4 space-y-3">{lines.map((line, index) => <div key={line.id ?? line.inventoryItemId ?? index} className="grid items-end gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-[2fr_110px_1fr_44px]"><label className="text-[10px] font-semibold">{t("Item")}<Input value={line.itemName} onChange={(event) => updateLine(index, { itemName: event.target.value })} className={TOUCH_HEIGHT} /></label><label className="text-[10px] font-semibold">{t("Quantity")}<Input type="number" min="0.01" step="0.01" inputMode="decimal" value={line.quantity} onChange={(event) => updateLine(index, { quantity: Number(event.target.value) })} className={TOUCH_HEIGHT} /></label><label className="text-[10px] font-semibold">{t("Notes")}<Input value={line.notes ?? ""} onChange={(event) => updateLine(index, { notes: event.target.value })} className={TOUCH_HEIGHT} /></label><Button type="button" size="icon" variant="ghost" className={TOUCH_ICON} onClick={() => setLines((current) => current.filter((_, position) => position !== index))} aria-label={t("Remove item")}><Trash2 /></Button></div>)}</div>
      </div><label className="block text-xs font-semibold">{t("Order notes")}<Input name="notes" className={cn("mt-1.5", TOUCH_HEIGHT)} /></label><DialogFooter><Button type="button" variant="outline" className={TOUCH_HEIGHT} onClick={() => onOpenChange(false)}>{t("Cancel")}</Button><Button type="submit" className={TOUCH_HEIGHT} disabled={saving}>{saving ? t("Saving…") : t("Save & preview")}</Button></DialogFooter></form>
  </DialogContent></Dialog>;
}

export function InventoryPage({
  items,
  onAdd,
  onAdjustStock,
  role,
  clinic,
}: {
  items: InventoryItem[];
  onAdd: (item: InventoryItem) => Promise<boolean>;
  onAdjustStock: (input: AdjustStockInput) => Promise<boolean>;
  role: ClinicRole;
  clinic: Pick<ClinicInfo, "name" | "phone" | "address" | "timezone">;
}) {
  const { formatDate, isRtl, t } = useClinicPreferences();
  const timeZone = clinic.timezone ?? DEFAULT_CLINIC_TIME_ZONE;
  const [printOpen, setPrintOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState(ALL_CATEGORIES);
  const [addOpen, setAddOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [adjusting, setAdjusting] = useState<{ item: InventoryItem; direction: 1 | -1 } | null>(null);
  const canManageStock = STOCK_MANAGER_ROLES.includes(role);
  const categories = [
    ALL_CATEGORIES,
    ...Array.from(new Set(items.map((i) => i.category))),
  ];
  const visible = useMemo(
    () =>
      items.filter(
        (i) =>
          (filter === ALL_CATEGORIES || i.category === filter) &&
          `${i.name} ${i.sku} ${i.supplier}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [items, filter, search],
  );
  const openAdd = () => {
    setAddError(null);
    setAddOpen(true);
  };
  const submitItem = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get("name") ?? "");
    const stock = Number(f.get("stock"));
    const minimum = Number(f.get("minimum"));
    if (!name.trim()) {
      setAddError(t("Enter an item name."));
      return;
    }
    if (!Number.isFinite(stock) || stock < 0 || !Number.isFinite(minimum) || minimum < 0) {
      setAddError(t("Stock and reorder level must be zero or more."));
      return;
    }
    const item: InventoryItem = {
      id: createId(),
      name,
      category: String(f.get("category") ?? ""),
      sku: String(f.get("sku") ?? ""),
      stock,
      minimum,
      unit: String(f.get("unit") ?? ""),
      supplier: String(f.get("supplier") ?? ""),
    };
    setAddError(null);
    setAdding(true);
    try {
      const saved = await onAdd(item);
      if (saved) setAddOpen(false);
      else setAddError(t("The inventory item could not be saved."));
    } catch {
      setAddError(t("The inventory item could not be saved."));
    } finally {
      setAdding(false);
    }
  };
  const low = items.filter((i) => i.stock <= i.minimum);
  const coverage = items.length ? Math.round((items.length - low.length) / items.length * 100) : 0;
  const stats: { label: string; value: string; note: string; icon: typeof Boxes; tone: StatTone }[] = [
    { label: t("Inventory items"), value: String(items.length), note: "", icon: Boxes, tone: "info" },
    { label: t("Low stock"), value: String(low.length), note: t("Action required"), icon: AlertTriangle, tone: "danger" },
    { label: t("Stock coverage"), value: `${coverage}%`, note: t("Above reorder level"), icon: PackageCheck, tone: "success" },
  ];
  const columns: DataTableColumn<InventoryItem>[] = [
    {
      key: "item",
      label: t("Item"),
      isRowHeader: true,
      render: (item) => {
        const needsStock = item.stock <= item.minimum;
        return <div className="min-w-40"><p className="text-sm font-semibold" data-no-translate>{item.name}</p><Badge variant={needsStock ? "danger" : "success"} className="mt-1">{needsStock ? t("Low stock") : t("In stock")}</Badge></div>;
      },
    },
    { key: "category", label: t("Category"), render: (item) => <span className="text-xs" data-no-translate>{item.category}</span> },
    { key: "sku", label: t("SKU"), render: (item) => <span className="font-mono text-xs text-muted-foreground" data-no-translate>{item.sku}</span> },
    {
      key: "stock",
      label: t("In stock"),
      render: (item) => <span className={cn("text-sm font-bold", item.stock <= item.minimum && "text-danger")}>{item.stock} <span className="text-[10px] font-normal text-muted-foreground" data-no-translate>{item.unit}</span></span>,
    },
    { key: "minimum", label: t("Reorder at"), render: (item) => <span className="text-xs">{item.minimum} <span data-no-translate>{item.unit}</span></span> },
    { key: "supplier", label: t("Supplier"), render: (item) => <span className="min-w-32 text-xs" data-no-translate>{item.supplier}</span> },
    { key: "expiry", label: t("Expiry"), render: (item) => <span className="text-xs text-muted-foreground" data-no-translate>{item.expiry ?? "—"}</span> },
  ];
  if (canManageStock) {
    columns.push({
      key: "adjust",
      label: t("Adjust"),
      render: (item) => (
        <div className="flex items-center gap-1">
          <Button size="icon" variant="outline" className={TOUCH_STEPPER} onClick={() => setAdjusting({ item, direction: -1 })} aria-label={t("Reduce {name} stock", { name: item.name })}><Minus /></Button>
          <Button size="icon" variant="outline" className={TOUCH_STEPPER} onClick={() => setAdjusting({ item, direction: 1 })} aria-label={t("Increase {name} stock", { name: item.name })}><Plus /></Button>
        </div>
      ),
    });
  }
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => <StatCard key={stat.label} label={stat.label} value={stat.value} note={stat.note} icon={stat.icon} tone={stat.tone} />)}
      </div>
      {low.length > 0 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 sm:flex-row sm:items-center">
          <div className="grid size-10 place-items-center rounded-xl bg-white text-rose-600">
            <AlertTriangle className="size-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-rose-900">
              {t("{count} items need attention", { count: low.length })}
            </p>
            <p className="text-xs text-rose-700" data-no-translate>
              {low.map((i) => i.name).join(", ")}
            </p>
          </div>
          {canManageStock && <Button
            size="sm"
            variant="outline"
            className="h-11 border-rose-200 bg-white text-rose-700 sm:h-8"
            onClick={() => setPurchaseOpen(true)}
          >
            <ShoppingCart />
            {t("Create purchase order")}
          </Button>}
        </div>
      )}
      <FilterBar className="justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row">
          <div className="relative max-w-md flex-1">
            <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn("bg-white ps-9", TOUCH_HEIGHT)}
              placeholder={t("Search inventory…")}
              aria-label={t("Search inventory…")}
            />
          </div>
          <Select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label={t("Category")}
            className={cn("rounded-xl border bg-white px-3 text-sm", TOUCH_HEIGHT)}
          >
            {categories.map((c) => (
              <option key={c} value={c} data-no-translate={c === ALL_CATEGORIES ? undefined : true}>
                {c === ALL_CATEGORIES ? t(c) : c}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManageStock && <Button variant="outline" className={TOUCH_HEIGHT} onClick={() => setPurchaseOpen(true)}><ShoppingCart /> {t("Create purchase order")}</Button>}
          <Button
            variant="outline"
            className={TOUCH_HEIGHT}
            onClick={() => setPrintOpen(true)}
          >
            <Printer />
            {t("Print / Save PDF")}
          </Button>
          {canManageStock && (
            <Button className={TOUCH_HEIGHT} onClick={openAdd}>
              <Plus />
              {t("Add item")}
            </Button>
          )}
        </div>
      </FilterBar>
      <Card className="overflow-hidden">
        {visible.length ? <DataTable ariaLabel={t("Inventory")} columns={columns} rows={visible} getRowKey={(item) => item.id} contentClassName="min-w-[900px]" /> : <EmptyState icon={Boxes} title={t("No inventory items found")} description={t("Try a different search or category, or add a new clinical supply.")} className="m-5" />}
      </Card>
      {adjusting && (
        <StockAdjustDialog
          key={`${adjusting.item.id}-${adjusting.direction}`}
          item={adjusting.item}
          direction={adjusting.direction}
          onClose={() => setAdjusting(null)}
          onAdjust={onAdjustStock}
        />
      )}
      <Dialog open={addOpen} onOpenChange={(value) => { if (!adding) setAddOpen(value); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Add inventory item")}</DialogTitle>
            <DialogDescription>
              {t("Track a new clinical supply and its reorder level.")}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitItem} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                ["name", t("Item name"), t("Bonding agent")],
                ["category", t("Category"), t("Restorative")],
                ["sku", t("SKU"), "RST-BND01"],
                ["supplier", t("Supplier"), "Henry Schein"],
                ["stock", t("Starting stock"), "12"],
                ["minimum", t("Reorder level"), "5"],
                ["unit", t("Unit"), t("boxes")],
              ].map(([name, label, placeholder], i) => (
                <label
                  key={name}
                  className={cn(
                    "text-xs font-semibold",
                    i === 0 && "col-span-2",
                  )}
                >
                  {label}
                  <Input
                    name={name}
                    required
                    min={name === "stock" || name === "minimum" ? "0" : undefined}
                    step={name === "stock" || name === "minimum" ? "any" : undefined}
                    type={
                      name === "stock" || name === "minimum" ? "number" : "text"
                    }
                    inputMode={name === "stock" || name === "minimum" ? "decimal" : undefined}
                    className={cn("mt-1.5", TOUCH_HEIGHT)}
                    placeholder={placeholder}
                    aria-invalid={addError ? true : undefined}
                  />
                </label>
              ))}
            </div>
            {addError && (
              <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-xs text-danger-soft-foreground">
                {addError}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className={TOUCH_HEIGHT}
                onClick={() => setAddOpen(false)}
                disabled={adding}
              >
                {t("Cancel")}
              </Button>
              <Button type="submit" className={TOUCH_HEIGHT} disabled={adding}>
                {adding ? t("Saving…") : t("Add item")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={printOpen} onOpenChange={setPrintOpen}>
        <DialogContent aria-describedby={undefined} className="max-w-5xl">
          <DialogTitle className="sr-only">{t("Inventory report")}</DialogTitle>
          <div className="print-area overflow-x-auto bg-white text-slate-950" dir={isRtl ? "rtl" : "ltr"}>
            <div className="mb-5 flex items-start justify-between gap-4 border-b pb-4 pe-6 print:pe-0"><div><h2 className="text-xl font-bold" data-no-translate>{clinic.name}</h2><p className="text-sm">{t("Inventory report")}</p></div><p className="text-sm">{formatDate(new Date(), { year: "numeric", month: "short", day: "numeric", timeZone })}</p></div>
            <p className="mb-3 text-xs" data-no-translate={filter === ALL_CATEGORIES ? undefined : true}>{filter === ALL_CATEGORIES ? t(filter) : filter}{search ? ` · ${search}` : ""}</p>
            <table className="min-w-[640px] w-full border-collapse text-start text-xs print:min-w-0"><thead><tr>{[t("Item"), t("SKU"), t("In stock"), t("Reorder at"), t("Supplier"), t("Expiry")].map((label) => <th key={label} className="border-b p-2 text-start">{label}</th>)}</tr></thead><tbody>{visible.map((item) => <tr key={item.id}><td className="border-b p-2" data-no-translate>{item.name}</td><td className="border-b p-2" data-no-translate>{item.sku}</td><td className="border-b p-2">{item.stock} <span data-no-translate>{item.unit}</span></td><td className="border-b p-2">{item.minimum} <span data-no-translate>{item.unit}</span></td><td className="border-b p-2" data-no-translate>{item.supplier}</td><td className="border-b p-2" data-no-translate>{item.expiry ?? "—"}</td></tr>)}</tbody></table>
            {!visible.length && <p className="py-5 text-center text-sm">{t("No inventory items found")}</p>}
          </div>
          <DialogFooter className="print:hidden"><Button variant="outline" className={TOUCH_HEIGHT} onClick={() => setPrintOpen(false)}>{t("Close")}</Button><PrintActions filename="inventory" /></DialogFooter>
        </DialogContent>
      </Dialog>
      {canManageStock && (
        <PurchaseOrderDialog items={items} clinic={clinic} timeZone={timeZone} open={purchaseOpen} onOpenChange={setPurchaseOpen} />
      )}
    </div>
  );
}
