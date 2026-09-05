"use client";

import { FormEvent, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { History, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useClinicPreferences } from "@/lib/clinic-preferences";
import { archiveProcedureCatalogItem, persistProcedureCatalogItem } from "@/lib/supabase/clinic-data";
import type { ClinicRole, ProcedureCatalogItem } from "@/lib/types";
import { ConfirmDialog, DataTable, EmptyState, FilterBar, type DataTableColumn } from "@/components/clinic/app-ui";

export function PriceListPage({ procedures, role, onChange }: {
  procedures: ProcedureCatalogItem[];
  role: ClinicRole;
  onChange: (procedures: ProcedureCatalogItem[]) => void;
}) {
  const { formatMoney } = useClinicPreferences();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<ProcedureCatalogItem | null | undefined>(undefined);
  const [archiveTarget, setArchiveTarget] = useState<ProcedureCatalogItem | null>(null);
  const [saving, setSaving] = useState(false);
  const canAdmin = role === "owner" || role === "admin";
  const filtered = procedures.filter((item) => `${item.name} ${item.category} ${item.code ?? ""}`.toLowerCase().includes(search.toLowerCase()));

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const candidate: ProcedureCatalogItem = {
      id: editing?.id ?? `demo-${crypto.randomUUID()}`,
      code: String(form.get("code") ?? "").trim() || undefined,
      name: String(form.get("name")),
      category: String(form.get("category")),
      defaultPrice: Number(form.get("price")),
      defaultSessions: Number(form.get("sessions")),
      supportsSurfaces: form.get("supportsSurfaces") === "on",
      supportsMultipleTeeth: form.get("supportsMultipleTeeth") === "on",
      isSystem: false,
      isActive: true,
    };
    const result = await persistProcedureCatalogItem(candidate);
    setSaving(false);
    if (!result.ok) return toast.error(result.error ?? "Procedure could not be saved");
    const saved = { ...candidate, id: result.id ?? candidate.id };
    onChange(editing ? procedures.map((item) => item.id === editing.id ? saved : item) : [...procedures, saved]);
    setEditing(undefined);
    toast.success(editing ? "Procedure updated; historical prices were preserved" : "Procedure added to the Price List");
  };

  const archive = async (item: ProcedureCatalogItem) => {
    const result = await archiveProcedureCatalogItem(item.id);
    if (!result.ok) return toast.error(result.error ?? "Procedure could not be removed");
    onChange(procedures.filter((candidate) => candidate.id !== item.id));
    toast.success("Procedure removed from future selections; historical records were preserved");
  };

  const columns: DataTableColumn<ProcedureCatalogItem>[] = [
    { key: "procedure", label: "Procedure", isRowHeader: true, render: (item) => <div><p className="font-semibold" data-no-translate>{item.name}</p><p className="text-[10px] text-muted-foreground" data-no-translate>{item.code || "—"}</p></div> },
    { key: "category", label: "Category", render: (item) => <span data-no-translate>{item.category}</span> },
    { key: "price", label: "Default price", render: (item) => <span className="font-bold">{formatMoney(item.defaultPrice)}</span> },
    { key: "sessions", label: "Sessions", render: (item) => item.defaultSessions },
  ];
  if (canAdmin) columns.push({
    key: "actions",
    label: "Actions",
    className: "text-end",
    render: (item) => <div className="flex justify-end gap-1"><Button size="icon" variant="ghost" aria-label="Edit procedure" onClick={() => setEditing(item)}><Pencil /></Button><Button size="icon" variant="ghost" aria-label="Remove procedure" className="text-danger" onClick={() => setArchiveTarget(item)}><Trash2 /></Button></div>,
  });

  return <div className="space-y-5">
    <FilterBar className="justify-between">
      <div className="relative max-w-md flex-1"><Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} className="ps-9" placeholder="Search procedures…" /></div>
      {canAdmin && <Button onClick={() => setEditing(null)}><Plus /> Add procedure</Button>}
    </FilterBar>
    <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><History className="mt-0.5 size-5 shrink-0" /><div><p className="font-semibold">Price-history protection is active</p><p className="mt-1 text-xs leading-relaxed">Price changes apply only to future appointments and treatment items. Existing appointments, plans, invoices, payments, and receipts keep their saved price snapshots.</p></div></div>
    <Card><CardHeader><CardTitle>Central Price List</CardTitle></CardHeader><CardContent className="p-0">{filtered.length ? <DataTable ariaLabel="Treatment price list" columns={columns} rows={filtered} getRowKey={(item) => item.id} /> : <EmptyState icon={Search} title="No procedures found" description="Try a different search, or add a procedure to the clinic Price List." className="m-5" />}</CardContent></Card>
    <Dialog open={editing !== undefined} onOpenChange={(open) => !open && setEditing(undefined)}><DialogContent><DialogHeader><DialogTitle>{editing ? "Edit procedure" : "Add procedure"}</DialogTitle><DialogDescription>Set the default used for future bookings and treatment items.</DialogDescription></DialogHeader><form onSubmit={save} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold sm:col-span-2">Procedure name<Input name="name" defaultValue={editing?.name} required className="mt-1.5" /></label><label className="text-xs font-semibold">Code<Input name="code" defaultValue={editing?.code} className="mt-1.5" /></label><label className="text-xs font-semibold">Category<Input name="category" defaultValue={editing?.category ?? "General"} required className="mt-1.5" /></label><label className="text-xs font-semibold">Default price<Input name="price" type="number" min="0" step="1" defaultValue={editing?.defaultPrice ?? 0} required className="mt-1.5" /></label><label className="text-xs font-semibold">Default sessions<Input name="sessions" type="number" min="1" step="1" defaultValue={editing?.defaultSessions ?? 1} required className="mt-1.5" /></label></div>
      <div className="flex flex-wrap gap-4 text-sm"><label className="inline-flex cursor-pointer items-center gap-2"><Checkbox name="supportsSurfaces" defaultChecked={editing?.supportsSurfaces} />Supports tooth surfaces</label><label className="inline-flex cursor-pointer items-center gap-2"><Checkbox name="supportsMultipleTeeth" defaultChecked={editing?.supportsMultipleTeeth} />Supports multiple teeth</label></div>
      <DialogFooter><Button type="button" variant="outline" onClick={() => setEditing(undefined)}>Cancel</Button><Button disabled={saving}>{saving ? "Saving…" : "Save procedure"}</Button></DialogFooter>
    </form></DialogContent></Dialog>
    <ConfirmDialog open={Boolean(archiveTarget)} onOpenChange={(open) => !open && setArchiveTarget(null)} title="Remove this procedure?" description="It will no longer appear in future selections. Historical treatment and invoice prices remain unchanged." confirmLabel="Remove procedure" destructive onConfirm={() => { if (archiveTarget) void archive(archiveTarget).finally(() => setArchiveTarget(null)); }} />
  </div>;
}
