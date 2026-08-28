/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  Appointment,
  AppLanguage,
  InventoryItem,
  Patient,
  Payment,
  PaymentReceipt,
  ProcedureCatalogItem,
  TreatmentPlan,
  TreatmentPlanItem,
  TreatmentItemStatus,
  DentalChartState,
  ToothSurface,
  ToothSurfaceChart,
  ToothCondition,
  TreatmentSession,
  ClinicRole,
  ClinicMember,
  ClinicCurrency,
  ClinicInfo,
  PurchaseOrder,
} from "@/lib/types";
import { iraqiMobileValidationMessage, normalizeIraqiMobileNumber } from "@/lib/utils";
import { createClient, hasSupabaseConfig } from "./client";

async function context() {
  const supabase = createClient();
  if (!supabase) return null;
  const currentUser = (await supabase.auth.getUser()).data.user;
  if (!currentUser) return null;
  const { data, error } = await supabase
    .from("clinic_members")
    .select("clinic_id, role, clinics(name,phone,email,address,logo_path,currency)")
    .eq("user_id", currentUser.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return {
    supabase,
    userId: currentUser.id,
    userEmail: currentUser.email,
    clinicId: data.clinic_id as string,
    role: data.role as ClinicRole,
    clinic: data.clinics as unknown as ClinicInfo & { logo_path?: string },
  };
}

export async function loadClinicData() {
  const ctx = await context();
  if (!ctx) return null;
  const [patientsResult, appointmentsResult, paymentsResult, inventoryResult, sessionsResult, proceduresResult, membersResult] =
    await Promise.all([
      ctx.supabase
        .from("patients")
        .select("*, dental_chart(tooth_number, condition), dental_chart_surfaces(tooth_number,surface,state)")
        .order("created_at", { ascending: false }),
      ctx.supabase
        .from("appointments")
        .select("*, patients(first_name,last_name)")
        .order("starts_at"),
      ctx.supabase
        .from("invoices")
        .select("*, patients(first_name,last_name), payments(id,amount,method,paid_at,receipt_number,treatment_name_snapshot,original_price_snapshot,amount_due_snapshot,remaining_balance_snapshot,clinic_snapshot)")
        .order("created_at", { ascending: false }),
      ctx.supabase.from("inventory_items").select("*").order("name"),
      ctx.supabase
        .from("treatment_sessions")
        .select("*, treatment_plan_items!inner(id,procedure_name,treatment_plan_id,treatment_plans!inner(id,patient_id,patients!inner(first_name,last_name))), treatment_item_payments(amount)")
        .neq("status", "cancelled")
        .order("session_number"),
      ctx.supabase.from("procedure_catalog").select("*").eq("is_active", true).order("category").order("name"),
      ctx.supabase.from("clinic_members").select("id,user_id,full_name,email,role,status,specialty").order("full_name"),
    ]);
  if (
    patientsResult.error ||
    appointmentsResult.error ||
    paymentsResult.error ||
    inventoryResult.error ||
    sessionsResult.error ||
    proceduresResult.error ||
    membersResult.error
  )
    return null;
  const patients: Patient[] = (patientsResult.data ?? []).map((row: any) => ({
    id: row.id,
    patientNo: row.patient_number,
    name: `${row.first_name} ${row.last_name}`,
    initials: `${row.first_name?.[0] ?? ""}${row.last_name?.[0] ?? ""}`,
    age: row.date_of_birth
      ? Math.max(
          0,
          new Date().getFullYear() - new Date(row.date_of_birth).getFullYear(),
        )
      : 0,
    gender: row.gender ?? "Other",
    phone: row.phone ?? "",
    email: row.email ?? "",
    lastVisit: row.last_visit_at
      ? new Date(row.last_visit_at).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "New patient",
    nextVisit: undefined,
    status: row.status === "inactive" ? "Inactive" : "Active",
    allergies: row.allergies ?? [],
    conditions: row.medical_conditions ?? [],
    notes: row.notes ?? "",
    balance: Number(row.outstanding_balance ?? 0),
    avatarColor: "bg-teal-100 text-teal-700",
    toothChart: Object.fromEntries(
      (row.dental_chart ?? []).map((tooth: any) => [
        tooth.tooth_number,
        tooth.condition,
      ]),
    ) as Record<number, ToothCondition>,
    toothSurfaces: (row.dental_chart_surfaces ?? []).reduce(
      (chart: ToothSurfaceChart, surface: any) => ({
        ...chart,
        [surface.tooth_number]: {
          ...(chart[surface.tooth_number] ?? {}),
          [surface.surface]: surface.state,
        },
      }),
      {} as ToothSurfaceChart,
    ),
  }));
  const appointments: Appointment[] = (appointmentsResult.data ?? []).map(
    (row: any) => {
      const startsAt = new Date(row.starts_at);
      const localDate = `${startsAt.getFullYear()}-${String(startsAt.getMonth() + 1).padStart(2, "0")}-${String(startsAt.getDate()).padStart(2, "0")}`;
      return {
      id: row.id,
      patientId: row.patient_id,
      patientName:
        `${row.patients?.first_name ?? ""} ${row.patients?.last_name ?? ""}`.trim(),
      date: localDate,
      time: startsAt.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      }),
      endTime: new Date(row.ends_at).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      }),
      treatment: row.title,
      procedureId: row.procedure_id ?? undefined,
      treatmentPrice: Number(row.treatment_price ?? 0),
      doctor: row.doctor_name ?? "Assigned dentist",
      providerId: row.provider_id ?? undefined,
      providerMemberId: row.provider_member_id ?? undefined,
      room: row.room ?? "Room 1",
      status: row.status,
      color: row.color ?? "#0f9f8f",
    }},
  );
  const payments: Payment[] = (paymentsResult.data ?? []).map((row: any) => {
    const transactions = [...(row.payments ?? [])].sort(
      (a: any, b: any) => String(b.paid_at).localeCompare(String(a.paid_at)),
    );
    const paid = transactions.reduce((sum: number, transaction: any) => sum + Number(transaction.amount), 0);
    const receipts: PaymentReceipt[] = transactions.filter((transaction: any) => transaction.receipt_number).map((transaction: any) => ({
      id: transaction.id,
      receiptNumber: transaction.receipt_number,
      amount: Number(transaction.amount),
      date: new Date(transaction.paid_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      method: transaction.method,
      treatment: transaction.treatment_name_snapshot ?? row.treatment_name ?? "Treatment",
      originalPrice: Number(transaction.original_price_snapshot ?? row.original_price ?? row.total_amount),
      amountDue: Number(transaction.amount_due_snapshot ?? row.total_amount),
      remaining: Number(transaction.remaining_balance_snapshot ?? 0),
      clinic: transaction.clinic_snapshot ?? {},
    }));
    return {
    id: row.id,
    patientId: row.patient_id,
    appointmentId: row.appointment_id ?? undefined,
    invoice: row.invoice_number ?? "—",
    patientName: `${row.patients?.first_name ?? ""} ${row.patients?.last_name ?? ""}`.trim(),
    treatment: row.treatment_name ?? "Treatment",
    originalPrice: Number(row.original_price ?? row.total_amount),
    date: new Date(transactions[0]?.paid_at ?? row.created_at).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    total: Number(row.total_amount),
    paid,
    discount: Number(row.discount_amount ?? 0),
    method: transactions[0]?.method ?? "Cash",
    status: row.status === "overdue" ? "Overdue" : paid >= Number(row.total_amount) ? "Paid" : paid > 0 ? "Partial" : "Unpaid",
    receiptNumber: transactions[0]?.receipt_number ?? undefined,
    lastPaymentAmount: transactions[0] ? Number(transactions[0].amount) : undefined,
    receipts,
  }});
  const inventory: InventoryItem[] = (inventoryResult.data ?? []).map(
    (row: any) => ({
      id: row.id,
      name: row.name,
      category: row.category,
      sku: row.sku,
      stock: Number(row.quantity),
      minimum: Number(row.reorder_level),
      unit: row.unit,
      supplier: row.supplier ?? "",
      expiry: row.expires_at
        ? new Date(row.expires_at).toLocaleDateString("en-US", {
            month: "short",
            year: "numeric",
          })
        : undefined,
    }),
  );
  const sessions: TreatmentSession[] = (sessionsResult.data ?? []).map((row: any) => {
    const item = row.treatment_plan_items;
    const plan = item?.treatment_plans;
    const amountPaid = (row.treatment_item_payments ?? []).reduce(
      (sum: number, allocation: any) => sum + Number(allocation.amount), 0,
    );
    const expectedAmount = Number(row.expected_amount ?? 0);
    return {
      id: row.id,
      itemId: item?.id,
      planId: plan?.id,
      patientId: plan?.patient_id,
      patientName: `${plan?.patients?.first_name ?? ""} ${plan?.patients?.last_name ?? ""}`.trim(),
      procedureName: item?.procedure_name ?? "Treatment session",
      sessionNumber: Number(row.session_number),
      status: row.status,
      scheduledAt: row.scheduled_at ?? undefined,
      expectedAmount,
      amountPaid,
      remaining: Math.max(0, expectedAmount - amountPaid),
      paymentStatus: amountPaid >= expectedAmount && expectedAmount > 0
        ? "Paid" : amountPaid > 0 ? "Partially Paid" : "Unpaid",
    };
  });
  const procedures: ProcedureCatalogItem[] = (proceduresResult.data ?? []).map((row: any) => ({
    id: row.id, code: row.code ?? undefined, name: row.name, category: row.category,
    defaultPrice: Number(row.default_price), defaultSessions: Number(row.default_sessions),
    supportsSurfaces: Boolean(row.supports_surfaces), supportsMultipleTeeth: Boolean(row.supports_multiple_teeth),
    isSystem: Boolean(row.is_system), isActive: Boolean(row.is_active),
  }));
  const members: ClinicMember[] = (membersResult.data ?? []).map((row: any) => ({
    id: row.id, userId: row.user_id ?? undefined, fullName: row.full_name, email: row.email ?? (row.user_id === ctx.userId ? ctx.userEmail : undefined),
    role: row.role, status: row.status, specialty: row.specialty ?? undefined,
  }));
  return { patients, appointments, payments, inventory, sessions, procedures, members, currentUserId: ctx.userId, role: ctx.role, clinic: ctx.clinic };
}

