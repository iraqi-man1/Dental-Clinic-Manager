"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type Key, type ReactElement, type ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertTriangle,
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
  RefreshCw,
  Settings,
  ShieldCheck,
  Users,
  WalletCards,
} from "lucide-react";
import { Toaster, toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn, iraqiMobileValidationMessage, normalizeIraqiMobileNumber } from "@/lib/utils";
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
import { ProfileControl } from "./profile-control";
import { SettingsPage } from "./pages/settings-page";
import { PageHeader, PageSkeleton } from "./app-ui";
import { HeaderSearch } from "./header-search";
import { subscribeToClinicChanges } from "@/lib/supabase/realtime";
import {
  SESSION_UNAVAILABLE,
  loadClinicData,
  adjustInventoryStock,
  createClinicMember,
  persistAppointment,
  persistClinicProfile,
  persistInventoryItem,
  persistPatient,
  persistPayment,
  persistToothChart,
  rescheduleAppointment,
  recordSessionPayment,
  reversePayment,
  type ClinicSnapshot,
} from "@/lib/supabase/clinic-data";
import { useClinicPreferences } from "@/lib/clinic-preferences";
import { createClient, hasSupabaseConfig } from "@/lib/supabase/client";
import {
  ageFromDateOfBirth,
  clinicDateKey,
  clinicDateLabel,
  clinicTimeLabel,
  clinicTodayKey,
  localDateTimeToIso,
  resolveClinicTimeZone,
} from "@/lib/clinic-time";
import { createId } from "@/lib/ids";

/** Realtime events arrive in bursts (one save touches several tables), so reloads are debounced. */
const REALTIME_RELOAD_DELAY_MS = 400;
const MIN_APPOINTMENT_MS = 15 * 60_000;

/** Appointment as the scheduling form submits it. The shell derives the instants from the clinic zone. */
type AppointmentDraft = Omit<Appointment, "startsAt" | "endsAt">;

type AppNotification = {
  id: string;
  title: string;
  detail: ReactNode;
  tone: string;
  /** Changes when the underlying records change, so a new item marks the list unread again. */
  signature: string;
};

const navGroups: { label: string; items: { key: NavKey; label: string; icon: typeof LayoutDashboard }[] }[] = [
  {
    label: "Workspace",
    items: [
      { key: "dashboard", label: "Overview", icon: LayoutDashboard },
      { key: "appointments", label: "Appointments", icon: CalendarDays },
      { key: "patients", label: "Patients", icon: Users },
      { key: "treatments", label: "Price List", icon: ClipboardPlus },
    ],
  },
  {
    label: "Management",
    items: [
      { key: "payments", label: "Payments", icon: WalletCards },
      { key: "staff", label: "Doctors & staff", icon: HeartPulse },
      { key: "inventory", label: "Inventory", icon: Boxes },
      { key: "reports", label: "Reports & analytics", icon: FileBarChart },
    ],
  },
];

const roleLabels: Record<ClinicRole, string> = {
  owner: "Owner",
  admin: "Admin",
  dentist: "Dentist",
  hygienist: "Hygienist",
  assistant: "Assistant",
  front_desk: "Front desk",
  billing: "Billing",
  viewer: "Viewer",
};

function patientNumberFromId(id: string) {
  return `PT-${id.replaceAll("-", "").slice(0, 10).toUpperCase()}`;
}

const pageMeta: Record<NavKey, { title: string }> = {
  dashboard: {
    title: "Clinic overview",
  },
  patients: {
    title: "Patients",
  },
  appointments: {
    title: "Appointments",
  },
  treatments: {
    title: "Treatment Price List",
  },
  payments: {
    title: "Payments",
  },
  staff: {
    title: "Doctors & staff",
  },
  inventory: {
    title: "Inventory",
  },
  reports: {
    title: "Reports & analytics",
  },
  settings: {
    title: "Clinic settings",
  },
};

const isAdministrator = (role: ClinicRole | null) => role === "owner" || role === "admin";
const allowedNavigation = (role: ClinicRole | null): NavKey[] => {
  if (!role) return [];
  if (isAdministrator(role)) return ["dashboard", "patients", "appointments", "treatments", "payments", "staff", "inventory", "reports", "settings"];
  if (role === "dentist" || role === "hygienist") return ["patients", "appointments"];
  if (["assistant", "front_desk", "billing"].includes(role)) return ["patients", "appointments", "payments"];
  return ["patients"];
};

/**
 * Builds UTC instants for a clinic wall-clock start time. The end is either the given end time or
 * start plus `durationMs`. Returns null for malformed input. Display text is never parsed.
 */
function appointmentWindow(
  dateKey: string,
  startTime: string,
  timeZone: string,
  endTime?: string,
  durationMs = MIN_APPOINTMENT_MS,
): { startsAt: string; endsAt: string } | null {
  try {
    const startsAt = localDateTimeToIso(dateKey, startTime, timeZone);
    const endsAt = endTime
      ? localDateTimeToIso(dateKey, endTime, timeZone)
      : new Date(Date.parse(startsAt) + durationMs).toISOString();
    return { startsAt, endsAt };
  } catch {
    return null;
  }
}

