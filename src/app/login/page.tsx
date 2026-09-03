"use client";

import { FormEvent, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient, hasSupabaseConfig } from "@/lib/supabase/client";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();
  const configured = hasSupabaseConfig();
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    const f = new FormData(e.currentTarget),
      email = String(f.get("email")),
      password = String(f.get("password")),
      supabase = createClient();
    if (!supabase) {
      setMessage(
        "Supabase credentials are not configured. Use the demo workspace instead.",
      );
      setLoading(false);
      return;
    }
    if (mode === "reset") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${location.origin}/auth/callback?next=/update-password`,
      });
      setMessage(error ? error.message : "Check your email for a secure password-reset link.");
    } else if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) setMessage(error.message);
      else {
        const { data: membership } = await supabase
          .from("clinic_members")
          .select("clinic_id")
          .limit(1)
          .maybeSingle();
        if (!membership) {
          const user = (await supabase.auth.getUser()).data.user;
          const clinicName = user?.user_metadata?.clinic_name;
          const fullName = user?.user_metadata?.full_name ?? "Clinic owner";
          if (typeof clinicName === "string" && clinicName.trim()) {
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
        router.push("/");
        router.refresh();
      }
    } else {
      const fullName = String(f.get("name")),
        clinic = String(f.get("clinic"));
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, clinic_name: clinic },
          emailRedirectTo: `${location.origin}/auth/callback`,
        },
      });
      if (error) setMessage(error.message);
      else if (data.session) {
        const slug = `${clinic
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")}-${Date.now().toString().slice(-5)}`;
        await supabase.rpc("create_clinic", {
          clinic_name: clinic,
          clinic_slug: slug,
          member_name: fullName,
        });
        router.push("/");
        router.refresh();
      } else
        setMessage(
          "Check your email to confirm your account, then sign in to create your clinic workspace.",
        );
    }
    setLoading(false);
  };
  return (
    <main className="grid min-h-screen lg:grid-cols-[1.05fr_.95fr]">
      <section className="relative hidden overflow-hidden bg-[#0b6f68] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-40 -top-40 size-[500px] rounded-full bg-teal-300/15 blur-3xl" />
        <div className="absolute -bottom-48 -left-32 size-[520px] rounded-full bg-sky-300/15 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-2xl bg-white text-xl font-black text-primary">
            B
          </div>
          <div>
            <p className="font-bold">BrightSmile</p>
            <p className="text-xs text-white/60">Dental Studio</p>
          </div>
        </div>
        <div className="relative max-w-xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold">
            <Sparkles className="size-3.5" />
            Modern practice management
          </span>
          <h1 className="mt-6 text-5xl font-bold leading-[1.08] tracking-[-.04em]">
            Clinical care and clinic operations, beautifully together.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-white/70">
            A secure workspace for patient care, scheduling, treatments,
            payments, and the people behind every healthy smile.
          </p>
          <div className="mt-10 grid grid-cols-2 gap-4">
            {[
              "Tenant-isolated clinical data",
              "Interactive dental chart",
              "Realtime team coordination",
              "Private X-ray storage",
            ].map((x) => (
              <div key={x} className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="size-4 text-teal-200" />
                {x}
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-white/50">
          Protected by role-based access and PostgreSQL row-level security.
        </p>
      </section>
      <section className="grid place-items-center bg-[#f7f9f9] p-5">
        <Card className="w-full max-w-md shadow-xl shadow-slate-900/5">
          <CardContent className="p-7 sm:p-9">
            <div className="mb-8 lg:hidden">
              <div className="grid size-11 place-items-center rounded-2xl bg-primary text-xl font-black text-white">
                B
              </div>
            </div>
            <h2 className="text-2xl font-bold tracking-tight">
              {mode === "login" ? "Welcome back" : mode === "reset" ? "Reset your password" : "Start your clinic workspace"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {mode === "login" ? "Sign in to manage today’s care." : mode === "reset" ? "We’ll email you a secure recovery link." : "Create your secure BrightSmile account."}
            </p>
            <form className="mt-7 space-y-4" onSubmit={submit}>
              {mode === "signup" && (
                <>
                  <label className="block text-xs font-semibold">
                    Your full name
                    <Input
                      name="name"
                      required
                      className="mt-1.5"
                      placeholder="Dr. Maya Chen"
                    />
                  </label>
                  <label className="block text-xs font-semibold">
                    Clinic name
                    <Input
                      name="clinic"
                      required
                      className="mt-1.5"
                      placeholder="BrightSmile Dental Studio"
                    />
                  </label>
                </>
              )}
              <label className="block text-xs font-semibold">
                Email address
                <Input
                  name="email"
                  type="email"
                  required
                  className="mt-1.5"
                  placeholder="maya@brightsmile.com"
                />
              </label>
              {mode !== "reset" && <label className="block text-xs font-semibold">
                Password
                <div className="relative mt-1.5">
                  <Input
                    name="password"
                    type={show ? "text" : "password"}
                    minLength={8}
                    required
                    className="pe-10"
                    placeholder="At least 8 characters"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setShow(!show)}
                    className="absolute end-1 top-1/2 size-8 -translate-y-1/2 text-muted-foreground"
                    aria-label={show ? "Hide password" : "Show password"}
                  >
                    {show ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </Button>
                </div>
              </label>}
              {message && (
                <div className="rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
                  {message}
                </div>
              )}
              <Button className="w-full" size="lg" disabled={loading}>
                {loading ? "Please wait…" : mode === "login" ? "Sign in" : mode === "reset" ? "Send reset link" : "Create account"}
                <ArrowRight />
              </Button>
            </form>
            {mode === "login" && <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => { setMode("reset"); setMessage(""); }}
              className="mt-4 w-full text-center text-xs text-primary"
            >Forgot password?</Button>}
            <div className="my-6 h-px bg-border" />
            <p className="text-center text-sm text-muted-foreground">
              {mode === "login" ? "New to BrightSmile?" : "Already have an account?"}{" "}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setMode(mode === "login" ? "signup" : "login");
                  setMessage("");
                }}
                className="h-auto px-1 font-semibold text-primary"
              >
                {mode === "login" ? "Create an account" : "Sign in"}
              </Button>
            </p>
            {!configured && (
              <Button
                variant="ghost"
                className="mt-3 w-full"
                onClick={() => router.push("/")}
              >
                Open interactive demo
              </Button>
            )}
            <div className="mt-6 flex items-center justify-center gap-2 text-[10px] text-muted-foreground">
              <ShieldCheck className="size-3.5" />
              Secure, encrypted clinic access
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
