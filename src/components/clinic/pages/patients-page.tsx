/* eslint-disable @next/next/no-img-element */
"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  FileImage,
  Mail,
  Banknote,
  Phone,
  Plus,
  Search,
  Upload,
  UserRound,
} from "lucide-react";
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
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DentalChart } from "@/components/clinic/dental-chart";
import { TreatmentsPage } from "@/components/clinic/pages/treatments-page";
import type { Appointment, ClinicRole, Patient, Payment, ToothCondition, ToothSurfaceChart, TreatmentSession } from "@/lib/types";
import { cn, iraqiMobileValidationMessage, normalizeIraqiMobileNumber } from "@/lib/utils";
import { toast } from "sonner";
import { uploadPatientFile } from "@/lib/supabase/clinic-data";
import { useClinicPreferences } from "@/lib/clinic-preferences";
import {
  DataTable,
  EmptyState,
  FilterBar,
  type DataTableColumn,
} from "@/components/clinic/app-ui";

function SessionPaymentDialog({ session, onPay, onClose }: {
  session: TreatmentSession | null;
  onClose: () => void;
  onPay: (input: { sessionId: string; mode: "full" | "partial" | "not_paid"; amount?: number; method: Payment["method"]; reference?: string }) => Promise<{ ok: boolean; error?: string }>;
}) {
  const { formatMoney } = useClinicPreferences();
  const [mode, setMode] = useState<"full" | "partial" | "not_paid">("full");
  const [saving, setSaving] = useState(false);
  if (!session) return null;
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSaving(true);
    const form = new FormData(event.currentTarget);
    const result = await onPay({
      sessionId: session.id, mode,
      amount: mode === "partial" ? Number(form.get("amount")) : undefined,
      method: String(form.get("method")) as Payment["method"],
      reference: String(form.get("reference") ?? ""),
    });
    setSaving(false);
    if (result.ok) { toast.success(mode === "not_paid" ? "Session left unpaid; no transaction was created" : "Session payment recorded"); onClose(); }
    else toast.error(result.error ?? "Payment could not be recorded");
  };
  return <Dialog open onOpenChange={(open) => !open && onClose()}>
    <DialogContent>
      <DialogHeader><DialogTitle>Record session payment</DialogTitle><DialogDescription>
        {session.procedureName} · Session {session.sessionNumber}. Payment does not complete the clinical session.
      </DialogDescription></DialogHeader>
      <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center text-xs">
        <div><p className="text-muted-foreground">Expected</p><p className="mt-1 font-bold">{formatMoney(session.expectedAmount)}</p></div>
        <div><p className="text-muted-foreground">Paid</p><p className="mt-1 font-bold text-emerald-700">{formatMoney(session.amountPaid)}</p></div>
        <div><p className="text-muted-foreground">Due</p><p className="mt-1 font-bold text-amber-700">{formatMoney(session.remaining)}</p></div>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-xs font-semibold">Payment status
          <Select value={mode} onChange={(event) => setMode(event.target.value as typeof mode)} className="mt-1.5 h-10 w-full rounded-xl border bg-white px-3 text-sm">
            <option value="full">Paid in Full</option><option value="partial">Partial Payment</option><option value="not_paid">Not Paid</option>
          </Select>
        </label>
        {mode === "full" && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm">Amount to collect: <strong>{formatMoney(session.remaining)}</strong></div>}
        {mode === "partial" && <label className="block text-xs font-semibold">Amount received<Input name="amount" type="number" min="0.01" max={session.remaining} step="0.01" required className="mt-1.5" /></label>}
        {mode !== "not_paid" && <>
          <label className="block text-xs font-semibold">Method<Select name="method" className="mt-1.5 h-10 w-full rounded-xl border bg-white px-3 text-sm"><option>Cash</option><option>Card</option><option>Insurance</option><option>Bank transfer</option></Select></label>
          <label className="block text-xs font-semibold">Reference<Input name="reference" className="mt-1.5" placeholder="Optional" /></label>
        </>}
        <DialogFooter><Button type="submit" disabled={saving || session.remaining <= 0}>{saving ? "Saving…" : mode === "not_paid" ? "Confirm not paid" : "Confirm payment"}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-1.5 text-xs font-semibold text-slate-700">
      <span>{label}</span>
      {children}
    </label>
  );
}

