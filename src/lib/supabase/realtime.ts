import { createClient, hasSupabaseConfig } from "./client";

/**
 * Tables published to the `supabase_realtime` publication. Keep this list in sync with
 * the publication migrations. Any table added to the publication must be listed here.
 */
export const REALTIME_CLINIC_TABLES = [
  "appointments",
  "patients",
  "clinic_members",
  "payments",
  "invoices",
  "procedure_catalog",
  "doctor_patient_assignments",
  "inventory_items",
  "treatment_plans",
  "treatment_plan_items",
  "treatment_sessions",
  "treatment_item_payments",
  "dental_chart_surfaces",
  "purchase_orders",
] as const;

/**
 * Subscribes to clinic table changes. `onChange` is called for every change. Callers
 * are responsible for debouncing and for running one reload at a time.
 */
export function subscribeToClinicChanges(onChange: () => void) {
  if (!hasSupabaseConfig()) return () => undefined;
  const supabase = createClient();
  if (!supabase) return () => undefined;
  let channel = supabase.channel("clinic-workspace");
  for (const table of REALTIME_CLINIC_TABLES) {
    channel = channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table },
      onChange,
    );
  }
  channel.subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