export async function persistPatient(patient: Patient) {
  const phone = normalizeIraqiMobileNumber(patient.phone);
  if (!phone) return { ok: false as const, error: iraqiMobileValidationMessage };
  const ctx = await context();
  if (!ctx) {
    return hasSupabaseConfig()
      ? { ok: false as const, error: "Your clinic session is unavailable. Please sign in again." }
      : { ok: true as const, id: patient.id };
  }
  const dateOfBirth = patient.age > 0
    ? `${new Date().getFullYear() - patient.age}-01-01`
    : null;
  const { data, error } = await ctx.supabase
    .rpc("create_patient", {
      p_clinic_id: ctx.clinicId,
      p_patient_id: patient.id,
      p_patient_number: patient.patientNo,
      p_full_name: patient.name.trim(),
      p_phone: phone,
      p_email: patient.email.trim() || null,
      p_date_of_birth: dateOfBirth,
      p_gender: patient.gender,
      p_allergies: patient.allergies,
      p_medical_conditions: patient.conditions,
      p_notes: patient.notes,
      p_status: patient.status.toLowerCase(),
      p_outstanding_balance: patient.balance,
    });
  return error
    ? { ok: false as const, error: error.message }
    : { ok: true as const, id: data as string };
}

export async function persistToothChart(
  patientId: string,
  chart: Record<number, ToothCondition>,
  surfaces?: ToothSurfaceChart,
) {
  const ctx = await context();
  if (!ctx) return false;
  const rows = Object.entries(chart).map(([tooth, condition]) => ({
    clinic_id: ctx.clinicId,
    patient_id: patientId,
    tooth_number: Number(tooth),
    condition,
  }));
  const { error } = await ctx.supabase
    .from("dental_chart")
    .upsert(rows, { onConflict: "patient_id,tooth_number" });
  if (error) return false;
  const surfaceRows = Object.entries(surfaces ?? {}).flatMap(
    ([toothNumber, toothSurfaces]) =>
      Object.entries(toothSurfaces ?? {}).map(([surface, state]) => ({
        clinic_id: ctx.clinicId,
        patient_id: patientId,
        tooth_number: Number(toothNumber),
        surface,
        state,
      })),
  );
  if (!surfaceRows.length) return true;
  const { error: surfaceError } = await ctx.supabase
    .from("dental_chart_surfaces")
    .upsert(surfaceRows, {
      onConflict: "patient_id,tooth_number,surface",
    });
  return !surfaceError;
}

