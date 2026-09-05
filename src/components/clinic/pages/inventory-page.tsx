"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  Download,
  Minus,
  PackageCheck,
  Plus,
  Search,
  ShoppingCart,
  Printer,
  Trash2,
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
import type { ClinicRole, InventoryItem, PurchaseOrder, PurchaseOrderItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { persistPurchaseOrder } from "@/lib/supabase/clinic-data";
import {
  DataTable,
  EmptyState,
  FilterBar,
  StatCard,
  type DataTableColumn,
} from "@/components/clinic/app-ui";

function PurchaseOrderDialog({ items, clinic, open, onOpenChange }: {
  items: InventoryItem[];
  clinic: { name: string; phone?: string; address?: Record<string, string> };
  open: boolean; onOpenChange: (open: boolean) => void;
}) {
  const [lines, setLines] = useState<PurchaseOrderItem[]>([]);
  const [preview, setPreview] = useState<PurchaseOrder | null>(null);
  const [saving, setSaving] = useState(false);
  const addExisting = (id: string) => {
    const item = items.find((candidate) => candidate.id === id);
    if (!item || lines.some((line) => line.inventoryItemId === id)) return;
    setLines((current) => [...current, { inventoryItemId: item.id, itemName: item.name, sku: item.sku, unit: item.unit, quantity: Math.max(1, item.minimum - item.stock), notes: "" }]);
  };
  const addManual = () => setLines((current) => [...current, { id: crypto.randomUUID(), itemName: "", unit: "units", quantity: 1, notes: "" }]);
  const updateLine = (index: number, patch: Partial<PurchaseOrderItem>) => setLines((current) => current.map((line, position) => position === index ? { ...line, ...patch } : line));
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!lines.length || lines.some((line) => !line.itemName.trim() || line.quantity <= 0)) { toast.error("Add at least one valid purchase item"); return; }
    const form = new FormData(event.currentTarget);
    const order: PurchaseOrder = {
      id: crypto.randomUUID(), orderNumber: `PO-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${Math.floor(1000 + Math.random() * 9000)}`,
      orderDate: String(form.get("orderDate")), supplierName: String(form.get("supplierName") || ""),
      supplierContact: String(form.get("supplierContact") || ""), deliveryAddress: String(form.get("deliveryAddress") || ""),
      notes: String(form.get("notes") || ""), status: "issued", items: lines,
    };
    setSaving(true); const saved = await persistPurchaseOrder(order); setSaving(false);
    if (!saved.ok && !items.every((item) => item.id.startsWith("i"))) { toast.error(saved.error ?? "Purchase order could not be saved"); return; }
    setPreview({ ...order, id: saved.id ?? order.id }); toast.success("Purchase order saved without changing stock");
  };
  if (preview) return <Dialog open={open} onOpenChange={(value) => { if (!value) { setPreview(null); onOpenChange(false); } }}><DialogContent aria-describedby={undefined} className="max-w-3xl print:max-w-none print:border-0 print:shadow-none">
    <DialogTitle className="sr-only">PURCHASE ORDER</DialogTitle>
    <div className="print-area bg-white p-2 text-slate-950">
      <div className="flex items-start justify-between border-b-2 border-primary pb-5"><div><p className="text-xl font-bold" data-no-translate>{clinic.name}</p><p className="mt-1 text-xs text-muted-foreground" data-no-translate>{Object.values(clinic.address ?? {}).filter(Boolean).join(", ")}</p><p className="text-xs text-muted-foreground" data-no-translate>{clinic.phone}</p></div><div className="text-end"><h2 className="text-2xl font-bold">PURCHASE ORDER</h2><p className="mt-1 font-mono text-xs">{preview.orderNumber}</p><p className="mt-1 text-xs">{preview.orderDate}</p></div></div>
      <div className="grid grid-cols-2 gap-6 py-5 text-sm"><div><p className="text-[10px] font-bold uppercase text-muted-foreground">Supplier</p><p className="mt-1 font-semibold" data-no-translate>{preview.supplierName || "Open supplier"}</p><p className="text-xs" data-no-translate>{preview.supplierContact}</p></div><div><p className="text-[10px] font-bold uppercase text-muted-foreground">Deliver to</p><p className="mt-1 text-xs" data-no-translate>{preview.deliveryAddress || Object.values(clinic.address ?? {}).filter(Boolean).join(", ")}</p></div></div>
      <table className="w-full border-collapse text-sm"><thead><tr className="bg-slate-100 text-start text-[10px] uppercase"><th className="p-2">#</th><th className="p-2">Item</th><th className="p-2">SKU</th><th className="p-2">Quantity</th><th className="p-2">Notes</th></tr></thead><tbody>{preview.items.map((line, index) => <tr key={line.id ?? line.inventoryItemId ?? index} className="border-b"><td className="p-2">{index + 1}</td><td className="p-2 font-semibold" data-no-translate>{line.itemName}</td><td className="p-2 font-mono text-xs" data-no-translate>{line.sku || "—"}</td><td className="p-2">{line.quantity} {line.unit}</td><td className="p-2 text-xs" data-no-translate>{line.notes || "—"}</td></tr>)}</tbody></table>
      {preview.notes && <div className="mt-5 rounded-xl bg-slate-50 p-3 text-xs"><strong>Order notes:</strong> <span data-no-translate>{preview.notes}</span></div>}
      <div className="mt-12 grid grid-cols-2 gap-16 text-center text-xs"><div className="border-t pt-2">Prepared by</div><div className="border-t pt-2">Authorized signature</div></div>
    </div>
    <DialogFooter className="print:hidden"><Button variant="outline" onClick={() => setPreview(null)}>Edit</Button><Button onClick={() => window.print()}><Printer /> Print / Save PDF</Button></DialogFooter>
  </DialogContent></Dialog>;
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>Create purchase order</DialogTitle><DialogDescription>Select stock items or add any material manually. Saving this order does not change inventory quantities.</DialogDescription></DialogHeader>
    <form onSubmit={submit} className="space-y-4"><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold">Order date<Input name="orderDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className="mt-1.5" /></label><label className="text-xs font-semibold">Supplier name<Input name="supplierName" className="mt-1.5" /></label><label className="text-xs font-semibold">Supplier contact<Input name="supplierContact" className="mt-1.5" /></label><label className="text-xs font-semibold">Delivery address<Input name="deliveryAddress" className="mt-1.5" /></label></div>
      <div className="rounded-2xl border p-4"><div className="flex flex-wrap gap-2"><Select defaultValue="" onChange={(event) => { addExisting(event.target.value); event.target.value = ""; }} className="h-10 min-w-60 flex-1 rounded-xl border bg-white px-3 text-sm"><option value="">Select inventory item…</option>{items.map((item) => <option key={item.id} value={item.id} data-no-translate>{item.name} · {item.stock} {item.unit}</option>)}</Select><Button type="button" variant="outline" onClick={addManual}><Plus /> Manual item</Button></div>
        <div className="mt-4 space-y-3">{lines.map((line, index) => <div key={line.id ?? line.inventoryItemId ?? index} className="grid items-end gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-[2fr_110px_1fr_36px]"><label className="text-[10px] font-semibold">Item<Input value={line.itemName} onChange={(event) => updateLine(index, { itemName: event.target.value })} /></label><label className="text-[10px] font-semibold">Quantity<Input type="number" min="0.01" step="0.01" value={line.quantity} onChange={(event) => updateLine(index, { quantity: Number(event.target.value) })} /></label><label className="text-[10px] font-semibold">Notes<Input value={line.notes ?? ""} onChange={(event) => updateLine(index, { notes: event.target.value })} /></label><Button type="button" size="icon" variant="ghost" onClick={() => setLines((current) => current.filter((_, position) => position !== index))}><Trash2 /></Button></div>)}</div>
      </div><label className="block text-xs font-semibold">Order notes<Input name="notes" className="mt-1.5" /></label><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save & preview"}</Button></DialogFooter></form>
  </DialogContent></Dialog>;
}

