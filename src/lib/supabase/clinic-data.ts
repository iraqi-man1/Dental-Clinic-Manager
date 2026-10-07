import type {
  Appointment,
  AppLanguage,
  ClinicCurrency,
  ClinicInfo,
  ClinicMember,
  ClinicRole,
  DentalChartState,
  InventoryItem,
  Patient,
  Payment,
  PaymentReceipt,
  ProcedureCatalogItem,
  PurchaseOrder,
  SessionPaymentStatus,
  ToothCondition,
  ToothSurface,
  ToothSurfaceChart,
  TreatmentItemStatus,
  TreatmentPlan,
  TreatmentPlanItem,
  TreatmentSession,
} from "@/lib/types";
import { createId } from "@/lib/ids";
import {
  ageFromDateOfBirth,
  clinicDateKey,
  clinicDateLabel,
  clinicTimeLabel,
  DEFAULT_CLINIC_TIME_ZONE,
  isValidTimeZone,
  resolveClinicTimeZone,
} from "@/lib/clinic-time";
import { iraqiMobileValidationMessage, normalizeIraqiMobileNumber } from "@/lib/utils";
import { createClient, hasSupabaseConfig } from "./client";

export const SESSION_UNAVAILABLE = "Your clinic session is unavailable. Please sign in again.";
export const SAVE_FAILED = "The change could not be saved. Please try again.";
export const DEMO_SESSION_PAYMENT_UNAVAILABLE = "Session payments need a connected clinic workspace.";
export const INVALID_APPOINTMENT_TIME = "Choose a valid appointment time.";
export const INVALID_TIME_ZONE = "Choose a valid time zone.";
export const CLINIC_DEFAULTS_OWNER_ONLY = "Only the clinic owner or an admin can change clinic defaults.";
export const REVERSAL_REASON_REQUIRED = "Enter a reason before reversing this payment.";

/** Appointments are loaded for a bounded window. The calendar only needs this range. */
const APPOINTMENT_WINDOW_DAYS_BACK = 180;
const APPOINTMENT_WINDOW_DAYS_AHEAD = 400;
const DAY_MS = 24 * 60 * 60 * 1000;

export type ActionResult = { ok: boolean; error?: string; id?: string; demo?: boolean };

export type ClinicSnapshot = {
  patients: Patient[];
  appointments: Appointment[];
  payments: Payment[];
  inventory: InventoryItem[];
  sessions: TreatmentSession[];
  procedures: ProcedureCatalogItem[];
  members: ClinicMember[];
  currentUserId: string;
  role: ClinicRole;
  clinic: ClinicInfo;
};

export type LoadResult = { ok: true; snapshot: ClinicSnapshot } | { ok: false; error: string };

/* ----------------------------------------------------------------------------
 * PostgREST row shapes. The client is untyped, so each query result is cast to
 * one of these interfaces at the boundary and mapped to the app types.
 * -------------------------------------------------------------------------- */

/** PostgREST returns numeric columns as numbers or strings depending on precision. */
type Numeric = number | string;

type ClinicRow = {
  name: string;
  phone: string | null;
  email: string | null;
  address: Record<string, string> | null;
  currency: string | null;
  timezone: string | null;
};

type MembershipRow = { clinic_id: string; role: ClinicRole; clinics: ClinicRow | null };

type PersonNameRow = { first_name: string; last_name: string };

type PatientRow = {
  id: string;
  patient_number: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  gender: Patient["gender"] | null;
  phone: string | null;
  email: string | null;
  allergies: string[] | null;
  medical_conditions: string[] | null;
  notes: string | null;
  status: string;
  outstanding_balance: Numeric | null;
  last_visit_at: string | null;
  dental_chart: { tooth_number: number; condition: ToothCondition }[] | null;
  dental_chart_surfaces: { tooth_number: number; surface: ToothSurface; state: DentalChartState }[] | null;
};

type AppointmentRow = {
  id: string;
  patient_id: string;
  provider_id: string | null;
  provider_member_id: string | null;
  procedure_id: string | null;
  doctor_name: string | null;
  title: string;
  starts_at: string;
  ends_at: string;
  room: string | null;
  status: Appointment["status"];
  color: string | null;
  treatment_price: Numeric | null;
  patients: PersonNameRow | null;
};

type TransactionRow = {
  id: string;
  amount: Numeric;
  method: Payment["method"];
  paid_at: string;
  receipt_number: string | null;
  treatment_name_snapshot: string | null;
  original_price_snapshot: Numeric | null;
  amount_due_snapshot: Numeric | null;
  remaining_balance_snapshot: Numeric | null;
  clinic_snapshot: Partial<PaymentReceipt["clinic"]> | null;
  reversed_at: string | null;
};

type InvoiceRow = {
  id: string;
  patient_id: string;
  appointment_id: string | null;
  invoice_number: string | null;
  treatment_name: string | null;
  original_price: Numeric | null;
  total_amount: Numeric;
  discount_amount: Numeric | null;
  status: string;
  created_at: string;
  patients: PersonNameRow | null;
  payments: TransactionRow[] | null;
};

type InventoryRow = {
  id: string;
  name: string;
  category: string;
  sku: string;
  quantity: Numeric;
  reorder_level: Numeric;
  unit: string;
  supplier: string | null;
  expires_at: string | null;
};

/** One payment allocation to a treatment item or session. Reversed payments carry a reversed_at. */
type AllocationRow = { amount: Numeric; payments: { reversed_at: string | null } | null };

type SessionRow = {
  id: string;
  session_number: Numeric;
  status: TreatmentSession["status"];
  scheduled_at: string | null;
  expected_amount: Numeric | null;
  treatment_plan_items: {
    id: string;
    procedure_name: string;
    treatment_plan_id: string;
    treatment_plans: {
      id: string;
      patient_id: string;
      patients: PersonNameRow | null;
    } | null;
  } | null;
  treatment_item_payments: AllocationRow[] | null;
};