export async function loadTreatmentPlanningData() {
  const ctx = await context();
  if (!ctx) return null;
  const [catalogResult, plansResult, itemsResult, sessionsResult] = await Promise.all([
    ctx.supabase
      .from("procedure_catalog")
      .select("*")
      .eq("is_active", true)
      .order("category")
      .order("name"),
    ctx.supabase
      .from("treatment_plans")
      .select("*, patients(first_name,last_name)")
      .order("updated_at", { ascending: false }),
    ctx.supabase
      .from("treatment_plan_items")
      .select("*, treatment_item_payments(amount)")
      .order("created_at"),
    ctx.supabase
      .from("treatment_sessions")
      .select("*, treatment_item_payments(amount)")
      .order("session_number"),
  ]);
  if (catalogResult.error || plansResult.error || itemsResult.error || sessionsResult.error) return null;

  const catalog: ProcedureCatalogItem[] = (catalogResult.data ?? []).map(
    (row: any) => ({
      id: row.id,
      code: row.code ?? undefined,
      name: row.name,
      category: row.category,
      defaultPrice: Number(row.default_price),
      defaultSessions: Number(row.default_sessions),
      supportsSurfaces: row.supports_surfaces,
      supportsMultipleTeeth: row.supports_multiple_teeth,
      isSystem: row.is_system,
      isActive: row.is_active,
    }),
  );
  const items: TreatmentPlanItem[] = (itemsResult.data ?? []).map((row: any) => {
    const finalPrice = Math.max(
      0,
      Number(row.price) * Number(row.quantity) - Number(row.discount_amount),
    );
    const allocations = (row.treatment_item_payments ?? []).reduce(
      (sum: number, allocation: any) => sum + Number(allocation.amount),
      0,
    );
    const amountPaid = Math.max(Number(row.amount_paid ?? 0), allocations);
    const itemSessions: TreatmentSession[] = (sessionsResult.data ?? [])
      .filter((session: any) => session.treatment_plan_item_id === row.id)
      .map((session: any) => {
        const sessionPaid = (session.treatment_item_payments ?? []).reduce(
          (sum: number, allocation: any) => sum + Number(allocation.amount), 0,
        );
        const expectedAmount = Number(session.expected_amount ?? 0);
        return {
          id: session.id, itemId: row.id, planId: row.treatment_plan_id,
          patientId: "", patientName: "", procedureName: row.procedure_name,
          sessionNumber: Number(session.session_number), status: session.status,
          scheduledAt: session.scheduled_at ?? undefined, expectedAmount,
          amountPaid: sessionPaid, remaining: Math.max(0, expectedAmount - sessionPaid),
          paymentStatus: sessionPaid >= expectedAmount && expectedAmount > 0
            ? "Paid" : sessionPaid > 0 ? "Partially Paid" : "Unpaid",
        };
      });
    return {
      id: row.id,
      planId: row.treatment_plan_id,
      procedureId: row.procedure_id ?? undefined,
      procedureName: row.procedure_name,
      toothNumbers:
        row.tooth_numbers?.length > 0
          ? row.tooth_numbers.map(Number)
          : row.tooth_number
            ? [Number(row.tooth_number)]
            : [],
      surfaces: (row.surfaces ?? []) as ToothSurface[],
      status: row.status as TreatmentItemStatus,
      sessionsDone: Number(row.sessions_completed),
      sessionsTotal: Number(row.sessions_total),
      price: Number(row.price) * Number(row.quantity),
      discount: Number(row.discount_amount),
      finalPrice,
      amountPaid,
      remaining: Math.max(0, finalPrice - amountPaid),
      notes: row.notes ?? undefined,
      sessions: itemSessions,
    };
  });
  const plans: TreatmentPlan[] = (plansResult.data ?? []).map((row: any) => {
    const planItems = items.filter((item) => item.planId === row.id);
    const totalSessions = planItems.length
      ? planItems.reduce((sum, item) => sum + item.sessionsTotal, 0)
      : Number(row.sessions_total);
    const completedSessions = planItems.length
      ? planItems.reduce((sum, item) => sum + item.sessionsDone, 0)
      : Number(row.sessions_completed);
    return {
      id: row.id,
      patientId: row.patient_id,
      patientName:
        `${row.patients?.first_name ?? ""} ${row.patients?.last_name ?? ""}`.trim(),
      title: row.title,
      procedures: planItems.map((item) => item.procedureName),
      total: Number(row.total_amount),
      sessionsDone: completedSessions,
      sessionsTotal: totalSessions,
      progress: totalSessions
        ? Math.round((completedSessions / totalSessions) * 100)
        : 0,
      status: row.status,
      nextSession: row.next_session_at
        ? new Date(row.next_session_at).toLocaleDateString("en-US", {
            month: "short",
            day: "2-digit",
          })
        : undefined,
      items: planItems,
    };
  });
  return { catalog, plans };
}

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
) {
  const ctx = await context();
  if (!ctx) return { ok: false, error: "No clinic session" };
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
  const saved = Array.isArray(data) ? data[0] : data;
  return { ok: !error, itemId: saved?.treatment_plan_item_id as string | undefined, error: error?.message };
}

