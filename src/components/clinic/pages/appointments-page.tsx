"use client";

import { FormEvent, type ReactNode, useMemo, useState } from "react";
import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from "date-fns";
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

const timeSlots = Array.from({ length: 20 }, (_, index) => {
  const minutes = 8 * 60 + index * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});
const slotLabel = (time: string) => format(new Date(`2000-01-01T${time}:00`), "h:mm a");
const appointmentSlot = (time: string) => {
  const parsed = new Date(`2000-01-01 ${time}`);
  if (Number.isNaN(parsed.getTime())) return "08:00";
  const minutes = parsed.getHours() * 60 + parsed.getMinutes();
  const snapped = Math.floor(minutes / 30) * 30;
  return `${String(Math.floor(snapped / 60)).padStart(2, "0")}:${String(snapped % 60).padStart(2, "0")}`;
};

type CalendarActions = {
  canManage: boolean;
  onSelect: (appointment: Appointment) => void;
};

function DraggableAppointment({ appointment, compact = false, canManage, onSelect }: {
  appointment: Appointment; compact?: boolean;
} & CalendarActions) {
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
        <span className="flex flex-wrap items-center gap-1 text-[11px] font-medium text-muted-foreground"><Clock3 className="size-3 shrink-0" /><span dir="ltr">{appointment.time} – {appointment.endTime}</span></span>
        {movable && <GripVertical className="size-3 shrink-0 text-muted-foreground" />}
      </span>
      <span className="mt-1.5 block break-words text-sm font-semibold" data-no-translate>{appointment.patientName}</span>
      <span className="mt-1 block truncate text-xs text-muted-foreground" data-no-translate>{appointment.treatment}</span>
      {!compact && <span className="mt-2 flex flex-wrap items-center justify-between gap-2"><span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Stethoscope className="size-3.5" /><span data-no-translate>{appointment.doctor}</span></span><Badge variant={appointment.status === "Pending" ? "warning" : appointment.status === "Cancelled" ? "secondary" : "default"}>{appointment.status}</Badge></span>}
    </button>
  );
}

