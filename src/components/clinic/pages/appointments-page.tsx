"use client";

import { FormEvent, type ReactNode, useMemo, useState } from "react";
import { CalendarClock, ChevronLeft, ChevronRight, Clock3, GripVertical, Plus, Search, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Appointment, ClinicMember, Patient, ProcedureCatalogItem } from "@/lib/types";
import { cn, iraqiMobileValidationMessage, normalizeIraqiMobileNumber } from "@/lib/utils";
import { useClinicPreferences } from "@/lib/clinic-preferences";
import { EmptyState, FilterBar } from "@/components/clinic/app-ui";
import {
  DEFAULT_CLINIC_TIME_ZONE,
  clinicDateKey,
  clinicTodayKey,
  localDateTimeToIso,
  resolveClinicTimeZone,
} from "@/lib/clinic-time";
import { createId } from "@/lib/ids";

const DAY_MS = 24 * 60 * 60 * 1000;
const SLOT_MINUTES = 30;
const FIRST_SLOT_MINUTES = 8 * 60;
/** Phones get 44px touch targets. Larger screens keep the compact desktop heights. */
const TOUCH_CONTROL = "h-11 sm:h-10";
const TOUCH_BUTTON = "h-11 sm:h-10";
const TOUCH_ICON_BUTTON = "size-11 sm:size-10";

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** "HH:mm" for a count of minutes after midnight. */
function toClock(minutes: number): string {
  return `${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}`;
}

const timeSlots = Array.from({ length: 20 }, (_, index) =>
  toClock(FIRST_SLOT_MINUTES + index * SLOT_MINUTES),
);