export async function createTreatmentPlan(patientId: string, title: string, totalAmount: number) {
  const ctx = await context();
  if (!ctx) return { ok: false, error: "No clinic session" };
  const { data, error } = await ctx.supabase.rpc("create_treatment_plan_with_price", {
    p_clinic_id: ctx.clinicId,
    p_patient_id: patientId,
    p_title: title,
    p_total_amount: totalAmount,
  });
  return { ok: !error, id: data as string | null, error: error?.message };
}

export async function updateTreatmentPlan(planId: string, input: { title: string; status: TreatmentPlan["status"] }) {
  const ctx = await context();
  if (!ctx) return { ok: true, demo: true };
  const { error } = await ctx.supabase.from("treatment_plans")
    .update({ title: input.title.trim(), status: input.status })
    .eq("clinic_id", ctx.clinicId)
    .eq("id", planId);
  return { ok: !error, error: error?.message };
}

export async function persistProcedureCatalogItem(
  procedure: Omit<ProcedureCatalogItem, "isSystem" | "isActive">,
) {
  const ctx = await context();
  if (!ctx) return { ok: true, id: procedure.id, demo: true };
  const values = {
    clinic_id: ctx.clinicId,
    code: procedure.code ?? null,
    name: procedure.name,
    category: procedure.category,
    default_price: procedure.defaultPrice,
    default_sessions: procedure.defaultSessions,
    supports_surfaces: procedure.supportsSurfaces,
    supports_multiple_teeth: procedure.supportsMultipleTeeth,
    is_system: false,
    is_active: true,
  };
  const query = procedure.id.startsWith("demo-")
    ? ctx.supabase.from("procedure_catalog").insert(values)
    : ctx.supabase.from("procedure_catalog").update(values).eq("id", procedure.id).eq("clinic_id", ctx.clinicId);
  const { data, error } = await query.select("id").single();
  return { ok: !error, id: data?.id as string | undefined, error: error?.message };
}