type ProcedureRow = {
  id: string;
  code: string | null;
  name: string;
  category: string;
  default_price: Numeric;
  default_sessions: Numeric;
  supports_surfaces: boolean;
  supports_multiple_teeth: boolean;
  is_system: boolean;
  is_active: boolean;
};

type MemberRow = {
  id: string;
  user_id: string | null;
  full_name: string;
  email: string | null;
  role: ClinicRole;
  status: ClinicMember["status"];
  specialty: string | null;
};

type PlanRow = {
  id: string;
  patient_id: string;
  title: string;
  status: TreatmentPlan["status"];
  total_amount: Numeric;
  sessions_total: Numeric;
  sessions_completed: Numeric;
  next_session_at: string | null;
  patients: PersonNameRow | null;
};

type PlanItemRow = {
  id: string;
  treatment_plan_id: string;
  procedure_id: string | null;
  procedure_name: string;
  tooth_number: Numeric | null;
  tooth_numbers: Numeric[] | null;
  surfaces: string[] | null;
  status: TreatmentItemStatus;
  sessions_completed: Numeric;
  sessions_total: Numeric;
  price: Numeric;
  quantity: Numeric;
  discount_amount: Numeric;
  notes: string | null;
  treatment_item_payments: AllocationRow[] | null;
};

type PlanSessionRow = {
  id: string;
  treatment_plan_item_id: string;
  session_number: Numeric;
  status: TreatmentSession["status"];
  scheduled_at: string | null;
  expected_amount: Numeric | null;
  treatment_item_payments: AllocationRow[] | null;
};

type ClinicSupabase = NonNullable<ReturnType<typeof createClient>>;

type ClinicContext = {
  supabase: ClinicSupabase;
  userId: string;
  userEmail?: string;
  clinicId: string;
  role: ClinicRole;
  clinic: ClinicInfo;
  timeZone: string;
};

/* ----------------------------------------------------------------------------
 * Small helpers
 * -------------------------------------------------------------------------- */

function num(value: Numeric | null | undefined): number {
  return value === null || value === undefined ? 0 : Number(value);
}

/** Compares money in whole cents so floating-point sums never flip a status. */
function toCents(value: number): number {
  return Math.round(value * 100);
}

function fullName(first?: string | null, last?: string | null): string {
  return `${first ?? ""} ${last ?? ""}`.trim();
}

