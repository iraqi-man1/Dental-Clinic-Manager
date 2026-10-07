/* eslint-disable @next/next/no-img-element */
"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Banknote,
  ChevronRight,
  FileImage,
  Mail,
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
import { createId } from "@/lib/ids";
import {
  DEFAULT_CLINIC_TIME_ZONE,
  ageFromDateOfBirth,
  clinicDateLabel,
  clinicTimeLabel,
  clinicTodayKey,
} from "@/lib/clinic-time";
import {
  DataTable,
  EmptyState,
  FilterBar,
  type DataTableColumn,
} from "@/components/clinic/app-ui";

/** Session payments are collected by these roles. Mirrors the record_session_payment database check. */
const SESSION_PAYMENT_ROLES: ClinicRole[] = ["owner", "admin", "billing", "front_desk", "assistant"];
/** Phones need 44px touch targets. Larger screens keep the compact height. */
const TOUCH_TARGET_CLASS = "h-11 sm:h-10";
const TOUCH_TARGET_SMALL_CLASS = "h-11 sm:h-8";
const MAX_PATIENT_AGE_YEARS = 120;
const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

type PaymentMode = "full" | "partial" | "not_paid";
type SessionPaymentInput = {
  sessionId: string;
  mode: PaymentMode;
  amount?: number;
  method: Payment["method"];
  reference?: string;
};
type ClinicalNote = { id: string; text: string; isToday: boolean };
type DateOfBirthIssue = "required" | "invalid" | "future" | "tooOld";

