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
import { createId } from "@/lib/ids";
import { archiveProcedureCatalogItem, persistProcedureCatalogItem } from "@/lib/supabase/clinic-data";
import type { ClinicRole, ProcedureCatalogItem } from "@/lib/types";
import { ConfirmDialog, DataTable, EmptyState, FilterBar, type DataTableColumn } from "@/components/clinic/app-ui";

/** The data layer never receives is_system or is_active from this screen. */
type ProcedureDraft = Omit<ProcedureCatalogItem, "isSystem" | "isActive">;

/* Phones get 44px touch targets. Desktop keeps the compact height. */
const fieldClass = "mt-1.5 min-h-11 sm:min-h-0";
const buttonTouch = "min-h-11 sm:min-h-0";

export function PriceListPage({ procedures, role, onChange }: {
  procedures: ProcedureCatalogItem[];
  role: ClinicRole;
  onChange: (procedures: ProcedureCatalogItem[]) => void;
}) {
  const { formatMoney, t } = useClinicPreferences();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<ProcedureCatalogItem | null | undefined>(undefined);
  const [archiveTarget, setArchiveTarget] = useState<ProcedureCatalogItem | null>(null);
  const [saving, setSaving] = useState(false);
  const canAdmin = role === "owner" || role === "admin";
  const filtered = procedures.filter((item) => `${item.name} ${item.category} ${item.code ?? ""}`.toLowerCase().includes(search.toLowerCase()));

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const category = String(form.get("category") ?? "").trim();
    const defaultPrice = Number(form.get("price"));
    const defaultSessions = Number(form.get("sessions"));
    if (!name || !category) { toast.error(t("Enter a procedure name and category")); return; }
    if (!Number.isFinite(defaultPrice) || defaultPrice < 0) { toast.error(t("Enter a valid default price")); return; }
    if (!Number.isInteger(defaultSessions) || defaultSessions < 1) { toast.error(t("Sessions must be a whole number of at least 1")); return; }
    const candidate: ProcedureDraft = {
      id: editing?.id ?? `demo-${createId()}`,
      code: String(form.get("code") ?? "").trim() || undefined,
      name,
      category,
      defaultPrice,
      defaultSessions,
      supportsSurfaces: form.get("supportsSurfaces") === "on",
      supportsMultipleTeeth: form.get("supportsMultipleTeeth") === "on",
    };
    setSaving(true);
    try {
      const result = await persistProcedureCatalogItem(candidate);
      if (!result.ok) { toast.error(result.error ?? t("Procedure could not be saved")); return; }
      // Flags stay as they were: editing a system procedure keeps it a system procedure.
      const saved: ProcedureCatalogItem = {
        ...candidate,
        id: result.id ?? candidate.id,
        isSystem: editing?.isSystem ?? false,
        isActive: true,
      };
      onChange(editing ? procedures.map((item) => item.id === editing.id ? saved : item) : [...procedures, saved]);
      setEditing(undefined);
      toast.success(editing ? t("Procedure updated; historical prices were preserved") : t("Procedure added to the Price List"));
    } finally {
      setSaving(false);
    }
  };

  const archive = async (item: ProcedureCatalogItem): Promise<boolean> => {
    const result = await archiveProcedureCatalogItem(item.id);
    if (!result.ok) { toast.error(result.error ?? t("Procedure could not be removed")); return false; }
    onChange(procedures.filter((candidate) => candidate.id !== item.id));
    toast.success(t("Procedure removed from future selections; historical records were preserved"));
    return true;
  };

  const columns: DataTableColumn<ProcedureCatalogItem>[] = [
    { key: "procedure", label: t("Procedure"), isRowHeader: true, render: (item) => <div><p className="font-semibold" data-no-translate>{item.name}</p><p className="text-[10px] text-muted-foreground" data-no-translate>{item.code || "—"}</p></div> },
    { key: "category", label: t("Category"), render: (item) => <span data-no-translate>{item.category}</span> },
    { key: "price", label: t("Default price"), render: (item) => <span className="font-bold">{formatMoney(item.defaultPrice)}</span> },
    { key: "sessions", label: t("Sessions"), render: (item) => item.defaultSessions },
  ];
  if (canAdmin) columns.push({
    key: "actions",
    label: t("Actions"),
    className: "text-end",
    render: (item) => (
      <div className="flex justify-end gap-1">
        <Button size="icon" variant="ghost" className="size-11 sm:size-10" aria-label={t("Edit procedure")} onClick={() => setEditing(item)}><Pencil /></Button>
        <Button size="icon" variant="ghost" className="size-11 text-danger sm:size-10" aria-label={t("Remove procedure")} onClick={() => setArchiveTarget(item)}><Trash2 /></Button>
      </div>
    ),
  });

  return <div className="space-y-5">
    <FilterBar className="justify-between">
      <div className="relative max-w-md flex-1"><Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label={t("Search procedures…")} value={search} onChange={(event) => setSearch(event.target.value)} className="min-h-11 ps-9 sm:min-h-0" placeholder={t("Search procedures…")} /></div>
      {canAdmin && <Button className={buttonTouch} onClick={() => setEditing(null)}><Plus /> {t("Add procedure")}</Button>}
    </FilterBar>
    <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><History className="mt-0.5 size-5 shrink-0" /><div><p className="font-semibold">{t("Price-history protection is active")}</p><p className="mt-1 text-xs leading-relaxed">{t("Price changes apply only to future appointments and treatment items. Existing appointments, plans, invoices, payments, and receipts keep their saved price snapshots.")}</p></div></div>
    <Card><CardHeader><CardTitle>{t("Central Price List")}</CardTitle></CardHeader><CardContent className="p-0">{filtered.length ? <DataTable ariaLabel={t("Treatment price list")} columns={columns} rows={filtered} getRowKey={(item) => item.id} contentClassName="min-w-[560px]" /> : <EmptyState icon={Search} title={t("No procedures found")} description={t("Try a different search, or add a procedure to the clinic Price List.")} className="m-5" />}</CardContent></Card>
    <Dialog open={editing !== undefined} onOpenChange={(open) => !open && setEditing(undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? t("Edit procedure") : t("Add procedure")}</DialogTitle>
          <DialogDescription>{t("Set the default used for future bookings and treatment items.")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold sm:col-span-2">{t("Procedure name")}<Input name="name" defaultValue={editing?.name} required className={fieldClass} /></label>
            <label className="text-xs font-semibold">{t("Code")}<Input name="code" defaultValue={editing?.code} className={fieldClass} /></label>
            <label className="text-xs font-semibold">{t("Category")}<Input name="category" defaultValue={editing?.category ?? "General"} required className={fieldClass} /></label>
            <label className="text-xs font-semibold">{t("Default price")}<Input name="price" type="number" min="0" step="1" defaultValue={editing?.defaultPrice ?? 0} required className={fieldClass} /></label>
            <label className="text-xs font-semibold">{t("Default sessions")}<Input name="sessions" type="number" min="1" step="1" defaultValue={editing?.defaultSessions ?? 1} required className={fieldClass} /></label>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2"><Checkbox name="supportsSurfaces" defaultChecked={editing?.supportsSurfaces} />{t("Supports tooth surfaces")}</label>
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2"><Checkbox name="supportsMultipleTeeth" defaultChecked={editing?.supportsMultipleTeeth} />{t("Supports multiple teeth")}</label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className={buttonTouch} onClick={() => setEditing(undefined)}>{t("Cancel")}</Button>
            <Button className={buttonTouch} disabled={saving}>{saving ? t("Saving…") : t("Save procedure")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    <ConfirmDialog
      open={Boolean(archiveTarget)}
      onOpenChange={(open) => !open && setArchiveTarget(null)}
      title={t("Remove this procedure?")}
      description={t("It will no longer appear in future selections. Historical treatment and invoice prices remain unchanged.")}
      confirmLabel={t("Remove procedure")}
      cancelLabel={t("Cancel")}
      destructive
      onConfirm={() => {
        if (!archiveTarget) return;
        // The dialog closes only after the archive succeeds, so a failure stays visible.
        void archive(archiveTarget).then((ok) => { if (ok) setArchiveTarget(null); });
      }}
    />
  </div>;
}
