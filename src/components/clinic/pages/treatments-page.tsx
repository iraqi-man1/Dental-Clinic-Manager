"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
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
import { createId } from "@/lib/ids";
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

/** English enum values stay as they are in data. Only the labels are translated. */
const planStatuses: TreatmentPlan["status"][] = ["Proposed", "In progress", "On hold", "Completed"];
const itemStatusLabels: Record<TreatmentItemStatus, string> = {
  planned: "Planned",
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
};
const itemStatuses = Object.keys(itemStatusLabels) as TreatmentItemStatus[];
const chartStateOptions: { value: DentalChartState; label: string }[] = [
  { value: "decay", label: "Decay / caries" },
  { value: "existing_restoration", label: "Existing restoration" },
  { value: "planned", label: "Planned treatment" },
  { value: "completed", label: "Completed treatment" },
  { value: "other", label: "Other finding" },
];
const paymentMethods: Payment["method"][] = ["Cash", "Card", "Insurance", "Bank transfer"];
const clinicalRoles: ClinicRole[] = ["owner", "admin", "dentist", "hygienist"];
/** Mirrors the payment RPC: clinicians complete sessions but do not collect payments. */
const paymentRoles: ClinicRole[] = ["owner", "admin", "billing", "front_desk", "assistant"];

/* Shared control sizes. Phones get 44px touch targets, desktop keeps the compact height. */
const fieldClass = "mt-1.5 min-h-11 sm:min-h-0";
const selectClass = "mt-1.5 min-h-11 w-full rounded-xl border bg-white px-3 text-sm sm:min-h-0 sm:h-10";
const buttonTouch = "min-h-11 sm:min-h-0";

const variant = (status: TreatmentPlan["status"]) =>
  status === "Completed" ? "success" : status === "In progress" ? "default" : status === "On hold" ? "warning" : "secondary";

function surfacesLabel(surfaces: ToothSurface[]) {
  const abbreviations: Record<ToothSurface, string> = {
    occlusal: "O", mesial: "M", distal: "D", buccal: "B/F", lingual: "L/P",
  };
  return surfaces.map((surface) => abbreviations[surface]).join(", ");
}

function PlanItems({ plan, onEdit, onRecord, canEdit, canComplete }: {
  plan: TreatmentPlan;
  onEdit: (item: TreatmentPlanItem) => void;
  onRecord: (item: TreatmentPlanItem) => void;
  canEdit: boolean;
  canComplete: boolean;
}) {
  const { formatMoney, t } = useClinicPreferences();
  const columns: DataTableColumn<TreatmentPlanItem>[] = [
    { key: "procedure", label: t("Procedure"), isRowHeader: true, render: (item) => <span className="min-w-40 font-semibold" data-no-translate>{item.procedureName}</span> },
    { key: "teeth", label: t("Teeth"), render: (item) => <span data-no-translate>{item.toothNumbers.length ? `#${item.toothNumbers.join(", #")}` : "—"}</span> },
    { key: "surfaces", label: t("Surfaces"), render: (item) => item.surfaces.length ? <span data-no-translate>{surfacesLabel(item.surfaces)}</span> : t("Whole tooth") },
    {
      key: "status",
      label: t("Status"),
      render: (item) => <Badge variant={item.status === "completed" ? "success" : item.status === "scheduled" ? "default" : "secondary"}>{t(itemStatusLabels[item.status])}</Badge>,
    },
    {
      key: "sessions",
      label: t("Sessions"),
      render: (item) => {
        const remaining = Math.max(0, item.sessionsTotal - item.sessionsDone);
        return (
          <div>
            <p className="font-medium">{t("{done}/{total} completed", { done: item.sessionsDone, total: item.sessionsTotal })}</p>
            {remaining > 0 && <p className="text-xs text-muted-foreground">{t("{n} remaining", { n: remaining })}</p>}
          </div>
        );
      },
    },
    { key: "price", label: t("Price"), render: (item) => <span className="font-medium">{formatMoney(item.price)}</span> },
    { key: "discount", label: t("Discount"), render: (item) => formatMoney(item.discount) },
    { key: "finalPrice", label: t("Final price"), render: (item) => <span className="font-semibold">{formatMoney(item.finalPrice)}</span> },
    { key: "paid", label: t("Paid"), render: (item) => <span className="text-success">{formatMoney(item.amountPaid)}</span> },
    { key: "remaining", label: t("Remaining"), render: (item) => <span className="font-semibold text-warning">{formatMoney(item.remaining)}</span> },
    {
      key: "actions",
      label: <span className="sr-only">{t("Treatment actions")}</span>,
      render: (item) => (
        <div className="flex min-w-40 gap-1">
          {canEdit ? (
            <Button size="icon" variant="ghost" className="size-11 sm:size-10" aria-label={t("Edit treatment item")} onClick={() => onEdit(item)}>
              <Pencil />
            </Button>
          ) : null}
          {canComplete && item.status !== "completed" && item.status !== "cancelled" ? (
            <Button size="sm" variant="outline" className="h-11 sm:h-8" onClick={() => onRecord(item)}>
              <CheckCircle2 /> {t("Record session")}
            </Button>
          ) : null}
        </div>
      ),
    },
  ];
  if (!plan.items?.length) return (
    <EmptyState icon={ClipboardPlus} title={t("No procedures in this plan")} description={t("Select teeth on the odontogram and add the first procedure.")} />
  );
  return (
    <DataTable ariaLabel={t("Treatment plan items")} columns={columns} rows={plan.items} getRowKey={(item) => item.id} contentClassName="min-w-[980px]" />
  );
}

