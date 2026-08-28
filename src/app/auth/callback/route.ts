import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const requestedNext = url.searchParams.get("next");
  const next = requestedNext?.startsWith("/") && !requestedNext.startsWith("//")
    ? requestedNext
    : "/";
  if (code) {
    const supabase = await createClient();
    const { data } = (await supabase?.auth.exchangeCodeForSession(code)) ?? {
      data: null,
    };
    if (supabase && data?.user) {
      const { data: membership } = await supabase
        .from("clinic_members")
        .select("clinic_id")
        .limit(1)
        .maybeSingle();
      const clinicName = data.user.user_metadata?.clinic_name;
      const fullName = data.user.user_metadata?.full_name ?? "Clinic owner";
      if (!membership && typeof clinicName === "string" && clinicName.trim()) {
        const slug = `${clinicName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")}-${Date.now().toString().slice(-5)}`;
        await supabase.rpc("create_clinic", {
          clinic_name: clinicName,
          clinic_slug: slug,
          member_name: fullName,
        });
      }
    }
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
