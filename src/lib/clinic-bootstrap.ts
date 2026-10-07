import type { SupabaseClient, User } from "@supabase/supabase-js";

// Stable error codes. Pages translate these codes for display; they are never shown raw.
export type ClinicBootstrapError = "lookup_failed" | "not_linked" | "setup_failed";

export type ClinicBootstrapResult = { ok: true } | { ok: false; error: ClinicBootstrapError };

function slugFromName(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  // Arabic and other non-Latin clinic names slugify to nothing; keep the URL slug valid anyway.
  const stem = base || "clinic";
  const suffix = Math.random().toString(36).slice(2, 8).padEnd(6, "0");
  return `${stem}-${suffix}`;
}

// Makes sure a signed-in user belongs to a clinic. When the user has no active membership but
// signed up with a clinic name (sign-up metadata), the clinic is created through the RPC.
export async function ensureClinicMembership(
  supabase: SupabaseClient,
  user: User,
): Promise<ClinicBootstrapResult> {
  const { data: membership, error: lookupError } = await supabase
    .from("clinic_members")
    .select("clinic_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (lookupError) return { ok: false, error: "lookup_failed" };
  if (membership) return { ok: true };

  const metadata: Record<string, unknown> = user.user_metadata ?? {};
  const clinicName = metadata.clinic_name;
  if (typeof clinicName !== "string" || !clinicName.trim()) {
    return { ok: false, error: "not_linked" };
  }
  const fullName =
    typeof metadata.full_name === "string" && metadata.full_name.trim()
      ? metadata.full_name
      : "Clinic owner";
  const { error: createError } = await supabase.rpc("create_clinic", {
    clinic_name: clinicName,
    clinic_slug: slugFromName(clinicName),
    member_name: fullName,
  });
  if (createError) return { ok: false, error: "setup_failed" };
  return { ok: true };
}
