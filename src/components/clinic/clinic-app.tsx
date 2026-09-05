"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Bell,
  Boxes,
  CalendarDays,
  ChevronDown,
  ClipboardPlus,
  FileBarChart,
  HeartPulse,
  LayoutDashboard,
  Languages,
  Menu,
  Pin,
  PinOff,
  Search,
  Settings,
  ShieldCheck,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { Toaster, toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn, normalizeIraqiMobileNumber } from "@/lib/utils";
import type {
  Appointment,
  InventoryItem,
  NavKey,
  Patient,
  Payment,
  ToothSurfaceChart,
  ToothCondition,
  TreatmentSession,
  ClinicRole,
  ClinicMember,
  ProcedureCatalogItem,
  ClinicInfo,
} from "@/lib/types";
import {
  appointments as initialAppointments,
  inventoryItems as initialInventory,
  patients as initialPatients,
  payments as initialPayments,
  clinicMembers as initialMembers,
  procedureCatalog as initialProcedures,
} from "@/lib/demo-data";
import { DashboardPage } from "./pages/dashboard-page";
import { PatientsPage } from "./pages/patients-page";
import { AppointmentsPage } from "./pages/appointments-page";
import { PriceListPage } from "./pages/price-list-page";
import { PaymentsPage } from "./pages/payments-page";
import { StaffPage } from "./pages/staff-page";
import { InventoryPage } from "./pages/inventory-page";
import { ReportsPage } from "./pages/reports-page";
import { SettingsPage } from "./pages/settings-page";
import { PageHeader, PageSkeleton } from "./app-ui";
import { subscribeToClinicChanges } from "@/lib/supabase/realtime";
import {
  loadClinicData,
  persistAppointment,
  persistInventoryItem,
  persistPatient,
  persistPayment,
  persistToothChart,
  rescheduleAppointment,
  recordSessionPayment,
  createClinicMember,
  persistClinicProfile,
} from "@/lib/supabase/clinic-data";
import { useClinicPreferences } from "@/lib/clinic-preferences";
import { createClient, hasSupabaseConfig } from "@/lib/supabase/client";

const navGroups = [
  {
    label: "Workspace",
    items: [
      { key: "dashboard" as NavKey, label: "Overview", icon: LayoutDashboard },
      {
        key: "appointments" as NavKey,
        label: "Appointments",
        icon: CalendarDays,
      },
      { key: "patients" as NavKey, label: "Patients", icon: Users },
      {
        key: "treatments" as NavKey,
        label: "Price List",
        icon: ClipboardPlus,
      },
    ],
  },
  {
    label: "Management",
    items: [
      { key: "payments" as NavKey, label: "Payments", icon: WalletCards },
      { key: "staff" as NavKey, label: "Doctors & staff", icon: HeartPulse },
      { key: "inventory" as NavKey, label: "Inventory", icon: Boxes },
      {
        key: "reports" as NavKey,
        label: "Reports & analytics",
        icon: FileBarChart,
      },
    ],
  },
];

function patientNumberFromId(id: string) {
  return `PT-${id.replaceAll("-", "").slice(0, 10).toUpperCase()}`;
}

const pageMeta: Record<NavKey, { title: string; description: string }> = {
  dashboard: {
    title: "Clinic overview",
    description: "Here’s what’s happening at BrightSmile today.",
  },
  patients: {
    title: "Patients",
    description: "Complete clinical profiles and treatment history.",
  },
  appointments: {
    title: "Appointments",
    description: "Coordinate schedules, rooms, and care teams.",
  },
  treatments: {
    title: "Treatment Price List",
    description: "Manage current procedure prices without changing historical records.",
  },
  payments: {
    title: "Payments",
    description: "Invoices, installments, balances, and receipts.",
  },
  staff: {
    title: "Doctors & staff",
    description: "Manage your care team and access roles.",
  },
  inventory: {
    title: "Inventory",
    description: "Monitor clinical supplies and reorder levels.",
  },
  reports: {
    title: "Reports & analytics",
    description: "Performance insights across the clinic.",
  },
  settings: {
    title: "Clinic settings",
    description: "Identity, operations, notifications, and security.",
  },
};

const isAdministrator = (role: ClinicRole) => role === "owner" || role === "admin";
const allowedNavigation = (role: ClinicRole): NavKey[] => {
  if (isAdministrator(role)) return ["dashboard", "patients", "appointments", "treatments", "payments", "staff", "inventory", "reports", "settings"];
  if (role === "dentist" || role === "hygienist") return ["patients", "appointments"];
  if (["assistant", "front_desk", "billing"].includes(role)) return ["patients", "appointments", "payments"];
  return ["patients"];
};

