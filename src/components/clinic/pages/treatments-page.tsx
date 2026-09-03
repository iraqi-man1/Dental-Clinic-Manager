"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ClipboardPlus,
  Pencil,
  Plus,
  Search,
  Stethoscope,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { DentalChart } from "@/components/clinic/dental-chart";
import { treatmentPlans as demoPlans } from "@/lib/demo-data";
import type {
  DentalChartState,
  Patient,
  ProcedureCatalogItem,
  ToothCondition,
  ToothSurface,
  ToothSurfaceChart,
  TreatmentItemStatus,
  TreatmentPlan,
  TreatmentPlanItem,
  TreatmentSession,
  ClinicRole,
  Payment,
} from "@/lib/types";
import { cn, initials } from "@/lib/utils";
import { useClinicPreferences } from "@/lib/clinic-preferences";
import {
  loadTreatmentPlanningData,
  completeTreatmentSession,
  recordSessionPayment,
  saveOdontogramPlanItem,
  setTreatmentSessionPrices,
  createTreatmentPlan,
  updateTreatmentPlan,
} from "@/lib/supabase/clinic-data";
import { hasSupabaseConfig } from "@/lib/supabase/client";
import {
  DataTable,
  EmptyState,
  FilterBar,
  StatCard,
  type DataTableColumn,
} from "@/components/clinic/app-ui";

const fallbackCatalog: ProcedureCatalogItem[] = [
  ["Filling", "Restorative", 180, 1, true, false],
  ["Crown", "Restorative", 950, 2, false, false],
  ["Root Canal", "Endodontic", 850, 2, false, false],
  ["Extraction", "Surgical", 260, 1, false, false],
  ["Implant", "Surgical", 2400, 4, false, false],
  ["Bridge", "Restorative", 2100, 3, false, true],
  ["Veneer", "Cosmetic", 780, 2, false, true],
  ["Whitening / Cosmetic Treatment", "Cosmetic", 420, 1, false, true],
  ["Periodontal Treatment", "Periodontal", 340, 2, true, true],
  ["Missing Tooth", "Diagnostic", 0, 1, false, false],
].map(([name, category, price, sessions, surfaces, multiple], index) => ({
  id: `demo-procedure-${index}`,
  name: String(name),
  category: String(category),
  defaultPrice: Number(price),
  defaultSessions: Number(sessions),
  supportsSurfaces: Boolean(surfaces),
  supportsMultipleTeeth: Boolean(multiple),
  isSystem: true,
  isActive: true,
}));

const variant = (status: TreatmentPlan["status"]) =>
  status === "Completed" ? "success" : status === "In progress" ? "default" : status === "On hold" ? "warning" : "secondary";

function statusLabel(status: TreatmentItemStatus) {
  return status === "planned" ? "Planned" : status === "scheduled" ? "Scheduled" : status === "completed" ? "Completed" : "Cancelled";
}

function surfacesLabel(surfaces: ToothSurface[]) {
  const abbreviations: Record<ToothSurface, string> = {
    occlusal: "O", mesial: "M", distal: "D", buccal: "B/F", lingual: "L/P",
  };
  return surfaces.length ? surfaces.map((surface) => abbreviations[surface]).join(", ") : "Whole tooth";
}

