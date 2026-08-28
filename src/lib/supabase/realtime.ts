import { createClient, hasSupabaseConfig } from "./client";

export function subscribeToClinicChanges(onChange: () => void) {
  if (!hasSupabaseConfig()) return () => undefined;
  const supabase = createClient();
  if (!supabase) return () => undefined;
  const channel = supabase
    .channel("clinic-workspace")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "appointments" },
      onChange,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "patients" },
      onChange,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "clinic_members" },
      onChange,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "payments" },
      onChange,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "invoices" },
      onChange,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "procedure_catalog" },
      onChange,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "doctor_patient_assignments" },
      onChange,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "inventory_items" },
      onChange,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "treatment_sessions" },
      onChange,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "treatment_item_payments" },
      onChange,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "purchase_orders" },
      onChange,
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