function Brand({ expanded = true, clinicName }: { expanded?: boolean; clinicName: string }) {
  return (
    <div className={cn("flex items-center", expanded ? "gap-3" : "justify-center")}>
      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-teal-400/15 text-teal-300 ring-1 ring-inset ring-teal-300/20">
        <HeartPulse className="size-6" />
      </div>
      <div className={cn("min-w-0", !expanded && "hidden")}>
        <p className="truncate text-base font-semibold tracking-tight text-white" data-no-translate>{clinicName}</p>
        <p className="mt-0.5 text-xs text-slate-400">
          Clinic workspace
        </p>
      </div>
    </div>
  );
}

function WorkstationSwitcher({ members, currentUserId, configured, onDemoSwitch }: {
  members: ClinicMember[];
  currentUserId: string;
  configured: boolean;
  onDemoSwitch: (member: ClinicMember) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [target, setTarget] = useState<ClinicMember | null>(null);
  const [saving, setSaving] = useState(false);
  const current = members.find((member) => member.userId === currentUserId);
  const select = (member: ClinicMember) => {
    if (member.userId === currentUserId) return setMenuOpen(false);
    setMenuOpen(false); setTarget(member);
  };
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!target) return;
    setSaving(true);
    const password = String(new FormData(event.currentTarget).get("password"));
    if (!configured) {
      onDemoSwitch(target); setTarget(null); setSaving(false);
      toast.success(`Workstation switched to ${target.fullName}`);
      return;
    }
    const client = createClient();
    if (!client || !target.email) {
      toast.error("This account does not have a switchable email address"); setSaving(false); return;
    }
    const { error } = await client.auth.signInWithPassword({ email: target.email, password });
    if (error) { toast.error(error.message); setSaving(false); return; }
    location.reload();
  };
  return <div className="relative block">
    <Button variant="ghost" onClick={() => setMenuOpen((open) => !open)} className="h-auto gap-2 rounded-xl p-1.5 pe-2" aria-label="Switch workstation user">
      <Avatar className="size-8"><AvatarFallback>{current?.fullName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2) || "CU"}</AvatarFallback></Avatar>
      <div className="text-start"><p className="max-w-28 truncate text-xs font-semibold" data-no-translate>{current?.fullName ?? "Clinic user"}</p><p className="text-[10px] capitalize text-muted-foreground">{current?.role.replace("_", " ") ?? "member"}</p></div><ChevronDown className="size-3.5 text-muted-foreground" />
    </Button>
    {menuOpen && <div className="absolute end-0 top-12 z-50 w-72 rounded-2xl border border-border bg-overlay p-2 shadow-overlay"><p className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Workstation user</p>{members.filter((member) => member.status === "active" && member.email && member.userId).map((member) => <Button key={member.id} variant="ghost" onClick={() => select(member)} className="h-auto w-full justify-start gap-3 rounded-xl px-3 py-2.5 text-start"><Avatar className="size-8"><AvatarFallback>{member.fullName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2)}</AvatarFallback></Avatar><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold" data-no-translate>{member.fullName}</span><span className="block text-[10px] capitalize text-muted-foreground">{member.role.replace("_", " ")}</span></span>{member.userId === currentUserId && <span className="text-[10px] font-bold text-success">Current</span>}</Button>)}</div>}
    <Dialog open={Boolean(target)} onOpenChange={(open) => !open && setTarget(null)}><DialogContent><DialogHeader><DialogTitle>Switch to {target?.fullName}</DialogTitle><DialogDescription>Enter this user’s password. Returning to Admin mode requires the Admin account password.</DialogDescription></DialogHeader><form onSubmit={submit} className="space-y-4"><label className="block text-xs font-semibold">Password<Input name="password" type="password" minLength={configured ? 8 : 1} required className="mt-1.5" autoFocus /></label><DialogFooter><Button type="button" variant="outline" onClick={() => setTarget(null)}>Cancel</Button><Button disabled={saving}>{saving ? "Switching…" : "Switch user"}</Button></DialogFooter></form></DialogContent></Dialog>
  </div>;
}

function SidebarContent({
  active,
  onNavigate,
  expanded = true,
  pinned = true,
  onTogglePin,
  mobile = false,
  role,
  member,
  clinic,
  notificationCounts,
}: {
  active: NavKey;
  onNavigate: (key: NavKey) => void;
  expanded?: boolean;
  pinned?: boolean;
  onTogglePin?: () => void;
  mobile?: boolean;
  role: ClinicRole;
  member?: ClinicMember;
  clinic: ClinicInfo;
  notificationCounts: Partial<Record<NavKey, number>>;
}) {
  const { language } = useClinicPreferences();
  const withTooltip = (
    label: string,
    child: React.ReactElement,
    tooltipKey?: React.Key,
  ) => {
    if (expanded || mobile) return child;
    return (
    <Tooltip key={tooltipKey} delayDuration={100}>
      <TooltipTrigger asChild>{child}</TooltipTrigger>
      <TooltipContent
        side={language === "ar" ? "left" : "right"}
        sideOffset={10}
        className="z-[70] text-xs font-medium"
      >
        {label}
      </TooltipContent>
    </Tooltip>
    );
  };

  return (
    <TooltipProvider>
      <div className={cn("py-5", expanded ? "px-5" : "px-3")}>
        <div className={cn("flex items-center", expanded ? "justify-between" : "flex-col gap-3")}>
          <Brand expanded={expanded} clinicName={clinic.name} />
          {!mobile && onTogglePin &&
            withTooltip(
              pinned ? "Unpin sidebar" : "Pin sidebar",
              <Button
                variant="ghost"
                size="icon"
                onClick={onTogglePin}
                aria-label={pinned ? "Unpin sidebar" : "Pin sidebar"}
                aria-pressed={pinned}
                className="size-7 shrink-0 rounded-md text-slate-400 hover:bg-white/10 hover:text-white"
              >
                {pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
              </Button>,
            )}
        </div>
      </div>
      <div className={cn("mb-6 rounded-lg border border-white/10 bg-white/[.035]", expanded ? "mx-4 p-3" : "mx-3 p-2")}>
        <div className={cn("flex items-center", expanded ? "gap-3" : "justify-center")}>
          <div className="grid size-8 shrink-0 place-items-center rounded-md bg-white/10 text-teal-200">
            <ShieldCheck className="size-4" />
          </div>
          <div className={cn("min-w-0", !expanded && "hidden")}>
            <p className="truncate text-sm font-medium text-slate-100" data-no-translate>{clinic.name}</p>
            <p className="mt-0.5 truncate text-xs text-slate-400" data-no-translate>{clinic.address?.street || clinic.phone || "Clinic workspace"}</p>
          </div>
        </div>
      </div>
      <nav className={cn("flex-1 overflow-y-auto px-3", expanded ? "space-y-6" : "space-y-4")}>
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className={cn("mb-2 px-3 text-xs font-medium uppercase tracking-widest text-slate-400", !expanded && "sr-only")}>
              {group.label}
            </p>
            <div className="space-y-1">
              {group.items.filter((item) => allowedNavigation(role).includes(item.key)).map((item) => {
                const Icon = item.icon;
                const selected = active === item.key;
                const count = notificationCounts[item.key] ?? 0;
                return withTooltip(item.label,
                  <Button
                    key={item.key}
                    variant={selected ? "default" : "ghost"}
                    onClick={() => onNavigate(item.key)}
                    aria-label={!expanded ? item.label : undefined}
                    aria-current={selected ? "page" : undefined}
                    className={cn(
                      "group h-11 w-full items-center rounded-lg py-2.5 text-sm font-medium transition-colors",
                      expanded ? "gap-3 px-3" : "justify-center px-2",
                      selected
                        ? "bg-primary text-white shadow-sm hover:bg-primary/90"
                        : "text-slate-300 hover:bg-white/7 hover:text-white",
                    )}
                  >
                    <Icon className={cn("size-[18px] shrink-0", !selected && "text-slate-400 group-hover:text-teal-200")} />
                    <span className={cn("flex-1 text-start", !expanded && "hidden")}>{item.label}</span>
                    {count > 0 && expanded ? (
                      <span className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-bold",
                        selected ? "bg-white/20 text-white" : item.key === "inventory" ? "bg-rose-400/15 text-rose-200" : "bg-white/10 text-slate-300",
                      )}>{count}</span>
                    ) : null}
                  </Button>,
                  item.key,
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      {isAdministrator(role) && <div className="p-3">
        {withTooltip("Clinic settings",
          <Button
            variant={active === "settings" ? "default" : "ghost"}
            onClick={() => onNavigate("settings")}
            aria-label={!expanded ? "Clinic settings" : undefined}
            aria-current={active === "settings" ? "page" : undefined}
            className={cn(
              "h-11 w-full items-center rounded-lg py-2.5 text-sm font-medium transition",
              expanded ? "gap-3 px-3" : "justify-center px-2",
              active === "settings" ? "text-white" : "text-slate-300 hover:bg-white/7 hover:text-white",
            )}
          >
            <Settings className="size-[18px] shrink-0" />
            <span className={cn(!expanded && "hidden")}>Clinic settings</span>
          </Button>,
        )}
      </div>}
      <div className={cn("border-t border-white/10", expanded ? "p-4" : "p-3")}>
        <div className={cn("flex items-center rounded-xl", expanded ? "gap-3 p-2" : "justify-center")}>
          <Avatar><AvatarFallback className="bg-white/10 text-teal-200" data-no-translate>{member?.fullName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2) || "CU"}</AvatarFallback></Avatar>
          <div className={cn("min-w-0 flex-1", !expanded && "hidden")}>
            <p className="truncate text-sm font-semibold" data-no-translate>{member?.fullName ?? "Clinic user"}</p>
            <p className="truncate text-xs capitalize text-slate-400">{role.replace("_", " ")}</p>
          </div>
          {expanded && <ShieldCheck className="size-4 text-slate-400" />}
        </div>
      </div>
    </TooltipProvider>
  );
}

export function ClinicApp() {
  const { formatMoney, language, setLanguage } = useClinicPreferences();
  const configured = hasSupabaseConfig();
  const [active, setActive] = useState<NavKey>("dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [patientList, setPatientList] = useState<Patient[]>(configured ? [] : initialPatients);
  const [appointmentList, setAppointmentList] =
    useState<Appointment[]>(configured ? [] : initialAppointments);
  const [paymentList, setPaymentList] = useState<Payment[]>(configured ? [] : initialPayments);
  const [inventoryList, setInventoryList] =
    useState<InventoryItem[]>(configured ? [] : initialInventory);
  const [procedureList, setProcedureList] = useState<ProcedureCatalogItem[]>(configured ? [] : initialProcedures);
  const [memberList, setMemberList] = useState<ClinicMember[]>(configured ? [] : initialMembers);
  const [currentUserId, setCurrentUserId] = useState(configured ? "" : "demo-owner");
  const [sessionList, setSessionList] = useState<TreatmentSession[]>([]);
  const [clinicRole, setClinicRole] = useState<ClinicRole>("owner");
  const [clinicInfo, setClinicInfo] = useState<ClinicInfo>({ name: "Dental Clinic" });
  const [sidebarPinned, setSidebarPinned] = useState(true);
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const [sidebarPreferenceReady, setSidebarPreferenceReady] = useState(false);
  const [initialLoading, setInitialLoading] = useState(configured);
  const sidebarHoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      const saved = localStorage.getItem("clinic-sidebar-pinned");
      if (saved === "true" || saved === "false")
        setSidebarPinned(saved === "true");
      window.setTimeout(() => setSidebarPreferenceReady(true), 100);
    });
    return () => {
      if (sidebarHoverTimer.current) clearTimeout(sidebarHoverTimer.current);
    };
  }, []);

  useEffect(() => {
    void loadClinicData()
      .then((data) => {
        if (!data) return;
        setPatientList(data.patients);
        setAppointmentList(data.appointments);
        setPaymentList(data.payments);
        setInventoryList(data.inventory);
        setProcedureList(data.procedures);
        setMemberList(data.members);
        setCurrentUserId(data.currentUserId);
        setSessionList(data.sessions);
        setClinicRole(data.role);
        setClinicInfo(data.clinic);
      })
      .finally(() => setInitialLoading(false));
    return subscribeToClinicChanges(() => {
      void loadClinicData().then((data) => {
        if (!data) return;
        setPatientList(data.patients);
        setAppointmentList(data.appointments);
        setPaymentList(data.payments);
        setInventoryList(data.inventory);
        setSessionList(data.sessions);
        setProcedureList(data.procedures);
        setMemberList(data.members);
        setCurrentUserId(data.currentUserId);
        setClinicRole(data.role);
        setClinicInfo(data.clinic);
        toast.info("Clinic data updated in real time");
      });
    });
  }, []);

  const navigate = (key: NavKey) => {
    setActive(key);
    setMobileOpen(false);
    setSearch("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const toggleSidebarPin = () => {
    if (sidebarHoverTimer.current) clearTimeout(sidebarHoverTimer.current);
    setSidebarHovered(false);
    setSidebarPinned((current) => {
      const next = !current;
      localStorage.setItem("clinic-sidebar-pinned", String(next));
      return next;
    });
  };
  const expandSidebarOnHover = () => {
    if (sidebarPinned) return;
    if (sidebarHoverTimer.current) clearTimeout(sidebarHoverTimer.current);
    sidebarHoverTimer.current = setTimeout(() => setSidebarHovered(true), 300);
  };
  const collapseSidebarAfterHover = () => {
    if (sidebarHoverTimer.current) clearTimeout(sidebarHoverTimer.current);
    sidebarHoverTimer.current = null;
    if (!sidebarPinned) setSidebarHovered(false);
  };
  const sidebarExpanded = sidebarPinned || sidebarHovered;
  const matchingPatients = useMemo(
    () =>
      search.trim().length >= 2
        ? patientList
            .filter((p) =>
              `${p.name} ${p.patientNo} ${p.phone}`
                .toLowerCase()
                .includes(search.toLowerCase()),
            )
            .slice(0, 5)
        : [],
    [patientList, search],
  );

  const refreshClinicData = async () => {
    const data = await loadClinicData();
    if (!data) return;
    setPatientList(data.patients); setAppointmentList(data.appointments);
    setPaymentList(data.payments); setInventoryList(data.inventory);
    setSessionList(data.sessions); setProcedureList(data.procedures);
    setMemberList(data.members); setCurrentUserId(data.currentUserId);
    setClinicRole(data.role); setClinicInfo(data.clinic);
  };
  const savePatient = async (patient: Patient) => {
    const phone = normalizeIraqiMobileNumber(patient.phone);
    if (!phone) return null;
    const pending = { ...patient, phone };
    const result = await persistPatient(pending);
    if (!result.ok) { toast.error(result.error ?? "Patient could not be saved"); return null; }
    const saved = { ...pending, id: result.id };
    setPatientList((old) => [saved, ...old]);
    toast.success(`${patient.name} added to patients`);
    return saved;
  };
  const addPatient = (patient: Patient) => savePatient(patient);
  const createBookingPatient = (input: { name: string; phone: string; email: string; requestedTreatment: string; assignedDoctor: string }) => {
    const parts = input.name.trim().split(/\s+/);
    const id = crypto.randomUUID();
    return savePatient({
      id, patientNo: patientNumberFromId(id),
      name: input.name.trim(), initials: parts.map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
      age: 0, gender: "Other", phone: input.phone, email: input.email,
      lastVisit: "New patient", status: "Active", allergies: [], conditions: [], notes: "",
      balance: 0, avatarColor: "bg-teal-100 text-teal-700", toothChart: {},
      requestedTreatment: input.requestedTreatment, assignedDoctor: input.assignedDoctor,
    });
  };
  const updateToothChart = (
    id: string,
    chart: Record<number, ToothCondition>,
    surfaces: ToothSurfaceChart,
  ) => {
    setPatientList((old) =>
      old.map((p) =>
        p.id === id ? { ...p, toothChart: chart, toothSurfaces: surfaces } : p,
      ),
    );
    void persistToothChart(id, chart, surfaces);
    toast.success("Dental chart saved");
  };
  const addAppointment = async (appointment: Appointment) => {
    const result = await persistAppointment(appointment);
    if (!result.ok) { toast.error(result.error ?? "Appointment could not be scheduled"); return false; }
    setAppointmentList((old) => [...old, appointment]);
    setPatientList((old) => old.map((patient) => patient.id === appointment.patientId ? {
      ...patient, requestedTreatment: appointment.treatment, assignedDoctor: appointment.doctor,
    } : patient));
    if (configured) await refreshClinicData();
    toast.success("Appointment and payment balance created");
    return true;
  };
  const moveAppointment = async (appointment: Appointment, date: string, time?: string) => {
    const previousStart = new Date(`${appointment.date} ${appointment.time}`);
    const previousEnd = new Date(`${appointment.date} ${appointment.endTime}`);
    const duration = Math.max(15 * 60_000, previousEnd.getTime() - previousStart.getTime());
    const nextStart = new Date(`${date} ${time ?? appointment.time}`);
    const nextEnd = new Date(nextStart.getTime() + duration);
    if (Number.isNaN(nextStart.getTime()) || nextStart < new Date()) {
      toast.error("Choose a valid future date and time");
      return false;
    }
    const result = await rescheduleAppointment(appointment.id, nextStart.toISOString(), nextEnd.toISOString());
    if (!result.ok) {
      toast.error(result.error ?? "Appointment could not be rescheduled");
      return false;
    }
    setAppointmentList((current) => current.map((item) => item.id === appointment.id ? {
      ...item,
      date,
      time: nextStart.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
      endTime: nextEnd.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
    } : item));
    return true;
  };
  const addPayment = async (input: { invoiceId: string; amount: number; method: Payment["method"]; reference?: string }) => {
    const result = await persistPayment(input);
    if (!result.ok) { toast.error(result.error ?? "Payment could not be recorded"); return false; }
    if (configured) await refreshClinicData();
    else setPaymentList((old) => old.map((payment) => payment.id === input.invoiceId ? {
      ...payment, paid: payment.paid + input.amount,
      status: payment.paid + input.amount + payment.discount >= payment.total ? "Paid" : "Partial",
      method: input.method, lastPaymentAmount: input.amount,
      receiptNumber: `RCT-${Date.now()}`, date: new Date().toLocaleDateString(),
      receipts: [{
        id: result.paymentId ?? crypto.randomUUID(), receiptNumber: `RCT-${Date.now()}`,
        amount: input.amount, date: new Date().toLocaleDateString(), method: input.method,
        treatment: payment.treatment, originalPrice: payment.originalPrice,
        amountDue: payment.total - payment.discount,
        remaining: Math.max(0, payment.total - payment.discount - payment.paid - input.amount),
        clinic: clinicInfo,
      }, ...(payment.receipts ?? [])],
    } : payment));
    toast.success("Payment recorded and receipt generated");
    return true;
  };
  const createMember = async (input: { fullName: string; email?: string; role: "dentist" | "front_desk"; specialty?: string }) => {
    if (!configured) {
      const id = crypto.randomUUID();
      setMemberList((old) => [...old, { id, fullName: input.fullName, email: input.email, role: input.role, status: "active", specialty: input.specialty }]);
      return true;
    }
    const result = await createClinicMember(input);
    if (!result.ok || !result.member) { toast.error(result.error ?? "Staff member could not be added"); return false; }
    setMemberList((old) => [...old, result.member!]);
    return true;
  };
  const saveClinicProfile = async (clinic: ClinicInfo) => {
    const result = await persistClinicProfile(clinic);
    if (!result.ok) { toast.error(result.error ?? "Clinic profile could not be saved"); return false; }
    setClinicInfo(clinic); return true;
  };
  const collectSessionPayment = async (input: Parameters<typeof recordSessionPayment>[0]) => {
    const result = await recordSessionPayment(input);
    if (!result.ok) return result;
    const data = await loadClinicData();
    if (data) {
      setSessionList(data.sessions);
      setPaymentList(data.payments);
      setPatientList(data.patients);
    }
    return result;
  };
  const addInventory = (item: InventoryItem) => {
    setInventoryList((old) => [item, ...old]);
    void persistInventoryItem(item);
    toast.success("Inventory item added");
  };
  const currentMember = memberList.find((member) => member.userId === currentUserId);
  const doctors = memberList.filter((member) => member.status === "active" && (member.role === "dentist" || member.role === "hygienist"));
  const canManageAppointments = isAdministrator(clinicRole) || ["assistant", "front_desk"].includes(clinicRole);
  const displayActive = allowedNavigation(clinicRole).includes(active) ? active : allowedNavigation(clinicRole)[0];
  const lowStockCount = inventoryList.filter((item) => item.stock <= item.minimum).length;
  const appointmentNotificationCount = appointmentList.filter(
    (appointment) => appointment.status !== "Completed" && appointment.status !== "Cancelled",
  ).length;
  const notificationCounts = {
    appointments: appointmentNotificationCount,
    inventory: lowStockCount,
  } satisfies Partial<Record<NavKey, number>>;
  const notifications = [
    ...(lowStockCount ? [{ t: "Low stock alert", d: `${lowStockCount} supplies are below reorder level`, c: "bg-rose-500" }] : []),
    ...appointmentList.slice(0, 1).map((appointment) => ({ t: "Appointment confirmed", d: `${appointment.patientName} · ${appointment.time}`, c: "bg-primary" })),
    ...paymentList.filter((payment) => payment.paid > 0).slice(0, 1).map((payment) => ({ t: "Payment received", d: `${formatMoney(payment.lastPaymentAmount ?? payment.paid)} from ${payment.patientName}`, c: "bg-violet-500" })),
  ];

  return (
    <div className="clinic-shell min-h-screen bg-background text-foreground">
      <Toaster position="top-right" richColors closeButton />
      <aside
        data-sidebar-state={sidebarExpanded ? "expanded" : "collapsed"}
        data-sidebar-pinned={sidebarPinned}
        onMouseEnter={expandSidebarOnHover}
        onMouseLeave={collapseSidebarAfterHover}
        className={cn(
          "clinic-sidebar desktop-sidebar fixed inset-y-0 start-0 z-30 flex-col border-e border-white/5",
          sidebarPreferenceReady
            ? "opacity-100 transition-[width,box-shadow,opacity] duration-300 ease-out"
            : "opacity-0",
          sidebarExpanded ? "w-[248px]" : "w-[76px]",
          sidebarHovered && !sidebarPinned && "shadow-2xl shadow-slate-900/10",
        )}
      >
        <SidebarContent
          active={displayActive}
          onNavigate={navigate}
          expanded={sidebarExpanded}
          pinned={sidebarPinned}
          onTogglePin={toggleSidebarPin}
          role={clinicRole}
          member={currentMember}
          clinic={clinicInfo}
          notificationCounts={notificationCounts}
        />
      </aside>
      {mobileOpen && (
        <div className="mobile-nav-layer fixed inset-0 z-50">
          <button
            className="absolute inset-0 bg-slate-950/35 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          />
          <aside className="clinic-sidebar mobile-sidebar absolute inset-y-0 start-0 flex w-[280px] max-w-[85vw] flex-col border-e border-white/5 shadow-overlay">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen(false)}
              className="mobile-nav-close absolute end-2 top-1 rounded-lg text-slate-300 hover:bg-white/10 hover:text-white"
              aria-label="Close navigation"
            >
              <X className="size-5" />
            </Button>
            <SidebarContent active={displayActive} onNavigate={navigate} mobile role={clinicRole} member={currentMember} clinic={clinicInfo} notificationCounts={notificationCounts} />
          </aside>
        </div>
      )}
      <div
        className={cn(
          sidebarPreferenceReady && "transition-[padding] duration-300 ease-out",
          "desktop-sidebar-offset",
          sidebarPinned ? "desktop-sidebar-offset-expanded" : "desktop-sidebar-offset-collapsed",
        )}
      >
        <header className="sticky top-0 z-20 flex h-[72px] items-center gap-3 border-b border-border bg-card/95 px-4 backdrop-blur-xl sm:gap-5 sm:px-6 lg:px-8">
          <Button
            variant="ghost"
            size="icon"
            className="mobile-nav-trigger shrink-0"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu />
          </Button>
          <div className="hidden items-center gap-2 border-e pe-5 text-sm font-semibold xl:flex">
            <span className="size-2 rounded-full bg-primary" />
            <span className="whitespace-nowrap">{displayActive === "dashboard" ? "Overview" : pageMeta[displayActive].title}</span>
          </div>
          <div className="relative hidden w-full max-w-sm md:block">
            <Search className="absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border-transparent bg-muted/70 ps-10 shadow-none focus:bg-white"
              placeholder="Search patients, invoices, appointments…"
            />
            {matchingPatients.length > 0 && (
              <div className="absolute inset-x-0 top-12 z-50 rounded-2xl border border-border bg-overlay p-2 shadow-overlay">
                {matchingPatients.map((patient) => (
                  <Button
                    key={patient.id}
                    variant="ghost"
                    onClick={() => {
                      navigate("patients");
                      setSearch(patient.name);
                    }}
                    className="h-auto w-full justify-start gap-3 rounded-xl p-2.5 text-start"
                  >
                    <Avatar className="size-8">
                      <AvatarFallback className={patient.avatarColor}>
                        {patient.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-semibold" data-no-translate>{patient.name}</p>
                      <p className="text-xs text-muted-foreground" data-no-translate>
                        {patient.patientNo} · {patient.phone}
                      </p>
                    </div>
                  </Button>
                ))}
              </div>
            )}
          </div>
          <div className="ms-auto flex items-center gap-1 sm:gap-2">
            <Button variant="ghost" size="sm" onClick={() => setLanguage(language === "en" ? "ar" : "en")} aria-label={language === "en" ? "العربية" : "English"} className="gap-1.5 px-2 text-muted-foreground" data-no-translate>
              <Languages className="size-4" /><span className="text-xs">{language === "en" ? "العربية" : "English"}</span>
            </Button>
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setNotificationsOpen((v) => !v)}
                aria-label="Notifications"
                className="relative"
              >
                <Bell />
                {notifications.length > 0 && <span className="absolute end-2 top-2 size-2 rounded-full border-2 border-white bg-rose-500" />}
              </Button>
              {notificationsOpen && (
                <div className="absolute end-0 top-12 w-[min(340px,calc(100vw-2rem))] rounded-2xl border border-border bg-overlay p-2 shadow-overlay">
                  <div className="flex items-center justify-between px-3 py-2">
                    <p className="font-semibold">Notifications</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs font-semibold text-primary"
                      onClick={() => {
                        setNotificationsOpen(false);
                        toast.success("Notifications marked as read");
                      }}
                    >
                      Mark all read
                    </Button>
                  </div>
                  {notifications.map((n) => (
                    <div
                      key={n.t}
                      className="flex gap-3 rounded-xl p-3 hover:bg-slate-50"
                    >
                      <span
                        className={cn(
                          "mt-1.5 size-2 shrink-0 rounded-full",
                          n.c,
                        )}
                      />
                      <div>
                        <p className="text-sm font-semibold">{n.t}</p>
                        <p className="text-xs text-muted-foreground">{n.d}</p>
                      </div>
                    </div>
                  ))}
                  {!notifications.length && <p className="px-3 py-6 text-center text-xs text-muted-foreground">No notifications yet.</p>}
                </div>
              )}
            </div>
            <div className="hidden h-8 w-px bg-border sm:block" />
            <WorkstationSwitcher
              members={memberList}
              currentUserId={currentUserId}
              configured={configured}
              onDemoSwitch={(member) => { if (member.userId) setCurrentUserId(member.userId); setClinicRole(member.role); }}
            />
          </div>
        </header>
        <main className="mx-auto min-w-0 max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <PageHeader
            title={pageMeta[displayActive].title}
            description={displayActive === "dashboard" ? `Here’s what’s happening at ${clinicInfo.name} today.` : pageMeta[displayActive].description}
            status={
              <div className="flex items-center gap-3">
                <span className="hidden items-center gap-2 text-xs text-muted-foreground sm:inline-flex"><CalendarDays className="size-4" />{new Date().toLocaleDateString(language === "ar" ? "ar-IQ" : "en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                <span className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground">
                  <span className={cn("size-1.5 rounded-full", configured ? "bg-success" : "bg-amber-500")} />
                  {configured ? "Live workspace" : "Demo workspace"}
                </span>
              </div>
            }
          />
          {initialLoading ? <PageSkeleton /> : <>
          {displayActive === "dashboard" && (
            <DashboardPage
              appointments={appointmentList}
              patients={patientList}
              payments={paymentList}
              sessions={sessionList}
              onNavigate={navigate}
            />
          )}
          {displayActive === "patients" && (
            <PatientsPage
              patients={patientList}
              initialSearch={search}
              onAdd={addPatient}
              appointments={appointmentList}
              clinicianName={currentMember?.fullName ?? "Clinician"}
              onChartChange={updateToothChart}
              sessions={sessionList}
              role={clinicRole}
              onSessionPayment={collectSessionPayment}
            />
          )}
          {displayActive === "appointments" && (
            <AppointmentsPage
              appointments={appointmentList}
              patients={patientList}
              procedures={procedureList}
              doctors={doctors}
              canManage={canManageAppointments}
              onAdd={addAppointment}
              onCreatePatient={createBookingPatient}
              onReschedule={moveAppointment}
            />
          )}
          {displayActive === "treatments" && (
            <PriceListPage procedures={procedureList} role={clinicRole} onChange={setProcedureList} />
          )}
          {displayActive === "payments" && (
            <PaymentsPage
              payments={paymentList}
              clinic={clinicInfo}
              role={clinicRole}
              onAdd={addPayment}
            />
          )}
          {displayActive === "staff" && <StaffPage members={memberList} role={clinicRole} onCreate={createMember} />}
          {displayActive === "inventory" && (
            <InventoryPage items={inventoryList} onAdd={addInventory} role={clinicRole} clinic={clinicInfo} />
          )}
          {displayActive === "reports" && <ReportsPage payments={paymentList} patients={patientList} appointments={appointmentList} />}
          {displayActive === "settings" && <SettingsPage clinic={clinicInfo} onSaveClinic={saveClinicProfile} />}
          </>}
        </main>
      </div>
    </div>
  );
}