export async function archiveProcedureCatalogItem(procedureId: string) {
  const ctx = await context();
  if (!ctx) return { ok: true, demo: true };
  const { error } = await ctx.supabase.from("procedure_catalog")
    .update({ is_active: false })
    .eq("clinic_id", ctx.clinicId)
    .eq("id", procedureId);
  return { ok: !error, error: error?.message };
}

export async function recordTreatmentSession(itemId: string) {
  const ctx = await context();
  if (!ctx) return false;
  const { data, error } = await ctx.supabase.rpc("record_treatment_session", {
    p_clinic_id: ctx.clinicId,
    p_item_id: itemId,
  });
  return !error && data === true;
}

export async function completeTreatmentSession(sessionId: string) {
  const ctx = await context();
  if (!ctx) return { ok: false, error: "No clinic session" };
  const { data, error } = await ctx.supabase.rpc("complete_treatment_session", {
    p_clinic_id: ctx.clinicId,
    p_session_id: sessionId,
  });
  return { ok: !error && data === true, error: error?.message };
}

export async function setTreatmentSessionPrices(itemId: string, amounts: number[]) {
  const ctx = await context();
  if (!ctx) return { ok: false, error: "No clinic session" };
  const { data, error } = await ctx.supabase.rpc("set_treatment_session_prices", {
    p_clinic_id: ctx.clinicId,
    p_item_id: itemId,
    p_expected_amounts: amounts,
  });
  return { ok: !error && data === true, error: error?.message };
}