function isLeapYear(year: number) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** True only for a real calendar date written as YYYY-MM-DD. */
function isValidDateKey(value: string) {
  const match = DATE_KEY_PATTERN.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

/** The earliest accepted date of birth: the clinic's today minus MAX_PATIENT_AGE_YEARS. */
function earliestDateOfBirthKey(todayKey: string) {
  const [year, month, day] = todayKey.split("-").map(Number);
  const targetYear = year - MAX_PATIENT_AGE_YEARS;
  // 29 February falls back to 28 February when the target year is not a leap year.
  const safeDay = month === 2 && day === 29 && !isLeapYear(targetYear) ? 28 : day;
  return [
    String(targetYear).padStart(4, "0"),
    String(month).padStart(2, "0"),
    String(safeDay).padStart(2, "0"),
  ].join("-");
}

function dateOfBirthIssue(value: string, todayKey: string): DateOfBirthIssue | null {
  if (!value) return "required";
  if (!isValidDateKey(value)) return "invalid";
  if (value > todayKey) return "future";
  if (value < earliestDateOfBirthKey(todayKey)) return "tooOld";
  return null;
}

/** Appointment labels come from the instant in the clinic zone. The stored display labels are a fallback only. */
function appointmentDateLabel(appointment: Appointment, timeZone: string, locale: string) {
  return clinicDateLabel(appointment.startsAt, timeZone, locale) || appointment.date;
}

function appointmentTimeLabel(appointment: Appointment, timeZone: string, locale: string) {
  return clinicTimeLabel(appointment.startsAt, timeZone, locale) || appointment.time;
}

function SessionPaymentDialog({ session, onPay, onClose }: {
  session: TreatmentSession | null;
  onClose: () => void;
  onPay: (input: SessionPaymentInput) => Promise<{ ok: boolean; error?: string }>;
}) {
  const { formatMoney, t } = useClinicPreferences();
  const [mode, setMode] = useState<PaymentMode>("full");
  const [method, setMethod] = useState<Payment["method"]>("Cash");
  const [saving, setSaving] = useState(false);
  if (!session) return null;
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    const form = new FormData(event.currentTarget);
    let result: { ok: boolean; error?: string };
    try {
      result = await onPay({
        sessionId: session.id,
        mode,
        amount: mode === "partial" ? Number(form.get("amount")) : undefined,
        method,
        reference: String(form.get("reference") ?? ""),
      });
    } catch {
      result = { ok: false };
    }
    setSaving(false);
    if (result.ok) {
      toast.success(mode === "not_paid" ? t("Session left unpaid; no transaction was created") : t("Session payment recorded"));
      onClose();
    } else {
      toast.error(result.error ?? t("Payment could not be recorded"));
    }
  };
  return <Dialog open onOpenChange={(open) => !open && onClose()}>
    <DialogContent>
      <DialogHeader><DialogTitle>{t("Record session payment")}</DialogTitle><DialogDescription>
        <span data-no-translate>{session.procedureName}</span> · {t("Session {number}", { number: session.sessionNumber })}. {t("Payment does not complete the clinical session.")}
      </DialogDescription></DialogHeader>
      <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center text-xs">
        <div><p className="text-muted-foreground">{t("Expected")}</p><p className="mt-1 font-bold">{formatMoney(session.expectedAmount)}</p></div>
        <div><p className="text-muted-foreground">{t("Paid")}</p><p className="mt-1 font-bold text-emerald-700">{formatMoney(session.amountPaid)}</p></div>
        <div><p className="text-muted-foreground">{t("Due")}</p><p className="mt-1 font-bold text-amber-700">{formatMoney(session.remaining)}</p></div>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-xs font-semibold">{t("Payment status")}
          <Select value={mode} onChange={(event) => setMode(event.target.value as PaymentMode)} className={cn("mt-1.5 w-full rounded-xl border bg-white px-3 text-sm", TOUCH_TARGET_CLASS)}>
            <option value="full">{t("Paid in Full")}</option>
            <option value="partial">{t("Partial Payment")}</option>
            <option value="not_paid">{t("Not Paid")}</option>
          </Select>
        </label>
        {mode === "full" && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm">{t("Amount to collect:")} <strong>{formatMoney(session.remaining)}</strong></div>}
        {mode === "partial" && <label className="block text-xs font-semibold">{t("Amount received")}<Input name="amount" type="number" min="0.01" max={session.remaining} step="0.01" required className={cn("mt-1.5", TOUCH_TARGET_CLASS)} /></label>}
        {mode !== "not_paid" && <>
          <label className="block text-xs font-semibold">{t("Method")}
            <Select value={method} onChange={(event) => setMethod(event.target.value as Payment["method"])} className={cn("mt-1.5 w-full rounded-xl border bg-white px-3 text-sm", TOUCH_TARGET_CLASS)}>
              <option value="Cash">{t("Cash")}</option>
              <option value="Card">{t("Card")}</option>
              <option value="Insurance">{t("Insurance")}</option>
              <option value="Bank transfer">{t("Bank transfer")}</option>
            </Select>
          </label>
          <label className="block text-xs font-semibold">{t("Reference")}<Input name="reference" className={cn("mt-1.5", TOUCH_TARGET_CLASS)} placeholder={t("Optional")} /></label>
        </>}
        <DialogFooter>
          <Button type="submit" className={TOUCH_TARGET_CLASS} disabled={saving || session.remaining <= 0}>
            {saving ? t("Saving…") : mode === "not_paid" ? t("Confirm not paid") : t("Confirm payment")}
          </Button>
        </DialogFooter>
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

function AddPatientDialog({ onAdd, timeZone }: { onAdd: (patient: Patient) => Promise<Patient | null>; timeZone: string }) {
  const { t } = useClinicPreferences();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  const [dateOfBirthError, setDateOfBirthError] = useState("");
  const todayKey = clinicTodayKey(timeZone);
  const earliestKey = earliestDateOfBirthKey(todayKey);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name")).trim();
    const phone = normalizeIraqiMobileNumber(String(form.get("phone")));
    if (!phone) {
      setPhoneError(t(iraqiMobileValidationMessage));
      return;
    }
    setPhoneError("");
    const dateOfBirth = String(form.get("dateOfBirth") ?? "");
    const issue = dateOfBirthIssue(dateOfBirth, todayKey);
    if (issue) {
      setDateOfBirthError(
        issue === "required" ? t("Enter the date of birth.")
          : issue === "invalid" ? t("Enter a valid date of birth.")
            : issue === "future" ? t("Date of birth cannot be in the future.")
              : t("Date of birth must be within the last {years} years.", { years: MAX_PATIENT_AGE_YEARS }),
      );
      return;
    }
    setDateOfBirthError("");
    setSaving(true);
    const id = createId();
    let saved: Patient | null = null;
    try {
      saved = await onAdd({
        id,
        patientNo: `PT-${id.replaceAll("-", "").slice(0, 10).toUpperCase()}`,
        name,
        initials: name
          .split(" ")
          .map((p) => p[0])
          .join("")
          .slice(0, 2)
          .toUpperCase(),
        dateOfBirth,
        age: ageFromDateOfBirth(dateOfBirth, timeZone),
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
    } catch {
      saved = null;
    }
    setSaving(false);
    if (saved) setOpen(false);
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button className={TOUCH_TARGET_CLASS} onClick={() => { setPhoneError(""); setDateOfBirthError(""); setOpen(true); }}>
        <Plus /> {t("Add patient")}
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("Add a new patient")}</DialogTitle>
          <DialogDescription>
            {t("Create a complete patient profile. You can add clinical records and images afterward.")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("Full name")}>
              <Input name="name" required placeholder="Eleanor Anderson" className={TOUCH_TARGET_CLASS} />
            </Field>
            <Field label={t("Date of birth")}>
              <Input
                name="dateOfBirth"
                type="date"
                required
                dir="ltr"
                min={earliestKey}
                max={todayKey}
                className={TOUCH_TARGET_CLASS}
                aria-invalid={Boolean(dateOfBirthError)}
                aria-describedby={dateOfBirthError ? "patient-dob-error" : undefined}
                onChange={() => dateOfBirthError && setDateOfBirthError("")}
              />
              {dateOfBirthError && <span id="patient-dob-error" className="mt-1 block text-[11px] font-medium text-rose-700">{dateOfBirthError}</span>}
            </Field>
            <Field label={t("Gender")}>
              <Select
                name="gender"
                className={cn("w-full rounded-xl border bg-white px-3 text-sm", TOUCH_TARGET_CLASS)}
              >
                <option value="Female">{t("Female")}</option>
                <option value="Male">{t("Male")}</option>
                <option value="Other">{t("Other")}</option>
              </Select>
            </Field>
            <Field label={t("Phone")}>
              <Input
                name="phone"
                required
                inputMode="tel"
                dir="ltr"
                className={TOUCH_TARGET_CLASS}
                aria-invalid={Boolean(phoneError)}
                aria-describedby={phoneError ? "patient-phone-error" : undefined}
                placeholder="07XXXXXXXXX or +9647XXXXXXXXX"
                onChange={() => phoneError && setPhoneError("")}
              />
              {phoneError && <span id="patient-phone-error" className="mt-1 block text-[11px] font-medium text-rose-700">{phoneError}</span>}
            </Field>
            <Field label={t("Email (optional)")}>
              <Input
                name="email"
                type="email"
                className={TOUCH_TARGET_CLASS}
                placeholder="patient@example.com"
              />
            </Field>
            <Field label={t("Allergies")}>
              <Input name="allergies" className={TOUCH_TARGET_CLASS} placeholder={t("Penicillin, latex")} />
            </Field>
          </div>
          <Field label={t("Clinical note")}>
            <Textarea
              name="notes"
              rows={3}
              className="w-full rounded-xl border p-3 text-sm outline-none focus:ring-4 focus:ring-primary/10"
              placeholder={t("Important details for the care team…")}
            />
          </Field>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className={TOUCH_TARGET_CLASS}
              onClick={() => setOpen(false)}
            >
              {t("Cancel")}
            </Button>
            <Button type="submit" className={TOUCH_TARGET_CLASS} disabled={saving}>{saving ? t("Creating…") : t("Create patient")}</Button>
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
  timeZone,
  onBack,
  onChartChange,
}: {
  patient: Patient;
  appointments: Appointment[];
  role: ClinicRole;
  clinicianName: string;
  timeZone: string;
  onBack: () => void;
  onChartChange: (
    chart: Record<number, ToothCondition>,
    surfaces: ToothSurfaceChart,
  ) => Promise<boolean>;
}) {
  const { formatMoney, locale, t } = useClinicPreferences();
  const canEditClinical = ["owner", "admin", "dentist", "hygienist"].includes(role);
  const patientAppointments = appointments
    .filter((appointment) => appointment.patientId === patient.id)
    .sort((a, b) => (Date.parse(b.startsAt) || 0) - (Date.parse(a.startsAt) || 0));
  const relevantAppointment = patientAppointments.find((appointment) => appointment.status !== "Cancelled") ?? patientAppointments[0];
  const lastVisit = patient.lastVisit === "New patient" ? t("New patient") : patient.lastVisit;
  const savedSurfaces = patient.toothSurfaces ?? {};
  // The chart shows draft edits. `savedChart` is the last chart the database confirmed, and a failed save reverts to it.
  const [chart, setChart] = useState(patient.toothChart);
  const [surfaceChart, setSurfaceChart] = useState<ToothSurfaceChart>(savedSurfaces);
  const [savedChart, setSavedChart] = useState({ chart: patient.toothChart, surfaces: savedSurfaces });
  const [chartSaving, setChartSaving] = useState(false);
  const [notes, setNotes] = useState<ClinicalNote[]>(() =>
    patient.notes ? [{ id: "stored-note", text: patient.notes, isToday: false }] : [],
  );
  const [note, setNote] = useState("");
  const [images, setImages] = useState<{ name: string; url: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const saveChart = async () => {
    setChartSaving(true);
    let saved = false;
    try {
      saved = await onChartChange(chart, surfaceChart);
    } catch {
      saved = false;
    }
    setChartSaving(false);
    if (saved) {
      setSavedChart({ chart, surfaces: surfaceChart });
      toast.success(t("Dental chart saved"));
    } else {
      setChart(savedChart.chart);
      setSurfaceChart(savedChart.surfaces);
      toast.error(t("Dental chart could not be saved. The last saved chart is shown."));
    }
  };

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const selectedFiles = Array.from(files);
    setUploading(true);
    const outcomes = await Promise.all(
      selectedFiles.map(async (file) => {
        try {
          const result = await uploadPatientFile(patient.id, file);
          return { file, ok: result.ok, error: result.error };
        } catch {
          return { file, ok: false, error: undefined };
        }
      }),
    );
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
    // Previews appear only for files the server stored.
    const stored = outcomes.filter((outcome) => outcome.ok);
    const failed = outcomes.find((outcome) => !outcome.ok);
    if (stored.length) {
      setImages((old) => [
        ...old,
        ...stored.map((outcome) => ({ name: outcome.file.name, url: URL.createObjectURL(outcome.file) })),
      ]);
      toast.success(
        stored.length === 1 ? t("1 image attached") : t("{count} images attached", { count: stored.length }),
      );
    }
    if (failed) toast.error(failed.error ?? t("Image could not be uploaded"));
  };

  const addNote = () => {
    if (!note.trim()) return;
    setNotes((old) => [{ id: createId(), text: note, isToday: true }, ...old]);
    setNote("");
  };

  return (
    <div className="space-y-5">
      <Button
        onClick={onBack}
        variant="ghost"
        size="sm"
        className={TOUCH_TARGET_SMALL_CLASS}
      >
        <ArrowLeft className="size-4 rtl:rotate-180" /> {t("Back to all patients")}
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
                <Badge variant="success">{t(patient.status)}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                <span data-no-translate>{patient.patientNo}</span> · {t("{age} years", { age: patient.age })} · {t(patient.gender)}
              </p>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5" data-no-translate>
                  <Phone className="size-3.5" />
                  {patient.phone}
                </span>
                {patient.email ? (
                  <span className="inline-flex items-center gap-1.5" data-no-translate>
                    <Mail className="size-3.5" />
                    {patient.email}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      <Tabs defaultValue="overview">
        <div className="overflow-x-auto">
          <TabsList className="min-w-max">
            <TabsTrigger value="overview">{t("Overview")}</TabsTrigger>
            {canEditClinical && <TabsTrigger value="chart">{t("Dental chart")}</TabsTrigger>}
            {canEditClinical && <TabsTrigger value="plans">{t("Treatment plans")}</TabsTrigger>}
            <TabsTrigger value="visits">{t("Visit history")}</TabsTrigger>
            {canEditClinical && <TabsTrigger value="images">{t("X-rays & images")}</TabsTrigger>}
            {canEditClinical && <TabsTrigger value="notes">{t("Clinical notes")}</TabsTrigger>}
          </TabsList>
        </div>
        <TabsContent value="overview">
          <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>{t("Medical profile")}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("Allergies")}
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
                        {t("No known allergies")}
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("Medical conditions")}
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
                        {t("None reported")}
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("Last visit")}
                  </p>
                  <p className="whitespace-nowrap text-sm font-semibold">{lastVisit}</p>
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("Next appointment")}
                  </p>
                  <p className="text-sm font-semibold">
                    {patient.nextVisit ?? t("Not scheduled")}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{t("Financial summary")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs text-muted-foreground">
                    {t("Outstanding balance")}
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
                    <p className="text-xs text-muted-foreground">{t("Appointments")}</p>
                    <p className="mt-1 font-semibold">{patientAppointments.length}</p>
                  </div>
                  <div className="rounded-xl border p-3">
                    <p className="text-xs text-muted-foreground">
                      {t("Original price")}
                    </p>
                    <p className="mt-1 font-semibold">{relevantAppointment ? formatMoney(relevantAppointment.treatmentPrice) : "—"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          <Card className="mt-5"><CardHeader><CardTitle>{t("Requested treatment & appointment")}</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("Treatment")}</p><p className="mt-1 font-semibold" data-no-translate>{relevantAppointment?.treatment ?? patient.requestedTreatment ?? t("Not specified")}</p></div>
            <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("Assigned doctor")}</p><p className="mt-1 font-semibold" data-no-translate>{relevantAppointment?.doctor ?? patient.assignedDoctor ?? t("Not assigned")}</p></div>
            <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("Appointment")}</p><p className="mt-1 font-semibold whitespace-nowrap">{relevantAppointment ? `${appointmentDateLabel(relevantAppointment, timeZone, locale)} · ${appointmentTimeLabel(relevantAppointment, timeZone, locale)}` : t("Not scheduled")}</p></div>
            <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("Original price")}</p><p className="mt-1 font-semibold">{relevantAppointment ? formatMoney(relevantAppointment.treatmentPrice) : "—"}</p></div>
          </CardContent></Card>
        </TabsContent>
        {canEditClinical && <TabsContent value="chart">
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle>{t("Interactive odontogram")}</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("Universal numbering system · adult dentition")}
                </p>
              </div>
              <Button size="sm" className={TOUCH_TARGET_SMALL_CLASS} disabled={chartSaving} onClick={() => void saveChart()}>
                {chartSaving ? t("Saving…") : t("Save chart")}
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
        </TabsContent>}
        {canEditClinical && <TabsContent value="plans">
          <TreatmentsPage patients={[patient]} role={role} patientId={patient.id} embedded />
        </TabsContent>}
        <TabsContent value="visits">
          <Card>
            <CardHeader>
              <CardTitle>{t("Visit history")}</CardTitle>
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
                  <div className="min-w-0 flex-1 rounded-xl border p-4">
                    <div className="flex flex-wrap justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold" data-no-translate>{visit.treatment}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          <span className="whitespace-nowrap">{appointmentDateLabel(visit, timeZone, locale)}</span>
                          {" · "}
                          <span className="whitespace-nowrap">{appointmentTimeLabel(visit, timeZone, locale)}</span>
                          {" · "}
                          <span data-no-translate>{visit.doctor}</span>
                        </p>
                      </div>
                      <span className="text-sm font-bold">
                        {formatMoney(visit.treatmentPrice)}
                      </span>
                    </div>
                    <p className="mt-3 text-xs leading-relaxed text-slate-600">{t(visit.status)}</p>
                  </div>
                </div>
              ))}
              {!patientAppointments.length && <p className="py-8 text-center text-sm text-muted-foreground">{t("No appointments recorded for this patient.")}</p>}
            </CardContent>
          </Card>
        </TabsContent>
        {canEditClinical && <TabsContent value="images">
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3">
              <div className="min-w-0">
                <CardTitle>{t("X-rays & clinical images")}</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("Private files stored in this patient’s clinic folder")}
                </p>
              </div>
              <>
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => void upload(e.target.files)}
                />
                <Button size="sm" className={TOUCH_TARGET_SMALL_CLASS} disabled={uploading} onClick={() => inputRef.current?.click()}>
                  <Upload /> {uploading ? t("Uploading…") : t("Upload files")}
                </Button>
              </>
            </CardHeader>
            <CardContent>
              {images.length ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {images.map((img) => (
                    <div
                      key={img.url}
                      className="overflow-hidden rounded-2xl border"
                    >
                      <img
                        src={img.url}
                        alt={img.name}
                        data-no-translate
                        className="h-40 w-full object-cover"
                      />
                      <p className="truncate p-3 text-xs font-semibold" data-no-translate>
                        {img.name}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={FileImage}
                  title={t("No images attached yet")}
                  description={t("Upload X-rays and clinical images for this patient.")}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>}
        {canEditClinical && <TabsContent value="notes">
          <Card>
            <CardHeader>
              <CardTitle>{t("Clinical notes")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-3 flex gap-2">
                <Input
                  value={note}
                  aria-label={t("Add a clinical note…")}
                  className={TOUCH_TARGET_CLASS}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t("Add a clinical note…")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addNote();
                    }
                  }}
                />
                <Button className={TOUCH_TARGET_CLASS} disabled={!note.trim()} onClick={addNote}>
                  {t("Add note")}
                </Button>
              </div>
              <p className="mb-5 text-xs text-muted-foreground">{t("Clinical notes are not saved yet.")}</p>
              <div className="space-y-3">
                {notes.map((entry) => (
                  <div key={entry.id} className="rounded-xl border p-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold" data-no-translate>{clinicianName}</p>
                      {entry.isToday ? (
                        <span className="text-[10px] text-muted-foreground">{t("Today")}</span>
                      ) : null}
                    </div>
                    <p className="text-sm leading-relaxed text-slate-600" data-no-translate>
                      {entry.text}
                    </p>
                  </div>
                ))}
                {!notes.length && <p className="py-8 text-center text-sm text-muted-foreground">{t("No clinical notes yet.")}</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>}
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
  timeZone = DEFAULT_CLINIC_TIME_ZONE,
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
  ) => Promise<boolean>;
  sessions: TreatmentSession[];
  role: ClinicRole;
  onSessionPayment: (input: SessionPaymentInput) => Promise<{ ok: boolean; error?: string }>;
  /** Clinic time zone used for "today" and age. Defaults to the clinic default zone. */
  timeZone?: string;
}) {
  const { formatMoney, t } = useClinicPreferences();
  const [search, setSearch] = useState(initialSearch ?? "");
  const [status, setStatus] = useState("All patients");
  const [selected, setSelected] = useState<Patient | null>(() =>
    initialSearch
      ? (patients.find((p) => p.name === initialSearch) ?? null)
      : null,
  );
  const [paymentSession, setPaymentSession] = useState<TreatmentSession | null>(null);
  const canCollect = SESSION_PAYMENT_ROLES.includes(role);
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
        timeZone={timeZone}
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
      label: t("Patient"),
      isRowHeader: true,
      render: (patient) => (
        <div className="flex min-w-52 items-center gap-3">
          <Avatar>
            <AvatarFallback className={patient.avatarColor}>{patient.initials}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-semibold" data-no-translate>{patient.name}</p>
            <p className="whitespace-nowrap text-xs text-muted-foreground">
              <span data-no-translate>{patient.patientNo}</span> · {t("{age} yrs", { age: patient.age })}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "contact",
      label: t("Contact"),
      render: (patient) => (
        <div className="min-w-44">
          <p className="whitespace-nowrap text-xs font-medium" data-no-translate>{patient.phone}</p>
          <p className="mt-0.5 whitespace-nowrap text-xs text-muted-foreground" data-no-translate>{patient.email}</p>
        </div>
      ),
    },
    {
      key: "lastVisit",
      label: t("Last visit"),
      render: (patient) => (
        <span className="whitespace-nowrap text-xs font-medium">
          {patient.lastVisit === "New patient" ? t("New patient") : patient.lastVisit}
        </span>
      ),
    },
    {
      key: "alerts",
      label: t("Alerts"),
      render: (patient) => patient.allergies.length ? (
        <Badge variant="danger" data-no-translate><AlertTriangle className="me-1 size-3" />{patient.allergies[0]}</Badge>
      ) : <span className="text-xs text-muted-foreground">{t("None")}</span>,
    },
    {
      key: "balance",
      label: t("Balance"),
      render: (patient) => patient.balance ? (
        <span className="whitespace-nowrap text-sm font-semibold">{formatMoney(patient.balance)}</span>
      ) : <span className="text-sm font-semibold text-success">{t("Paid")}</span>,
    },
    {
      key: "sessions",
      label: t("Treatment sessions"),
      render: (patient) => {
        const allSessions = patientSessions(patient.id);
        const completed = allSessions.filter((session) => session.status === "completed").length;
        const current = relevantSession(patient.id);
        return (
          <div className="min-w-40">
            <p className="whitespace-nowrap text-xs font-semibold">
              {t("{done}/{total} completed", { done: completed, total: allSessions.length })}
            </p>
            <p className="mt-1 whitespace-nowrap text-[10px] text-muted-foreground">
              {t("{count} remaining", { count: Math.max(0, allSessions.length - completed) })}
              {current ? <> · {t("Session {number}", { number: current.sessionNumber })}</> : null}
            </p>
          </div>
        );
      },
    },
    {
      key: "payment",
      label: t("Session payment"),
      render: (patient) => {
        const current = relevantSession(patient.id);
        if (!current) return <span className="text-xs text-muted-foreground">{t("No upcoming session")}</span>;
        return (
          <div className="flex min-w-40 items-center gap-2">
            <Badge variant={current.paymentStatus === "Paid" ? "success" : current.paymentStatus === "Partially Paid" ? "warning" : "danger"}>{t(current.paymentStatus)}</Badge>
            {canCollect && current.paymentStatus !== "Paid" ? (
              <Button
                size="sm"
                variant="outline"
                className={TOUCH_TARGET_SMALL_CLASS}
                onClick={(event) => { event.stopPropagation(); setPaymentSession(current); }}
              >
                <Banknote /> {t("Pay")}
              </Button>
            ) : null}
          </div>
        );
      },
    },
    { key: "status", label: t("Status"), render: (patient) => <Badge variant={patient.status === "Active" ? "success" : "secondary"}>{t(patient.status)}</Badge> },
    { key: "action", label: <span className="sr-only">{t("Open patient")}</span>, render: () => <ChevronRight className="size-4 text-muted-foreground rtl:rotate-180" /> },
  ];
  return (
    <div className="space-y-5">
      <FilterBar className="justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row">
          <div className="relative max-w-md flex-1">
            <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className={cn("bg-white ps-9", TOUCH_TARGET_CLASS)}
              value={search}
              aria-label={t("Search patients")}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("Search patients…")}
            />
          </div>
          <Select
            value={status}
            aria-label={t("Filter by status")}
            onChange={(e) => setStatus(e.target.value)}
            className={cn("rounded-xl border bg-white px-3 text-sm", TOUCH_TARGET_CLASS)}
          >
            <option value="All patients">{t("All patients")}</option>
            <option value="Active">{t("Active")}</option>
            <option value="Inactive">{t("Inactive")}</option>
          </Select>
        </div>
        <AddPatientDialog onAdd={onAdd} timeZone={timeZone} />
      </FilterBar>
      <Card className="overflow-hidden">
        {filtered.length ? (
          // The shared Table primitive scrolls sideways inside its own container. This region gives that scroll area a label.
          <div role="region" aria-label={t("Patients")}>
            <DataTable
              ariaLabel={t("Patients")}
              columns={columns}
              rows={filtered}
              getRowKey={(patient) => patient.id}
              contentClassName="min-w-[1120px]"
              onRowAction={setSelected}
            />
          </div>
        ) : (
          <EmptyState
            icon={UserRound}
            title={t("No patients found")}
            description={t("Try a different name or status filter.")}
            className="m-5"
          />
        )}
      </Card>
      <SessionPaymentDialog session={paymentSession} onClose={() => setPaymentSession(null)} onPay={onSessionPayment} />
    </div>
  );
}