function PlanItems({ plan, onEdit, onRecord, canEdit, canComplete }: {
  plan: TreatmentPlan;
  onEdit: (item: TreatmentPlanItem) => void;
  onRecord: (item: TreatmentPlanItem) => void;
  canEdit: boolean;
  canComplete: boolean;
}) {
  const { formatMoney } = useClinicPreferences();
  const columns: DataTableColumn<TreatmentPlanItem>[] = [
    { key: "procedure", label: "Procedure", isRowHeader: true, render: (item) => <span className="min-w-40 font-semibold" data-no-translate>{item.procedureName}</span> },
    { key: "teeth", label: "Teeth", render: (item) => <span data-no-translate>{item.toothNumbers.length ? `#${item.toothNumbers.join(", #")}` : "—"}</span> },
    { key: "surfaces", label: "Surfaces", render: (item) => surfacesLabel(item.surfaces) },
    { key: "status", label: "Status", render: (item) => <Badge variant={item.status === "completed" ? "success" : item.status === "scheduled" ? "default" : "secondary"}>{statusLabel(item.status)}</Badge> },
    { key: "sessions", label: "Sessions", render: (item) => <span className="font-medium">{item.sessionsDone}/{item.sessionsTotal}</span> },
    { key: "price", label: "Price", render: (item) => <span className="font-medium">{formatMoney(item.price)}</span> },
    { key: "discount", label: "Discount", render: (item) => formatMoney(item.discount) },
    { key: "finalPrice", label: "Final price", render: (item) => <span className="font-semibold">{formatMoney(item.finalPrice)}</span> },
    { key: "paid", label: "Paid", render: (item) => <span className="text-success">{formatMoney(item.amountPaid)}</span> },
    { key: "remaining", label: "Remaining", render: (item) => <span className="font-semibold text-warning">{formatMoney(item.remaining)}</span> },
    {
      key: "actions",
      label: <span className="sr-only">Treatment actions</span>,
      render: (item) => <div className="flex min-w-40 gap-1">{canEdit ? <Button size="icon" variant="ghost" aria-label="Edit treatment item" onClick={() => onEdit(item)}><Pencil /></Button> : null}{canComplete && item.status !== "completed" && item.status !== "cancelled" ? <Button size="sm" variant="outline" onClick={() => onRecord(item)}><CheckCircle2 /> Record session</Button> : null}</div>,
    },
  ];
  if (!plan.items?.length) return (
    <EmptyState icon={ClipboardPlus} title="No procedures in this plan" description="Select teeth on the odontogram and add the first procedure." />
  );
  return (
    <DataTable ariaLabel="Treatment plan items" columns={columns} rows={plan.items} getRowKey={(item) => item.id} contentClassName="min-w-[980px]" />
  );
}