export function TreatmentsPage({ patients, role, patientId, embedded = false }: { patients: Patient[]; role: ClinicRole; patientId?: string; embedded?: boolean }) {
  const { formatMoney, t } = useClinicPreferences();
  const configured = hasSupabaseConfig();
  const [plans, setPlans] = useState<TreatmentPlan[]>(() => configured ? [] : demoPlans);
  const [catalog, setCatalog] = useState<ProcedureCatalogItem[]>(() => configured ? [] : fallbackCatalog);
  const [loaded, setLoaded] = useState(!configured);
  const [loadError, setLoadError] = useState(false);
  const [filter, setFilter] = useState<"All" | TreatmentPlan["status"]>("All");
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
  const [completion, setCompletion] = useState<{
    item: TreatmentPlanItem;
    session: TreatmentSession;
    paid: boolean;
  } | null>(null);
  const [completionPaymentMode, setCompletionPaymentMode] = useState<"none" | "full" | "partial">("none");
  const [completionAmount, setCompletionAmount] = useState(0);
  const [completionMethod, setCompletionMethod] = useState<Payment["method"]>("Cash");
  const [planEditOpen, setPlanEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const canComplete = clinicalRoles.includes(role);
  const canEdit = clinicalRoles.includes(role);
  const canCollect = paymentRoles.includes(role);
  const sessionTotal = sessionPrices.reduce((sum, amount) => sum + amount, 0);
  const finalPriceValue = Math.max(0, price - discount);
  const sessionsBalanced = Math.abs(sessionTotal - finalPriceValue) < 0.01;

  const distributeSessionPrices = (total = finalPriceValue, count = sessions) => {
    const parts = Math.max(1, count);
    const cents = Math.round(total * 100);
    const base = Math.floor(cents / parts);
    setSessionPrices(Array.from({ length: parts }, (_, index) =>
      (base + (index === parts - 1 ? cents - base * parts : 0)) / 100));
  };

  const loadPlanningData = useCallback(async () => {
    const data = await loadTreatmentPlanningData().catch(() => null);
    setLoaded(true);
    if (!data) {
      // A demo workspace has nothing to load. A configured one must say so instead of showing an empty list.
      if (configured) setLoadError(true);
      return null;
    }
    setLoadError(false);
    setCatalog(data.catalog);
    setPlans(data.plans);
    return data;
  }, [configured]);

  const refresh = useCallback(async () => {
    const data = await loadPlanningData();
    if (!data) return;
    setWorkspacePlan((current) => current ? data.plans.find((plan) => plan.id === current.id) ?? current : current);
  }, [loadPlanningData]);

  useEffect(() => {
    let cancelled = false;
    void loadTreatmentPlanningData().catch(() => null).then((data) => {
      if (cancelled) return;
      setLoaded(true);
      if (!data) {
        if (configured) setLoadError(true);
        return;
      }
      setLoadError(false);
      setCatalog(data.catalog);
      setPlans(data.plans);
    });
    return () => {
      cancelled = true;
    };
  }, [configured]);

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
    if (saving) return;
    if (!workspacePlan?.patientId || !selectedTeeth.length) {
      toast.error(t("Choose a patient and at least one tooth")); return;
    }
    const procedure = catalog.find((item) => item.id === procedureId);
    const procedureName = procedure?.name ?? customProcedure.trim();
    if (!procedureName) { toast.error(t("Choose or name a procedure")); return; }
    if (procedure && !procedure.supportsMultipleTeeth && selectedTeeth.length > 1) {
      toast.error(t("This procedure is configured for one tooth at a time")); return;
    }
    if (procedure?.supportsSurfaces && !selectedSurfaces.length) {
      toast.error(t("Select at least one clinically appropriate surface")); return;
    }
    if (!sessionsBalanced) { toast.error(t("Session prices must equal the final treatment price.")); return; }

    // Chart changes are built as new objects and applied only after the database confirms the save.
    const nextWhole: Record<number, ToothCondition> = { ...wholeChart };
    const nextSurface: ToothSurfaceChart = { ...surfaceChart };
    selectedTeeth.forEach((tooth) => {
      if (procedureName === "Missing Tooth") nextWhole[tooth] = "Missing";
      if (!selectedSurfaces.length) return;
      nextSurface[tooth] = selectedSurfaces.reduce<NonNullable<ToothSurfaceChart[number]>>(
        (acc, surface) => ({ ...acc, [surface]: chartState }),
        { ...(nextSurface[tooth] ?? {}) },
      );
    });

    setSaving(true);
    try {
      const saved = await saveOdontogramPlanItem({
        patientId: workspacePlan.patientId, planId: workspacePlan.id,
        planTitle: workspacePlan.title,
        procedureId: procedure?.id.startsWith("demo-") ? undefined : procedure?.id,
        procedureName, toothNumbers: selectedTeeth, surfaces: selectedSurfaces,
        chartState, status: itemStatus, price, discount, sessionsTotal: sessions, notes,
      });
      if (!saved.ok || !saved.itemId) { toast.error(saved.error ?? t("Treatment item could not be saved")); return; }
      const pricing = await setTreatmentSessionPrices(saved.itemId, sessionPrices);
      if (!pricing.ok) {
        toast.error(pricing.error ?? t("Session prices could not be saved"));
        // The item itself was saved, so reload to show it.
        if (configured) await refresh();
        return;
      }

      const currentItems = workspacePlan.items ?? [];
      const nextItem: TreatmentPlanItem = {
        id: saved.itemId, planId: workspacePlan.id,
        procedureId: procedure?.id, procedureName, toothNumbers: selectedTeeth,
        surfaces: selectedSurfaces, status: itemStatus,
        sessionsDone: itemStatus === "completed" ? sessions : (editingItem?.sessionsDone ?? 0),
        sessionsTotal: sessions, price, discount, finalPrice: finalPriceValue,
        amountPaid: editingItem?.amountPaid ?? 0,
        remaining: Math.max(0, finalPriceValue - (editingItem?.amountPaid ?? 0)), notes,
      };
      const matchingIndex = currentItems.findIndex((item) => item.id === editingItem?.id ||
        (item.procedureId === nextItem.procedureId &&
         item.toothNumbers.join() === nextItem.toothNumbers.join() && item.surfaces.join() === nextItem.surfaces.join()));
      const nextItems = matchingIndex >= 0
        ? currentItems.map((item, index) => index === matchingIndex ? nextItem : item)
        : [...currentItems, nextItem];
      const total = nextItems.reduce((sum, item) => sum + item.finalPrice, 0);
      const nextPlan: TreatmentPlan = { ...workspacePlan, items: nextItems, procedures: nextItems.map((item) => item.procedureName), total };
      setWorkspacePlan(nextPlan);
      setPlans((current) => current.map((plan) => plan.id === nextPlan.id ? nextPlan : plan));
      setWholeChart(nextWhole);
      setSurfaceChart(nextSurface);
      toast.success(editingItem ? t("Treatment item and session prices updated") : t("Treatment item and session prices added"));
      setEditingItem(null); setSelectedTeeth([]); setSelectedSurfaces([]); setNotes("");
      if (configured) await refresh();
    } finally {
      setSaving(false);
    }
  };
  const recordSession = (item: TreatmentPlanItem) => {
    if (!canComplete) { toast.error(t("Your role cannot complete clinical sessions")); return; }
    const nextSession = item.sessions?.find((session) => session.status !== "completed" && session.status !== "cancelled");
    if (!nextSession) { toast.error(t("No open session is available")); return; }
    setCompletionPaymentMode("none");
    setCompletionAmount(0);
    setCompletion({ item, session: nextSession, paid: false });
  };
  const closeCompletion = () => {
    setCompletion(null);
    setCompletionPaymentMode("none");
    setCompletionAmount(0);
  };
  const confirmCompletion = async () => {
    if (!completion || saving) return;
    setSaving(true);
    try {
      const wantsPayment = !completion.paid && canCollect && completionPaymentMode !== "none" && completion.session.remaining > 0;
      if (wantsPayment) {
        const collected = completionPaymentMode === "partial" ? completionAmount : completion.session.remaining;
        const payment = await recordSessionPayment({
          sessionId: completion.session.id,
          mode: completionPaymentMode,
          amount: completionPaymentMode === "partial" ? completionAmount : undefined,
          method: completionMethod,
        });
        if (!payment.ok) { toast.error(payment.error ?? t("Payment could not be recorded")); return; }
        // Mark the payment as recorded so a retry only completes the session and never collects twice.
        setCompletion((current) => current ? {
          ...current,
          paid: true,
          session: {
            ...current.session,
            amountPaid: current.session.amountPaid + collected,
            remaining: Math.max(0, current.session.remaining - collected),
          },
        } : current);
        setCompletionPaymentMode("none");
        toast.success(t("Payment recorded"));
        if (configured) await refresh();
      }
      const result = await completeTreatmentSession(completion.session.id);
      if (!result.ok) { toast.error(result.error ?? t("Session could not be completed")); return; }
      toast.success(t("Clinical session completed"));
      closeCompletion();
      await refresh();
    } finally {
      setSaving(false);
    }
  };
  const savePlanDetails = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!workspacePlan) return;
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    const rawStatus = String(form.get("status") ?? "");
    const status = planStatuses.find((candidate) => candidate === rawStatus);
    if (!title || !status) { toast.error(t("Treatment plan could not be updated")); return; }
    const result = await updateTreatmentPlan(workspacePlan.id, { title, status });
    if (!result.ok) { toast.error(result.error ?? t("Treatment plan could not be updated")); return; }
    const updated: TreatmentPlan = { ...workspacePlan, title, status };
    setWorkspacePlan(updated);
    setPlans((current) => current.map((plan) => plan.id === updated.id ? updated : plan));
    setPlanEditOpen(false);
    toast.success(t("Treatment plan updated"));
  };

  if (workspacePlan) {
    const selectedProcedure = catalog.find((item) => item.id === procedureId);
    const categories = [...new Set(catalog.map((item) => item.category))];
    const configuredLabel = selectedProcedure
      ? selectedProcedure.supportsMultipleTeeth
        ? selectedProcedure.supportsSurfaces ? t("Configured for multiple teeth and tooth surfaces.") : t("Configured for multiple teeth.")
        : selectedProcedure.supportsSurfaces ? t("Configured for one tooth and tooth surfaces.") : t("Configured for one tooth.")
      : null;
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Button variant="ghost" size="sm" className={cn("mb-2 -ms-2", buttonTouch)} onClick={() => setWorkspacePlan(null)}><X /> {t("Close treatment workspace")}</Button>
            <h2 className="text-xl font-bold" data-no-translate>{workspacePlan.title}</h2>
            <p className="text-sm text-muted-foreground" data-no-translate>{workspacePlan.patientName}</p>
          </div>
          <div className="flex items-center gap-2"><Badge variant={variant(workspacePlan.status)}>{t(workspacePlan.status)}</Badge>{canEdit && <Button size="sm" variant="outline" className={buttonTouch} onClick={() => setPlanEditOpen(true)}><Pencil /> {t("Edit plan")}</Button>}</div>
        </div>
        <Card>
          <CardHeader><CardTitle>{t("Dental chart & tooth surfaces")}</CardTitle></CardHeader>
          <CardContent>
            <DentalChart value={wholeChart} surfaceValue={surfaceChart} onChange={setWholeChart}
              onSurfaceChange={setSurfaceChart} selectedTeeth={selectedTeeth} onSelectedTeethChange={setSelectedTeeth}
              selectedSurfaces={selectedSurfaces} onSelectedSurfacesChange={setSelectedSurfaces} />
          </CardContent>
        </Card>
        {canEdit && <Card id="procedure-editor">
          <CardHeader>
            <CardTitle>{editingItem ? t("Edit treatment item") : t("Add procedure to treatment plan")}</CardTitle>
            <p className="text-xs text-muted-foreground">{t("The same procedure, teeth, and surfaces update the existing item instead of creating a duplicate.")}</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveItem} className="grid gap-4 lg:grid-cols-4">
              <label className="text-xs font-semibold lg:col-span-2">{t("Procedure")}
                <Select value={procedureId} onChange={(event) => chooseProcedure(event.target.value)} required className={selectClass}>
                  <option value="">{t("Choose procedure…")}</option>
                  {categories.map((category) =>
                    <optgroup key={category} label={category} data-no-translate>{catalog.filter((item) => item.category === category).map((item) =>
                      <option key={item.id} value={item.id} data-no-translate>{item.name}</option>)}</optgroup>)}
                  <option value="__custom__">{t("Custom procedure…")}</option>
                </Select>
              </label>
              {procedureId === "__custom__" && <label className="text-xs font-semibold lg:col-span-2">{t("Custom procedure name")}<Input value={customProcedure} onChange={(event) => setCustomProcedure(event.target.value)} required className={fieldClass} /></label>}
              <label className="text-xs font-semibold">{t("Clinical chart state")}
                <Select value={chartState} onChange={(event) => setChartState(event.target.value as DentalChartState)} className={selectClass}>
                  {chartStateOptions.map((option) => <option key={option.value} value={option.value}>{t(option.label)}</option>)}
                </Select>
              </label>
              <label className="text-xs font-semibold">{t("Treatment status")}
                <Select value={itemStatus} onChange={(event) => setItemStatus(event.target.value as TreatmentItemStatus)} className={selectClass}>
                  {itemStatuses.map((status) => <option key={status} value={status}>{t(itemStatusLabels[status])}</option>)}
                </Select>
              </label>
              <label className="text-xs font-semibold">{t("Price")}<Input type="number" min="0" step="0.01" value={price} onChange={(event) => setPrice(Number(event.target.value))} className={fieldClass} /></label>
              <label className="text-xs font-semibold">{t("Discount")}<Input type="number" min="0" max={price} step="0.01" value={discount} onChange={(event) => setDiscount(Number(event.target.value))} className={fieldClass} /></label>
              <label className="text-xs font-semibold">{t("Sessions")}<Input type="number" min="1" value={sessions} onChange={(event) => { const count = Math.max(1, Number(event.target.value)); setSessions(count); distributeSessionPrices(finalPriceValue, count); }} className={fieldClass} /></label>
              <div className="lg:col-span-4 rounded-2xl border bg-slate-50/60 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold">{t("Expected price per session")}</p>
                    <p className="text-[10px] text-muted-foreground">{t("Session prices must equal the final treatment price.")}</p>
                  </div>
                  <Button type="button" size="sm" variant="outline" className={buttonTouch} onClick={() => distributeSessionPrices()}>{t("Distribute evenly")}</Button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {Array.from({ length: sessions }, (_, index) => (
                    <label key={index} className="text-[10px] font-semibold">{t("Session {number}", { number: index + 1 })}
                      <Input type="number" min="0" step="0.01" value={sessionPrices[index] ?? 0}
                        onChange={(event) => setSessionPrices((current) => Array.from({ length: sessions }, (_, position) =>
                          position === index ? Number(event.target.value) : current[position] ?? 0))}
                        className="mt-1 min-h-11 sm:min-h-0" />
                    </label>
                  ))}
                </div>
                <p className={cn("mt-3 text-xs font-semibold", sessionsBalanced ? "text-emerald-700" : "text-rose-700")}>
                  {t("Session total: {total} · Treatment final price: {price}", { total: formatMoney(sessionTotal), price: formatMoney(finalPriceValue) })}
                </p>
              </div>
              <label className="text-xs font-semibold lg:col-span-3">{t("Clinical notes")}<Input value={notes} onChange={(event) => setNotes(event.target.value)} className={fieldClass} placeholder={t("Optional clinical details…")} /></label>
              <div className="flex items-end justify-end gap-2 lg:col-span-4">
                {editingItem && <Button type="button" variant="outline" className={buttonTouch} onClick={() => setEditingItem(null)}>{t("Cancel edit")}</Button>}
                <Button type="submit" className={buttonTouch} disabled={saving || !selectedTeeth.length || !procedureId || !sessionsBalanced}>
                  {editingItem ? t("Update treatment item") : t("Add to treatment plan")}
                </Button>
              </div>
              {configuredLabel && <p className="text-xs text-muted-foreground lg:col-span-4">{configuredLabel}</p>}
            </form>
          </CardContent>
        </Card>}
        <Card>
          <CardHeader><CardTitle>{t("Treatment plan items")}</CardTitle></CardHeader>
          <CardContent><PlanItems plan={workspacePlan} onEdit={editItem} onRecord={recordSession} canEdit={canEdit} canComplete={canComplete} /></CardContent>
        </Card>
        <Dialog open={Boolean(completion)} onOpenChange={(open) => !open && closeCompletion()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("Complete clinical session")}</DialogTitle>
              <DialogDescription>{t("Clinical completion and payment are separate. Any amount already collected by reception is shown below.")}</DialogDescription>
            </DialogHeader>
            {completion && <div className="space-y-4">
              <div className="rounded-2xl border bg-slate-50 p-4">
                <p className="font-semibold"><span data-no-translate>{completion.item.procedureName}</span> · {t("Session {number}", { number: completion.session.sessionNumber })}</p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div><p className="text-muted-foreground">{t("Expected")}</p><p className="font-bold">{formatMoney(completion.session.expectedAmount)}</p></div>
                  <div><p className="text-muted-foreground">{t("Already paid")}</p><p className="font-bold text-emerald-700">{formatMoney(completion.session.amountPaid)}</p></div>
                  <div><p className="text-muted-foreground">{t("Remaining")}</p><p className="font-bold text-amber-700">{formatMoney(completion.session.remaining)}</p></div>
                </div>
              </div>
              {completion.paid ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{t("Payment recorded. Only the clinical completion is pending.")}</div>
              ) : completion.session.remaining > 0 ? (canCollect ? <>
                <label className="block text-xs font-semibold">{t("Payment during completion")}
                  <Select value={completionPaymentMode} onChange={(event) => setCompletionPaymentMode(event.target.value as typeof completionPaymentMode)} className={selectClass}>
                    <option value="none">{t("Do not collect now")}</option>
                    <option value="full">{t("Collect remaining in full")}</option>
                    <option value="partial">{t("Collect partial amount")}</option>
                  </Select>
                </label>
                {completionPaymentMode === "partial" && <label className="block text-xs font-semibold">{t("Amount")}<Input type="number" min="0.01" max={completion.session.remaining} step="0.01" value={completionAmount || ""} onChange={(event) => setCompletionAmount(Number(event.target.value))} className={fieldClass} /></label>}
                {completionPaymentMode !== "none" && <label className="block text-xs font-semibold">{t("Method")}
                  <Select value={completionMethod} onChange={(event) => setCompletionMethod(event.target.value as Payment["method"])} className={selectClass}>
                    {paymentMethods.map((method) => <option key={method} value={method}>{t(method)}</option>)}
                  </Select>
                </label>}
              </> : <p className="text-xs text-muted-foreground">{t("Payments are recorded by reception or billing staff.")}</p>
              ) : <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{t("This session is fully paid. No duplicate payment will be requested.")}</div>}
            </div>}
            <DialogFooter>
              <Button variant="outline" className={buttonTouch} onClick={closeCompletion}>{t("Cancel")}</Button>
              <Button className={buttonTouch} onClick={confirmCompletion} disabled={saving || (completionPaymentMode === "partial" && (completionAmount <= 0 || completionAmount > (completion?.session.remaining ?? 0)))}>
                <CheckCircle2 /> {t("Complete session")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={planEditOpen} onOpenChange={setPlanEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("Edit treatment plan")}</DialogTitle>
              <DialogDescription>{t("Update the plan title or workflow status from this patient profile.")}</DialogDescription>
            </DialogHeader>
            <form onSubmit={savePlanDetails} className="space-y-4">
              <label className="block text-xs font-semibold">{t("Plan title")}<Input name="title" defaultValue={workspacePlan.title} required className={fieldClass} /></label>
              <label className="block text-xs font-semibold">{t("Plan status")}
                <Select name="status" defaultValue={workspacePlan.status} className={selectClass}>
                  {planStatuses.map((status) => <option key={status} value={status}>{t(status)}</option>)}
                </Select>
              </label>
              <DialogFooter>
                <Button type="button" variant="outline" className={buttonTouch} onClick={() => setPlanEditOpen(false)}>{t("Cancel")}</Button>
                <Button type="submit" className={buttonTouch}>{t("Save plan")}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  const createPlan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const patient = patients.find((item) => item.id === String(form.get("patientId")));
    if (!patient) { toast.error(t("Choose a patient")); return; }
    const title = String(form.get("title") ?? "").trim();
    const total = Number(form.get("totalPrice") ?? 0);
    if (!title) { toast.error(t("Enter a plan title")); return; }
    if (!Number.isFinite(total) || total < 0) { toast.error(t("Enter a valid treatment price")); return; }
    const persisted = await createTreatmentPlan(patient.id, title, total);
    if (!persisted.ok) { toast.error(persisted.error ?? t("Treatment plan could not be created")); return; }
    const plan: TreatmentPlan = {
      id: persisted.id ?? createId(), patientId: patient.id, patientName: patient.name,
      title, procedures: [], total, sessionsDone: 0, sessionsTotal: 1,
      progress: 0, status: "Proposed", items: [],
    };
    setPlans((current) => [plan, ...current]);
    setCreateOpen(false);
    toast.success(t("Treatment plan created"));
    openWorkspace(plan);
  };
  return (
    <div className="space-y-5">
      {!embedded && <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: t("Active plans"), value: stats.active, sub: stats.activeValue, icon: Stethoscope, color: "bg-primary/10 text-primary" },
          { label: t("Proposed value"), value: stats.proposed, sub: stats.proposedValue, icon: ClipboardPlus, color: "bg-blue-50 text-blue-700" },
          { label: t("Completed"), value: stats.completed, sub: stats.completedValue, icon: CheckCircle2, color: "bg-emerald-50 text-emerald-700" },
        ].map((stat, index) => <StatCard key={stat.label} label={stat.label} value={stat.value} note={formatMoney(stat.sub)} icon={stat.icon} tone={index === 1 ? "info" : index === 2 ? "success" : "accent"} />)}
      </div>}
      {loadError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <span>{t("Treatment plans could not be loaded.")}</span>
          <Button variant="outline" size="sm" className={buttonTouch} onClick={() => void loadPlanningData()}>{t("Retry")}</Button>
        </div>
      )}
      <FilterBar className="justify-between">
        <div className="flex flex-1 gap-2">
          <div className="relative max-w-md flex-1"><Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label={t("Search treatment plans…")} value={search} onChange={(event) => setSearch(event.target.value)} className="bg-white ps-9 min-h-11 sm:min-h-0" placeholder={t("Search treatment plans…")} /></div>
          <Select aria-label={t("Filter by status")} value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)} className="min-h-11 rounded-xl border bg-white px-3 text-sm sm:min-h-0">
            <option value="All">{t("All")}</option>
            {planStatuses.map((status) => <option key={status} value={status}>{t(status)}</option>)}
          </Select>
        </div>
        {canEdit && <Button className={buttonTouch} onClick={() => setCreateOpen(true)}><Plus /> {t("New treatment plan")}</Button>}
      </FilterBar>
      {!loaded && <p className="text-sm text-muted-foreground">{t("Loading treatment plans…")}</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        {visible.map((plan) => {
          const remaining = Math.max(0, plan.sessionsTotal - plan.sessionsDone);
          return <Card key={plan.id} className="transition hover:-translate-y-0.5 hover:shadow-lg">
            <CardHeader className="flex-row items-start gap-3"><Avatar><AvatarFallback data-no-translate>{initials(plan.patientName)}</AvatarFallback></Avatar>
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><CardTitle data-no-translate>{plan.title}</CardTitle><Badge variant={variant(plan.status)}>{t(plan.status)}</Badge></div><p className="mt-1 text-xs text-muted-foreground" data-no-translate>{plan.patientName} · {plan.id.slice(0, 8).toUpperCase()}</p></div>
            </CardHeader><CardContent><div className="mb-4 flex flex-wrap gap-2">{plan.procedures.map((procedure, index) => <Badge variant="outline" key={`${procedure}-${index}`} data-no-translate>{procedure}</Badge>)}</div>
              <div className="mb-2 flex justify-between text-xs"><span className="font-semibold">{t("Treatment progress")}</span><span className="font-bold text-primary">{plan.progress}%</span></div><Progress value={plan.progress} />
              <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                <span>{t("{done}/{total} completed", { done: plan.sessionsDone, total: plan.sessionsTotal })}</span>
                {remaining > 0 && <span>{t("{n} remaining", { n: remaining })}</span>}
              </div>
              <div className="mt-5 grid grid-cols-3 divide-x rounded-xl bg-slate-50 p-3 text-center"><div><p className="text-[10px] text-muted-foreground">{t("Plan value")}</p><p className="mt-1 text-sm font-bold">{formatMoney(plan.total)}</p></div><div><p className="text-[10px] text-muted-foreground">{t("Sessions")}</p><p className="mt-1 text-sm font-bold">{plan.sessionsDone}/{plan.sessionsTotal}</p></div><div><p className="text-[10px] text-muted-foreground">{t("Plan items")}</p><p className="mt-1 text-sm font-bold">{plan.items?.length ?? plan.procedures.length}</p></div></div>
              <Button className={cn("mt-4 w-full", buttonTouch)} variant="outline" onClick={() => openWorkspace(plan)}>{t("Open odontogram & plan")}</Button>
            </CardContent></Card>;
        })}
        {loaded && !visible.length && <EmptyState icon={ClipboardPlus} title={t("No treatment plans found")} description={t("Try another filter, or create a treatment plan for a patient.")} className="lg:col-span-2" action={canEdit ? <Button className={buttonTouch} onClick={() => setCreateOpen(true)}><Plus /> {t("New treatment plan")}</Button> : undefined} />}
      </div>
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Create treatment plan")}</DialogTitle>
            <DialogDescription>{t("Choose a patient, then build the plan from the interactive odontogram.")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={createPlan} className="space-y-4">
            {patientId ? <input type="hidden" name="patientId" value={patientId} /> : <label className="block text-xs font-semibold">{t("Patient")}
              <Select name="patientId" required className={selectClass}>
                <option value="">{t("Choose patient…")}</option>
                {patients.map((patient) => <option key={patient.id} value={patient.id} data-no-translate>{patient.name} · {patient.patientNo}</option>)}
              </Select>
            </label>}
            <label className="block text-xs font-semibold">{t("Plan title")}<Input name="title" required className={fieldClass} placeholder={t("Comprehensive treatment plan")} /></label>
            <label className="block text-xs font-semibold">{t("Total treatment price")}<Input name="totalPrice" type="number" min="0" step="0.01" required className={fieldClass} placeholder="0.00" /></label>
            <DialogFooter>
              <Button type="button" variant="outline" className={buttonTouch} onClick={() => setCreateOpen(false)}>{t("Cancel")}</Button>
              <Button type="submit" className={buttonTouch}>{t("Create & open plan")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