// Calendar math runs on YYYY-MM-DD keys. UTC arithmetic on those keys never depends on the browser's zone.
function keyToUtc(key: string): number {
  const [year, month, day] = key.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function utcToKey(ms: number): string {
  const date = new Date(ms);
  return `${String(date.getUTCFullYear()).padStart(4, "0")}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

function shiftDays(key: string, days: number): string {
  return utcToKey(keyToUtc(key) + days * DAY_MS);
}

function shiftMonths(key: string, months: number): string {
  const [year, month] = key.split("-").map(Number);
  return utcToKey(Date.UTC(year, month - 1 + months, 1));
}

/** The Monday of the week that contains the date key. */
function weekStartOf(key: string): string {
  const weekday = new Date(keyToUtc(key)).getUTCDay();
  return shiftDays(key, -((weekday + 6) % 7));
}

/** Every date key in the Monday-first grid that covers the month of the anchor key. */
function monthGridDays(anchor: string): string[] {
  const [year, month] = anchor.split("-").map(Number);
  const start = weekStartOf(utcToKey(Date.UTC(year, month - 1, 1)));
  const end = shiftDays(weekStartOf(utcToKey(Date.UTC(year, month, 0))), 6);
  const count = Math.round((keyToUtc(end) - keyToUtc(start)) / DAY_MS) + 1;
  return Array.from({ length: count }, (_, index) => shiftDays(start, index));
}

const clockFormatters = new Map<string, Intl.DateTimeFormat>();

/** Minutes after midnight on the clinic wall clock, or null for an invalid instant. */
function clinicMinutesOfDay(iso: string, timeZone: string): number | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const zone = resolveClinicTimeZone(timeZone);
  let formatter = clockFormatters.get(zone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hour: "numeric",
      minute: "numeric",
      hourCycle: "h23",
    });
    clockFormatters.set(zone, formatter);
  }
  const parts = formatter.formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

type Visit = {
  appointment: Appointment;
  /** Clinic-local calendar date key. */
  date: string;
  /** Half-hour slot on the clinic wall clock ("HH:mm"), or "" when the start instant is invalid. */
  slot: string;
};

/** Converts a clinic wall-clock start and end on one date into UTC instants, or null when either is malformed. */
function bookingWindow(
  date: string,
  startTime: string,
  endTime: string,
  timeZone: string,
): { startsAt: string; endsAt: string } | null {
  try {
    return {
      startsAt: localDateTimeToIso(date, startTime, timeZone),
      endsAt: localDateTimeToIso(date, endTime, timeZone),
    };
  } catch {
    return null;
  }
}

type CalendarActions = {
  canManage: boolean;
  timeZone: string;
  onSelect: (appointment: Appointment) => void;
};

function DraggableAppointment({ appointment, compact = false, canManage, timeZone, onSelect }: {
  appointment: Appointment; compact?: boolean;
} & CalendarActions) {
  const { formatTime, t } = useClinicPreferences();
  const movable = canManage && appointment.status !== "Completed" && appointment.status !== "Cancelled";
  return (
    <button
      type="button"
      onClick={() => onSelect(appointment)}
      draggable={movable}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/appointment-id", appointment.id);
      }}
      className={cn(
        "group w-full min-w-0 rounded-lg border border-border border-s-4 bg-white text-start text-foreground shadow-xs transition hover:bg-accent/40 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-primary",
        compact ? "p-2" : "p-3",
        movable && "cursor-grab active:cursor-grabbing",
        appointment.status === "Cancelled" && "opacity-60",
      )}
      style={{ borderInlineStartColor: appointment.color }}
    >
      <span className="flex items-start justify-between gap-2">
        <span className="flex flex-wrap items-center gap-1 text-[11px] font-medium text-muted-foreground"><Clock3 className="size-3 shrink-0" /><span dir="ltr">{formatTime(appointment.startsAt, { timeZone })} – {formatTime(appointment.endsAt, { timeZone })}</span></span>
        {movable && <GripVertical className="size-3 shrink-0 text-muted-foreground" />}
      </span>
      <span className="mt-1.5 block break-words text-sm font-semibold" data-no-translate>{appointment.patientName}</span>
      <span className="mt-1 block truncate text-xs text-muted-foreground" data-no-translate>{appointment.treatment}</span>
      {!compact && <span className="mt-2 flex flex-wrap items-center justify-between gap-2"><span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Stethoscope className="size-3.5" /><span data-no-translate>{appointment.doctor}</span></span><Badge variant={appointment.status === "Pending" ? "warning" : appointment.status === "Cancelled" ? "secondary" : "default"}>{t(appointment.status)}</Badge></span>}
    </button>
  );
}

function AppointmentDetails({ appointment, canManage, timeZone, onClose, onSave }: {
  appointment: Appointment; canManage: boolean; timeZone: string; onClose: () => void;
  onSave: (appointment: Appointment, date: string, time?: string) => Promise<boolean>;
}) {
  const { formatDate, formatMoney, formatTime, t } = useClinicPreferences();
  const [saving, setSaving] = useState(false);
  const movable = canManage && appointment.status !== "Completed" && appointment.status !== "Cancelled";
  const visitDate = clinicDateKey(appointment.startsAt, timeZone) || appointment.date;
  const startMinutes = clinicMinutesOfDay(appointment.startsAt, timeZone);
  const startInput = startMinutes === null ? "" : toClock(startMinutes);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!movable || saving) return;
    const form = new FormData(event.currentTarget);
    const date = String(form.get("date"));
    const time = String(form.get("time"));
    try {
      localDateTimeToIso(date, time, timeZone);
    } catch {
      toast.error(t("Choose a valid future date and time"));
      return;
    }
    setSaving(true);
    try {
      if (await onSave(appointment, date, time)) {
        toast.success(t("Appointment rescheduled and saved"));
        onClose();
      }
    } finally { setSaving(false); }
  };
  return <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}><DialogContent>
    <DialogHeader><DialogTitle>{t("Appointment details")}</DialogTitle><DialogDescription>{t("Review the visit details and scheduled time.")}</DialogDescription></DialogHeader>
    <div className="rounded-xl border bg-accent/30 p-4"><h3 className="text-lg font-semibold" data-no-translate>{appointment.patientName}</h3><p className="mt-1 text-sm text-muted-foreground" data-no-translate>{appointment.treatment}</p><div className="mt-3 flex flex-wrap items-center gap-3"><Badge>{t(appointment.status)}</Badge><span className="text-sm" data-no-translate>{appointment.room}</span></div></div>
    <dl className="grid grid-cols-2 gap-4 text-sm">
      <div><dt className="text-muted-foreground">{t("Doctor")}</dt><dd className="mt-1 font-medium" data-no-translate>{appointment.doctor}</dd></div>
      <div><dt className="text-muted-foreground">{t("Treatment price")}</dt><dd className="mt-1 font-medium">{formatMoney(appointment.treatmentPrice)}</dd></div>
      <div className="col-span-2"><dt className="text-muted-foreground">{t("Scheduled")}</dt><dd className="mt-1 font-medium">{formatDate(visitDate, { timeZone, weekday: "long", month: "short", day: "numeric" })} · <span dir="ltr">{formatTime(appointment.startsAt, { timeZone })} – {formatTime(appointment.endsAt, { timeZone })}</span></dd></div>
    </dl>
    <form onSubmit={submit} className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs font-semibold">{t("Date")}<Input name="date" type="date" defaultValue={visitDate} required disabled={!movable || saving} className={cn("mt-1.5", TOUCH_CONTROL)} /></label>
        <label className="text-xs font-semibold">{t("Start time")}<Input name="time" type="time" defaultValue={startInput} required disabled={!movable || saving} className={cn("mt-1.5", TOUCH_CONTROL)} /></label>
      </div>
      {movable && <p className="text-xs leading-5 text-muted-foreground">{t("The visit duration stays the same when rescheduling.")}</p>}
      <DialogFooter>
        <Button type="button" variant="outline" disabled={saving} onClick={onClose} className={TOUCH_BUTTON}>{t("Close")}</Button>
        {movable && <Button disabled={saving} className={TOUCH_BUTTON}>{saving ? t("Saving…") : t("Save schedule")}</Button>}
      </DialogFooter>
    </form>
  </DialogContent></Dialog>;
}

function DropCell({ date, time, children, className, onMove }: {
  date: string; time?: string; children?: ReactNode; className?: string;
  onMove: (id: string, date: string, time?: string) => void;
}) {
  const [over, setOver] = useState(false);
  return <div
    className={cn("transition-colors", over && "bg-primary/10 ring-1 ring-inset ring-primary/30", className)}
    onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setOver(true); }}
    onDragLeave={() => setOver(false)}
    onDrop={(event) => {
      event.preventDefault(); setOver(false);
      const id = event.dataTransfer.getData("text/appointment-id");
      if (id) onMove(id, date, time);
    }}
  >{children}</div>;
}

function NewAppointment({
  patients,
  procedures,
  doctors,
  timeZone,
  onAdd,
  onCreatePatient,
}: {
  patients: Patient[];
  procedures: ProcedureCatalogItem[];
  doctors: ClinicMember[];
  timeZone: string;
  onAdd: (appointment: Appointment) => Promise<boolean>;
  onCreatePatient: (input: { name: string; phone: string; email: string; requestedTreatment: string; assignedDoctor: string }) => Promise<Patient | null>;
}) {
  const { formatMoney, t } = useClinicPreferences();
  const [open, setOpen] = useState(false);
  const [patientMode, setPatientMode] = useState<"existing" | "new">("existing");
  const [procedureId, setProcedureId] = useState("");
  const [saving, setSaving] = useState(false);
  const todayInput = clinicTodayKey(timeZone);
  const selectedProcedure = procedures.find((item) => item.id === procedureId) ?? procedures[0];
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const f = new FormData(event.currentTarget);
    const provider = doctors.find((doctor) => doctor.id === f.get("doctor"));
    const procedure = procedures.find((item) => item.id === f.get("procedure"));
    if (!provider || !procedure) {
      toast.error(t("Choose an available doctor and treatment"));
      return;
    }
    const date = String(f.get("date"));
    const instants = bookingWindow(date, String(f.get("time")), String(f.get("endTime")), timeZone);
    if (!instants) {
      toast.error(t("Choose a valid future date and time"));
      return;
    }
    if (Date.parse(instants.endsAt) <= Date.parse(instants.startsAt)) {
      toast.error(t("The end time must be after the start time"));
      return;
    }
    if (Date.parse(instants.startsAt) <= Date.now()) {
      toast.error(t("Choose a valid future date and time"));
      return;
    }
    setSaving(true);
    try {
      let patient: Patient | undefined = patients.find((p) => p.id === f.get("patient"));
      if (patientMode === "new") {
        const phone = normalizeIraqiMobileNumber(String(f.get("newPatientPhone")));
        if (!phone) {
          toast.error(t(iraqiMobileValidationMessage));
          return;
        }
        patient = (await onCreatePatient({
          name: String(f.get("newPatientName")),
          phone,
          email: String(f.get("newPatientEmail")),
          requestedTreatment: procedure.name,
          assignedDoctor: provider.fullName,
        })) ?? undefined;
      }
      if (!patient) {
        toast.error(t("Create or select a patient first"));
        return;
      }
      const saved = await onAdd({
        id: createId(),
        patientId: patient.id,
        patientName: patient.name,
        startsAt: instants.startsAt,
        endsAt: instants.endsAt,
        date: clinicDateKey(instants.startsAt, timeZone) || date,
        time: String(f.get("time")),
        endTime: String(f.get("endTime")),
        treatment: procedure.name,
        procedureId: procedure.id.startsWith("demo-") ? undefined : procedure.id,
        treatmentPrice: procedure.defaultPrice,
        doctor: provider.fullName,
        providerId: provider.userId,
        providerMemberId: provider.id,
        room: String(f.get("room")),
        status: "Confirmed",
        color: "#0f9f8f",
      });
      if (saved) setOpen(false);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button className={TOUCH_BUTTON} onClick={() => setOpen(true)}>
        <Plus />
        {t("New appointment")}
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("Schedule appointment")}</DialogTitle>
          <DialogDescription>
            {t("Reserve a provider, room, and time for the patient.")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-default p-1">
            {(["existing", "new"] as const).map((mode) => <Button key={mode} type="button" size="sm" variant={patientMode === mode ? "default" : "ghost"} className={TOUCH_BUTTON} onClick={() => setPatientMode(mode)}>{t(mode === "existing" ? "Existing patient" : "New patient")}</Button>)}
          </div>
          {patientMode === "existing" ? <label className="block text-xs font-semibold">
            {t("Patient")}
            <Select
              name="patient"
              required={patientMode === "existing"}
              className={cn("mt-1.5 w-full rounded-xl border bg-white px-3 text-sm", TOUCH_CONTROL)}
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id} data-no-translate>
                  {p.name} · {p.patientNo}
                </option>
              ))}
            </Select>
          </label> : <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold sm:col-span-2">{t("Patient name")}<Input name="newPatientName" required className={cn("mt-1.5", TOUCH_CONTROL)} /></label>
            <label className="text-xs font-semibold">{t("Phone")}<Input name="newPatientPhone" required inputMode="tel" dir="ltr" placeholder="07XXXXXXXXX or +9647XXXXXXXXX" className={cn("mt-1.5", TOUCH_CONTROL)} /></label>
            <label className="text-xs font-semibold">{t("Email (optional)")}<Input name="newPatientEmail" type="email" className={cn("mt-1.5", TOUCH_CONTROL)} /></label>
          </div>}
          <label className="block text-xs font-semibold">
            {t("Procedure")}
            <Select name="procedure" required value={procedureId || procedures[0]?.id || ""} onChange={(event) => setProcedureId(event.target.value)} className={cn("mt-1.5 w-full rounded-xl border bg-white px-3 text-sm", TOUCH_CONTROL)}>
              {procedures.map((procedure) => <option key={procedure.id} value={procedure.id} data-no-translate>{procedure.name}</option>)}
            </Select>
          </label>
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm">{t("Treatment price")}: <strong>{selectedProcedure ? formatMoney(selectedProcedure.defaultPrice) : t("Configure the Price List first")}</strong><p className="mt-1 text-[10px] text-muted-foreground">{t("Saved as a price snapshot for this appointment.")}</p></div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-semibold">
              {t("Date")}
              <Input
                name="date"
                required
                type="date"
                defaultValue={todayInput}
                className={cn("mt-1.5", TOUCH_CONTROL)}
              />
            </label>
            <label className="text-xs font-semibold">
              {t("Room")}
              <Select
                name="room"
                className={cn("mt-1.5 w-full rounded-xl border bg-white px-3 text-sm", TOUCH_CONTROL)}
              >
                <option value="Room 1">{t("Room 1")}</option>
                <option value="Room 2">{t("Room 2")}</option>
                <option value="Room 3">{t("Room 3")}</option>
              </Select>
            </label>
            <label className="text-xs font-semibold">
              {t("Start time")}
              <Input
                name="time"
                required
                type="time"
                defaultValue="14:30"
                className={cn("mt-1.5", TOUCH_CONTROL)}
              />
            </label>
            <label className="text-xs font-semibold">
              {t("End time")}
              <Input
                name="endTime"
                required
                type="time"
                defaultValue="15:15"
                className={cn("mt-1.5", TOUCH_CONTROL)}
              />
            </label>
          </div>
          <label className="block text-xs font-semibold">
            {t("Doctor")}
            <Select
              name="doctor"
              required
              className={cn("mt-1.5 w-full rounded-xl border bg-white px-3 text-sm", TOUCH_CONTROL)}
            >
              {doctors.map((doctor) => <option key={doctor.id} value={doctor.id} data-no-translate>{doctor.fullName}</option>)}
            </Select>
          </label>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className={TOUCH_BUTTON}
              onClick={() => setOpen(false)}
            >
              {t("Cancel")}
            </Button>
            <Button type="submit" className={TOUCH_BUTTON} disabled={saving || !procedures.length || !doctors.length}>{saving ? t("Scheduling…") : t("Schedule appointment")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DayView({ visits, anchor, slotLabels, onMove, canManage, timeZone, onSelect }: {
  visits: Visit[]; anchor: string; slotLabels: Map<string, string>;
  onMove: (id: string, date: string, time?: string) => void;
} & CalendarActions) {
  return (
    <div className="grid grid-cols-[64px_minmax(0,1fr)]">
      {timeSlots.map((time) => (
        <div key={time} className="contents">
          <div className="border-e border-t px-3 py-5 text-end text-[10px] font-semibold text-muted-foreground">
            {slotLabels.get(time)}
          </div>
          <DropCell date={anchor} time={time} onMove={onMove} className="relative min-h-[60px] space-y-2 border-t p-2">
            {visits
              .filter((visit) => visit.date === anchor && visit.slot === time)
              .map((visit) => (
                <DraggableAppointment key={visit.appointment.id} appointment={visit.appointment} canManage={canManage} timeZone={timeZone} onSelect={onSelect} />
              ))}
          </DropCell>
        </div>
      ))}
    </div>
  );
}

function WeekView({ visits, days, todayKey, slotLabels, onMove, canManage, timeZone, onSelect }: {
  visits: Visit[]; days: string[]; todayKey: string; slotLabels: Map<string, string>;
  onMove: (id: string, date: string, time?: string) => void;
} & CalendarActions) {
  const { formatDate } = useClinicPreferences();
  return (
    <div className="grid min-w-[980px] grid-cols-[64px_repeat(7,minmax(120px,1fr))]">
      <div className="border-b border-e bg-slate-50" />
      {days.map((day) => (
        <div
          key={day}
          className={cn("border-b border-e px-2 py-3 text-center", day === todayKey && "bg-primary/5")}
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {formatDate(day, { timeZone, weekday: "short" })}
          </p>
          <p
            className={cn(
              "mx-auto mt-1 grid size-8 place-items-center rounded-full text-sm font-bold",
              day === todayKey && "bg-primary text-white",
            )}
          >
            {formatDate(day, { timeZone, day: "numeric" })}
          </p>
        </div>
      ))}
      {timeSlots.flatMap((time) => [
        <div key={`label-${time}`} className="border-b border-e px-2 py-5 text-end text-[10px] font-semibold text-muted-foreground">{slotLabels.get(time)}</div>,
        ...days.map((date) => (
          <DropCell key={`${date}-${time}`} date={date} time={time} onMove={onMove} className="min-h-[60px] space-y-2 border-b border-e p-1.5">
            {visits.filter((visit) => visit.date === date && visit.slot === time)
              .map((visit) => <DraggableAppointment key={visit.appointment.id} appointment={visit.appointment} compact canManage={canManage} timeZone={timeZone} onSelect={onSelect} />)}
          </DropCell>
        )),
      ])}
    </div>
  );
}

function MonthView({ visits, days, anchor, todayKey, onMove, canManage, timeZone, onSelect }: {
  visits: Visit[]; days: string[]; anchor: string; todayKey: string;
  onMove: (id: string, date: string, time?: string) => void;
} & CalendarActions) {
  const { formatDate } = useClinicPreferences();
  const anchorMonth = anchor.slice(0, 7);
  return (
    <div className="min-w-[760px]">
      <div className="grid grid-cols-7 border-b bg-slate-50">
        {days.slice(0, 7).map((day) => (
          <div
            key={day}
            className="px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
          >
            {formatDate(day, { timeZone, weekday: "short" })}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const items = visits.filter((visit) => visit.date === day);
          const inMonth = day.slice(0, 7) === anchorMonth;
          return (
            <DropCell
              key={day}
              date={day}
              onMove={onMove}
              className={cn(
                "min-h-28 border-b border-e p-2",
                !inMonth && "bg-slate-50/70 text-slate-300",
              )}
            >
              <span
                className={cn(
                  "grid size-6 place-items-center rounded-full text-xs font-semibold",
                  day === todayKey && "bg-primary text-white",
                )}
              >
                {formatDate(day, { timeZone, day: "numeric" })}
              </span>
              <div className="mt-1 space-y-1">
                {items.map((visit) => (
                  <DraggableAppointment key={visit.appointment.id} appointment={visit.appointment} compact canManage={canManage} timeZone={timeZone} onSelect={onSelect} />
                ))}
              </div>
            </DropCell>
          );
        })}
      </div>
    </div>
  );
}

/** Stacked list of visits grouped by clinic-local day. Used for the agenda and for week view on phones. */
function AgendaList({ visits, canManage, timeZone, onSelect }: { visits: Visit[] } & CalendarActions) {
  const { formatDate, t } = useClinicPreferences();
  if (!visits.length) {
    return <EmptyState icon={CalendarClock} title={t("A little breathing room")} description={t("No appointments match this period. Try another date or clear your search.")} />;
  }
  const dates = [...new Set(visits.map((visit) => visit.date))];
  return (
    <div className="space-y-5">
      {dates.map((date) => (
        <section key={date}>
          <h3 className="mb-3 text-sm font-semibold">{formatDate(date, { timeZone, weekday: "long", month: "short", day: "numeric" })}</h3>
          <div className="grid gap-3 lg:grid-cols-2">
            {visits.filter((visit) => visit.date === date).map((visit) => (
              <DraggableAppointment key={visit.appointment.id} appointment={visit.appointment} canManage={canManage} timeZone={timeZone} onSelect={onSelect} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function AppointmentsPage({
  appointments,
  patients,
  procedures,
  doctors,
  canManage,
  onAdd,
  onCreatePatient,
  onReschedule,
  timeZone: timeZoneProp = DEFAULT_CLINIC_TIME_ZONE,
}: {
  appointments: Appointment[];
  patients: Patient[];
  procedures: ProcedureCatalogItem[];
  doctors: ClinicMember[];
  canManage: boolean;
  onAdd: (a: Appointment) => Promise<boolean>;
  onCreatePatient: (input: { name: string; phone: string; email: string; requestedTreatment: string; assignedDoctor: string }) => Promise<Patient | null>;
  onReschedule: (appointment: Appointment, date: string, time?: string) => Promise<boolean>;
  /** IANA zone of the clinic. Defaults to DEFAULT_CLINIC_TIME_ZONE. */
  timeZone?: string;
}) {
  const { formatDate, formatTime, t } = useClinicPreferences();
  const timeZone = resolveClinicTimeZone(timeZoneProp);
  const todayKey = clinicTodayKey(timeZone);
  const [view, setView] = useState("week");
  const [anchor, setAnchor] = useState(() => clinicTodayKey(timeZone));
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = appointments.find((appointment) => appointment.id === selectedId) ?? null;

  const visits = useMemo<Visit[]>(
    () =>
      appointments.map((appointment) => {
        const minutes = clinicMinutesOfDay(appointment.startsAt, timeZone);
        return {
          appointment,
          date: clinicDateKey(appointment.startsAt, timeZone) || appointment.date,
          slot: minutes === null ? "" : toClock(Math.floor(minutes / SLOT_MINUTES) * SLOT_MINUTES),
        };
      }),
    [appointments, timeZone],
  );
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return visits.filter(({ appointment }) =>
      `${appointment.patientName} ${appointment.treatment} ${appointment.doctor}`
        .toLowerCase()
        .includes(needle),
    );
  }, [visits, search]);

  const weekStart = weekStartOf(anchor);
  const weekEnd = shiftDays(weekStart, 6);
  const weekDays = Array.from({ length: 7 }, (_, index) => shiftDays(weekStart, index));
  const monthDays = monthGridDays(anchor);
  const range = view === "month"
    ? { start: monthDays[0], end: monthDays[monthDays.length - 1] }
    : view === "day"
      ? { start: anchor, end: anchor }
      : { start: weekStart, end: weekEnd };
  const visible = filtered
    .filter((visit) => visit.date >= range.start && visit.date <= range.end)
    .sort((a, b) => a.date.localeCompare(b.date) || Date.parse(a.appointment.startsAt) - Date.parse(b.appointment.startsAt));
  const outsideHours = visible.filter((visit) => !timeSlots.includes(visit.slot));

  const slotLabels = useMemo(
    () => new Map<string, string>(
      timeSlots.map((time) => [time, formatTime(localDateTimeToIso(todayKey, time, timeZone), { timeZone })]),
    ),
    [formatTime, timeZone, todayKey],
  );

  const step = (n: number) =>
    setAnchor((old) =>
      view === "day"
        ? shiftDays(old, n)
        : view === "week" || view === "agenda"
          ? shiftDays(old, n * 7)
          : shiftMonths(old, n),
    );
  const move = async (id: string, date: string, time?: string) => {
    if (!canManage) return;
    const visit = visits.find((candidate) => candidate.appointment.id === id);
    if (!visit) return;
    const { appointment } = visit;
    if (appointment.status === "Completed" || appointment.status === "Cancelled") {
      toast.error(t("Completed or cancelled appointments cannot be moved"));
      return;
    }
    if (date === visit.date && (time === undefined || time === visit.slot)) return;
    const moved = await onReschedule(appointment, date, time);
    if (moved) toast.success(t("Appointment rescheduled and saved"));
  };

  const heading = view === "month"
    ? formatDate(anchor, { timeZone, month: "long", year: "numeric" })
    : view === "day"
      ? formatDate(anchor, { timeZone, weekday: "long", month: "long", day: "numeric" })
      : `${formatDate(weekStart, { timeZone, month: "short", day: "numeric" })} – ${formatDate(weekEnd, { timeZone, month: "short", day: "numeric", year: "numeric" })}`;
  const select = (appointment: Appointment) => setSelectedId(appointment.id);
  const actions = { canManage, timeZone, onSelect: select };

  return (
    <div className="space-y-5">
      <FilterBar className="justify-between sm:flex-col sm:items-stretch 2xl:flex-row 2xl:items-center">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" className={TOUCH_ICON_BUTTON} aria-label={t("Previous period")} onClick={() => step(-1)}>
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            className={TOUCH_BUTTON}
            onClick={() => setAnchor(todayKey)}
          >
            {t("Today")}
          </Button>
          <Button variant="outline" size="icon" className={TOUCH_ICON_BUTTON} aria-label={t("Next period")} onClick={() => step(1)}>
            <ChevronRight />
          </Button>
          <h2 className="ms-1 text-sm font-bold">{heading}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-52 flex-1">
            <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn("bg-white ps-9", TOUCH_CONTROL)}
              placeholder={t("Search schedule…")}
            />
          </div>
          <Tabs value={view} onValueChange={setView}>
            <TabsList className="h-auto md:h-10">
              <TabsTrigger value="day" className="min-h-11 h-auto md:h-8 md:min-h-0">{t("Day")}</TabsTrigger>
              <TabsTrigger value="week" className="min-h-11 h-auto md:h-8 md:min-h-0">{t("Week")}</TabsTrigger>
              <TabsTrigger value="month" className="min-h-11 h-auto md:h-8 md:min-h-0">{t("Month")}</TabsTrigger>
              <TabsTrigger value="agenda" className="min-h-11 h-auto md:h-8 md:min-h-0">{t("Agenda")}</TabsTrigger>
            </TabsList>
          </Tabs>
          {canManage && <NewAppointment patients={patients} procedures={procedures} doctors={doctors} timeZone={timeZone} onAdd={onAdd} onCreatePatient={onCreatePatient} />}
        </div>
      </FilterBar>
      <Card className="overflow-hidden">
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 border-b bg-muted/25">
          <div>
            <CardTitle>{t("Clinic calendar")}</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              <span>{t("Visits in this view")}</span> · {visible.length}
            </p>
          </div>
          <Badge variant="outline"><CalendarClock className="size-3.5" /><span>{t("Choose a visit to see details")}</span></Badge>
        </CardHeader>
        {view === "agenda" ? (
          <div className="p-4 sm:p-6">
            <AgendaList visits={visible} {...actions} />
          </div>
        ) : view === "day" ? (
          <div className="overflow-x-auto">
            <DayView visits={filtered} anchor={anchor} slotLabels={slotLabels} onMove={move} {...actions} />
          </div>
        ) : view === "week" ? (
          <>
            <div className="p-4 md:hidden">
              <AgendaList visits={visible} {...actions} />
            </div>
            <div className="hidden overflow-x-auto md:block">
              <WeekView visits={filtered} days={weekDays} todayKey={todayKey} slotLabels={slotLabels} onMove={move} {...actions} />
            </div>
          </>
        ) : (
          <div className="overflow-x-auto">
            <MonthView visits={filtered} days={monthDays} anchor={anchor} todayKey={todayKey} onMove={move} {...actions} />
          </div>
        )}
      </Card>
      {(view === "day" || view === "week") && outsideHours.length > 0 && <section className="space-y-3"><h3 className="text-sm font-semibold">{t("Outside calendar hours")}</h3><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{outsideHours.map((visit) => <DraggableAppointment key={visit.appointment.id} appointment={visit.appointment} canManage={canManage} timeZone={timeZone} onSelect={select} />)}</div></section>}
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <CalendarClock className="size-4" />
        <span>{canManage ? t("Select a visit to review or reschedule it. You can also drag cards between time slots.") : t("Select a visit to review its details.")}</span>
      </p>
      {selected && <AppointmentDetails key={selected.id} appointment={selected} canManage={canManage} timeZone={timeZone} onClose={() => setSelectedId(null)} onSave={onReschedule} />}
    </div>
  );
}
