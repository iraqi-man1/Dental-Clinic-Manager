export type NavKey =
  | "dashboard"
  | "patients"
  | "appointments"
  | "treatments"
  | "payments"
  | "staff"
  | "inventory"
  | "reports"
  | "settings";

export type AppLanguage = "en" | "ar";
export type ClinicCurrency = "USD" | "IQD";

export type ToothCondition =
  | "Healthy"
  | "Caries"
  | "Filling"
  | "Crown"
  | "Root Canal"
  | "Implant"
  | "Extraction"
  | "Missing";

export type ToothSurface =
  | "occlusal"
  | "mesial"
  | "distal"
  | "buccal"
  | "lingual";

export type DentalChartState =
  | "healthy"
  | "decay"
  | "existing_restoration"
  | "planned"
  | "completed"
  | "other";

export type ToothSurfaceChart = Partial<
  Record<number, Partial<Record<ToothSurface, DentalChartState>>>
>;

export type Patient = {
  id: string;
  patientNo: string;
  name: string;
  initials: string;
  age: number;
  gender: "Female" | "Male" | "Other";
  phone: string;
  email: string;
  lastVisit: string;
  nextVisit?: string;
  status: "Active" | "Inactive";
  allergies: string[];
  conditions: string[];
  notes: string;
  balance: number;
  avatarColor: string;
  toothChart: Record<number, ToothCondition>;
  toothSurfaces?: ToothSurfaceChart;
  requestedTreatment?: string;
  assignedDoctor?: string;
};

export type Appointment = {
  id: string;
  patientId: string;
  patientName: string;
  time: string;
  endTime: string;
  date: string;
  treatment: string;
  procedureId?: string;
  treatmentPrice: number;
  doctor: string;
  providerId?: string;
  providerMemberId?: string;
  room: string;
  status:
    | "Confirmed"
    | "Checked in"
    | "In treatment"
    | "Completed"
    | "Pending"
    | "Cancelled";
  color: string;
};

export type ClinicRole =
  | "owner"
  | "admin"
  | "dentist"
  | "hygienist"
  | "assistant"
  | "front_desk"
  | "billing"
  | "viewer";

export type SessionPaymentStatus = "Paid" | "Partially Paid" | "Unpaid";

export type TreatmentSession = {
  id: string;
  itemId: string;
  planId: string;
  patientId: string;
  patientName: string;
  procedureName: string;
  sessionNumber: number;
  status: "planned" | "scheduled" | "completed" | "cancelled";
  scheduledAt?: string;
  expectedAmount: number;
  amountPaid: number;
  remaining: number;
  paymentStatus: SessionPaymentStatus;
};

export type TreatmentPlan = {
  id: string;
  patientId?: string;
  patientName: string;
  title: string;
  procedures: string[];
  total: number;
  sessionsDone: number;
  sessionsTotal: number;
  progress: number;
  status: "In progress" | "Proposed" | "Completed" | "On hold";
  nextSession?: string;
  items?: TreatmentPlanItem[];
};

export type ProcedureCatalogItem = {
  id: string;
  code?: string;
  name: string;
  category: string;
  defaultPrice: number;
  defaultSessions: number;
  supportsSurfaces: boolean;
  supportsMultipleTeeth: boolean;
  isSystem: boolean;
  isActive: boolean;
};

export type TreatmentItemStatus =
  | "planned"
  | "scheduled"
  | "completed"
  | "cancelled";

export type TreatmentPlanItem = {
  id: string;
  planId: string;
  procedureId?: string;
  procedureName: string;
  toothNumbers: number[];
  surfaces: ToothSurface[];
  status: TreatmentItemStatus;
  sessionsDone: number;
  sessionsTotal: number;
  price: number;
  discount: number;
  finalPrice: number;
  amountPaid: number;
  remaining: number;
  notes?: string;
  sessions?: TreatmentSession[];
};

export type Payment = {
  id: string;
  patientId?: string;
  appointmentId?: string;
  invoice: string;
  patientName: string;
  treatment: string;
  originalPrice: number;
  date: string;
  total: number;
  paid: number;
  discount: number;
  method: "Card" | "Cash" | "Insurance" | "Bank transfer";
  status: "Paid" | "Partial" | "Unpaid" | "Overdue";
  receiptNumber?: string;
  lastPaymentAmount?: number;
  receipts?: PaymentReceipt[];
};

export type PaymentReceipt = {
  id: string;
  receiptNumber: string;
  amount: number;
  date: string;
  method: Payment["method"];
  treatment: string;
  originalPrice: number;
  amountDue: number;
  remaining: number;
  clinic: { name: string; phone?: string; email?: string; address?: Record<string, string>; currency?: string };
};

export type ClinicMember = {
  id: string;
  userId?: string;
  fullName: string;
  email?: string;
  role: ClinicRole;
  status: "invited" | "active" | "suspended";
  specialty?: string;
};

export type ClinicInfo = {
  name: string;
  phone?: string;
  email?: string;
  address?: Record<string, string>;
  currency?: string;
};

export type InventoryItem = {
  id: string;
  name: string;
  category: string;
  sku: string;
  stock: number;
  minimum: number;
  unit: string;
  supplier: string;
  expiry?: string;
};

export type PurchaseOrderItem = {
  id?: string;
  inventoryItemId?: string;
  itemName: string;
  sku?: string;
  unit: string;
  quantity: number;
  unitCost?: number;
  notes?: string;
};

export type PurchaseOrder = {
  id: string;
  orderNumber: string;
  orderDate: string;
  supplierName?: string;
  supplierContact?: string;
  deliveryAddress?: string;
  notes?: string;
  status: "draft" | "issued" | "cancelled";
  items: PurchaseOrderItem[];
};
