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
import { CalendarClock, ChevronLeft, ChevronRight, GripVertical, Plus, Search } from "lucide-react";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Appointment, ClinicMember, Patient, ProcedureCatalogItem } from "@/lib/types";
import { cn, iraqiMobileValidationMessage, normalizeIraqiMobileNumber } from "@/lib/utils";
import { useClinicPreferences } from "@/lib/clinic-preferences";

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

function DraggableAppointment({ appointment, compact = false }: {
  appointment: Appointment; compact?: boolean;
}) {
  const { formatMoney } = useClinicPreferences();
  const movable = appointment.status !== "Completed" && appointment.status !== "Cancelled";
  return (
    <div
      draggable={movable}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/appointment-id", appointment.id);
      }}
      title={movable ? "Drag to reschedule" : "Completed or cancelled appointments cannot be moved"}
      className={cn(
        "group rounded-xl text-white shadow-sm transition hover:shadow-md",
        compact ? "p-2" : "p-2.5",
        movable && "cursor-grab active:cursor-grabbing",
      )}
      style={{ backgroundColor: appointment.color }}
    >
      <div className="flex items-start gap-1.5">
        {movable && <GripVertical className="mt-0.5 size-3 shrink-0 opacity-60" />}
        <div className="min-w-0">
          <p className="text-[10px] font-bold opacity-80">{appointment.time}–{appointment.endTime}</p>
          <p className="mt-0.5 truncate text-xs font-semibold" data-no-translate>{appointment.patientName}</p>
          <p className="mt-1 truncate text-[10px] opacity-90" data-no-translate>{appointment.treatment} · {formatMoney(appointment.treatmentPrice)}</p>
          <p className="mt-0.5 truncate text-[10px] opacity-80" data-no-translate>{appointment.doctor}</p>
        </div>
      </div>
    </div>
  );
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
          <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1">
            {(["existing", "new"] as const).map((mode) => <button key={mode} type="button" onClick={() => setPatientMode(mode)} className={cn("rounded-lg px-3 py-2 text-xs font-semibold", patientMode === mode && "bg-white text-primary shadow-sm")}>{mode === "existing" ? "Existing patient" : "New patient"}</button>)}
          </div>
          {patientMode === "existing" ? <label className="block text-xs font-semibold">
            Patient
            <select
              name="patient"
              required={patientMode === "existing"}
              className="mt-1.5 h-10 w-full rounded-xl border bg-white px-3 text-sm"
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id} data-no-translate>
                  {p.name} · {p.patientNo}
                </option>
              ))}
            </select>
          </label> : <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold sm:col-span-2">Patient name<Input name="newPatientName" required className="mt-1.5" /></label>
            <label className="text-xs font-semibold">Phone<Input name="newPatientPhone" required inputMode="tel" dir="ltr" placeholder="07XXXXXXXXX or +9647XXXXXXXXX" className="mt-1.5" /></label>
            <label className="text-xs font-semibold">Email (optional)<Input name="newPatientEmail" type="email" className="mt-1.5" /></label>
          </div>}
          <label className="block text-xs font-semibold">
            Procedure
            <select name="procedure" required value={procedureId || procedures[0]?.id || ""} onChange={(event) => setProcedureId(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border bg-white px-3 text-sm">
              {procedures.map((procedure) => <option key={procedure.id} value={procedure.id}>{procedure.name}</option>)}
            </select>
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
              <select
                name="room"
                className="mt-1.5 h-10 w-full rounded-xl border bg-white px-3 text-sm"
              >
                <option>Room 1</option>
                <option>Room 2</option>
                <option>Room 3</option>
              </select>
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
            <select
              name="doctor"
              required
              className="mt-1.5 h-10 w-full rounded-xl border bg-white px-3 text-sm"
            >
              {doctors.map((doctor) => <option key={doctor.id} value={doctor.id} data-no-translate>{doctor.fullName}</option>)}
            </select>
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

function DayView({ appointments, current, onMove }: {
  appointments: Appointment[]; current: Date;
  onMove: (id: string, date: string, time?: string) => void;
}) {
  const date = format(current, "yyyy-MM-dd");
  return (
    <div className="grid min-w-[700px] grid-cols-[70px_1fr]">
      {timeSlots.map((time) => (
        <div key={time} className="contents">
          <div className="border-r border-t px-3 py-5 text-right text-[10px] font-semibold text-muted-foreground">
            {slotLabel(time)}
          </div>
          <DropCell date={date} time={time} onMove={onMove} className="relative min-h-[60px] border-t p-1.5">
            {appointments
              .filter((appointment) => appointment.date === date && appointmentSlot(appointment.time) === time)
              .map((appt) => (
                <DraggableAppointment key={appt.id} appointment={appt} />
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
  onMove,
}: {
  appointments: Appointment[];
  current: Date;
  onMove: (id: string, date: string, time?: string) => void;
}) {
  const days = eachDayOfInterval({
    start: startOfWeek(current, { weekStartsOn: 1 }),
    end: endOfWeek(current, { weekStartsOn: 1 }),
  });
  return (
    <div className="grid min-w-[980px] grid-cols-[64px_repeat(7,minmax(120px,1fr))]">
      <div className="border-b border-r bg-slate-50" />
        {days.map((day) => (
          <div
            key={day.toISOString()}
            className={cn("border-b border-r px-2 py-3 text-center", format(day, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd") && "bg-primary/5")}
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
        <div key={`label-${time}`} className="border-b border-r px-2 py-5 text-end text-[10px] font-semibold text-muted-foreground">{slotLabel(time)}</div>,
        ...days.map((day) => {
          const date = format(day, "yyyy-MM-dd");
          return <DropCell key={`${date}-${time}`} date={date} time={time} onMove={onMove} className="min-h-[60px] border-b border-r p-1.5">
            {appointments.filter((a) => a.date === date && appointmentSlot(a.time) === time)
              .map((appt) => <DraggableAppointment key={appt.id} appointment={appt} compact />)}
          </DropCell>;
        }),
      ])}
    </div>
  );
}

function MonthView({
  appointments,
  current,
  onMove,
}: {
  appointments: Appointment[];
  current: Date;
  onMove: (id: string, date: string, time?: string) => void;
}) {
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
                "min-h-28 border-b border-r p-2",
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
                {items.slice(0, 3).map((item) => (
                  <DraggableAppointment key={item.id} appointment={item} compact />
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
  const [view, setView] = useState("week");
  const [current, setCurrent] = useState(new Date());
  const [search, setSearch] = useState("");
  const filtered = useMemo(
    () =>
      appointments.filter((a) =>
        `${a.patientName} ${a.treatment} ${a.doctor}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [appointments, search],
  );
  const step = (n: number) =>
    setCurrent((old) =>
      view === "day"
        ? addDays(old, n)
        : view === "week"
          ? addDays(old, n * 7)
          : new Date(old.getFullYear(), old.getMonth() + n, 1),
    );
  const move = async (id: string, date: string, time?: string) => {
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
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => step(-1)}>
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            onClick={() => setCurrent(new Date())}
          >
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={() => step(1)}>
            <ChevronRight />
          </Button>
          <h2 className="ml-1 text-sm font-bold">
            {view === "month"
              ? format(current, "MMMM yyyy")
              : view === "day"
                ? format(current, "EEEE, MMMM d")
                : `${format(startOfWeek(current, { weekStartsOn: 1 }), "MMM d")} – ${format(endOfWeek(current, { weekStartsOn: 1 }), "MMM d, yyyy")}`}
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-52 flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-white pl-9"
              placeholder="Search schedule…"
            />
          </div>
          <Tabs value={view} onValueChange={setView}>
            <TabsList>
              <TabsTrigger value="day">Day</TabsTrigger>
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="month">Month</TabsTrigger>
            </TabsList>
          </Tabs>
          {canManage && <NewAppointment patients={patients} procedures={procedures} doctors={doctors} onAdd={onAdd} onCreatePatient={onCreatePatient} />}
        </div>
      </div>
      <Card className="overflow-hidden">
        <CardHeader className="flex-row items-center justify-between border-b">
          <div>
            <CardTitle>Clinic calendar</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {filtered.length} scheduled visits · 3 treatment rooms
            </p>
          </div>
          <div className="hidden items-center gap-4 text-[10px] font-medium text-muted-foreground sm:flex">
            <span className="flex items-center gap-1.5">
              <i className="size-2 rounded-full bg-primary" />
              Dr. Chen
            </span>
            <span className="flex items-center gap-1.5">
              <i className="size-2 rounded-full bg-violet-500" />
              Dr. Wilson
            </span>
            <span className="flex items-center gap-1.5">
              <i className="size-2 rounded-full bg-sky-500" />
              Dr. Kim
            </span>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          {view === "day" ? (
            <DayView appointments={filtered} current={current} onMove={move} />
          ) : view === "week" ? (
            <WeekView appointments={filtered} current={current} onMove={move} />
          ) : (
            <MonthView appointments={filtered} current={current} onMove={move} />
          )}
        </div>
      </Card>
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <CalendarClock className="size-4" />
        Drag an appointment to another day or 30-minute time slot. Simultaneous visits remain separate; completed and cancelled visits stay locked.
      </p>
    </div>
  );
}