export async function recordSessionPayment(input: {
  sessionId: string;
  mode: "full" | "partial" | "not_paid";
  amount?: number;
  method: Payment["method"];
  reference?: string;
}) {
  const ctx = await context();
  if (!ctx) return { ok: false, error: "No clinic session" };
  const { data, error } = await ctx.supabase.rpc("record_session_payment", {
    p_clinic_id: ctx.clinicId,
    p_session_id: input.sessionId,
    p_payment_mode: input.mode,
    p_amount: input.amount ?? null,
    p_method: input.method,
    p_reference: input.reference ?? null,
  });
  return { ok: !error, paymentId: data as string | null, error: error?.message };
}

export async function rescheduleAppointment(
  appointmentId: string,
  startsAt: string,
  endsAt: string,
) {
  const ctx = await context();
  if (!ctx) return { ok: true, demo: true };
  const { data, error } = await ctx.supabase.rpc("reschedule_appointment", {
    p_clinic_id: ctx.clinicId,
    p_appointment_id: appointmentId,
    p_starts_at: startsAt,
    p_ends_at: endsAt,
  });
  return { ok: !error && data === true, error: error?.message };
}

export async function persistAppointment(item: Appointment) {
  const ctx = await context();
  if (!ctx) return { ok: true, demo: true };
  const start = new Date(`${item.date} ${item.time}`);
  const end = new Date(`${item.date} ${item.endTime}`);
  const { data, error } = await ctx.supabase.rpc("create_appointment_with_invoice_for_member", {
    p_clinic_id: ctx.clinicId,
    p_appointment_id: item.id,
    p_patient_id: item.patientId,
    p_provider_member_id: item.providerMemberId,
    p_procedure_id: item.procedureId ?? null,
    p_treatment_name: item.treatment,
    p_treatment_price: item.treatmentPrice,
    p_starts_at: start.toISOString(),
    p_ends_at: end.toISOString(),
    p_room: item.room,
    p_color: item.color,
  });
  return { ok: !error, invoiceId: data as string | null, error: error?.message };
}

