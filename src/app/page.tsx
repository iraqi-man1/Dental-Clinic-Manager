import { ClinicApp } from "@/components/clinic/clinic-app";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function Home() {
  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    const supabase = await createClient();
    const user = (await supabase?.auth.getUser())?.data.user;
    if (!user) redirect("/login");
  }
  return <ClinicApp />;
}