export function InventoryPage({
  items,
  onAdd,
  role,
  clinic,
}: {
  items: InventoryItem[];
  onAdd: (i: InventoryItem) => void;
  role: ClinicRole;
  clinic: { name: string; phone?: string; address?: Record<string, string> };
}) {
  const [stockOverrides, setStockOverrides] = useState<Record<string, number>>(
    {},
  );
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All categories");
  const [open, setOpen] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const canPurchase = ["owner", "admin", "assistant"].includes(role);
  const current = items.map((item) => ({
    ...item,
    stock: stockOverrides[item.id] ?? item.stock,
  }));
  const categories = [
    "All categories",
    ...Array.from(new Set(current.map((i) => i.category))),
  ];
  const visible = useMemo(
    () =>
      current.filter(
        (i) =>
          (filter === "All categories" || i.category === filter) &&
          `${i.name} ${i.sku} ${i.supplier}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [current, filter, search],
  );
  const adjust = (id: string, n: number) => {
    const item = current.find((candidate) => candidate.id === id);
    if (item) {
      setStockOverrides((old) => ({
        ...old,
        [id]: Math.max(0, item.stock + n),
      }));
    }
    toast.success("Stock level updated");
  };
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const item = {
      id: crypto.randomUUID(),
      name: String(f.get("name")),
      category: String(f.get("category")),
      sku: String(f.get("sku")),
      stock: Number(f.get("stock")),
      minimum: Number(f.get("minimum")),
      unit: String(f.get("unit")),
      supplier: String(f.get("supplier")),
    };
    onAdd(item);
    setOpen(false);
  };
  const low = current.filter((i) => i.stock <= i.minimum);
  const columns: DataTableColumn<InventoryItem>[] = [
    {
      key: "item",
      label: "Item",
      isRowHeader: true,
      render: (item) => {
        const needsStock = item.stock <= item.minimum;
        return <div className="min-w-40"><p className="text-sm font-semibold" data-no-translate>{item.name}</p><Badge variant={needsStock ? "danger" : "success"} className="mt-1">{needsStock ? "Low stock" : "In stock"}</Badge></div>;
      },
    },
    { key: "category", label: "Category", render: (item) => <span className="text-xs">{item.category}</span> },
    { key: "sku", label: "SKU", render: (item) => <span className="font-mono text-xs text-muted-foreground" data-no-translate>{item.sku}</span> },
    {
      key: "stock",
      label: "In stock",
      render: (item) => <span className={cn("text-sm font-bold", item.stock <= item.minimum && "text-danger")}>{item.stock} <span className="text-[10px] font-normal text-muted-foreground">{item.unit}</span></span>,
    },
    { key: "minimum", label: "Reorder at", render: (item) => <span className="text-xs">{item.minimum} {item.unit}</span> },
    { key: "supplier", label: "Supplier", render: (item) => <span className="min-w-32 text-xs" data-no-translate>{item.supplier}</span> },
    { key: "expiry", label: "Expiry", render: (item) => <span className="text-xs text-muted-foreground">{item.expiry ?? "—"}</span> },
    {
      key: "adjust",
      label: "Adjust",
      render: (item) => <div className="flex items-center gap-1"><Button size="icon" variant="outline" className="size-8" onClick={() => adjust(item.id, -1)} aria-label={`Reduce ${item.name} stock`}><Minus /></Button><Button size="icon" variant="outline" className="size-8" onClick={() => adjust(item.id, 1)} aria-label={`Increase ${item.name} stock`}><Plus /></Button></div>,
    },
  ];
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            label: "Inventory items",
            value: current.length + "",
            detail: "Across 6 categories",
            icon: Boxes,
            color: "bg-blue-50 text-blue-700",
          },
          {
            label: "Low stock",
            value: low.length + "",
            detail: "Action required",
            icon: AlertTriangle,
            color: "bg-rose-50 text-rose-700",
          },
          {
            label: "Stock coverage",
            value: "94%",
            detail: "30-day availability",
            icon: PackageCheck,
            color: "bg-emerald-50 text-emerald-700",
          },
        ].map((stat, index) => <StatCard key={stat.label} label={stat.label} value={stat.value} note={stat.detail} icon={stat.icon} tone={index === 0 ? "info" : index === 1 ? "danger" : "success"} />)}
      </div>
      {low.length > 0 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 sm:flex-row sm:items-center">
          <div className="grid size-10 place-items-center rounded-xl bg-white text-rose-600">
            <AlertTriangle className="size-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-rose-900">
              {low.length} items need attention
            </p>
            <p className="text-xs text-rose-700">
              {low.map((i) => i.name).join(", ")}
            </p>
          </div>
          {canPurchase && <Button
            size="sm"
            variant="outline"
            className="border-rose-200 bg-white text-rose-700"
            onClick={() => setPurchaseOpen(true)}
          >
            <ShoppingCart />
            Create purchase order
          </Button>}
        </div>
      )}
      <FilterBar className="justify-between">
        <div className="flex flex-1 gap-2">
          <div className="relative max-w-md flex-1">
            <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-white ps-9"
              placeholder="Search inventory…"
            />
          </div>
          <Select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-xl border bg-white px-3 text-sm"
          >
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </div>
        <div className="flex gap-2">
          {canPurchase && <Button variant="outline" onClick={() => setPurchaseOpen(true)}><ShoppingCart /> Create purchase order</Button>}
          <Button
            variant="outline"
            onClick={() => toast.success("Inventory CSV exported")}
          >
            <Download />
            Export
          </Button>
          <Button onClick={() => setOpen(true)}>
            <Plus />
            Add item
          </Button>
        </div>
      </FilterBar>
      <Card className="overflow-hidden">
        {visible.length ? <DataTable ariaLabel="Inventory" columns={columns} rows={visible} getRowKey={(item) => item.id} contentClassName="min-w-[900px]" /> : <EmptyState icon={Boxes} title="No inventory items found" description="Try a different search or category, or add a new clinical supply." className="m-5" />}
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add inventory item</DialogTitle>
            <DialogDescription>
              Track a new clinical supply and its reorder level.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                ["name", "Item name", "Bonding agent"],
                ["category", "Category", "Restorative"],
                ["sku", "SKU", "RST-BND01"],
                ["supplier", "Supplier", "Henry Schein"],
                ["stock", "Starting stock", "12"],
                ["minimum", "Reorder level", "5"],
                ["unit", "Unit", "boxes"],
              ].map(([name, label, placeholder], i) => (
                <label
                  key={name}
                  className={cn(
                    "text-xs font-semibold",
                    i < 4 && i === 0 && "col-span-2",
                  )}
                >
                  {label}
                  <Input
                    name={name}
                    required
                    type={
                      name === "stock" || name === "minimum" ? "number" : "text"
                    }
                    className="mt-1.5"
                    placeholder={placeholder}
                  />
                </label>
              ))}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Add item</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <PurchaseOrderDialog items={items} clinic={clinic} open={purchaseOpen} onOpenChange={setPurchaseOpen} />
    </div>
  );
}