function AddPatientDialog({ onAdd }: { onAdd: (patient: Patient) => Promise<Patient | null> }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name")).trim();
    const phone = normalizeIraqiMobileNumber(String(form.get("phone")));
    if (!phone) {
      setPhoneError(iraqiMobileValidationMessage);
      return;
    }
    setPhoneError("");
    setSaving(true);
    const id = crypto.randomUUID();
    const saved = await onAdd({
      id,
      patientNo: `PT-${id.replaceAll("-", "").slice(0, 10).toUpperCase()}`,
      name,
      initials: name
        .split(" ")
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
      age: Number(form.get("age")),
      gender: form.get("gender") as Patient["gender"],
      phone,
      email: String(form.get("email")).trim(),
      lastVisit: "New patient",
      status: "Active",
      allergies: String(form.get("allergies") || "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
      conditions: [],
      notes: String(form.get("notes") || ""),
      balance: 0,
      avatarColor: "bg-teal-100 text-teal-700",
      toothChart: {},
    });
    setSaving(false);
    if (saved) setOpen(false);
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => { setPhoneError(""); setOpen(true); }}>
        <Plus /> Add patient
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a new patient</DialogTitle>
          <DialogDescription>
            Create a complete patient profile. You can add clinical records and
            images afterward.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name">
              <Input name="name" required placeholder="Eleanor Anderson" />
            </Field>
            <Field label="Age">
              <Input
                name="age"
                required
                min={0}
                max={120}
                type="number"
                placeholder="36"
              />
            </Field>
            <Field label="Gender">
              <Select
                name="gender"
                className="h-10 w-full rounded-xl border bg-white px-3 text-sm"
              >
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Other">Other</option>
              </Select>
            </Field>
            <Field label="Phone">
              <Input
                name="phone"
                required
                inputMode="tel"
                dir="ltr"
                aria-invalid={Boolean(phoneError)}
                aria-describedby={phoneError ? "patient-phone-error" : undefined}
                placeholder="07XXXXXXXXX or +9647XXXXXXXXX"
                onChange={() => phoneError && setPhoneError("")}
              />
              {phoneError && <span id="patient-phone-error" className="mt-1 block text-[11px] font-medium text-rose-700">{phoneError}</span>}
            </Field>
            <Field label="Email (optional)">
              <Input
                name="email"
                type="email"
                placeholder="patient@example.com"
              />
            </Field>
            <Field label="Allergies">
              <Input name="allergies" placeholder="Penicillin, latex" />
            </Field>
          </div>
          <Field label="Clinical note">
            <Textarea
              name="notes"
              rows={3}
              className="w-full rounded-xl border p-3 text-sm outline-none focus:ring-4 focus:ring-primary/10"
              placeholder="Important details for the care team…"
            />
          </Field>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>{saving ? "Creating…" : "Create patient"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PatientDetails({
  patient,
  appointments,
  role,
  clinicianName,
  onBack,
  onChartChange,
}: {
  patient: Patient;
  appointments: Appointment[];
  role: ClinicRole;
  clinicianName: string;
  onBack: () => void;
  onChartChange: (
    chart: Record<number, ToothCondition>,
    surfaces: ToothSurfaceChart,
  ) => void;
}) {
  const { formatMoney } = useClinicPreferences();
  const canEditClinical = ["owner", "admin", "dentist", "hygienist"].includes(role);
  const patientAppointments = appointments.filter((appointment) => appointment.patientId === patient.id)
    .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
  const relevantAppointment = patientAppointments.find((appointment) => appointment.status !== "Cancelled") ?? patientAppointments[0];
  const [chart, setChart] = useState(patient.toothChart);
  const [surfaceChart, setSurfaceChart] = useState<ToothSurfaceChart>(
    patient.toothSurfaces ?? {},
  );
  const [notes, setNotes] = useState([patient.notes].filter(Boolean));
  const [note, setNote] = useState("");
  const [images, setImages] = useState<{ name: string; url: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = (files: FileList | null) => {
    if (!files) return;
    const selectedFiles = Array.from(files);
    const next = selectedFiles.map((file) => ({
      name: file.name,
      url: URL.createObjectURL(file),
    }));
    setImages((old) => [...old, ...next]);
    selectedFiles.forEach((file) => void uploadPatientFile(patient.id, file));
    toast.success(
      `${next.length} image${next.length === 1 ? "" : "s"} attached`,
    );
  };
  return (
    <div className="space-y-5">
      <Button
        onClick={onBack}
        variant="ghost"
        size="sm"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" /> Back to all patients
      </Button>
      <Card>
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-center">
            <Avatar className="size-20">
              <AvatarFallback className={cn("text-xl", patient.avatarColor)}>
                {patient.initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-bold tracking-tight" data-no-translate>
                  {patient.name}
                </h2>
                <Badge variant="success">{patient.status}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {patient.patientNo} · {patient.age} years · {patient.gender}
              </p>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="size-3.5" />
                  {patient.phone}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="size-3.5" />
                  {patient.email}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => toast.success("Patient check-in started")}
              >
                <CalendarDays /> Book visit
              </Button>
              {canEditClinical && <Button onClick={() => toast.success("Profile changes saved")}>
                Save profile
              </Button>}
            </div>
          </div>
        </CardContent>
      </Card>
      <Tabs defaultValue="overview">
        <div className="overflow-x-auto">
          <TabsList className="min-w-max">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            {canEditClinical && <TabsTrigger value="chart">Dental chart</TabsTrigger>}
            {canEditClinical && <TabsTrigger value="plans">Treatment plans</TabsTrigger>}
            <TabsTrigger value="visits">Visit history</TabsTrigger>
            {canEditClinical && <TabsTrigger value="images">X-rays & images</TabsTrigger>}
            {canEditClinical && <TabsTrigger value="notes">Clinical notes</TabsTrigger>}
          </TabsList>
        </div>
        <TabsContent value="overview">
          <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Medical profile</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Allergies
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {patient.allergies.length ? (
                      patient.allergies.map((a) => (
                        <Badge variant="danger" key={a} data-no-translate>
                          <AlertTriangle className="me-1 size-3" />
                          {a}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        No known allergies
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Medical conditions
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {patient.conditions.length ? (
                      patient.conditions.map((c) => (
                        <Badge variant="warning" key={c} data-no-translate>
                          {c}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        None reported
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Last visit
                  </p>
                  <p className="text-sm font-semibold">{patient.lastVisit}</p>
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Next appointment
                  </p>
                  <p className="text-sm font-semibold">
                    {patient.nextVisit ?? "Not scheduled"}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Financial summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs text-muted-foreground">
                    Outstanding balance
                  </p>
                  <p
                    className={cn(
                      "mt-1 text-3xl font-bold",
                      patient.balance > 0
                        ? "text-amber-600"
                        : "text-emerald-600",
                    )}
                  >
                    {formatMoney(patient.balance)}
                  </p>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl border p-3">
                    <p className="text-xs text-muted-foreground">Appointments</p>
                    <p className="mt-1 font-semibold">{patientAppointments.length}</p>
                  </div>
                  <div className="rounded-xl border p-3">
                    <p className="text-xs text-muted-foreground">
                      Original price
                    </p>
                    <p className="mt-1 font-semibold">{relevantAppointment ? formatMoney(relevantAppointment.treatmentPrice) : "—"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          <Card className="mt-5"><CardHeader><CardTitle>Requested treatment & appointment</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Treatment</p><p className="mt-1 font-semibold" data-no-translate>{relevantAppointment?.treatment ?? patient.requestedTreatment ?? "Not specified"}</p></div>
            <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Assigned doctor</p><p className="mt-1 font-semibold" data-no-translate>{relevantAppointment?.doctor ?? patient.assignedDoctor ?? "Not assigned"}</p></div>
            <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Appointment</p><p className="mt-1 font-semibold">{relevantAppointment ? `${relevantAppointment.date} · ${relevantAppointment.time}` : "Not scheduled"}</p></div>
            <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Original price</p><p className="mt-1 font-semibold">{relevantAppointment ? formatMoney(relevantAppointment.treatmentPrice) : "—"}</p></div>
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="chart">
          <Card>
            <CardHeader className="flex-row items-start justify-between">
              <div>
                <CardTitle>Interactive odontogram</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  Universal numbering system · adult dentition
                </p>
              </div>
              <Button size="sm" onClick={() => onChartChange(chart, surfaceChart)}>
                Save chart
              </Button>
            </CardHeader>
            <CardContent>
              <DentalChart
                value={chart}
                surfaceValue={surfaceChart}
                onChange={setChart}
                onSurfaceChange={setSurfaceChart}
              />
            </CardContent>
          </Card>
        </TabsContent>
        {canEditClinical && <TabsContent value="plans">
          <TreatmentsPage patients={[patient]} role={role} patientId={patient.id} embedded />
        </TabsContent>}
        <TabsContent value="visits">
          <Card>
            <CardHeader>
              <CardTitle>Visit history</CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              {patientAppointments.map((visit, i) => (
                <div
                  key={visit.id}
                  className="relative flex gap-4 pb-6 last:pb-0"
                >
                  <div className="relative z-10 grid size-9 shrink-0 place-items-center rounded-full border bg-white text-primary">
                    <Activity className="size-4" />
                  </div>
                  {i < patientAppointments.length - 1 && (
                    <div className="absolute start-[17px] top-9 h-[calc(100%-20px)] w-px bg-border" />
                  )}
                  <div className="flex-1 rounded-xl border p-4">
                    <div className="flex flex-wrap justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold" data-no-translate>{visit.treatment}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {visit.date} · {visit.time} · {visit.doctor}
                        </p>
                      </div>
                      <span className="text-sm font-bold">
                        {formatMoney(visit.treatmentPrice)}
                      </span>
                    </div>
                    <p className="mt-3 text-xs leading-relaxed text-slate-600">{visit.status}</p>
                  </div>
                </div>
              ))}
              {!patientAppointments.length && <p className="py-8 text-center text-sm text-muted-foreground">No appointments recorded for this patient.</p>}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="images">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>X-rays & clinical images</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  Private files stored in this patient’s clinic folder
                </p>
              </div>
              <>
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => upload(e.target.files)}
                />
                <Button size="sm" onClick={() => inputRef.current?.click()}>
                  <Upload /> Upload files
                </Button>
              </>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {images.map((img) => (
                  <div
                    key={img.url}
                    className="overflow-hidden rounded-2xl border"
                  >
                    <img
                      src={img.url}
                      alt={img.name}
                      className="h-40 w-full object-cover"
                    />
                    <p className="truncate p-3 text-xs font-semibold" data-no-translate>
                      {img.name}
                    </p>
                  </div>
                ))}
                {[
                  { name: "Bitewing · right", date: "Aug 24, 2026" },
                  { name: "Panoramic X-ray", date: "Mar 04, 2026" },
                ].map((image) => (
                  <Button
                    key={image.name}
                    variant="outline"
                    className="group grid h-48 place-items-center rounded-2xl border-dashed bg-surface-secondary text-center hover:border-primary hover:bg-primary/5"
                  >
                    <div>
                      <FileImage className="mx-auto size-8 text-slate-300 group-hover:text-primary" />
                      <p className="mt-3 text-sm font-semibold">{image.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {image.date}
                      </p>
                    </div>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="notes">
          <Card>
            <CardHeader>
              <CardTitle>Clinical notes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-5 flex gap-2">
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add a clinical note…"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && note.trim()) {
                      setNotes((old) => [note, ...old]);
                      setNote("");
                      toast.success("Clinical note added");
                    }
                  }}
                />
                <Button
                  onClick={() => {
                    if (note.trim()) {
                      setNotes((old) => [note, ...old]);
                      setNote("");
                      toast.success("Clinical note added");
                    }
                  }}
                >
                  Add note
                </Button>
              </div>
              <div className="space-y-3">
                {notes.map((n, i) => (
                  <div key={`${n}-${i}`} className="rounded-xl border p-4" data-no-translate>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold" data-no-translate>{clinicianName}</p>
                      <span className="text-[10px] text-muted-foreground">
                        {i === 0 ? "Today" : "Aug 24, 2026"}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed text-slate-600">
                      {n}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function PatientsPage({
  patients,
  appointments,
  clinicianName,
  initialSearch,
  onAdd,
  onChartChange,
  sessions,
  role,
  onSessionPayment,
}: {
  patients: Patient[];
  initialSearch?: string;
  onAdd: (patient: Patient) => Promise<Patient | null>;
  appointments: Appointment[];
  clinicianName: string;
  onChartChange: (
    id: string,
    chart: Record<number, ToothCondition>,
    surfaces: ToothSurfaceChart,
  ) => void;
  sessions: TreatmentSession[];
  role: ClinicRole;
  onSessionPayment: (input: { sessionId: string; mode: "full" | "partial" | "not_paid"; amount?: number; method: Payment["method"]; reference?: string }) => Promise<{ ok: boolean; error?: string }>;
}) {
  const { formatMoney } = useClinicPreferences();
  const [search, setSearch] = useState(initialSearch ?? "");
  const [status, setStatus] = useState("All patients");
  const [selected, setSelected] = useState<Patient | null>(() =>
    initialSearch
      ? (patients.find((p) => p.name === initialSearch) ?? null)
      : null,
  );
  const [paymentSession, setPaymentSession] = useState<TreatmentSession | null>(null);
  const canCollect = ["owner", "admin", "billing", "front_desk", "dentist"].includes(role);
  const patientSessions = (patientId: string) => sessions.filter((session) => session.patientId === patientId);
  const relevantSession = (patientId: string) => patientSessions(patientId)
    .filter((session) => session.status !== "completed" && session.status !== "cancelled")
    .sort((a, b) => (a.scheduledAt ?? "9999").localeCompare(b.scheduledAt ?? "9999") || a.sessionNumber - b.sessionNumber)[0];
  const filtered = useMemo(
    () =>
      patients.filter(
        (p) =>
          (status === "All patients" || p.status === status) &&
          `${p.name} ${p.patientNo} ${p.phone} ${p.email}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [patients, search, status],
  );
  if (selected) {
    const fresh = patients.find((p) => p.id === selected.id) ?? selected;
    return (
      <PatientDetails
        patient={fresh}
        appointments={appointments}
        role={role}
        clinicianName={clinicianName}
        onBack={() => setSelected(null)}
        onChartChange={(chart, surfaces) =>
          onChartChange(fresh.id, chart, surfaces)
        }
      />
    );
  }
  const columns: DataTableColumn<Patient>[] = [
    {
      key: "patient",
      label: "Patient",
      isRowHeader: true,
      render: (patient) => (
        <div className="flex min-w-52 items-center gap-3">
          <Avatar>
            <AvatarFallback className={patient.avatarColor}>{patient.initials}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-semibold" data-no-translate>{patient.name}</p>
            <p className="text-xs text-muted-foreground">{patient.patientNo} · {patient.age} yrs</p>
          </div>
        </div>
      ),
    },
    {
      key: "contact",
      label: "Contact",
      render: (patient) => (
        <div className="min-w-44">
          <p className="text-xs font-medium" data-no-translate>{patient.phone}</p>
          <p className="mt-0.5 text-xs text-muted-foreground" data-no-translate>{patient.email}</p>
        </div>
      ),
    },
    { key: "lastVisit", label: "Last visit", render: (patient) => <span className="text-xs font-medium">{patient.lastVisit}</span> },
    {
      key: "alerts",
      label: "Alerts",
      render: (patient) => patient.allergies.length ? (
        <Badge variant="danger" data-no-translate><AlertTriangle className="me-1 size-3" />{patient.allergies[0]}</Badge>
      ) : <span className="text-xs text-muted-foreground">None</span>,
    },
    {
      key: "balance",
      label: "Balance",
      render: (patient) => patient.balance ? (
        <span className="text-sm font-semibold">{formatMoney(patient.balance)}</span>
      ) : <span className="text-sm font-semibold text-success">Paid</span>,
    },
    {
      key: "sessions",
      label: "Treatment sessions",
      render: (patient) => {
        const allSessions = patientSessions(patient.id);
        const completed = allSessions.filter((session) => session.status === "completed").length;
        const current = relevantSession(patient.id);
        return <div className="min-w-40"><p className="text-xs font-semibold">{completed}/{allSessions.length} completed</p><p className="mt-1 text-[10px] text-muted-foreground">{Math.max(0, allSessions.length - completed)} remaining{current ? ` · Session ${current.sessionNumber}` : ""}</p></div>;
      },
    },
    {
      key: "payment",
      label: "Session payment",
      render: (patient) => {
        const current = relevantSession(patient.id);
        if (!current) return <span className="text-xs text-muted-foreground">No upcoming session</span>;
        return (
          <div className="flex min-w-40 items-center gap-2">
            <Badge variant={current.paymentStatus === "Paid" ? "success" : current.paymentStatus === "Partially Paid" ? "warning" : "danger"}>{current.paymentStatus}</Badge>
            {canCollect && current.paymentStatus !== "Paid" ? <Button size="sm" variant="outline" onClick={(event) => { event.stopPropagation(); setPaymentSession(current); }}><Banknote /> Pay</Button> : null}
          </div>
        );
      },
    },
    { key: "status", label: "Status", render: (patient) => <Badge variant={patient.status === "Active" ? "success" : "secondary"}>{patient.status}</Badge> },
    { key: "action", label: <span className="sr-only">Open patient</span>, render: () => <ChevronRight className="size-4 text-muted-foreground rtl:rotate-180" /> },
  ];
  return (
    <div className="space-y-5">
      <FilterBar className="justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row">
          <div className="relative max-w-md flex-1">
            <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="bg-white ps-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search patients…"
            />
          </div>
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-10 rounded-xl border bg-white px-3 text-sm"
          >
            <option>All patients</option>
            <option>Active</option>
            <option>Inactive</option>
          </Select>
        </div>
        <AddPatientDialog onAdd={onAdd} />
      </FilterBar>
      <Card className="overflow-hidden">
        {filtered.length ? (
          <DataTable
            ariaLabel="Patients"
            columns={columns}
            rows={filtered}
            getRowKey={(patient) => patient.id}
            contentClassName="min-w-[1120px]"
            onRowAction={setSelected}
          />
        ) : (
          <EmptyState
            icon={UserRound}
            title="No patients found"
            description="Try a different name or status filter."
            className="m-5"
          />
        )}
      </Card>
      <SessionPaymentDialog session={paymentSession} onClose={() => setPaymentSession(null)} onPay={onSessionPayment} />
    </div>
  );
}