export async function persistInventoryItem(item: InventoryItem) {
  const ctx = await context();
  if (!ctx) return false;
  const { error } = await ctx.supabase.from("inventory_items").insert({
    clinic_id: ctx.clinicId,
    name: item.name,
    category: item.category,
    sku: item.sku,
    quantity: item.stock,
    reorder_level: item.minimum,
    unit: item.unit,
    supplier: item.supplier,
  });
  return !error;
}

export async function persistPurchaseOrder(order: PurchaseOrder) {
  const ctx = await context();
  if (!ctx) return { ok: false, error: "No clinic session" };
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
  return { ok: !error, id: data as string | null, error: error?.message };
}

export async function persistPayment(input: {
  invoiceId: string;
  amount: number;
  method: Payment["method"];
  reference?: string;
}) {
  const ctx = await context();
  if (!ctx) return { ok: true, paymentId: crypto.randomUUID(), demo: true };
  const { data, error } = await ctx.supabase.rpc("record_appointment_payment", {
    p_clinic_id: ctx.clinicId,
    p_invoice_id: input.invoiceId,
    p_amount: input.amount,
    p_method: input.method,
    p_reference: input.reference ?? null,
  });
  return { ok: !error, paymentId: data as string | null, error: error?.message };
}

export async function createClinicMember(input: {
  fullName: string;
  email?: string;
  role: "dentist" | "front_desk";
  specialty?: string;
}) {
  const ctx = await context();
  if (!ctx) return { ok: false, error: "Your clinic session is unavailable. Please sign in again." };
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
  const member = data ? {
    id: data.id,
    userId: data.user_id ?? undefined,
    fullName: data.full_name,
    email: data.email ?? undefined,
    role: data.role,
    status: data.status,
    specialty: data.specialty ?? undefined,
  } as ClinicMember : undefined;
  return { ok: !error && Boolean(member), error: error?.message, member };
}

export async function uploadPatientFile(patientId: string, file: File) {
  const ctx = await context();
  if (!ctx) return false;
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const path = `${ctx.clinicId}/${patientId}/${crypto.randomUUID()}-${safeName}`;
  const { error: uploadError } = await ctx.supabase.storage
    .from("clinical-files")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) return false;
  const userId = (await ctx.supabase.auth.getUser()).data.user?.id;
  if (!userId) return false;
  const { error: metadataError } = await ctx.supabase
    .from("patient_files")
    .insert({
      clinic_id: ctx.clinicId,
      patient_id: patientId,
      storage_path: path,
      file_name: file.name,
      mime_type: file.type,
      file_size: file.size,
      uploaded_by: userId,
    });
  return !metadataError;
}

export async function loadClinicPreferences() {
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

export async function persistClinicPreferences(language: AppLanguage, currency?: ClinicCurrency) {
  const ctx = await context();
  if (!ctx) return false;
  const { error } = await ctx.supabase.from("clinic_settings").upsert({
    clinic_id: ctx.clinicId,
    language,
  });
  if (error) return false;
  if (currency) {
    const { error: clinicError } = await ctx.supabase.from("clinics")
      .update({ currency }).eq("id", ctx.clinicId);
    return !clinicError;
  }
  return true;
}

export async function persistClinicProfile(clinic: ClinicInfo) {
  const ctx = await context();
  if (!ctx) return { ok: true, demo: true };
  const { error } = await ctx.supabase.from("clinics").update({
    name: clinic.name.trim(), phone: clinic.phone?.trim() || null,
    email: clinic.email?.trim() || null, address: clinic.address ?? {},
  }).eq("id", ctx.clinicId);
  return { ok: !error, error: error?.message };
}
