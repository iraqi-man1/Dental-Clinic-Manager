"use client";

import { FormEvent, useState } from "react";
import { History, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useClinicPreferences } from "@/lib/clinic-preferences";
import { archiveProcedureCatalogItem, persistProcedureCatalogItem } from "@/lib/supabase/clinic-data";
import type { ClinicRole, ProcedureCatalogItem } from "@/lib/types";

export function PriceListPage({ procedures, role, onChange }: {
  procedures: ProcedureCatalogItem[];
  role: ClinicRole;
  onChange: (procedures: ProcedureCatalogItem[]) => void;
}) {
  const { formatMoney } = useClinicPreferences();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<ProcedureCatalogItem | null | undefined>(undefined);
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

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative max-w-md flex-1"><Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} className="ps-9" placeholder="Search procedures…" /></div>
      {canAdmin && <Button onClick={() => setEditing(null)}><Plus /> Add procedure</Button>}
    </div>
    <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><History className="mt-0.5 size-5 shrink-0" /><div><p className="font-semibold">Price-history protection is active</p><p className="mt-1 text-xs leading-relaxed">Price changes apply only to future appointments and treatment items. Existing appointments, plans, invoices, payments, and receipts keep their saved price snapshots.</p></div></div>
    <Card><CardHeader><CardTitle>Central Price List</CardTitle></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-start text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="px-5 py-3 text-start">Procedure</th><th className="px-5 py-3 text-start">Category</th><th className="px-5 py-3 text-start">Default price</th><th className="px-5 py-3 text-start">Sessions</th>{canAdmin && <th className="px-5 py-3" />}</tr></thead><tbody className="divide-y">{filtered.map((item) => <tr key={item.id}><td className="px-5 py-4"><p className="font-semibold" data-no-translate>{item.name}</p><p className="text-[10px] text-muted-foreground" data-no-translate>{item.code || "—"}</p></td><td className="px-5 py-4" data-no-translate>{item.category}</td><td className="px-5 py-4 font-bold">{formatMoney(item.defaultPrice)}</td><td className="px-5 py-4">{item.defaultSessions}</td>{canAdmin && <td className="px-5 py-4"><div className="flex justify-end gap-1"><Button size="icon" variant="ghost" aria-label="Edit procedure" onClick={() => setEditing(item)}><Pencil /></Button><Button size="icon" variant="ghost" aria-label="Remove procedure" onClick={() => void archive(item)}><Trash2 /></Button></div></td>}</tr>)}</tbody></table>{!filtered.length && <p className="p-8 text-center text-sm text-muted-foreground">No procedures found. The administrator can configure the clinic Price List here.</p>}</div></CardContent></Card>
    <Dialog open={editing !== undefined} onOpenChange={(open) => !open && setEditing(undefined)}><DialogContent><DialogHeader><DialogTitle>{editing ? "Edit procedure" : "Add procedure"}</DialogTitle><DialogDescription>Set the default used for future bookings and treatment items.</DialogDescription></DialogHeader><form onSubmit={save} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold sm:col-span-2">Procedure name<Input name="name" defaultValue={editing?.name} required className="mt-1.5" /></label><label className="text-xs font-semibold">Code<Input name="code" defaultValue={editing?.code} className="mt-1.5" /></label><label className="text-xs font-semibold">Category<Input name="category" defaultValue={editing?.category ?? "General"} required className="mt-1.5" /></label><label className="text-xs font-semibold">Default price<Input name="price" type="number" min="0" step="1" defaultValue={editing?.defaultPrice ?? 0} required className="mt-1.5" /></label><label className="text-xs font-semibold">Default sessions<Input name="sessions" type="number" min="1" step="1" defaultValue={editing?.defaultSessions ?? 1} required className="mt-1.5" /></label></div>
      <div className="flex flex-wrap gap-4 text-xs"><label className="flex items-center gap-2"><input name="supportsSurfaces" type="checkbox" defaultChecked={editing?.supportsSurfaces} /> Supports tooth surfaces</label><label className="flex items-center gap-2"><input name="supportsMultipleTeeth" type="checkbox" defaultChecked={editing?.supportsMultipleTeeth} /> Supports multiple teeth</label></div>
      <DialogFooter><Button type="button" variant="outline" onClick={() => setEditing(undefined)}>Cancel</Button><Button disabled={saving}>{saving ? "Saving…" : "Save procedure"}</Button></DialogFooter>
    </form></DialogContent></Dialog>
  </div>;
}
