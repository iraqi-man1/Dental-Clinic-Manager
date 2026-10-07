import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

type InviteBody = {
  fullName?: string;
  email?: string;
  role?: "dentist" | "front_desk";
  specialty?: string;
};

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) {
    return Response.json(
      { error: "Server-side Supabase secret is not configured." },
      { status: 503 },
    );
  }

  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return Response.json({ error: "Request body must be a JSON object." }, { status: 400 });
  }
  const body = parsed as InviteBody;
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const specialty = typeof body.specialty === "string" ? body.specialty.trim() : "";
  if (!fullName || !email || !/^\S+@\S+\.\S+$/.test(email) || !["dentist", "front_desk"].includes(body.role ?? "")) {
    return Response.json({ error: "A valid name, email, and account type are required." }, { status: 400 });
  }

  const server = await createServerClient();
  const user = (await server?.auth.getUser())?.data.user;
  if (!server || !user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const { data: membership } = await server
    .from("clinic_members")
    .select("clinic_id,role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .in("role", ["owner", "admin"])
    .limit(1)
    .maybeSingle();
  if (!membership) return Response.json({ error: "Administrator access required." }, { status: 403 });

  const admin = createAdminClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const redirectTo = `${new URL(request.url).origin}/update-password`;
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo,
  });
  if (inviteError || !invited.user) {
    return Response.json({ error: inviteError?.message ?? "Invitation could not be created." }, { status: 400 });
  }

  const { error: memberError } = await admin.from("clinic_members").insert({
    clinic_id: membership.clinic_id,
    user_id: invited.user.id,
    full_name: fullName,
    email,
    role: body.role,
    status: "active",
    specialty: specialty || null,
  });
  if (memberError) {
    await admin.auth.admin.deleteUser(invited.user.id);
    return Response.json({ error: memberError.message }, { status: 400 });
  }

  return Response.json({
    ok: true,
    member: {
      userId: invited.user.id,
      fullName,
      email,
      role: body.role,
      status: "active",
      specialty: specialty || undefined,
    },
  });
}