/** Current epoch milliseconds for event handlers. Render reads the clock from `useClinicClock`. */
function epochNow(): number {
  return Date.now();
}

/**
 * Mounted clock for render-time filters such as "upcoming today". It starts unset, so nothing
 * time-dependent renders before mount, and it refreshes once a minute.
 */
function useClinicClock(intervalMs = 60_000): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(epochNow());
    queueMicrotask(tick);
    const timer = setInterval(tick, intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/** Clinic wall-clock time as HH:mm, used to pre-fill time inputs from an instant. */
function clinicClock(iso: string, timeZone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "00:00";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${read("hour").padStart(2, "0")}:${read("minute").padStart(2, "0")}`;
}

function Brand({ expanded = true }: { expanded?: boolean }) {
  return (
    <div className={cn("flex items-center", expanded ? "gap-3" : "justify-center")}>
      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-white shadow-sm">
        <HeartPulse className="size-6" />
      </div>
      <div className={cn("min-w-0", !expanded && "hidden")}>
        <p className="app-brand text-3xl" data-no-translate>نرجس</p>
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
  const { t } = useClinicPreferences();
  const [menuOpen, setMenuOpen] = useState(false);
  const [target, setTarget] = useState<ClinicMember | null>(null);
  const [saving, setSaving] = useState(false);
  const select = (member: ClinicMember) => {
    if (member.userId === currentUserId) return setMenuOpen(false);
    setMenuOpen(false); setTarget(member);
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!target) return;
    setSaving(true);
    const password = String(new FormData(event.currentTarget).get("password"));
    if (!configured) {
      onDemoSwitch(target); setTarget(null); setSaving(false);
      toast.success(t("Workstation switched to {name}", { name: target.fullName }));
      return;
    }
    const client = createClient();
    if (!client || !target.email) {
      toast.error(t("This account does not have a switchable email address")); setSaving(false); return;
    }
    const { error } = await client.auth.signInWithPassword({ email: target.email, password });
    if (error) { toast.error(t(error.message)); setSaving(false); return; }
    location.reload();
  };
  return <div className="relative block">
    <Button variant="ghost" onClick={() => setMenuOpen((open) => !open)} className="h-auto gap-2 rounded-xl p-1.5 pe-2" aria-label={t("Switch workstation user")}>
      <Users className="size-4" /><ChevronDown className="size-3.5 text-muted-foreground" />
    </Button>
    {menuOpen && <div className="absolute end-0 top-12 z-50 w-72 rounded-2xl border border-border bg-overlay p-2 shadow-overlay"><p className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t("Workstation user")}</p>{members.filter((member) => member.status === "active" && member.email && member.userId).map((member) => <Button key={member.id} variant="ghost" onClick={() => select(member)} className="h-auto min-h-11 w-full justify-start gap-3 rounded-xl px-3 py-2.5 text-start"><Avatar className="size-8"><AvatarFallback data-no-translate>{member.fullName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2)}</AvatarFallback></Avatar><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold" data-no-translate>{member.fullName}</span><span className="block text-[10px] text-muted-foreground">{t(roleLabels[member.role])}</span></span>{member.userId === currentUserId && <span className="text-[10px] font-bold text-success">{t("Current")}</span>}</Button>)}</div>}
    <Dialog open={Boolean(target)} onOpenChange={(open) => !open && setTarget(null)}><DialogContent><DialogHeader><DialogTitle>{t("Switch to {name}", { name: target?.fullName ?? "" })}</DialogTitle><DialogDescription>{t("Enter this user’s password. Returning to Admin mode requires the Admin account password.")}</DialogDescription></DialogHeader><form onSubmit={submit} className="space-y-4"><label className="block text-xs font-semibold">{t("Password")}<Input name="password" type="password" minLength={configured ? 8 : 1} required className="mt-1.5" autoFocus /></label><DialogFooter><Button type="button" variant="outline" onClick={() => setTarget(null)}>{t("Cancel")}</Button><Button disabled={saving}>{saving ? t("Switching…") : t("Switch user")}</Button></DialogFooter></form></DialogContent></Dialog>
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
  role: ClinicRole | null;
  member?: ClinicMember;
  clinic: ClinicInfo;
  notificationCounts: Partial<Record<NavKey, number>>;
}) {
  const { language, t } = useClinicPreferences();
  const allowed = allowedNavigation(role);
  const visibleGroups = navGroups
    .map((group) => ({ ...group, items: group.items.filter((item) => allowed.includes(item.key)) }))
    .filter((group) => group.items.length > 0);
  const withTooltip = (
    label: string,
    child: ReactElement,
    tooltipKey?: Key,
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
          <Brand expanded={expanded} />
          {!mobile && onTogglePin &&
            withTooltip(
              pinned ? t("Unpin sidebar") : t("Pin sidebar"),
              <Button
                variant="ghost"
                size="icon"
                onClick={onTogglePin}
                aria-label={pinned ? t("Unpin sidebar") : t("Pin sidebar")}
                aria-pressed={pinned}
                className="size-7 shrink-0 rounded-md text-muted-foreground hover:bg-accent hover:text-primary"
              >
                {pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
              </Button>,
            )}
        </div>
      </div>
      {role && (
        <div className={cn("mb-6 rounded-lg border border-border bg-muted/60", expanded ? "mx-4 p-3" : "mx-3 p-2")}>
          <div className={cn("flex items-center", expanded ? "gap-3" : "justify-center")}>
            <div className="grid size-8 shrink-0 place-items-center rounded-md bg-accent text-primary">
              <ShieldCheck className="size-4" />
            </div>
            <div className={cn("min-w-0", !expanded && "hidden")}>
              <p className="truncate text-sm font-medium text-foreground" data-no-translate>{clinic.name}</p>
              {(clinic.address?.street || clinic.phone) && <p className="mt-0.5 truncate text-xs text-muted-foreground" data-no-translate>{clinic.address?.street || clinic.phone}</p>}
            </div>
          </div>
        </div>
      )}
      <nav aria-label={t("Main navigation")} className={cn("flex-1 overflow-y-auto px-3", expanded ? "space-y-6" : "space-y-4")}>
        {visibleGroups.map((group) => (
          <div key={group.label}>
            <p className={cn("mb-2 px-3 text-xs font-medium uppercase tracking-widest text-muted-foreground", !expanded && "sr-only")}>
              {t(group.label)}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const selected = active === item.key;
                const count = notificationCounts[item.key] ?? 0;
                const label = t(item.label);
                return withTooltip(label,
                  <Button
                    key={item.key}
                    variant={selected ? "default" : "ghost"}
                    onClick={() => onNavigate(item.key)}
                    aria-label={!expanded ? label : undefined}
                    aria-current={selected ? "page" : undefined}
                    className={cn(
                      "group h-11 w-full items-center rounded-lg py-2.5 text-sm font-medium transition-colors",
                      expanded ? "gap-3 px-3" : "justify-center px-2",
                      selected
                        ? "bg-accent text-primary shadow-none hover:bg-accent"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <Icon className={cn("size-[18px] shrink-0", !selected && "text-muted-foreground group-hover:text-primary")} />
                    <span className={cn("flex-1 text-start", !expanded && "hidden")}>{label}</span>
                    {count > 0 && expanded ? (
                      <span className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-bold",
                        selected ? "bg-primary/10 text-primary" : item.key === "inventory" ? "bg-rose-50 text-rose-700" : "bg-muted text-muted-foreground",
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
        {withTooltip(t("Clinic settings"),
          <Button
            variant={active === "settings" ? "default" : "ghost"}
            onClick={() => onNavigate("settings")}
            aria-label={!expanded ? t("Clinic settings") : undefined}
            aria-current={active === "settings" ? "page" : undefined}
            className={cn(
              "h-11 w-full items-center rounded-lg py-2.5 text-sm font-medium transition",
              expanded ? "gap-3 px-3" : "justify-center px-2",
              active === "settings" ? "text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Settings className="size-[18px] shrink-0" />
            <span className={cn(!expanded && "hidden")}>{t("Clinic settings")}</span>
          </Button>,
        )}
      </div>}
      <div className={cn("border-t border-border", expanded ? "p-4" : "p-3")}>
        <div className={cn("flex items-center rounded-xl", expanded ? "gap-3 p-2" : "justify-center")}>
          <Avatar><AvatarFallback className="bg-accent text-primary" data-no-translate>{member?.fullName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2) || "CU"}</AvatarFallback></Avatar>
          <div className={cn("min-w-0 flex-1", !expanded && "hidden")}>
            <p className="truncate text-sm font-semibold" data-no-translate>{member?.fullName ?? t("Clinic user")}</p>
            <p className="truncate text-xs text-muted-foreground">{role ? t(roleLabels[role]) : ""}</p>
          </div>
          {expanded && <ShieldCheck className="size-4 text-muted-foreground" />}
        </div>
      </div>
    </TooltipProvider>
  );
}

export function ClinicApp() {
  const { language, locale, setLanguage, t } = useClinicPreferences();
  const configured = hasSupabaseConfig();
  const [active, setActive] = useState<NavKey>("dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [readNotifications, setReadNotifications] = useState<{ userId: string; signature: string }>({ userId: "", signature: "" });
  const [search, setSearch] = useState("");
  // Demo mode keeps the seeded data. A configured workspace starts empty until the snapshot loads.
  const [patientList, setPatientList] = useState<Patient[]>(configured ? [] : initialPatients);
  const [appointmentList, setAppointmentList] = useState<Appointment[]>(configured ? [] : initialAppointments);
  const [paymentList, setPaymentList] = useState<Payment[]>(configured ? [] : initialPayments);
  const [inventoryList, setInventoryList] = useState<InventoryItem[]>(configured ? [] : initialInventory);
  const [procedureList, setProcedureList] = useState<ProcedureCatalogItem[]>(configured ? [] : initialProcedures);
  const [memberList, setMemberList] = useState<ClinicMember[]>(configured ? [] : initialMembers);
  const [currentUserId, setCurrentUserId] = useState(configured ? "" : "demo-owner");
  const [sessionList, setSessionList] = useState<TreatmentSession[]>([]);
  // The role stays null until a snapshot loads, so no owner-level navigation shows before the check.
  const [clinicRole, setClinicRole] = useState<ClinicRole | null>(configured ? null : "owner");
  const [clinicInfo, setClinicInfo] = useState<ClinicInfo>({ name: "Dental Clinic" });
  const [snapshotLoaded, setSnapshotLoaded] = useState(!configured);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloading, setReloading] = useState(false);
  const [sidebarPinned, setSidebarPinned] = useState(true);
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const [sidebarPreferenceReady, setSidebarPreferenceReady] = useState(false);
  const sidebarHoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reloadInFlight = useRef<Promise<boolean> | null>(null);
  const reloadQueued = useRef(false);

  const timeZone = resolveClinicTimeZone(clinicInfo.timezone);

  /** The only place a loaded snapshot is written into state. */
  const applySnapshot = useCallback((snapshot: ClinicSnapshot) => {
    setPatientList(snapshot.patients);
    setAppointmentList(snapshot.appointments);
    setPaymentList(snapshot.payments);
    setInventoryList(snapshot.inventory);
    setProcedureList(snapshot.procedures);
    setMemberList(snapshot.members);
    setCurrentUserId(snapshot.currentUserId);
    setSessionList(snapshot.sessions);
    setClinicRole(snapshot.role);
    setClinicInfo(snapshot.clinic);
    setLoadError(null);
    setSnapshotLoaded(true);
  }, []);

  /**
   * Reloads the workspace. Only one load runs at a time. A request that arrives during a load
   * queues one more pass, and every caller receives the result of that pass.
   */
  const reloadClinicData = useCallback((): Promise<boolean> => {
    if (reloadInFlight.current) {
      reloadQueued.current = true;
      return reloadInFlight.current;
    }
    const run = (async () => {
      setReloading(true);
      let ok = false;
      try {
        do {
          reloadQueued.current = false;
          const result = await loadClinicData();
          ok = result.ok;
          if (result.ok) applySnapshot(result.snapshot);
          else setLoadError(result.error);
        } while (reloadQueued.current);
      } finally {
        setReloading(false);
        reloadInFlight.current = null;
      }
      return ok;
    })();
    reloadInFlight.current = run;
    return run;
  }, [applySnapshot]);

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
    if (!configured) return;
    queueMicrotask(() => {
      void reloadClinicData();
    });
  }, [configured, reloadClinicData]);

  useEffect(() => {
    if (!configured) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribeToClinicChanges(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
        void reloadClinicData();
      }, REALTIME_RELOAD_DELAY_MS);
    });
    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, [configured, reloadClinicData]);

  const navigate = (key: NavKey) => {
    setActive(key);
    setMobileOpen(false);
    setSearch("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const openPatientFromSearch = (patient: Patient) => {
    navigate("patients");
    setSearch(patient.name);
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

  const savePatient = async (patient: Patient): Promise<Patient | null> => {
    const phone = normalizeIraqiMobileNumber(patient.phone);
    if (!phone) {
      toast.error(t(iraqiMobileValidationMessage));
      return null;
    }
    const age = patient.dateOfBirth ? ageFromDateOfBirth(patient.dateOfBirth, timeZone) : patient.age;
    const pending: Patient = { ...patient, phone, age };
    const result = await persistPatient(pending);
    if (!result.ok) { toast.error(t(result.error ?? "Patient could not be saved")); return null; }
    const saved: Patient = { ...pending, id: result.id ?? pending.id };
    setPatientList((old) => [saved, ...old.filter((item) => item.id !== saved.id)]);
    toast.success(t("{name} added to patients", { name: patient.name }));
    return saved;
  };
  const addPatient = (patient: Patient) => savePatient(patient);
  const createBookingPatient = (input: { name: string; phone: string; email: string; requestedTreatment: string; assignedDoctor: string }) => {
    const parts = input.name.trim().split(/\s+/);
    const id = createId();
    return savePatient({
      id, patientNo: patientNumberFromId(id),
      name: input.name.trim(), initials: parts.map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
      age: 0, gender: "Other", phone: input.phone, email: input.email,
      lastVisit: "New patient", status: "Active", allergies: [], conditions: [], notes: "",
      balance: 0, avatarColor: "bg-teal-100 text-teal-700", toothChart: {},
      requestedTreatment: input.requestedTreatment, assignedDoctor: input.assignedDoctor,
    });
  };
  const updateToothChart = async (
    id: string,
    chart: Record<number, ToothCondition>,
    surfaces: ToothSurfaceChart,
  ): Promise<boolean> => {
    const previous = patientList.find((patient) => patient.id === id);
    setPatientList((old) =>
      old.map((p) =>
        p.id === id ? { ...p, toothChart: chart, toothSurfaces: surfaces } : p,
      ),
    );
    const result = await persistToothChart(id, chart, surfaces);
    if (!result.ok) {
      // Roll back only the chart fields, and keep any other change made to the patient meanwhile.
      if (previous) {
        setPatientList((old) => old.map((p) =>
          p.id === id ? { ...p, toothChart: previous.toothChart, toothSurfaces: previous.toothSurfaces } : p,
        ));
      }
      toast.error(t(result.error ?? "Dental chart could not be saved"));
      return false;
    }
    toast.success(t("Dental chart saved"));
    return true;
  };
  const addAppointment = async (draft: AppointmentDraft): Promise<boolean> => {
    const window = appointmentWindow(draft.date, draft.time, timeZone, draft.endTime);
    if (!window) { toast.error(t("Choose a valid future date and time")); return false; }
    if (Date.parse(window.startsAt) <= epochNow()) { toast.error(t("Choose a valid future date and time")); return false; }
    if (Date.parse(window.endsAt) <= Date.parse(window.startsAt)) { toast.error(t("The end time must be after the start time")); return false; }
    const appointment: Appointment = {
      ...draft,
      startsAt: window.startsAt,
      endsAt: window.endsAt,
      date: clinicDateKey(window.startsAt, timeZone),
      time: clinicTimeLabel(window.startsAt, timeZone, "en-US"),
      endTime: clinicTimeLabel(window.endsAt, timeZone, "en-US"),
    };
    const result = await persistAppointment(appointment);
    if (!result.ok) { toast.error(t(result.error ?? "Appointment could not be scheduled")); return false; }
    setAppointmentList((old) => [...old, appointment]);
    setPatientList((old) => old.map((patient) => patient.id === appointment.patientId ? {
      ...patient, requestedTreatment: appointment.treatment, assignedDoctor: appointment.doctor,
    } : patient));
    if (configured) await reloadClinicData();
    toast.success(t("Appointment and payment balance created"));
    return true;
  };
  const moveAppointment = async (appointment: Appointment, date: string, time?: string): Promise<boolean> => {
    const durationMs = Math.max(MIN_APPOINTMENT_MS, Date.parse(appointment.endsAt) - Date.parse(appointment.startsAt));
    const window = appointmentWindow(date, time ?? clinicClock(appointment.startsAt, timeZone), timeZone, undefined, durationMs);
    if (!window || Date.parse(window.startsAt) <= epochNow()) {
      toast.error(t("Choose a valid future date and time"));
      return false;
    }
    const result = await rescheduleAppointment(appointment.id, window.startsAt, window.endsAt);
    if (!result.ok) {
      toast.error(t(result.error ?? "Appointment could not be rescheduled"));
      return false;
    }
    setAppointmentList((current) => current.map((item) => item.id === appointment.id ? {
      ...item,
      startsAt: window.startsAt,
      endsAt: window.endsAt,
      date: clinicDateKey(window.startsAt, timeZone),
      time: clinicTimeLabel(window.startsAt, timeZone, "en-US"),
      endTime: clinicTimeLabel(window.endsAt, timeZone, "en-US"),
    } : item));
    return true;
  };
  const addPayment = async (input: { invoiceId: string; amount: number; method: Payment["method"]; reference?: string }): Promise<boolean> => {
    const result = await persistPayment(input);
    if (!result.ok) { toast.error(t(result.error ?? "Payment could not be recorded")); return false; }
    if (configured) {
      await reloadClinicData();
    } else {
      const receiptNumber = `RCT-${epochNow()}`;
      const dateLabel = clinicDateLabel(new Date().toISOString(), timeZone, "en-US");
      setPaymentList((old) => old.map((payment) => payment.id === input.invoiceId ? {
        ...payment, paid: payment.paid + input.amount,
        status: payment.paid + input.amount + payment.discount >= payment.total ? "Paid" : "Partial",
        method: input.method, lastPaymentAmount: input.amount,
        receiptNumber, date: dateLabel,
        receipts: [{
          id: result.paymentId ?? createId(), receiptNumber,
          amount: input.amount, date: dateLabel, method: input.method,
          treatment: payment.treatment, originalPrice: payment.originalPrice,
          amountDue: payment.total - payment.discount,
          remaining: Math.max(0, payment.total - payment.discount - payment.paid - input.amount),
          clinic: clinicInfo,
        }, ...(payment.receipts ?? [])],
      } : payment));
    }
    toast.success(t("Payment recorded and receipt generated"));
    return true;
  };
  const reversePaymentEntry = async (input: { paymentId: string; reason: string }): Promise<boolean> => {
    const result = await reversePayment(input);
    if (!result.ok) { toast.error(t(result.error ?? "The payment could not be reversed")); return false; }
    if (configured) {
      await reloadClinicData();
    } else {
      // Demo mode has no database, so mirror the reversal on the local receipts.
      setPaymentList((old) => old.map((payment) => {
        const receipt = payment.receipts?.find((item) => item.id === input.paymentId);
        if (!receipt) return payment;
        const paid = Math.max(0, payment.paid - receipt.amount);
        const receipts = (payment.receipts ?? []).filter((item) => item.id !== input.paymentId);
        return {
          ...payment,
          paid,
          status: paid + payment.discount >= payment.total ? "Paid" : paid > 0 ? "Partial" : "Unpaid",
          lastPaymentAmount: receipts[0]?.amount,
          receipts,
        };
      }));
    }
    toast.success(t("Payment reversed"));
    return true;
  };
  const createMember = async (input: { fullName: string; email?: string; role: "dentist" | "front_desk"; specialty?: string }): Promise<boolean> => {
    const result = await createClinicMember(input);
    if (!result.ok) { toast.error(t(result.error ?? "Staff member could not be added")); return false; }
    if (configured) {
      if (result.member) setMemberList((old) => [...old, result.member!]);
      else await reloadClinicData();
      return true;
    }
    // Demo mode returns the member it would have created.
    const member = result.member ?? { id: createId(), fullName: input.fullName, email: input.email, role: input.role, status: "active" as const, specialty: input.specialty };
    setMemberList((old) => [...old, member]);
    return true;
  };
  const saveClinicProfile = async (clinic: ClinicInfo): Promise<boolean> => {
    const result = await persistClinicProfile(clinic);
    if (!result.ok) { toast.error(t(result.error ?? "Clinic profile could not be saved")); return false; }
    setClinicInfo(clinic);
    return true;
  };
  const collectSessionPayment = async (input: Parameters<typeof recordSessionPayment>[0]) => {
    const result = await recordSessionPayment(input);
    if (!result.ok) return result;
    await reloadClinicData();
    return result;
  };
  const adjustStock = async (input: { itemId: string; delta: number; reason: string }): Promise<boolean> => {
    const current = inventoryList.find((item) => item.id === input.itemId);
    if (!current) { toast.error(t("Inventory item not found")); return false; }
    // Live stock is checked by the database. Demo mode has no database, so it is checked here.
    if (!configured && current.stock + input.delta < 0) { toast.error(t("Stock cannot go below zero")); return false; }
    const result = await adjustInventoryStock(input);
    if (!result.ok) { toast.error(t(result.error ?? "Stock could not be updated")); return false; }
    if (result.quantity !== undefined) {
      const quantity = result.quantity;
      setInventoryList((old) => old.map((item) => item.id === input.itemId ? { ...item, stock: quantity } : item));
    } else if (!configured) {
      setInventoryList((old) => old.map((item) => item.id === input.itemId ? { ...item, stock: item.stock + input.delta } : item));
    }
    if (configured) await reloadClinicData();
    toast.success(t("Stock updated"));
    return true;
  };
  const addInventory = async (item: InventoryItem): Promise<boolean> => {
    // Optimistic insert. It is removed again if the save fails, so the list never shows unsaved stock.
    setInventoryList((old) => [item, ...old]);
    const result = await persistInventoryItem(item);
    if (!result.ok) {
      setInventoryList((old) => old.filter((existing) => existing.id !== item.id));
      toast.error(t(result.error ?? "Inventory item could not be saved"));
      return false;
    }
    if (result.id && result.id !== item.id) {
      const savedId = result.id;
      setInventoryList((old) => old.map((existing) => existing.id === item.id ? { ...existing, id: savedId } : existing));
    }
    toast.success(t("Inventory item added"));
    return true;
  };

  const role = clinicRole;
  const currentMember = memberList.find((member) => member.userId === currentUserId);
  const doctors = memberList.filter((member) => member.status === "active" && (member.role === "dentist" || member.role === "hygienist"));
  const canManageAppointments = role !== null && (isAdministrator(role) || ["assistant", "front_desk"].includes(role));
  const navKeys = allowedNavigation(role);
  const displayActive: NavKey = navKeys.includes(active) ? active : (navKeys[0] ?? "dashboard");
  const todayKey = clinicTodayKey(timeZone);
  const clock = useClinicClock();
  const appointmentNotificationCount = appointmentList.filter(
    (appointment) => appointment.status !== "Completed" && appointment.status !== "Cancelled",
  ).length;
  const notificationCounts = {
    appointments: appointmentNotificationCount,
    inventory: inventoryList.filter((item) => item.stock <= item.minimum).length,
  } satisfies Partial<Record<NavKey, number>>;

  // Notifications come only from persisted records, so nothing is invented.
  const upcomingToday = clock === null ? [] : appointmentList
    .filter((appointment) =>
      appointment.date === todayKey &&
      appointment.status !== "Completed" &&
      appointment.status !== "Cancelled" &&
      Date.parse(appointment.endsAt) > clock,
    )
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const lowStockItems = inventoryList.filter((item) => item.stock <= item.minimum);
  const partlyPaidInvoices = paymentList.filter((payment) => payment.status === "Partial");
  const notifications: AppNotification[] = [
    ...(upcomingToday.length
      ? [{
          id: "visits-today",
          title: t("Visits today"),
          detail: (
            <span className="block">
              {t("{count} visits still to come today", { count: upcomingToday.length })}
              <span className="block" data-no-translate>{upcomingToday[0].patientName} · {clinicTimeLabel(upcomingToday[0].startsAt, timeZone, locale)}</span>
            </span>
          ),
          tone: "bg-primary",
          signature: `visits:${upcomingToday.map((appointment) => appointment.id).join(",")}`,
        }]
      : []),
    ...(lowStockItems.length
      ? [{
          id: "low-stock",
          title: t("Low stock alert"),
          detail: t("{count} supplies are below reorder level", { count: lowStockItems.length }),
          tone: "bg-rose-500",
          signature: `stock:${lowStockItems.map((item) => `${item.id}:${item.stock}`).join(",")}`,
        }]
      : []),
    ...(partlyPaidInvoices.length
      ? [{
          id: "partly-paid",
          title: t("Partly paid invoices"),
          detail: t("{count} invoices have a remaining balance", { count: partlyPaidInvoices.length }),
          tone: "bg-amber-500",
          signature: `partial:${partlyPaidInvoices.map((payment) => `${payment.id}:${payment.paid}`).join(",")}`,
        }]
      : []),
  ];
  const notificationSignature = notifications.map((notification) => notification.signature).join("|");
  const hasUnreadNotifications = notifications.length > 0 && (readNotifications.userId !== currentUserId || readNotifications.signature !== notificationSignature);
  const markNotificationsRead = () => {
    setReadNotifications({ userId: currentUserId, signature: notificationSignature });
    try { localStorage.setItem(`nargis-notifications:${currentUserId}`, notificationSignature); } catch { /* Session state still clears the indicator. */ }
  };
  useEffect(() => {
    let signature = "";
    try { signature = localStorage.getItem(`nargis-notifications:${currentUserId}`) ?? ""; } catch { /* Storage may be unavailable. */ }
    queueMicrotask(() => setReadNotifications({ userId: currentUserId, signature }));
  }, [currentUserId]);

  const workspaceBadge = !configured
    ? { label: t("Demo workspace"), dot: "bg-amber-500" }
    : loadError
      ? { label: t("Workspace unavailable"), dot: "bg-rose-500" }
      : snapshotLoaded
        ? { label: t("Live workspace"), dot: "bg-success" }
        : { label: t("Connecting…"), dot: "bg-muted-foreground" };

  return (
    <div className="clinic-shell min-h-screen bg-background text-foreground">
      <Toaster position="top-right" richColors closeButton />
      <aside
        data-sidebar-state={sidebarExpanded ? "expanded" : "collapsed"}
        data-sidebar-pinned={sidebarPinned}
        onMouseEnter={expandSidebarOnHover}
        onMouseLeave={collapseSidebarAfterHover}
        className={cn(
          "clinic-sidebar desktop-sidebar fixed inset-y-0 start-0 z-30 flex-col border-e border-border",
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
          role={role}
          member={currentMember}
          clinic={clinicInfo}
          notificationCounts={notificationCounts}
        />
      </aside>
      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogContent aria-describedby={undefined} className="mobile-drawer mobile-nav-layer clinic-sidebar !inset-y-0 !start-0 !end-auto !left-auto !top-0 !h-dvh !max-h-none !w-[280px] !max-w-[85vw] !translate-x-0 !translate-y-0 !gap-0 !rounded-none !p-0 !flex !flex-col">
          <DialogTitle className="sr-only">{t("Navigation")}</DialogTitle>
          <SidebarContent active={displayActive} onNavigate={navigate} mobile role={role} member={currentMember} clinic={clinicInfo} notificationCounts={notificationCounts} />
        </DialogContent>
      </Dialog>

      <div
        className={cn(
          sidebarPreferenceReady && "transition-[padding] duration-300 ease-out",
          "desktop-sidebar-offset",
          sidebarPinned ? "desktop-sidebar-offset-expanded" : "desktop-sidebar-offset-collapsed",
        )}
      >
        <header className="clinic-topbar sticky top-0 z-20 flex h-[72px] items-center gap-3 border-b border-border bg-card/95 px-4 backdrop-blur-xl sm:gap-5 sm:px-6 lg:px-8">
          <Button
            variant="ghost"
            size="icon"
            className="mobile-nav-trigger shrink-0"
            onClick={() => setMobileOpen(true)}
            aria-label={t("Open navigation")}
          >
            <Menu />
          </Button>
          <span className="mobile-nav-trigger app-brand shrink-0 text-2xl" data-no-translate>نرجس</span>
          <div className="hidden items-center gap-2 border-e pe-5 text-sm font-semibold xl:flex">
            <span className="size-2 rounded-full bg-primary" />
            <span className="whitespace-nowrap">{displayActive === "dashboard" ? t("Overview") : t(pageMeta[displayActive].title)}</span>
          </div>
          <HeaderSearch patients={patientList} onSelectPatient={openPatientFromSearch} />
          <div className="ms-auto flex items-center gap-1 sm:gap-2">
            <Button variant="ghost" size="sm" onClick={() => setLanguage(language === "en" ? "ar" : "en")} aria-label={language === "en" ? "العربية" : "English"} className="gap-1.5 px-2 text-muted-foreground" data-no-translate>
              <Languages className="size-4" /><span className="text-xs">{language === "en" ? "العربية" : "English"}</span>
            </Button>
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => { setNotificationsOpen((v) => !v); markNotificationsRead(); }}
                aria-expanded={notificationsOpen}
                aria-label={t("Notifications")}
                className="relative"
              >
                <Bell />
                {hasUnreadNotifications && <span className="absolute end-2 top-2 size-2 rounded-full border-2 border-white bg-rose-500" />}
              </Button>
              {notificationsOpen && (
                <div className="absolute end-0 top-12 w-[min(340px,calc(100vw-2rem))] rounded-2xl border border-border bg-overlay p-2 shadow-overlay">
                  <div className="flex items-center justify-between px-3 py-2">
                    <p className="font-semibold">{t("Notifications")}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs font-semibold text-primary"
                      onClick={() => {
                        setNotificationsOpen(false);
                        markNotificationsRead();
                        toast.success(t("Notifications marked as read"));
                      }}
                    >
                      {t("Mark all read")}
                    </Button>
                  </div>
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className="flex gap-3 rounded-xl p-3 hover:bg-slate-50"
                    >
                      <span
                        className={cn(
                          "mt-1.5 size-2 shrink-0 rounded-full",
                          n.tone,
                        )}
                      />
                      <div>
                        <p className="text-sm font-semibold">{n.title}</p>
                        <div className="text-xs text-muted-foreground">{n.detail}</div>
                      </div>
                    </div>
                  ))}
                  {!notifications.length && <p className="px-3 py-6 text-center text-xs text-muted-foreground">{t("No notifications yet.")}</p>}
                </div>
              )}
            </div>
            <div className="hidden h-8 w-px bg-border sm:block" />
            <ProfileControl key={currentUserId} userId={currentUserId} fullName={currentMember?.fullName ?? t("Clinic user")} />
            <WorkstationSwitcher
              members={memberList}
              currentUserId={currentUserId}
              configured={configured}
              onDemoSwitch={(member) => { if (member.userId) setCurrentUserId(member.userId); setClinicRole(member.role); }}
            />
          </div>
        </header>
        <main key={displayActive} className="page-enter mx-auto min-w-0 max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <PageHeader
            title={t(pageMeta[displayActive].title)}
            status={
              <div className="flex items-center gap-3">
                <span className="hidden items-center gap-2 text-xs text-muted-foreground sm:inline-flex"><CalendarDays className="size-4" />{clinicDateLabel(new Date().toISOString(), timeZone, locale, { month: "short", day: "numeric", year: "numeric" })}</span>
                <span className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground">
                  <span className={cn("size-1.5 rounded-full", workspaceBadge.dot)} />
                  {workspaceBadge.label}
                </span>
              </div>
            }
          />
          {loadError && (
            <div role="alert" className="mb-6 flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="font-semibold">{t("Clinic data could not be loaded.")}</p>
                  <p className="text-xs text-rose-700">
                    {loadError === SESSION_UNAVAILABLE ? t(SESSION_UNAVAILABLE) : <span className="break-words" data-no-translate>{loadError}</span>}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => void reloadClinicData()}
                disabled={reloading}
                className="h-11 shrink-0 gap-2 sm:h-9"
              >
                <RefreshCw className={cn("size-4", reloading && "animate-spin")} />
                {reloading ? t("Retrying…") : t("Retry")}
              </Button>
            </div>
          )}
          {!snapshotLoaded && !loadError && <PageSkeleton />}
          {snapshotLoaded && role !== null && (
            <>
          {displayActive === "dashboard" && (
            <DashboardPage
              appointments={appointmentList}
              patients={patientList}
              payments={paymentList}
              sessions={sessionList}
              onNavigate={navigate}
              timeZone={timeZone}
            />
          )}
          {displayActive === "patients" && (
            <PatientsPage
              patients={patientList}
              initialSearch={search}
              onAdd={addPatient}
              appointments={appointmentList}
              clinicianName={currentMember?.fullName ?? t("Clinician")}
              onChartChange={updateToothChart}
              sessions={sessionList}
              role={role}
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
              timeZone={timeZone}
            />
          )}
          {displayActive === "treatments" && (
            <PriceListPage procedures={procedureList} role={role} onChange={setProcedureList} />
          )}
          {displayActive === "payments" && (
            <PaymentsPage
              payments={paymentList}
              clinic={clinicInfo}
              role={role}
              onAdd={addPayment}
              onReverse={reversePaymentEntry}
            />
          )}
          {displayActive === "staff" && <StaffPage members={memberList} role={role} onCreate={createMember} />}
          {displayActive === "inventory" && (
            <InventoryPage
              items={inventoryList}
              onAdd={addInventory}
              onAdjustStock={adjustStock}
              role={role}
              clinic={clinicInfo}
            />
          )}
          {displayActive === "reports" && <ReportsPage payments={paymentList} patients={patientList} appointments={appointmentList} />}
          {displayActive === "settings" && <SettingsPage clinic={clinicInfo} onSaveClinic={saveClinicProfile} role={role} />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