function toIsoInstant(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

/** Returns a normalized UTC instant, or null when the value is not a valid date. */
function parseInstant(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function sessionUnavailable(): ActionResult {
  return { ok: false, error: SESSION_UNAVAILABLE };
}

function demoResult(id?: string): ActionResult {
  return { ok: true, demo: true, id: id ?? createId() };
}

/**
 * Used when no clinic context resolved. Demo workspaces (no Supabase config) succeed
 * locally. A configured workspace never reports success without a saved record.
 */
function unavailableResult(id?: string): ActionResult {
  return hasSupabaseConfig() ? sessionUnavailable() : demoResult(id);
}

/** Rows returned by a update(...).select(...) call. Zero rows means nothing was saved. */
function updatedRows(data: unknown): boolean {
  return Array.isArray(data) && data.length > 0;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function paymentStatusFor(paid: number, expected: number): SessionPaymentStatus {
  if (expected > 0 && toCents(paid) >= toCents(expected)) return "Paid";
  return paid > 0 ? "Partially Paid" : "Unpaid";
}

/** Sums allocations, ignoring any payment that was reversed. */
function activeAllocationTotal(allocations: AllocationRow[] | null | undefined): number {
  return (allocations ?? []).reduce(
    (sum, allocation) => (allocation.payments?.reversed_at ? sum : sum + num(allocation.amount)),
    0,
  );
}

function mapClinic(row: ClinicRow): ClinicInfo {
  return {
    name: row.name,
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
    address: row.address ?? {},
    currency: row.currency ?? undefined,
    timezone: resolveClinicTimeZone(row.timezone),
  };
}

async function context(): Promise<ClinicContext | null> {
  const supabase = createClient();
  if (!supabase) return null;
  const currentUser = (await supabase.auth.getUser()).data.user;
  if (!currentUser) return null;
  const { data, error } = await supabase
    .from("clinic_members")
    .select("clinic_id, role, clinics(name,phone,email,address,currency,timezone)")
    .eq("user_id", currentUser.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  // The embedded clinic is a many-to-one relation, so PostgREST returns one object. The client
  // infers an array from the select string, which is why the cast goes through unknown.
  const membership = data as unknown as MembershipRow;
  if (!membership.clinics) return null;
  const clinic = mapClinic(membership.clinics);
  return {
    supabase,
    userId: currentUser.id,
    userEmail: currentUser.email,
    clinicId: membership.clinic_id,
    role: membership.role,
    clinic,
    timeZone: clinic.timezone ?? DEFAULT_CLINIC_TIME_ZONE,
  };
}

/* ----------------------------------------------------------------------------
 * Row mappers
 * -------------------------------------------------------------------------- */

function mapPatient(row: PatientRow, timeZone: string): Patient {
  const dateOfBirth = row.date_of_birth ?? undefined;
  return {
    id: row.id,
    patientNo: row.patient_number,
    name: fullName(row.first_name, row.last_name),
    initials: `${row.first_name?.[0] ?? ""}${row.last_name?.[0] ?? ""}`,
    dateOfBirth,
    age: ageFromDateOfBirth(dateOfBirth, timeZone),
    gender: row.gender ?? "Other",
    phone: row.phone ?? "",
    email: row.email ?? "",
    lastVisit: row.last_visit_at ? clinicDateLabel(row.last_visit_at, timeZone, "en-US") : "New patient",
    nextVisit: undefined,
    status: row.status === "inactive" ? "Inactive" : "Active",
    allergies: row.allergies ?? [],
    conditions: row.medical_conditions ?? [],
    notes: row.notes ?? "",
    balance: num(row.outstanding_balance),
    avatarColor: "bg-teal-100 text-teal-700",
    toothChart: Object.fromEntries(
      (row.dental_chart ?? []).map((tooth) => [tooth.tooth_number, tooth.condition]),
    ) as Record<number, ToothCondition>,
    toothSurfaces: (row.dental_chart_surfaces ?? []).reduce<ToothSurfaceChart>(
      (chart, surface) => ({
        ...chart,
        [surface.tooth_number]: {
          ...(chart[surface.tooth_number] ?? {}),
          [surface.surface]: surface.state,
        },
      }),
      {},
    ),
  };
}

function mapAppointment(row: AppointmentRow, timeZone: string): Appointment {
  return {
    id: row.id,
    patientId: row.patient_id,
    patientName: fullName(row.patients?.first_name, row.patients?.last_name),
    startsAt: toIsoInstant(row.starts_at),
    endsAt: toIsoInstant(row.ends_at),
    date: clinicDateKey(row.starts_at, timeZone),
    time: clinicTimeLabel(row.starts_at, timeZone, "en-US"),
    endTime: clinicTimeLabel(row.ends_at, timeZone, "en-US"),
    treatment: row.title,
    procedureId: row.procedure_id ?? undefined,
    treatmentPrice: num(row.treatment_price),
    doctor: row.doctor_name ?? "Assigned dentist",
    providerId: row.provider_id ?? undefined,
    providerMemberId: row.provider_member_id ?? undefined,
    room: row.room ?? "Room 1",
    status: row.status,
    color: row.color ?? "#0f9f8f",
  };
}

/** Active transactions only, newest first. Reversed payments never reach the UI. */
function activeTransactions(rows: TransactionRow[] | null | undefined): TransactionRow[] {
  return (rows ?? [])
    .filter((transaction) => !transaction.reversed_at)
    .sort((a, b) => Date.parse(b.paid_at) - Date.parse(a.paid_at));
}

function receiptClinic(snapshot: Partial<PaymentReceipt["clinic"]> | null, clinic: ClinicInfo): PaymentReceipt["clinic"] {
  if (snapshot?.name) return snapshot as PaymentReceipt["clinic"];
  return {
    name: clinic.name,
    phone: clinic.phone,
    email: clinic.email,
    address: clinic.address,
    currency: clinic.currency,
  };
}

function mapInvoice(row: InvoiceRow, timeZone: string, clinic: ClinicInfo): Payment {
  const transactions = activeTransactions(row.payments);
  const paid = transactions.reduce((sum, transaction) => sum + num(transaction.amount), 0);
  const total = num(row.total_amount);
  const discount = num(row.discount_amount);
  const receipts: PaymentReceipt[] = transactions
    .filter((transaction) => transaction.receipt_number)
    .map((transaction) => ({
      id: transaction.id,
      receiptNumber: transaction.receipt_number ?? "",
      amount: num(transaction.amount),
      date: clinicDateLabel(transaction.paid_at, timeZone, "en-US"),
      method: transaction.method,
      treatment: transaction.treatment_name_snapshot ?? row.treatment_name ?? "Treatment",
      originalPrice: num(transaction.original_price_snapshot ?? row.original_price ?? row.total_amount),
      amountDue: num(transaction.amount_due_snapshot ?? row.total_amount),
      remaining: num(transaction.remaining_balance_snapshot),
      clinic: receiptClinic(transaction.clinic_snapshot, clinic),
    }));
  const latest = transactions[0];
  const isPaid = toCents(paid) >= toCents(total - discount);
  return {
    id: row.id,
    patientId: row.patient_id,
    appointmentId: row.appointment_id ?? undefined,
    invoice: row.invoice_number ?? "—",
    patientName: fullName(row.patients?.first_name, row.patients?.last_name),
    treatment: row.treatment_name ?? "Treatment",
    originalPrice: num(row.original_price ?? row.total_amount),
    date: clinicDateLabel(latest?.paid_at ?? row.created_at, timeZone, "en-US"),
    total,
    paid,
    discount,
    method: latest?.method ?? "Cash",
    status: row.status === "overdue" ? "Overdue" : isPaid ? "Paid" : paid > 0 ? "Partial" : "Unpaid",
    receiptNumber: latest?.receipt_number ?? undefined,
    lastPaymentAmount: latest ? num(latest.amount) : undefined,
    receipts,
  };
}

function mapInventory(row: InventoryRow): InventoryItem {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    sku: row.sku,
    stock: num(row.quantity),
    minimum: num(row.reorder_level),
    unit: row.unit,
    supplier: row.supplier ?? "",
    // expires_at is a calendar date. Noon UTC keeps the month stable in every zone.
    expiry: row.expires_at
      ? clinicDateLabel(`${row.expires_at}T12:00:00.000Z`, "UTC", "en-US", { month: "short", year: "numeric" })
      : undefined,
  };
}

function mapSession(row: SessionRow): TreatmentSession {
  const item = row.treatment_plan_items;
  const plan = item?.treatment_plans;
  const amountPaid = activeAllocationTotal(row.treatment_item_payments);
  const expectedAmount = num(row.expected_amount);
  return {
    id: row.id,
    itemId: item?.id ?? "",
    planId: plan?.id ?? "",
    patientId: plan?.patient_id ?? "",
    patientName: fullName(plan?.patients?.first_name, plan?.patients?.last_name),
    procedureName: item?.procedure_name ?? "Treatment session",
    sessionNumber: num(row.session_number),
    status: row.status,
    scheduledAt: row.scheduled_at ?? undefined,
    expectedAmount,
    amountPaid,
    remaining: Math.max(0, expectedAmount - amountPaid),
    paymentStatus: paymentStatusFor(amountPaid, expectedAmount),
  };
}

function mapProcedure(row: ProcedureRow): ProcedureCatalogItem {
  return {
    id: row.id,
    code: row.code ?? undefined,
    name: row.name,
    category: row.category,
    defaultPrice: num(row.default_price),
    defaultSessions: num(row.default_sessions),
    supportsSurfaces: Boolean(row.supports_surfaces),
    supportsMultipleTeeth: Boolean(row.supports_multiple_teeth),
    isSystem: Boolean(row.is_system),
    isActive: Boolean(row.is_active),
  };
}

function mapMember(row: MemberRow, fallbackEmail?: string): ClinicMember {
  return {
    id: row.id,
    userId: row.user_id ?? undefined,
    fullName: row.full_name,
    email: row.email ?? fallbackEmail,
    role: row.role,
    status: row.status,
    specialty: row.specialty ?? undefined,
  };
}

function mapPlanSession(row: PlanSessionRow, itemId: string, planId: string, procedureName: string): TreatmentSession {
  const sessionPaid = activeAllocationTotal(row.treatment_item_payments);
  const expectedAmount = num(row.expected_amount);
  return {
    id: row.id,
    itemId,
    planId,
    patientId: "",
    patientName: "",
    procedureName,
    sessionNumber: num(row.session_number),
    status: row.status,
    scheduledAt: row.scheduled_at ?? undefined,
    expectedAmount,
    amountPaid: sessionPaid,
    remaining: Math.max(0, expectedAmount - sessionPaid),
    paymentStatus: paymentStatusFor(sessionPaid, expectedAmount),
  };
}

function mapPlanItem(row: PlanItemRow, sessions: PlanSessionRow[]): TreatmentPlanItem {
  const finalPrice = Math.max(0, num(row.price) * num(row.quantity) - num(row.discount_amount));
  // Paid amounts come only from active allocations. Reversed payments are excluded.
  const amountPaid = activeAllocationTotal(row.treatment_item_payments);
  const toothNumbers =
    row.tooth_numbers && row.tooth_numbers.length > 0
      ? row.tooth_numbers.map(Number)
      : row.tooth_number
        ? [Number(row.tooth_number)]
        : [];
  return {
    id: row.id,
    planId: row.treatment_plan_id,
    procedureId: row.procedure_id ?? undefined,
    procedureName: row.procedure_name,
    toothNumbers,
    surfaces: (row.surfaces ?? []) as ToothSurface[],
    status: row.status,
    sessionsDone: num(row.sessions_completed),
    sessionsTotal: num(row.sessions_total),
    price: num(row.price) * num(row.quantity),
    discount: num(row.discount_amount),
    finalPrice,
    amountPaid,
    remaining: Math.max(0, finalPrice - amountPaid),
    notes: row.notes ?? undefined,
    sessions: sessions.map((session) => mapPlanSession(session, row.id, row.treatment_plan_id, row.procedure_name)),
  };
}

/* ----------------------------------------------------------------------------
 * Loaders
 * -------------------------------------------------------------------------- */

/**
 * Loads the full clinic workspace. Returns an error (never null) when the session is
 * missing or any query fails. Callers must not call this in demo mode.
 */
export async function loadClinicData(): Promise<LoadResult> {
  try {
    const ctx = await context();
    if (!ctx) return { ok: false, error: SESSION_UNAVAILABLE };
    const { timeZone } = ctx;
    const now = Date.now();
    const windowStart = new Date(now - APPOINTMENT_WINDOW_DAYS_BACK * DAY_MS).toISOString();
    const windowEnd = new Date(now + APPOINTMENT_WINDOW_DAYS_AHEAD * DAY_MS).toISOString();

    const [
      patientsResult,
      appointmentsResult,
      invoicesResult,
      inventoryResult,
      sessionsResult,
      proceduresResult,
      membersResult,
    ] = await Promise.all([
      ctx.supabase
        .from("patients")
        .select("*, dental_chart(tooth_number, condition), dental_chart_surfaces(tooth_number,surface,state)")
        .order("created_at", { ascending: false }),
      // Bounded window: the calendar only needs appointments from 180 days ago to 400 days ahead.
      ctx.supabase
        .from("appointments")
        .select("*, patients(first_name,last_name)")
        .gte("starts_at", windowStart)
        .lt("starts_at", windowEnd)
        .order("starts_at"),
      // Invoices, payments, and inventory load in full.
      ctx.supabase
        .from("invoices")
        .select(
          "*, patients(first_name,last_name), payments(id,amount,method,paid_at,receipt_number,treatment_name_snapshot,original_price_snapshot,amount_due_snapshot,remaining_balance_snapshot,clinic_snapshot,reversed_at)",
        )
        .order("created_at", { ascending: false }),
      ctx.supabase.from("inventory_items").select("*").order("name"),
      ctx.supabase
        .from("treatment_sessions")
        .select(
          "*, treatment_plan_items!inner(id,procedure_name,treatment_plan_id,treatment_plans!inner(id,patient_id,patients!inner(first_name,last_name))), treatment_item_payments(amount, payments(reversed_at))",
        )
        .neq("status", "cancelled")
        .order("session_number"),
      ctx.supabase.from("procedure_catalog").select("*").eq("is_active", true).order("category").order("name"),
      ctx.supabase.from("clinic_members").select("id,user_id,full_name,email,role,status,specialty").order("full_name"),
    ]);

    const failure = [
      patientsResult,
      appointmentsResult,
      invoicesResult,
      inventoryResult,
      sessionsResult,
      proceduresResult,
      membersResult,
    ].find((result) => result.error);
    if (failure?.error) return { ok: false, error: failure.error.message };

    const patients = ((patientsResult.data ?? []) as PatientRow[]).map((row) => mapPatient(row, timeZone));
    const appointments = ((appointmentsResult.data ?? []) as AppointmentRow[]).map((row) =>
      mapAppointment(row, timeZone),
    );
    const payments = ((invoicesResult.data ?? []) as InvoiceRow[]).map((row) =>
      mapInvoice(row, timeZone, ctx.clinic),
    );
    const inventory = ((inventoryResult.data ?? []) as InventoryRow[]).map(mapInventory);
    const sessions = ((sessionsResult.data ?? []) as SessionRow[]).map(mapSession);
    const procedures = ((proceduresResult.data ?? []) as ProcedureRow[]).map(mapProcedure);
    const members = ((membersResult.data ?? []) as MemberRow[]).map((row) =>
      mapMember(row, row.user_id === ctx.userId ? ctx.userEmail : undefined),
    );

    return {
      ok: true,
      snapshot: {
        patients,
        appointments,
        payments,
        inventory,
        sessions,
        procedures,
        members,
        currentUserId: ctx.userId,
        role: ctx.role,
        clinic: ctx.clinic,
      },
    };
  } catch (error) {
    return { ok: false, error: errorMessage(error, SESSION_UNAVAILABLE) };
  }
}

export async function loadTreatmentPlanningData() {
  const ctx = await context();
  if (!ctx) return null;
  const { timeZone } = ctx;
  const [catalogResult, plansResult, itemsResult, sessionsResult] = await Promise.all([
    ctx.supabase.from("procedure_catalog").select("*").eq("is_active", true).order("category").order("name"),
    ctx.supabase
      .from("treatment_plans")
      .select("*, patients(first_name,last_name)")
      .order("updated_at", { ascending: false }),
    ctx.supabase
      .from("treatment_plan_items")
      .select("*, treatment_item_payments(amount, payments(reversed_at))")
      .order("created_at"),
    ctx.supabase
      .from("treatment_sessions")
      .select("*, treatment_item_payments(amount, payments(reversed_at))")
      .order("session_number"),
  ]);
  if (catalogResult.error || plansResult.error || itemsResult.error || sessionsResult.error) return null;

  const catalog = ((catalogResult.data ?? []) as ProcedureRow[]).map(mapProcedure);

  const sessionsByItem = new Map<string, PlanSessionRow[]>();
  for (const session of (sessionsResult.data ?? []) as PlanSessionRow[]) {
    const bucket = sessionsByItem.get(session.treatment_plan_item_id) ?? [];
    bucket.push(session);
    sessionsByItem.set(session.treatment_plan_item_id, bucket);
  }
  const items = ((itemsResult.data ?? []) as PlanItemRow[]).map((row) =>
    mapPlanItem(row, sessionsByItem.get(row.id) ?? []),
  );
  const itemsByPlan = new Map<string, TreatmentPlanItem[]>();
  for (const item of items) {
    const bucket = itemsByPlan.get(item.planId) ?? [];
    bucket.push(item);
    itemsByPlan.set(item.planId, bucket);
  }

  const plans = ((plansResult.data ?? []) as PlanRow[]).map((row): TreatmentPlan => {
    const planItems = itemsByPlan.get(row.id) ?? [];
    const totalSessions = planItems.length
      ? planItems.reduce((sum, item) => sum + item.sessionsTotal, 0)
      : num(row.sessions_total);
    const completedSessions = planItems.length
      ? planItems.reduce((sum, item) => sum + item.sessionsDone, 0)
      : num(row.sessions_completed);
    return {
      id: row.id,
      patientId: row.patient_id,
      patientName: fullName(row.patients?.first_name, row.patients?.last_name),
      title: row.title,
      procedures: planItems.map((item) => item.procedureName),
      total: num(row.total_amount),
      sessionsDone: completedSessions,
      sessionsTotal: totalSessions,
      progress: totalSessions ? Math.round((completedSessions / totalSessions) * 100) : 0,
      status: row.status,
      nextSession: row.next_session_at
        ? clinicDateLabel(row.next_session_at, timeZone, "en-US", { month: "short", day: "2-digit" })
        : undefined,
      items: planItems,
    };
  });
  return { catalog, plans };
}

/* ----------------------------------------------------------------------------
 * Patients and charting
 * -------------------------------------------------------------------------- */

export async function persistPatient(patient: Patient): Promise<ActionResult> {
  const phone = normalizeIraqiMobileNumber(patient.phone);
  if (!phone) return { ok: false, error: iraqiMobileValidationMessage };
  const ctx = await context();
  if (!ctx) return unavailableResult(patient.id);
  // The balance is never sent. Payments own it. Date of birth is stored as entered.
  const { data, error } = await ctx.supabase.rpc("create_patient", {
    p_clinic_id: ctx.clinicId,
    p_patient_id: patient.id,
    p_patient_number: patient.patientNo,
    p_full_name: patient.name.trim(),
    p_phone: phone,
    p_email: patient.email.trim() || null,
    p_date_of_birth: patient.dateOfBirth || null,
    p_gender: patient.gender,
    p_allergies: patient.allergies,
    p_medical_conditions: patient.conditions,
    p_notes: patient.notes,
    p_status: patient.status.toLowerCase(),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: typeof data === "string" ? data : patient.id };
}

export async function persistToothChart(
  patientId: string,
  chart: Record<number, ToothCondition>,
  surfaces?: ToothSurfaceChart,
): Promise<ActionResult> {
  const ctx = await context();
  if (!ctx) return unavailableResult(patientId);
  const rows = Object.entries(chart).map(([tooth, condition]) => ({
    clinic_id: ctx.clinicId,
    patient_id: patientId,
    tooth_number: Number(tooth),
    condition,
  }));
  if (rows.length) {
    const { error } = await ctx.supabase
      .from("dental_chart")
      .upsert(rows, { onConflict: "patient_id,tooth_number" });
    if (error) return { ok: false, error: error.message };
  }
  const surfaceRows = Object.entries(surfaces ?? {}).flatMap(([toothNumber, toothSurfaces]) =>
    Object.entries(toothSurfaces ?? {})
      .filter((entry): entry is [string, DentalChartState] => Boolean(entry[1]))
      .map(([surface, state]) => ({
        clinic_id: ctx.clinicId,
        patient_id: patientId,
        tooth_number: Number(toothNumber),
        surface,
        state,
      })),
  );
  if (!surfaceRows.length) return { ok: true, id: patientId };
  const { error: surfaceError } = await ctx.supabase
    .from("dental_chart_surfaces")
    .upsert(surfaceRows, { onConflict: "patient_id,tooth_number,surface" });
  return surfaceError ? { ok: false, error: surfaceError.message } : { ok: true, id: patientId };
}

/* ----------------------------------------------------------------------------
 * Treatment planning
 * -------------------------------------------------------------------------- */

export type SaveOdontogramItemInput = {
  patientId: string;
  planId?: string;
  planTitle: string;
  procedureId?: string;
  procedureName: string;
  toothNumbers: number[];
  surfaces: ToothSurface[];
  chartState: DentalChartState;
  status: TreatmentItemStatus;
  price: number;
  discount: number;
  sessionsTotal: number;
  notes?: string;
};

export async function saveOdontogramPlanItem(
  input: SaveOdontogramItemInput,
): Promise<ActionResult & { itemId?: string }> {
  const ctx = await context();
  if (!ctx) return hasSupabaseConfig() ? sessionUnavailable() : { ...demoResult(), itemId: createId() };
  const { data, error } = await ctx.supabase.rpc("save_odontogram_plan_item", {
    p_clinic_id: ctx.clinicId,
    p_patient_id: input.patientId,
    p_plan_id: input.planId ?? null,
    p_plan_title: input.planTitle,
    p_procedure_id: input.procedureId ?? null,
    p_procedure_name: input.procedureName,
    p_tooth_numbers: input.toothNumbers,
    p_surfaces: input.surfaces,
    p_chart_state: input.chartState,
    p_status: input.status,
    p_price: input.price,
    p_discount_amount: input.discount,
    p_sessions_total: input.sessionsTotal,
    p_notes: input.notes ?? null,
  });
  if (error) return { ok: false, error: error.message };
  const saved = (Array.isArray(data) ? data[0] : data) as { treatment_plan_item_id?: string } | null;
  const itemId = saved?.treatment_plan_item_id;
  return itemId ? { ok: true, itemId } : { ok: false, error: SAVE_FAILED };
}

export async function createTreatmentPlan(patientId: string, title: string, totalAmount: number): Promise<ActionResult> {
  const ctx = await context();
  if (!ctx) return unavailableResult();
  const { data, error } = await ctx.supabase.rpc("create_treatment_plan_with_price", {
    p_clinic_id: ctx.clinicId,
    p_patient_id: patientId,
    p_title: title,
    p_total_amount: totalAmount,
  });
  if (error) return { ok: false, error: error.message };
  return typeof data === "string" ? { ok: true, id: data } : { ok: false, error: SAVE_FAILED };
}

export async function updateTreatmentPlan(
  planId: string,
  input: { title: string; status: TreatmentPlan["status"] },
): Promise<ActionResult> {
  const ctx = await context();
  if (!ctx) return unavailableResult(planId);
  const { data, error } = await ctx.supabase
    .from("treatment_plans")
    .update({ title: input.title.trim(), status: input.status })
    .eq("clinic_id", ctx.clinicId)
    .eq("id", planId)
    .select("id");
  if (error) return { ok: false, error: error.message };
  return updatedRows(data) ? { ok: true, id: planId } : { ok: false, error: SAVE_FAILED };
}

/* ----------------------------------------------------------------------------
 * Procedure catalog
 * -------------------------------------------------------------------------- */

export async function persistProcedureCatalogItem(
  procedure: Omit<ProcedureCatalogItem, "isSystem" | "isActive">,
): Promise<ActionResult> {
  const ctx = await context();
  if (!ctx) return unavailableResult(procedure.id);
  // Only editable columns are sent on update. is_system and is_active are never written here.
  const editable = {
    code: procedure.code ?? null,
    name: procedure.name,
    category: procedure.category,
    default_price: procedure.defaultPrice,
    default_sessions: procedure.defaultSessions,
    supports_surfaces: procedure.supportsSurfaces,
    supports_multiple_teeth: procedure.supportsMultipleTeeth,
  };
  if (procedure.id.startsWith("demo-")) {
    // Client-created procedures carry a "demo-" id until the database assigns one.
    const { data, error } = await ctx.supabase
      .from("procedure_catalog")
      .insert({ ...editable, clinic_id: ctx.clinicId, is_system: false, is_active: true })
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };
    return typeof data?.id === "string" ? { ok: true, id: data.id } : { ok: false, error: SAVE_FAILED };
  }
  const { data, error } = await ctx.supabase
    .from("procedure_catalog")
    .update(editable)
    .eq("id", procedure.id)
    .eq("clinic_id", ctx.clinicId)
    .select("id");
  if (error) return { ok: false, error: error.message };
  return updatedRows(data) ? { ok: true, id: procedure.id } : { ok: false, error: SAVE_FAILED };
}

export async function archiveProcedureCatalogItem(procedureId: string): Promise<ActionResult> {
  const ctx = await context();
  if (!ctx) return unavailableResult(procedureId);
  const { data, error } = await ctx.supabase
    .from("procedure_catalog")
    .update({ is_active: false })
    .eq("clinic_id", ctx.clinicId)
    .eq("id", procedureId)
    .select("id");
  if (error) return { ok: false, error: error.message };
  return updatedRows(data) ? { ok: true, id: procedureId } : { ok: false, error: SAVE_FAILED };
}

/* ----------------------------------------------------------------------------
 * Sessions and session payments
 * -------------------------------------------------------------------------- */

export async function recordTreatmentSession(itemId: string): Promise<ActionResult> {
  const ctx = await context();
  if (!ctx) return unavailableResult(itemId);
  const { data, error } = await ctx.supabase.rpc("record_treatment_session", {
    p_clinic_id: ctx.clinicId,
    p_item_id: itemId,
  });
  if (error) return { ok: false, error: error.message };
  return data === true ? { ok: true, id: itemId } : { ok: false, error: SAVE_FAILED };
}

export async function completeTreatmentSession(sessionId: string): Promise<ActionResult> {
  const ctx = await context();
  if (!ctx) return unavailableResult(sessionId);
  const { data, error } = await ctx.supabase.rpc("complete_treatment_session", {
    p_clinic_id: ctx.clinicId,
    p_session_id: sessionId,
  });
  if (error) return { ok: false, error: error.message };
  return data === true ? { ok: true, id: sessionId } : { ok: false, error: SAVE_FAILED };
}

export async function setTreatmentSessionPrices(itemId: string, amounts: number[]): Promise<ActionResult> {
  const ctx = await context();
  if (!ctx) return unavailableResult(itemId);
  const { data, error } = await ctx.supabase.rpc("set_treatment_session_prices", {
    p_clinic_id: ctx.clinicId,
    p_item_id: itemId,
    p_expected_amounts: amounts,
  });
  if (error) return { ok: false, error: error.message };
  return data === true ? { ok: true, id: itemId } : { ok: false, error: SAVE_FAILED };
}

export async function recordSessionPayment(input: {
  sessionId: string;
  mode: "full" | "partial" | "not_paid";
  amount?: number;
  method: Payment["method"];
  reference?: string;
}): Promise<ActionResult & { paymentId?: string }> {
  // Session payments write allocations and invoices, so they need a real workspace.
  if (!hasSupabaseConfig()) return { ok: false, error: DEMO_SESSION_PAYMENT_UNAVAILABLE };
  const ctx = await context();
  if (!ctx) return sessionUnavailable();
  const { data, error } = await ctx.supabase.rpc("record_session_payment", {
    p_clinic_id: ctx.clinicId,
    p_session_id: input.sessionId,
    p_payment_mode: input.mode,
    p_amount: input.amount ?? null,
    p_method: input.method,
    p_reference: input.reference ?? null,
  });
  if (error) return { ok: false, error: error.message };
  const paymentId = typeof data === "string" ? data : undefined;
  // "not_paid" records nothing by design, so it has no payment id.
  if (!paymentId && input.mode !== "not_paid") return { ok: false, error: SAVE_FAILED };
  return { ok: true, paymentId };
}

/* ----------------------------------------------------------------------------
 * Appointments
 * -------------------------------------------------------------------------- */

export async function rescheduleAppointment(
  appointmentId: string,
  startsAt: string,
  endsAt: string,
): Promise<ActionResult> {
  const start = parseInstant(startsAt);
  const end = parseInstant(endsAt);
  if (!start || !end) return { ok: false, error: INVALID_APPOINTMENT_TIME };
  const ctx = await context();
  if (!ctx) return unavailableResult(appointmentId);
  const { data, error } = await ctx.supabase.rpc("reschedule_appointment", {
    p_clinic_id: ctx.clinicId,
    p_appointment_id: appointmentId,
    p_starts_at: start,
    p_ends_at: end,
  });
  if (error) return { ok: false, error: error.message };
  return data === true ? { ok: true, id: appointmentId } : { ok: false, error: SAVE_FAILED };
}

export async function persistAppointment(item: Appointment): Promise<ActionResult & { invoiceId?: string }> {
  // Scheduling uses the instants only. Display labels are never parsed back into dates.
  const startsAt = parseInstant(item.startsAt);
  const endsAt = parseInstant(item.endsAt);
  if (!startsAt || !endsAt) return { ok: false, error: INVALID_APPOINTMENT_TIME };
  const ctx = await context();
  if (!ctx) return hasSupabaseConfig() ? sessionUnavailable() : { ok: true, demo: true };
  const { data, error } = await ctx.supabase.rpc("create_appointment_with_invoice_for_member", {
    p_clinic_id: ctx.clinicId,
    p_appointment_id: item.id,
    p_patient_id: item.patientId,
    p_provider_member_id: item.providerMemberId ?? null,
    p_procedure_id: item.procedureId ?? null,
    p_treatment_name: item.treatment,
    p_treatment_price: item.treatmentPrice,
    p_starts_at: startsAt,
    p_ends_at: endsAt,
    p_room: item.room,
    p_color: item.color,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, invoiceId: typeof data === "string" ? data : undefined };
}

/* ----------------------------------------------------------------------------
 * Inventory and purchasing
 * -------------------------------------------------------------------------- */

export async function persistInventoryItem(item: InventoryItem): Promise<ActionResult> {
  const ctx = await context();
  if (!ctx) return unavailableResult(item.id);
  const { data, error } = await ctx.supabase.rpc("create_inventory_item", {
    p_clinic_id: ctx.clinicId,
    p_name: item.name,
    p_category: item.category,
    p_sku: item.sku,
    p_quantity: item.stock,
    p_reorder_level: item.minimum,
    p_unit: item.unit,
    p_supplier: item.supplier,
  });
  if (error) return { ok: false, error: error.message };
  return typeof data === "string" ? { ok: true, id: data } : { ok: false, error: SAVE_FAILED };
}

/** Stock changes go through a movement row. Purchase orders never change quantities. */
export async function adjustInventoryStock(input: {
  itemId: string;
  delta: number;
  reason: string;
}): Promise<ActionResult & { quantity?: number }> {
  const ctx = await context();
  if (!ctx) return unavailableResult(input.itemId);
  const { data, error } = await ctx.supabase.rpc("adjust_inventory_stock", {
    p_clinic_id: ctx.clinicId,
    p_item_id: input.itemId,
    p_delta: input.delta,
    p_reason: input.reason.trim(),
  });
  if (error) return { ok: false, error: error.message };
  if (data === null || data === undefined) return { ok: false, error: SAVE_FAILED };
  return { ok: true, id: input.itemId, quantity: num(data) };
}

export async function persistPurchaseOrder(order: PurchaseOrder): Promise<ActionResult> {
  const ctx = await context();
  if (!ctx) return unavailableResult(order.id);
  const { data, error } = await ctx.supabase.rpc("create_purchase_order", {
    p_clinic_id: ctx.clinicId,
    p_order_number: order.orderNumber,
    p_order_date: order.orderDate,
    p_supplier_name: order.supplierName ?? "",
    p_supplier_contact: order.supplierContact ?? "",
    p_delivery_address: order.deliveryAddress ?? "",
    p_notes: order.notes ?? "",
    p_items: order.items,
  });
  if (error) return { ok: false, error: error.message };
  return typeof data === "string" ? { ok: true, id: data } : { ok: false, error: SAVE_FAILED };
}

/* ----------------------------------------------------------------------------
 * Payments
 * -------------------------------------------------------------------------- */

export async function persistPayment(input: {
  invoiceId: string;
  amount: number;
  method: Payment["method"];
  reference?: string;
}): Promise<ActionResult & { paymentId?: string }> {
  const ctx = await context();
  if (!ctx) return hasSupabaseConfig() ? sessionUnavailable() : { ok: true, demo: true, paymentId: createId() };
  const { data, error } = await ctx.supabase.rpc("record_appointment_payment", {
    p_clinic_id: ctx.clinicId,
    p_invoice_id: input.invoiceId,
    p_amount: input.amount,
    p_method: input.method,
    p_reference: input.reference ?? null,
  });
  if (error) return { ok: false, error: error.message };
  return typeof data === "string" ? { ok: true, paymentId: data } : { ok: false, error: SAVE_FAILED };
}

/** Reverses a payment. The database enforces the role, the reason, and that a payment is reversed once. */
export async function reversePayment(input: { paymentId: string; reason: string }): Promise<ActionResult> {
  const reason = input.reason.trim();
  if (!reason) return { ok: false, error: REVERSAL_REASON_REQUIRED };
  const ctx = await context();
  if (!ctx) return unavailableResult(input.paymentId);
  const { data, error } = await ctx.supabase.rpc("reverse_payment", {
    p_clinic_id: ctx.clinicId,
    p_payment_id: input.paymentId,
    p_reason: reason,
  });
  if (error) return { ok: false, error: error.message };
  return data === true ? { ok: true, id: input.paymentId } : { ok: false, error: SAVE_FAILED };
}

/* ----------------------------------------------------------------------------
 * Staff, clinic profile, and preferences
 * -------------------------------------------------------------------------- */

export async function createClinicMember(input: {
  fullName: string;
  email?: string;
  role: "dentist" | "front_desk";
  specialty?: string;
}): Promise<ActionResult & { member?: ClinicMember }> {
  const ctx = await context();
  if (!ctx) {
    if (hasSupabaseConfig()) return sessionUnavailable();
    const demoId = createId();
    return {
      ok: true,
      demo: true,
      id: demoId,
      member: {
        id: demoId,
        fullName: input.fullName.trim(),
        email: input.email?.trim().toLowerCase() || undefined,
        role: input.role,
        status: "active",
        specialty: input.specialty?.trim() || undefined,
      },
    };
  }
  const { data, error } = await ctx.supabase
    .from("clinic_members")
    .insert({
      clinic_id: ctx.clinicId,
      user_id: null,
      full_name: input.fullName.trim(),
      email: input.email?.trim().toLowerCase() || null,
      role: input.role,
      status: "active",
      specialty: input.specialty?.trim() || null,
    })
    .select("id,user_id,full_name,email,role,status,specialty")
    .single();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: SAVE_FAILED };
  const member = mapMember(data as MemberRow);
  return { ok: true, id: member.id, member };
}

export async function persistClinicProfile(clinic: ClinicInfo): Promise<ActionResult> {
  const timezone = clinic.timezone?.trim() || undefined;
  if (timezone && !isValidTimeZone(timezone)) return { ok: false, error: INVALID_TIME_ZONE };
  const ctx = await context();
  if (!ctx) return unavailableResult();
  const values: Record<string, unknown> = {
    name: clinic.name.trim(),
    phone: clinic.phone?.trim() || null,
    email: clinic.email?.trim() || null,
    address: clinic.address ?? {},
  };
  if (timezone) values.timezone = timezone;
  const { data, error } = await ctx.supabase
    .from("clinics")
    .update(values)
    .eq("id", ctx.clinicId)
    .select("id");
  if (error) return { ok: false, error: error.message };
  return updatedRows(data) ? { ok: true, id: ctx.clinicId } : { ok: false, error: SAVE_FAILED };
}

export async function uploadPatientFile(patientId: string, file: File): Promise<ActionResult> {
  const ctx = await context();
  if (!ctx) return unavailableResult(patientId);
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const path = `${ctx.clinicId}/${patientId}/${createId()}-${safeName}`;
  const { error: uploadError } = await ctx.supabase.storage
    .from("clinical-files")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) return { ok: false, error: uploadError.message };
  const { error: metadataError } = await ctx.supabase.from("patient_files").insert({
    clinic_id: ctx.clinicId,
    patient_id: patientId,
    storage_path: path,
    file_name: file.name,
    mime_type: file.type,
    file_size: file.size,
    uploaded_by: ctx.userId,
  });
  if (metadataError) {
    // Remove the orphaned object so storage matches the metadata. Best effort.
    void ctx.supabase.storage.from("clinical-files").remove([path]);
    return { ok: false, error: metadataError.message };
  }
  return { ok: true, id: path };
}

export async function loadClinicPreferences(): Promise<{ language: AppLanguage; currency: ClinicCurrency } | null> {
  const ctx = await context();
  if (!ctx) return null;
  const { data, error } = await ctx.supabase
    .from("clinic_settings")
    .select("language")
    .eq("clinic_id", ctx.clinicId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    language: (data.language ?? "en") as AppLanguage,
    currency: (ctx.clinic.currency === "IQD" ? "IQD" : "USD") as ClinicCurrency,
  };
}

/** Writes the clinic-wide default language and currency. Owner and admin only. */
export async function persistClinicPreferences(
  language: AppLanguage,
  currency?: ClinicCurrency,
): Promise<ActionResult> {
  const ctx = await context();
  if (!ctx) return unavailableResult();
  if (ctx.role !== "owner" && ctx.role !== "admin") return { ok: false, error: CLINIC_DEFAULTS_OWNER_ONLY };
  const { error } = await ctx.supabase
    .from("clinic_settings")
    .upsert({ clinic_id: ctx.clinicId, language }, { onConflict: "clinic_id" });
  if (error) return { ok: false, error: error.message };
  if (!currency) return { ok: true, id: ctx.clinicId };
  const { data, error: clinicError } = await ctx.supabase
    .from("clinics")
    .update({ currency })
    .eq("id", ctx.clinicId)
    .select("id");
  if (clinicError) return { ok: false, error: clinicError.message };
  return updatedRows(data) ? { ok: true, id: ctx.clinicId } : { ok: false, error: SAVE_FAILED };
}
