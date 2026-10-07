import { NextResponse } from "next/server";
import { ensureClinicMembership } from "@/lib/clinic-bootstrap";
import { safeInternalPath } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/server";

function loginRedirect(origin: string, error: string) {
  const target = new URL("/login", origin);
  target.searchParams.set("error", error);
  return NextResponse.redirect(target);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeInternalPath(url.searchParams.get("next"), "/");

  if (!code) return loginRedirect(url.origin, "auth_failed");

  const supabase = await createClient();
  if (!supabase) return loginRedirect(url.origin, "auth_failed");

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return loginRedirect(url.origin, "auth_failed");

  const membership = await ensureClinicMembership(supabase, data.user);
  if (!membership.ok) return loginRedirect(url.origin, membership.error);

  return NextResponse.redirect(new URL(next, url.origin));
}