function AppointmentDetails({ appointment, canManage, onClose, onSave }: {
  appointment: Appointment; canManage: boolean; onClose: () => void;
  onSave: (appointment: Appointment, date: string, time?: string) => Promise<boolean>;
}) {
  const { formatMoney } = useClinicPreferences();
  const [saving, setSaving] = useState(false);
  const movable = canManage && appointment.status !== "Completed" && appointment.status !== "Cancelled";
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!movable || saving) return;
    const form = new FormData(event.currentTarget);
    setSaving(true);
    try {
      if (await onSave(appointment, String(form.get("date")), String(form.get("time")))) {
        toast.success("Appointment rescheduled and saved");
        onClose();
      }
    } finally { setSaving(false); }
  };
  const exactTime = /^\d{2}:\d{2}$/.test(appointment.time) ? appointment.time : format(new Date(`2000-01-01 ${appointment.time}`), "HH:mm");
  return <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}><DialogContent>
    <DialogHeader><DialogTitle>Appointment details</DialogTitle><DialogDescription>Review the visit details and scheduled time.</DialogDescription></DialogHeader>
    <div className="rounded-xl border bg-accent/30 p-4"><h3 className="text-lg font-semibold" data-no-translate>{appointment.patientName}</h3><p className="mt-1 text-sm text-muted-foreground" data-no-translate>{appointment.treatment}</p><div className="mt-3 flex flex-wrap items-center gap-3"><Badge>{appointment.status}</Badge><span className="text-sm" data-no-translate>{appointment.room}</span></div></div>
    <dl className="grid grid-cols-2 gap-4 text-sm"><div><dt className="text-muted-foreground">Doctor</dt><dd className="mt-1 font-medium" data-no-translate>{appointment.doctor}</dd></div><div><dt className="text-muted-foreground">Treatment price</dt><dd className="mt-1 font-medium">{formatMoney(appointment.treatmentPrice)}</dd></div></dl>
    <form onSubmit={submit} className="space-y-5"><div className="grid grid-cols-2 gap-3"><label className="text-xs font-semibold">Date<Input name="date" type="date" defaultValue={appointment.date} required disabled={!movable || saving} className="mt-1.5" /></label><label className="text-xs font-semibold">Start time<Input name="time" type="time" defaultValue={exactTime} required disabled={!movable || saving} className="mt-1.5" /></label></div>
    {movable && <p className="text-xs leading-5 text-muted-foreground">The visit duration stays the same when rescheduling.</p>}
    <DialogFooter><Button type="button" variant="outline" disabled={saving} onClick={onClose}>Close</Button>{movable && <Button disabled={saving}>{saving ? "Saving…" : "Save schedule"}</Button>}</DialogFooter></form>
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
  onAdd,
  onCreatePatient,
}: {
  patients: Patient[];
  procedures: ProcedureCatalogItem[];
  doctors: ClinicMember[];
  onAdd: (appointment: Appointment) => Promise<boolean>;
  onCreatePatient: (input: { name: string; phone: string; email: string; requestedTreatment: string; assignedDoctor: string }) => Promise<Patient | null>;
}) {
  const { formatMoney } = useClinicPreferences();
  const [open, setOpen] = useState(false);
  const [patientMode, setPatientMode] = useState<"existing" | "new">("existing");
  const [procedureId, setProcedureId] = useState("");
  const [saving, setSaving] = useState(false);
  const today = new Date();
  const todayInput = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const selectedProcedure = procedures.find((item) => item.id === procedureId) ?? procedures[0];
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    const f = new FormData(event.currentTarget);
    const provider = doctors.find((doctor) => doctor.id === f.get("doctor"));
    const procedure = procedures.find((item) => item.id === f.get("procedure"));
    if (!provider || !procedure) {
      toast.error("Choose an available doctor and treatment");
      setSaving(false);
      return;
    }
    let patient = patients.find((p) => p.id === f.get("patient"));
    if (patientMode === "new") {
      const phone = normalizeIraqiMobileNumber(String(f.get("newPatientPhone")));
      if (!phone) {
        toast.error(iraqiMobileValidationMessage);
        setSaving(false);
        return;
      }
      patient = await onCreatePatient({
        name: String(f.get("newPatientName")),
        phone,
        email: String(f.get("newPatientEmail")),
        requestedTreatment: procedure.name,
        assignedDoctor: provider.fullName,
      }) ?? undefined;
    }
    if (!patient) {
      toast.error("Create or select a patient first");
      setSaving(false);
      return;
    }
    const saved = await onAdd({
      id: crypto.randomUUID(),
      patientId: patient.id,
      patientName: patient.name,
      date: String(f.get("date")),
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
    setSaving(false);
    if (saved) setOpen(false);
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)}>
        <Plus />
        New appointment
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule appointment</DialogTitle>
          <DialogDescription>
            Reserve a provider, room, and time for the patient.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-default p-1">
            {(["existing", "new"] as const).map((mode) => <Button key={mode} type="button" size="sm" variant={patientMode === mode ? "default" : "ghost"} onClick={() => setPatientMode(mode)}>{mode === "existing" ? "Existing patient" : "New patient"}</Button>)}
          </div>
          {patientMode === "existing" ? <label className="block text-xs font-semibold">
            Patient
            <Select
              name="patient"
              required={patientMode === "existing"}
              className="mt-1.5 h-10 w-full rounded-xl border bg-white px-3 text-sm"
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id} data-no-translate>
                  {p.name} · {p.patientNo}
                </option>
              ))}
            </Select>
          </label> : <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold sm:col-span-2">Patient name<Input name="newPatientName" required className="mt-1.5" /></label>
            <label className="text-xs font-semibold">Phone<Input name="newPatientPhone" required inputMode="tel" dir="ltr" placeholder="07XXXXXXXXX or +9647XXXXXXXXX" className="mt-1.5" /></label>
            <label className="text-xs font-semibold">Email (optional)<Input name="newPatientEmail" type="email" className="mt-1.5" /></label>
          </div>}
          <label className="block text-xs font-semibold">
            Procedure
            <Select name="procedure" required value={procedureId || procedures[0]?.id || ""} onChange={(event) => setProcedureId(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border bg-white px-3 text-sm">
              {procedures.map((procedure) => <option key={procedure.id} value={procedure.id}>{procedure.name}</option>)}
            </Select>
          </label>
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm">Treatment price: <strong>{selectedProcedure ? formatMoney(selectedProcedure.defaultPrice) : "Configure the Price List first"}</strong><p className="mt-1 text-[10px] text-muted-foreground">Saved as a price snapshot for this appointment.</p></div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-semibold">
              Date
              <Input
                name="date"
                required
                type="date"
                defaultValue={todayInput}
                className="mt-1.5"
              />
            </label>
            <label className="text-xs font-semibold">
              Room
              <Select
                name="room"
                className="mt-1.5 h-10 w-full rounded-xl border bg-white px-3 text-sm"
              >
                <option>Room 1</option>
                <option>Room 2</option>
                <option>Room 3</option>
              </Select>
            </label>
            <label className="text-xs font-semibold">
              Start time
              <Input
                name="time"
                required
                type="time"
                defaultValue="14:30"
                className="mt-1.5"
              />
            </label>
            <label className="text-xs font-semibold">
              End time
              <Input
                name="endTime"
                required
                type="time"
                defaultValue="15:15"
                className="mt-1.5"
              />
            </label>
          </div>
          <label className="block text-xs font-semibold">
            Doctor
            <Select
              name="doctor"
              required
              className="mt-1.5 h-10 w-full rounded-xl border bg-white px-3 text-sm"
            >
              {doctors.map((doctor) => <option key={doctor.id} value={doctor.id} data-no-translate>{doctor.fullName}</option>)}
            </Select>
          </label>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !procedures.length || !doctors.length}>{saving ? "Scheduling…" : "Schedule appointment"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DayView({ appointments, current, onMove, canManage, onSelect }: {
  appointments: Appointment[]; current: Date;
  onMove: (id: string, date: string, time?: string) => void;
} & CalendarActions) {
  const date = format(current, "yyyy-MM-dd");
  return (
    <div className="grid grid-cols-[64px_minmax(0,1fr)]">
      {timeSlots.map((time) => (
        <div key={time} className="contents">
          <div className="border-e border-t px-3 py-5 text-end text-[10px] font-semibold text-muted-foreground">
            {slotLabel(time)}
          </div>
          <DropCell date={date} time={time} onMove={onMove} className="relative min-h-[60px] space-y-2 border-t p-2">
            {appointments
              .filter((appointment) => appointment.date === date && appointmentSlot(appointment.time) === time)
              .map((appt) => (
                <DraggableAppointment key={appt.id} appointment={appt} canManage={canManage} onSelect={onSelect} />
              ))}
          </DropCell>
        </div>
      ))}
    </div>
  );
}

function WeekView({
  appointments,
  current,
  onMove, canManage, onSelect,
}: {
  appointments: Appointment[];
  current: Date;
  onMove: (id: string, date: string, time?: string) => void;
} & CalendarActions) {
  const days = eachDayOfInterval({
    start: startOfWeek(current, { weekStartsOn: 1 }),
    end: endOfWeek(current, { weekStartsOn: 1 }),
  });
  return (
    <div className="grid min-w-[980px] grid-cols-[64px_repeat(7,minmax(120px,1fr))]">
      <div className="border-b border-e bg-slate-50" />
        {days.map((day) => (
          <div
            key={day.toISOString()}
            className={cn("border-b border-e px-2 py-3 text-center", format(day, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd") && "bg-primary/5")}
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {format(day, "EEE")}
            </p>
            <p
              className={cn(
                "mx-auto mt-1 grid size-8 place-items-center rounded-full text-sm font-bold",
                format(day, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd") &&
                  "bg-primary text-white",
              )}
            >
              {format(day, "d")}
            </p>
          </div>
        ))}
      {timeSlots.flatMap((time) => [
        <div key={`label-${time}`} className="border-b border-e px-2 py-5 text-end text-[10px] font-semibold text-muted-foreground">{slotLabel(time)}</div>,
        ...days.map((day) => {
          const date = format(day, "yyyy-MM-dd");
          return <DropCell key={`${date}-${time}`} date={date} time={time} onMove={onMove} className="min-h-[60px] space-y-2 border-b border-e p-1.5">
            {appointments.filter((a) => a.date === date && appointmentSlot(a.time) === time)
              .map((appt) => <DraggableAppointment key={appt.id} appointment={appt} compact canManage={canManage} onSelect={onSelect} />)}
          </DropCell>;
        }),
      ])}
    </div>
  );
}

function MonthView({
  appointments,
  current,
  onMove, canManage, onSelect,
}: {
  appointments: Appointment[];
  current: Date;
  onMove: (id: string, date: string, time?: string) => void;
} & CalendarActions) {
  const start = startOfWeek(startOfMonth(current), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(current), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start, end });
  return (
    <div className="min-w-[760px]">
      <div className="grid grid-cols-7 border-b bg-slate-50">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
          <div
            key={day}
            className="px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
          >
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const items = appointments.filter(
            (a) => a.date === format(day, "yyyy-MM-dd"),
          );
          const inMonth = day.getMonth() === current.getMonth();
          return (
            <DropCell
              key={day.toISOString()}
              date={format(day, "yyyy-MM-dd")}
              onMove={onMove}
              className={cn(
                "min-h-28 border-b border-e p-2",
                !inMonth && "bg-slate-50/70 text-slate-300",
              )}
            >
              <span
                className={cn(
                  "grid size-6 place-items-center rounded-full text-xs font-semibold",
                  format(day, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd") &&
                    "bg-primary text-white",
                )}
              >
                {format(day, "d")}
              </span>
              <div className="mt-1 space-y-1">
                {items.map((item) => (
                  <DraggableAppointment key={item.id} appointment={item} compact canManage={canManage} onSelect={onSelect} />
                ))}
              </div>
            </DropCell>
          );
        })}
      </div>
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
}: {
  appointments: Appointment[];
  patients: Patient[];
  procedures: ProcedureCatalogItem[];
  doctors: ClinicMember[];
  canManage: boolean;
  onAdd: (a: Appointment) => Promise<boolean>;
  onCreatePatient: (input: { name: string; phone: string; email: string; requestedTreatment: string; assignedDoctor: string }) => Promise<Patient | null>;
  onReschedule: (appointment: Appointment, date: string, time?: string) => Promise<boolean>;
}) {
  const { language } = useClinicPreferences();
  const [view, setView] = useState("week");
  const [current, setCurrent] = useState(new Date());
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Appointment | null>(null);
  const filtered = useMemo(
    () =>
      appointments.filter((a) =>
        `${a.patientName} ${a.treatment} ${a.doctor}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [appointments, search],
  );
  const rangeStart = format(view === "month" ? startOfWeek(startOfMonth(current), { weekStartsOn: 1 }) : view === "day" ? current : startOfWeek(current, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const rangeEnd = format(view === "month" ? endOfWeek(endOfMonth(current), { weekStartsOn: 1 }) : view === "day" ? current : endOfWeek(current, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const visible = filtered.filter((appointment) => appointment.date >= rangeStart && appointment.date <= rangeEnd).sort((a, b) => a.date.localeCompare(b.date) || appointmentSlot(a.time).localeCompare(appointmentSlot(b.time)));
  const outsideHours = visible.filter((appointment) => !timeSlots.includes(appointmentSlot(appointment.time)));
  const dateLabel = (date: Date, options: Intl.DateTimeFormatOptions) => date.toLocaleDateString(language === "ar" ? "ar-IQ" : "en-US", options);
  const step = (n: number) =>
    setCurrent((old) =>
      view === "day"
        ? addDays(old, n)
        : view === "week" || view === "agenda"
          ? addDays(old, n * 7)
          : new Date(old.getFullYear(), old.getMonth() + n, 1),
    );
  const move = async (id: string, date: string, time?: string) => {
    if (!canManage) return;
    const appointment = appointments.find((candidate) => candidate.id === id);
    if (!appointment) return;
    if (appointment.status === "Completed" || appointment.status === "Cancelled") {
      toast.error("Completed or cancelled appointments cannot be moved");
      return;
    }
    const moved = await onReschedule(appointment, date, time);
    if (moved) toast.success("Appointment rescheduled and saved");
  };
  return (
    <div className="space-y-5">
      <FilterBar className="justify-between sm:flex-col sm:items-stretch 2xl:flex-row 2xl:items-center">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" aria-label="Previous period" onClick={() => step(-1)}>
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            onClick={() => setCurrent(new Date())}
          >
            Today
          </Button>
          <Button variant="outline" size="icon" aria-label="Next period" onClick={() => step(1)}>
            <ChevronRight />
          </Button>
          <h2 className="ms-1 text-sm font-bold">
            {view === "month"
              ? dateLabel(current, {month: "long", year: "numeric"})
              : view === "day"
                ? dateLabel(current, {weekday: "long", month: "long", day: "numeric"})
                : `${dateLabel(startOfWeek(current, { weekStartsOn: 1 }), {month: "short", day: "numeric"})} – ${dateLabel(endOfWeek(current, { weekStartsOn: 1 }), {month: "short", day: "numeric", year: "numeric"})}`}
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-52 flex-1">
            <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-white ps-9"
              placeholder="Search schedule…"
            />
          </div>
          <Tabs value={view} onValueChange={setView}>
            <TabsList>
              <TabsTrigger value="day">Day</TabsTrigger>
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="month">Month</TabsTrigger>
              <TabsTrigger value="agenda">Agenda</TabsTrigger>
            </TabsList>
          </Tabs>
          {canManage && <NewAppointment patients={patients} procedures={procedures} doctors={doctors} onAdd={onAdd} onCreatePatient={onCreatePatient} />}
        </div>
      </FilterBar>
      <Card className="overflow-hidden">
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 border-b bg-muted/25">
          <div>
            <CardTitle>Clinic calendar</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              <span>Visits in this view</span> · {visible.length}
            </p>
          </div>
          <Badge variant="outline"><CalendarClock className="size-3.5" /><span>Choose a visit to see details</span></Badge>
        </CardHeader>
        <div className="overflow-x-auto">
          {view === "agenda" ? (
            <div className="space-y-5 p-4 sm:p-6">
              {!visible.length && <EmptyState icon={CalendarClock} title="A little breathing room" description="No appointments match this week. Try another date or clear your search." />}
              {[...new Set(visible.map((appointment) => appointment.date))].map((date) => <section key={date}><h3 className="mb-3 text-sm font-semibold">{dateLabel(new Date(`${date}T12:00:00`), {weekday: "long", month: "short", day: "numeric"})}</h3><div className="grid gap-3 lg:grid-cols-2">{visible.filter((appointment) => appointment.date === date).map((appointment) => <DraggableAppointment key={appointment.id} appointment={appointment} canManage={canManage} onSelect={setSelected} />)}</div></section>)}
            </div>
          ) : view === "day" ? (
            <DayView appointments={filtered} current={current} onMove={move} canManage={canManage} onSelect={setSelected} />
          ) : view === "week" ? (
            <WeekView appointments={filtered} current={current} onMove={move} canManage={canManage} onSelect={setSelected} />
          ) : (
            <MonthView appointments={filtered} current={current} onMove={move} canManage={canManage} onSelect={setSelected} />
          )}
        </div>
      </Card>
      {(view === "day" || view === "week") && outsideHours.length > 0 && <section className="space-y-3"><h3 className="text-sm font-semibold">Outside calendar hours</h3><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{outsideHours.map((appointment) => <DraggableAppointment key={appointment.id} appointment={appointment} canManage={canManage} onSelect={setSelected} />)}</div></section>}
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <CalendarClock className="size-4" />
        <span>{canManage ? "Select a visit to review or reschedule it. You can also drag cards between time slots." : "Select a visit to review its details."}</span>
      </p>
      {selected && <AppointmentDetails key={selected.id} appointment={selected} canManage={canManage} onClose={() => setSelected(null)} onSave={onReschedule} />}
    </div>
  );
}