export function TreatmentsPage({ patients, role, patientId, embedded = false }: { patients: Patient[]; role: ClinicRole; patientId?: string; embedded?: boolean }) {
  const { formatMoney } = useClinicPreferences();
  const configured = hasSupabaseConfig();
  const [plans, setPlans] = useState<TreatmentPlan[]>(() => configured ? [] : demoPlans);
  const [catalog, setCatalog] = useState<ProcedureCatalogItem[]>(() => configured ? [] : fallbackCatalog);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [workspacePlan, setWorkspacePlan] = useState<TreatmentPlan | null>(null);
  const [editingItem, setEditingItem] = useState<TreatmentPlanItem | null>(null);
  const [selectedTeeth, setSelectedTeeth] = useState<number[]>([]);
  const [selectedSurfaces, setSelectedSurfaces] = useState<ToothSurface[]>([]);
  const [surfaceChart, setSurfaceChart] = useState<ToothSurfaceChart>({});
  const [wholeChart, setWholeChart] = useState<Record<number, ToothCondition>>({});
  const [procedureId, setProcedureId] = useState("");
  const [customProcedure, setCustomProcedure] = useState("");
  const [chartState, setChartState] = useState<DentalChartState>("planned");
  const [itemStatus, setItemStatus] = useState<TreatmentItemStatus>("planned");
  const [price, setPrice] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [sessions, setSessions] = useState(1);
  const [notes, setNotes] = useState("");
  const [sessionPrices, setSessionPrices] = useState<number[]>([0]);
  const [completion, setCompletion] = useState<{ item: TreatmentPlanItem; session: TreatmentSession } | null>(null);
  const [completionPaymentMode, setCompletionPaymentMode] = useState<"none" | "full" | "partial">("none");
  const [completionAmount, setCompletionAmount] = useState(0);
  const [completionMethod, setCompletionMethod] = useState<Payment["method"]>("Cash");
  const [planEditOpen, setPlanEditOpen] = useState(false);
  const canComplete = ["owner", "admin", "dentist", "hygienist"].includes(role);
  const canEdit = ["owner", "admin", "dentist", "hygienist"].includes(role);
  const distributeSessionPrices = (total = Math.max(0, price - discount), count = sessions) => {
    const cents = Math.round(total * 100);
    const base = Math.floor(cents / Math.max(1, count));
    setSessionPrices(Array.from({ length: Math.max(1, count) }, (_, index) =>
      (base + (index === Math.max(1, count) - 1 ? cents - base * Math.max(1, count) : 0)) / 100));
  };

  const refresh = async () => {
    const data = await loadTreatmentPlanningData();
    if (!data) return;
    setCatalog(data.catalog);
    setPlans(data.plans);
    if (workspacePlan) {
      const fresh = data.plans.find((plan) => plan.id === workspacePlan.id ||
        (plan.patientId === workspacePlan.patientId && plan.title === workspacePlan.title));
      if (fresh) setWorkspacePlan(fresh);
    }
  };
  useEffect(() => {
    void loadTreatmentPlanningData().then((data) => {
      if (!data) return;
      setCatalog(data.catalog);
      setPlans(data.plans);
    });
  }, []);

  const patientPlans = useMemo(() => plans.filter((plan) => !patientId || plan.patientId === patientId), [patientId, plans]);
  const visible = useMemo(() => patientPlans.filter((plan) =>
    (filter === "All" || plan.status === filter) &&
    `${plan.patientName} ${plan.title} ${plan.procedures.join(" ")}`.toLowerCase().includes(search.toLowerCase())),
  [patientPlans, filter, search]);
  const stats = useMemo(() => ({
    active: patientPlans.filter((plan) => plan.status === "In progress").length,
    proposed: patientPlans.filter((plan) => plan.status === "Proposed").length,
    completed: patientPlans.filter((plan) => plan.status === "Completed").length,
    activeValue: patientPlans.filter((plan) => plan.status === "In progress").reduce((sum, plan) => sum + plan.total, 0),
    proposedValue: patientPlans.filter((plan) => plan.status === "Proposed").reduce((sum, plan) => sum + plan.total, 0),
    completedValue: patientPlans.filter((plan) => plan.status === "Completed").reduce((sum, plan) => sum + plan.total, 0),
  }), [patientPlans]);

  const openWorkspace = (plan: TreatmentPlan) => {
    const patient = patients.find((candidate) => candidate.id === plan.patientId || candidate.name === plan.patientName);
    setWorkspacePlan({ ...plan, patientId: plan.patientId ?? patient?.id });
    setWholeChart(patient?.toothChart ?? {});
    setSurfaceChart(patient?.toothSurfaces ?? {});
    setSelectedTeeth([]);
    setSelectedSurfaces([]);
    setEditingItem(null);
  };
  const chooseProcedure = (id: string) => {
    setProcedureId(id);
    const procedure = catalog.find((item) => item.id === id);
    if (procedure) {
      setPrice(procedure.defaultPrice); setSessions(procedure.defaultSessions);
      const cents = Math.round(procedure.defaultPrice * 100);
      const base = Math.floor(cents / procedure.defaultSessions);
      setSessionPrices(Array.from({ length: procedure.defaultSessions }, (_, index) =>
        (base + (index === procedure.defaultSessions - 1 ? cents - base * procedure.defaultSessions : 0)) / 100));
    }
  };
  const editItem = (item: TreatmentPlanItem) => {
    setEditingItem(item);
    setProcedureId(item.procedureId ?? "__custom__");
    setCustomProcedure(item.procedureId ? "" : item.procedureName);
    setSelectedTeeth(item.toothNumbers);
    setSelectedSurfaces(item.surfaces);
    setItemStatus(item.status);
    setChartState(item.status === "completed" ? "completed" : "planned");
    setPrice(item.price);
    setDiscount(item.discount);
    setSessions(item.sessionsTotal);
    setSessionPrices(item.sessions?.map((session) => session.expectedAmount) ?? Array(item.sessionsTotal).fill(item.finalPrice / item.sessionsTotal));
    setNotes(item.notes ?? "");
    document.getElementById("procedure-editor")?.scrollIntoView({ behavior: "smooth" });
  };
  const saveItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!workspacePlan?.patientId || !selectedTeeth.length) {
      toast.error("Choose a patient and at least one tooth"); return;
    }
    const procedure = catalog.find((item) => item.id === procedureId);
    const procedureName = procedure?.name ?? customProcedure.trim();
    if (!procedureName) { toast.error("Choose or name a procedure"); return; }
    if (procedure && !procedure.supportsMultipleTeeth && selectedTeeth.length > 1) {
      toast.error("This procedure is configured for one tooth at a time"); return;
    }
    if (procedure?.supportsSurfaces && !selectedSurfaces.length) {
      toast.error("Select at least one clinically appropriate surface"); return;
    }
    const finalPrice = Math.max(0, price - discount);
    const nextItem: TreatmentPlanItem = {
      id: editingItem?.id ?? crypto.randomUUID(), planId: workspacePlan.id,
      procedureId: procedure?.id, procedureName, toothNumbers: selectedTeeth,
      surfaces: selectedSurfaces, status: itemStatus,
      sessionsDone: itemStatus === "completed" ? sessions : (editingItem?.sessionsDone ?? 0),
      sessionsTotal: sessions, price, discount, finalPrice,
      amountPaid: editingItem?.amountPaid ?? 0,
      remaining: Math.max(0, finalPrice - (editingItem?.amountPaid ?? 0)), notes,
    };
    const currentItems = workspacePlan.items ?? [];
    const matchingIndex = currentItems.findIndex((item) => item.id === editingItem?.id ||
      (item.procedureId === nextItem.procedureId &&
       item.toothNumbers.join() === nextItem.toothNumbers.join() && item.surfaces.join() === nextItem.surfaces.join()));
    const nextItems = matchingIndex >= 0
      ? currentItems.map((item, index) => index === matchingIndex ? nextItem : item)
      : [...currentItems, nextItem];
    const total = nextItems.reduce((sum, item) => sum + item.finalPrice, 0);
    const nextPlan = { ...workspacePlan, items: nextItems, procedures: nextItems.map((item) => item.procedureName), total };
    setWorkspacePlan(nextPlan);
    setPlans((current) => current.map((plan) => plan.id === workspacePlan.id ? nextPlan : plan));
    selectedTeeth.forEach((tooth) => {
      if (procedureName === "Missing Tooth") wholeChart[tooth] = "Missing";
      selectedSurfaces.forEach((surface) => {
        surfaceChart[tooth] = { ...(surfaceChart[tooth] ?? {}), [surface]: chartState };
      });
    });
    setWholeChart({ ...wholeChart }); setSurfaceChart({ ...surfaceChart });
    const saved = await saveOdontogramPlanItem({
      patientId: workspacePlan.patientId, planId: workspacePlan.id,
      planTitle: workspacePlan.title,
      procedureId: procedure?.id.startsWith("demo-") ? undefined : procedure?.id,
      procedureName, toothNumbers: selectedTeeth, surfaces: selectedSurfaces,
      chartState, status: itemStatus, price, discount, sessionsTotal: sessions, notes,
    });
    if (!saved.ok || !saved.itemId) { toast.error(saved.error ?? "Treatment item could not be saved"); return; }
    const pricing = await setTreatmentSessionPrices(saved.itemId, sessionPrices);
    if (!pricing.ok) { toast.error(pricing.error ?? "Session prices could not be saved"); return; }
    toast.success(editingItem ? "Treatment item and session prices updated" : "Treatment item and session prices added");
    setEditingItem(null); setSelectedTeeth([]); setSelectedSurfaces([]); setNotes("");
    await refresh();
  };
  const recordSession = async (item: TreatmentPlanItem) => {
    if (!canComplete) { toast.error("Your role cannot complete clinical sessions"); return; }
    const nextSession = item.sessions?.find((session) => session.status !== "completed" && session.status !== "cancelled");
    if (!nextSession) { toast.error("No open session is available"); return; }
    setCompletion({ item, session: nextSession });
  };
  const confirmCompletion = async () => {
    if (!completion) return;
    if (completionPaymentMode !== "none" && completion.session.remaining > 0) {
      const payment = await recordSessionPayment({
        sessionId: completion.session.id,
        mode: completionPaymentMode,
        amount: completionPaymentMode === "partial" ? completionAmount : undefined,
        method: completionMethod,
      });
      if (!payment.ok) { toast.error(payment.error ?? "Payment could not be recorded"); return; }
    }
    const result = await completeTreatmentSession(completion.session.id);
    if (!result.ok) { toast.error(result.error ?? "Session could not be completed"); return; }
    toast.success("Clinical session completed");
    setCompletion(null); setCompletionPaymentMode("none"); setCompletionAmount(0);
    await refresh();
  };
  const savePlanDetails = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!workspacePlan) return;
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title")).trim();
    const status = String(form.get("status")) as TreatmentPlan["status"];
    const result = await updateTreatmentPlan(workspacePlan.id, { title, status });
    if (!result.ok) return toast.error(result.error ?? "Treatment plan could not be updated");
    const updated = { ...workspacePlan, title, status };
    setWorkspacePlan(updated); setPlans((current) => current.map((plan) => plan.id === updated.id ? updated : plan));
    setPlanEditOpen(false); toast.success("Treatment plan updated");
  };

  if (workspacePlan) {
    const selectedProcedure = catalog.find((item) => item.id === procedureId);
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Button variant="ghost" size="sm" className="mb-2 -ms-2" onClick={() => setWorkspacePlan(null)}><X /> Close treatment workspace</Button>
            <h2 className="text-xl font-bold" data-no-translate>{workspacePlan.title}</h2>
            <p className="text-sm text-muted-foreground" data-no-translate>{workspacePlan.patientName}</p>
          </div>
          <div className="flex items-center gap-2"><Badge variant={variant(workspacePlan.status)}>{workspacePlan.status}</Badge>{canEdit && <Button size="sm" variant="outline" onClick={() => setPlanEditOpen(true)}><Pencil /> Edit plan</Button>}</div>
        </div>
        <Card>
          <CardHeader><CardTitle>Dental chart & tooth surfaces</CardTitle></CardHeader>
          <CardContent>
            <DentalChart value={wholeChart} surfaceValue={surfaceChart} onChange={setWholeChart}
              onSurfaceChange={setSurfaceChart} selectedTeeth={selectedTeeth} onSelectedTeethChange={setSelectedTeeth}
              selectedSurfaces={selectedSurfaces} onSelectedSurfacesChange={setSelectedSurfaces} />
          </CardContent>
        </Card>
        {canEdit && <Card id="procedure-editor">
          <CardHeader>
            <CardTitle>{editingItem ? "Edit treatment item" : "Add procedure to treatment plan"}</CardTitle>
            <p className="text-xs text-muted-foreground">The same procedure, teeth, and surfaces update the existing item instead of creating a duplicate.</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveItem} className="grid gap-4 lg:grid-cols-4">
              <label className="text-xs font-semibold lg:col-span-2">Procedure
                <Select value={procedureId} onChange={(event) => chooseProcedure(event.target.value)} required className="mt-1.5 h-10 w-full rounded-xl border bg-white px-3 text-sm">
                  <option value="">Choose procedure…</option>
                  {[...new Set(catalog.map((item) => item.category))].map((category) =>
                    <optgroup key={category} label={category}>{catalog.filter((item) => item.category === category).map((item) =>
                      <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup>)}
                  <option value="__custom__">Custom procedure…</option>
                </Select>
              </label>
              {procedureId === "__custom__" && <label className="text-xs font-semibold lg:col-span-2">Custom procedure name<Input value={customProcedure} onChange={(event) => setCustomProcedure(event.target.value)} required className="mt-1.5" /></label>}
              <label className="text-xs font-semibold">Clinical chart state
                <Select value={chartState} onChange={(event) => setChartState(event.target.value as DentalChartState)} className="mt-1.5 h-10 w-full rounded-xl border bg-white px-3 text-sm">
                  <option value="decay">Decay / caries</option><option value="existing_restoration">Existing restoration</option>
                  <option value="planned">Planned treatment</option><option value="completed">Completed treatment</option><option value="other">Other finding</option>
                </Select>
              </label>
              <label className="text-xs font-semibold">Treatment status
                <Select value={itemStatus} onChange={(event) => setItemStatus(event.target.value as TreatmentItemStatus)} className="mt-1.5 h-10 w-full rounded-xl border bg-white px-3 text-sm">
                  <option value="planned">Planned</option><option value="scheduled">Scheduled</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>
                </Select>
              </label>
              <label className="text-xs font-semibold">Price<Input type="number" min="0" step="0.01" value={price} onChange={(event) => setPrice(Number(event.target.value))} className="mt-1.5" /></label>
              <label className="text-xs font-semibold">Discount<Input type="number" min="0" max={price} step="0.01" value={discount} onChange={(event) => setDiscount(Number(event.target.value))} className="mt-1.5" /></label>
              <label className="text-xs font-semibold">Sessions<Input type="number" min="1" value={sessions} onChange={(event) => { const count = Math.max(1, Number(event.target.value)); setSessions(count); distributeSessionPrices(undefined, count); }} className="mt-1.5" /></label>
              <div className="lg:col-span-4 rounded-2xl border bg-slate-50/60 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-semibold">Expected price per session</p><p className="text-[10px] text-muted-foreground">Session prices must equal the final treatment price.</p></div><Button type="button" size="sm" variant="outline" onClick={() => distributeSessionPrices()}>Distribute evenly</Button></div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: sessions }, (_, index) => <label key={index} className="text-[10px] font-semibold">Session {index + 1}<Input type="number" min="0" step="0.01" value={sessionPrices[index] ?? 0} onChange={(event) => setSessionPrices((current) => Array.from({ length: sessions }, (_, position) => position === index ? Number(event.target.value) : current[position] ?? 0))} className="mt-1" /></label>)}</div>
                <p className={cn("mt-3 text-xs font-semibold", Math.abs(sessionPrices.reduce((sum, amount) => sum + amount, 0) - Math.max(0, price - discount)) < 0.01 ? "text-emerald-700" : "text-rose-700")}>Session total: {formatMoney(sessionPrices.reduce((sum, amount) => sum + amount, 0))} · Treatment final price: {formatMoney(Math.max(0, price - discount))}</p>
              </div>
              <label className="text-xs font-semibold lg:col-span-3">Clinical notes<Input value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-1.5" placeholder="Optional clinical details…" /></label>
              <div className="flex items-end justify-end gap-2 lg:col-span-4">
                {editingItem && <Button type="button" variant="outline" onClick={() => setEditingItem(null)}>Cancel edit</Button>}
                <Button type="submit" disabled={!selectedTeeth.length || !procedureId || Math.abs(sessionPrices.reduce((sum, amount) => sum + amount, 0) - Math.max(0, price - discount)) >= 0.01}>{editingItem ? "Update treatment item" : "Add to treatment plan"}</Button>
              </div>
              {selectedProcedure && <p className="text-xs text-muted-foreground lg:col-span-4">Configured for {selectedProcedure.supportsMultipleTeeth ? "multiple teeth" : "one tooth"}{selectedProcedure.supportsSurfaces ? " and tooth surfaces" : ""}.</p>}
            </form>
          </CardContent>
        </Card>}
        <Card>
          <CardHeader><CardTitle>Treatment plan items</CardTitle></CardHeader>
          <CardContent><PlanItems plan={workspacePlan} onEdit={editItem} onRecord={recordSession} canEdit={canEdit} canComplete={canComplete} /></CardContent>
        </Card>
        <Dialog open={Boolean(completion)} onOpenChange={(open) => !open && setCompletion(null)}>
          <DialogContent><DialogHeader><DialogTitle>Complete clinical session</DialogTitle><DialogDescription>Clinical completion and payment are separate. Any amount already collected by reception is shown below.</DialogDescription></DialogHeader>
            {completion && <div className="space-y-4">
              <div className="rounded-2xl border bg-slate-50 p-4"><p className="font-semibold" data-no-translate>{completion.item.procedureName} · Session {completion.session.sessionNumber}</p><div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs"><div><p className="text-muted-foreground">Expected</p><p className="font-bold">{formatMoney(completion.session.expectedAmount)}</p></div><div><p className="text-muted-foreground">Already paid</p><p className="font-bold text-emerald-700">{formatMoney(completion.session.amountPaid)}</p></div><div><p className="text-muted-foreground">Remaining</p><p className="font-bold text-amber-700">{formatMoney(completion.session.remaining)}</p></div></div></div>
              {completion.session.remaining > 0 ? <><label className="block text-xs font-semibold">Payment during completion<Select value={completionPaymentMode} onChange={(event) => setCompletionPaymentMode(event.target.value as typeof completionPaymentMode)} className="mt-1.5 h-10 w-full rounded-xl border bg-white px-3 text-sm"><option value="none">Do not collect now</option><option value="full">Collect remaining in full</option><option value="partial">Collect partial amount</option></Select></label>
                {completionPaymentMode === "partial" && <label className="block text-xs font-semibold">Amount<Input type="number" min="0.01" max={completion.session.remaining} step="0.01" value={completionAmount || ""} onChange={(event) => setCompletionAmount(Number(event.target.value))} className="mt-1.5" /></label>}
                {completionPaymentMode !== "none" && <label className="block text-xs font-semibold">Method<Select value={completionMethod} onChange={(event) => setCompletionMethod(event.target.value as Payment["method"])} className="mt-1.5 h-10 w-full rounded-xl border bg-white px-3 text-sm"><option>Cash</option><option>Card</option><option>Insurance</option><option>Bank transfer</option></Select></label>}</> : <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">This session is fully paid. No duplicate payment will be requested.</div>}
            </div>}
            <DialogFooter><Button variant="outline" onClick={() => setCompletion(null)}>Cancel</Button><Button onClick={confirmCompletion} disabled={completionPaymentMode === "partial" && (completionAmount <= 0 || completionAmount > (completion?.session.remaining ?? 0))}><CheckCircle2 /> Complete session</Button></DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={planEditOpen} onOpenChange={setPlanEditOpen}><DialogContent><DialogHeader><DialogTitle>Edit treatment plan</DialogTitle><DialogDescription>Update the plan title or workflow status from this patient profile.</DialogDescription></DialogHeader><form onSubmit={savePlanDetails} className="space-y-4"><label className="block text-xs font-semibold">Plan title<Input name="title" defaultValue={workspacePlan.title} required className="mt-1.5" /></label><label className="block text-xs font-semibold">Plan status<Select name="status" defaultValue={workspacePlan.status} className="mt-1.5 h-10 w-full rounded-xl border bg-white px-3 text-sm"><option>Proposed</option><option>In progress</option><option>On hold</option><option>Completed</option></Select></label><DialogFooter><Button type="button" variant="outline" onClick={() => setPlanEditOpen(false)}>Cancel</Button><Button>Save plan</Button></DialogFooter></form></DialogContent></Dialog>
      </div>
    );
  }

  const createPlan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const patient = patients.find((item) => item.id === String(form.get("patientId")));
    if (!patient) return;
    const title = String(form.get("title")); const total = Number(form.get("totalPrice") ?? 0);
    const persisted = await createTreatmentPlan(patient.id, title, total);
    if (!persisted.ok && !patient.id.startsWith("p")) { toast.error(persisted.error ?? "Treatment plan could not be created"); return; }
    const plan: TreatmentPlan = { id: persisted.id ?? crypto.randomUUID(), patientId: patient.id, patientName: patient.name,
      title, procedures: [], total, sessionsDone: 0, sessionsTotal: 1,
      progress: 0, status: "Proposed", items: [] };
    setPlans((current) => [plan, ...current]); setCreateOpen(false); openWorkspace(plan);
  };
  return (
    <div className="space-y-5">
      {!embedded && <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Active plans", value: stats.active, sub: stats.activeValue, icon: Stethoscope, color: "bg-primary/10 text-primary" },
          { label: "Proposed value", value: stats.proposed, sub: stats.proposedValue, icon: ClipboardPlus, color: "bg-blue-50 text-blue-700" },
          { label: "Completed", value: stats.completed, sub: stats.completedValue, icon: CheckCircle2, color: "bg-emerald-50 text-emerald-700" },
        ].map((stat, index) => <StatCard key={stat.label} label={stat.label} value={stat.value} note={formatMoney(stat.sub)} icon={stat.icon} tone={index === 1 ? "info" : index === 2 ? "success" : "accent"} />)}
      </div>}
      <FilterBar className="justify-between">
        <div className="flex flex-1 gap-2"><div className="relative max-w-md flex-1"><Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} className="bg-white ps-9" placeholder="Search treatment plans…" /></div>
          <Select value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded-xl border bg-white px-3 text-sm"><option>All</option><option>Proposed</option><option>In progress</option><option>Completed</option><option>On hold</option></Select></div>
        {canEdit && <Button onClick={() => setCreateOpen(true)}><Plus /> New treatment plan</Button>}
      </FilterBar>
      <div className="grid gap-4 lg:grid-cols-2">
        {visible.map((plan) => <Card key={plan.id} className="transition hover:-translate-y-0.5 hover:shadow-lg">
          <CardHeader className="flex-row items-start gap-3"><Avatar><AvatarFallback>{initials(plan.patientName)}</AvatarFallback></Avatar>
            <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><CardTitle data-no-translate>{plan.title}</CardTitle><Badge variant={variant(plan.status)}>{plan.status}</Badge></div><p className="mt-1 text-xs text-muted-foreground" data-no-translate>{plan.patientName} · {plan.id.slice(0, 8).toUpperCase()}</p></div>
          </CardHeader><CardContent><div className="mb-4 flex flex-wrap gap-2">{plan.procedures.map((procedure, index) => <Badge variant="outline" key={`${procedure}-${index}`} data-no-translate>{procedure}</Badge>)}</div>
            <div className="mb-2 flex justify-between text-xs"><span className="font-semibold">Treatment progress</span><span className="font-bold text-primary">{plan.progress}%</span></div><Progress value={plan.progress} />
            <div className="mt-5 grid grid-cols-3 divide-x rounded-xl bg-slate-50 p-3 text-center"><div><p className="text-[10px] text-muted-foreground">Plan value</p><p className="mt-1 text-sm font-bold">{formatMoney(plan.total)}</p></div><div><p className="text-[10px] text-muted-foreground">Sessions</p><p className="mt-1 text-sm font-bold">{plan.sessionsDone}/{plan.sessionsTotal}</p></div><div><p className="text-[10px] text-muted-foreground">Plan items</p><p className="mt-1 text-sm font-bold">{plan.items?.length ?? plan.procedures.length}</p></div></div>
            <Button className="mt-4 w-full" variant="outline" onClick={() => openWorkspace(plan)}>Open odontogram & plan</Button>
          </CardContent></Card>)}
        {!visible.length && <EmptyState icon={ClipboardPlus} title="No treatment plans found" description="Try another filter, or create a treatment plan for a patient." className="lg:col-span-2" action={canEdit ? <Button onClick={() => setCreateOpen(true)}><Plus /> New treatment plan</Button> : undefined} />}
      </div>
      <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent><DialogHeader><DialogTitle>Create treatment plan</DialogTitle><DialogDescription>Choose a patient, then build the plan from the interactive odontogram.</DialogDescription></DialogHeader>
        <form onSubmit={createPlan} className="space-y-4">{patientId ? <input type="hidden" name="patientId" value={patientId} /> : <label className="block text-xs font-semibold">Patient<Select name="patientId" required className="mt-1.5 h-10 w-full rounded-xl border bg-white px-3 text-sm"><option value="">Choose patient…</option>{patients.map((patient) => <option key={patient.id} value={patient.id} data-no-translate>{patient.name} · {patient.patientNo}</option>)}</Select></label>}
          <label className="block text-xs font-semibold">Plan title<Input name="title" required className="mt-1.5" placeholder="Comprehensive treatment plan" /></label>
          <label className="block text-xs font-semibold">Total treatment price<Input name="totalPrice" type="number" min="0" step="0.01" required className="mt-1.5" placeholder="0.00" /></label>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button><Button type="submit">Create & open plan</Button></DialogFooter>
        </form></DialogContent></Dialog>
    </div>
  );
}
