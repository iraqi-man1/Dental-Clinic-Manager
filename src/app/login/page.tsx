"use client";

import { FormEvent, Suspense, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Languages,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ensureClinicMembership } from "@/lib/clinic-bootstrap";
import { useClinicPreferences } from "@/lib/clinic-preferences";
import { createClient, hasSupabaseConfig } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Mode = "login" | "signup" | "reset";
// `text` is an English source string translated at render time, so a language switch updates it.
// Server messages that cannot be translated are marked `server` and rendered untranslated.
type Notice = { tone: "error" | "success"; text: string; server?: boolean };

const CALLBACK_ERRORS: Partial<Record<string, string>> = {
  auth_failed: "This sign-in link is invalid or has expired. Please try again.",
  not_linked: "Your account is not linked to a clinic workspace.",
  lookup_failed: "Could not open your clinic workspace. Please try again.",
  setup_failed: "Could not open your clinic workspace. Please try again.",
};

function callbackNotice(code: string | null): Notice | null {
  if (!code) return null;
  return {
    tone: "error",
    text: CALLBACK_ERRORS[code] ?? "Something went wrong. Please sign in again.",
  };
}

function authNotice(message: string): Notice {
  if (message === "Invalid login credentials") {
    return { tone: "error", text: "Invalid email or password." };
  }
  if (message === "Email not confirmed") {
    return { tone: "error", text: "Confirm your email address before signing in." };
  }
  return { tone: "error", text: message, server: true };
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function BrandMark({ variant }: { variant: "on-dark" | "on-light" }) {
  const { t } = useClinicPreferences();
  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          "grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-white shadow-sm",
          variant === "on-dark" && "ring-1 ring-white/30",
        )}
      >
        <span className="app-brand text-2xl leading-none" aria-hidden="true" data-no-translate>
          ن
        </span>
      </div>
      <div className="min-w-0">
        <p className={cn("app-brand text-3xl", variant === "on-light" && "text-primary")} data-no-translate>
          نرجس
        </p>
        <p className={cn("text-xs", variant === "on-dark" ? "text-white/60" : "text-muted-foreground")}>
          {t("Dental Studio")}
        </p>
      </div>
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language, setLanguage, t } = useClinicPreferences();
  const configured = hasSupabaseConfig();
  const [mode, setMode] = useState<Mode>("login");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(() =>
    callbackNotice(searchParams.get("error")),
  );

  const changeMode = (next: Mode) => {
    setMode(next);
    setNotice(null);
    setShow(false);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");
    setNotice(null);

    const supabase = createClient();
    if (!supabase) {
      setNotice({
        tone: "error",
        text: "Supabase credentials are not configured. Use the demo workspace instead.",
      });
      return;
    }
    if (mode === "signup" && password !== confirmPassword) {
      setNotice({ tone: "error", text: "Passwords do not match." });
      return;
    }

    setLoading(true);
    try {
      if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${location.origin}/auth/callback?next=/update-password`,
        });
        setNotice(
          error
            ? authNotice(error.message)
            : {
                tone: "success",
                text: "Check your email for a secure password-reset link.",
              },
        );
        return;
      }

      if (mode === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setNotice(authNotice(error.message));
          return;
        }
        if (!data.user) {
          setNotice({ tone: "error", text: "Could not connect to the authentication service. Please try again." });
          return;
        }
        const membership = await ensureClinicMembership(supabase, data.user);
        if (!membership.ok) {
          setNotice(callbackNotice(membership.error));
          return;
        }
        router.replace("/");
        router.refresh();
        return;
      }

      const fullName = String(form.get("name") ?? "").trim();
      const clinic = String(form.get("clinic") ?? "").trim();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, clinic_name: clinic },
          emailRedirectTo: `${location.origin}/auth/callback`,
        },
      });
      if (error) {
        setNotice(authNotice(error.message));
        return;
      }
      if (!data.session || !data.user) {
        setNotice({
          tone: "success",
          text: "Check your email to confirm your account, then sign in to create your clinic workspace.",
        });
        return;
      }
      const membership = await ensureClinicMembership(supabase, data.user);
      if (!membership.ok) {
        setNotice(callbackNotice(membership.error));
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setNotice({
        tone: "error",
        text: "Could not connect to the authentication service. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const title =
    mode === "login"
      ? "Welcome back"
      : mode === "reset"
        ? "Reset your password"
        : "Start your clinic workspace";
  const subtitle =
    mode === "login"
      ? "Sign in to manage today's care."
      : mode === "reset"
        ? "We'll email you a secure recovery link."
        : "Create your account.";
  const submitLabel =
    loading
      ? "Please wait…"
      : mode === "login"
        ? "Sign in"
        : mode === "reset"
          ? "Send reset link"
          : "Create account";

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.05fr_.95fr]">
      <section className="relative hidden overflow-hidden bg-[#0b6f68] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-40 -top-40 size-[500px] rounded-full bg-teal-300/15 blur-3xl" />
        <div className="absolute -bottom-48 -start-32 size-[520px] rounded-full bg-sky-300/15 blur-3xl" />
        <div className="relative">
          <BrandMark variant="on-dark" />
        </div>
        <div className="relative max-w-xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold">
            <Sparkles className="size-3.5" />
            {t("Modern practice management")}
          </span>
          <h1 className="mt-6 text-5xl font-bold leading-[1.08] tracking-[-.04em]">
            {t("Clinical care and clinic operations, beautifully together.")}
          </h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-white/70">
            {t("A secure workspace for patient care, scheduling, treatments, payments, and the people behind every healthy smile.")}
          </p>
          <div className="mt-10 grid grid-cols-2 gap-4">
            {[
              "Tenant-isolated clinical data",
              "Interactive dental chart",
              "Realtime team coordination",
              "Private X-ray storage",
            ].map((feature) => (
              <div key={feature} className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="size-4 shrink-0 text-teal-200" />
                {t(feature)}
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-white/50">
          {t("Protected by role-based access and PostgreSQL row-level security.")}
        </p>
      </section>

      <section className="relative grid place-items-center bg-[#f7f9f9] p-5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setLanguage(language === "ar" ? "en" : "ar")}
          aria-label={t("Switch language")}
          className="absolute end-3 top-3 min-h-11 gap-2 px-3 text-xs font-semibold text-muted-foreground"
        >
          <Languages className="size-4" />
          <span lang={language === "ar" ? "en" : "ar"} data-no-translate>
            {language === "ar" ? "English" : "العربية"}
          </span>
        </Button>

        <Card className="w-full max-w-md shadow-xl shadow-slate-900/5">
          <CardContent className="p-7 sm:p-9">
            <div className="mb-8 lg:hidden">
              <BrandMark variant="on-light" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">{t(title)}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{t(subtitle)}</p>

            <form className="mt-7 space-y-4" onSubmit={submit}>
              {mode === "signup" && (
                <>
                  <label className="block text-xs font-semibold">
                    {t("Your full name")}
                    <Input
                      name="name"
                      required
                      autoComplete="name"
                      className="mt-1.5"
                      placeholder={t("Dr. Maya Chen")}
                    />
                  </label>
                  <label className="block text-xs font-semibold">
                    {t("Clinic name")}
                    <Input
                      name="clinic"
                      required
                      autoComplete="organization"
                      className="mt-1.5"
                      placeholder={t("Clinic name")}
                    />
                  </label>
                </>
              )}
              <label className="block text-xs font-semibold">
                {t("Email address")}
                <Input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  inputMode="email"
                  dir="ltr"
                  className="mt-1.5"
                  placeholder="maya@brightsmile.com"
                />
              </label>
              {mode !== "reset" && (
                <label className="block text-xs font-semibold">
                  {t("Password")}
                  <div className="relative mt-1.5">
                    <Input
                      name="password"
                      type={show ? "text" : "password"}
                      minLength={mode === "signup" ? 8 : undefined}
                      required
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
                      className="pe-12"
                      placeholder={t("At least 8 characters")}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setShow(!show)}
                      className="absolute end-0 top-1/2 size-11 -translate-y-1/2 text-muted-foreground"
                      aria-label={show ? t("Hide password") : t("Show password")}
                    >
                      {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </Button>
                  </div>
                </label>
              )}
              {mode === "signup" && (
                <label className="block text-xs font-semibold">
                  {t("Confirm password")}
                  <Input
                    name="confirmPassword"
                    type={show ? "text" : "password"}
                    minLength={8}
                    required
                    autoComplete="new-password"
                    className="mt-1.5"
                    placeholder={t("Re-enter your password")}
                  />
                </label>
              )}
              {notice && (
                <div
                  role={notice.tone === "error" ? "alert" : "status"}
                  className={cn(
                    "rounded-xl p-3 text-xs leading-relaxed ring-1",
                    notice.tone === "error"
                      ? "bg-rose-50 text-rose-700 ring-rose-200"
                      : "bg-emerald-50 text-emerald-800 ring-emerald-200",
                  )}
                >
                  {notice.server ? (
                    <span data-no-translate>{notice.text}</span>
                  ) : (
                    t(notice.text)
                  )}
                </div>
              )}
              <Button className="w-full" size="lg" disabled={loading}>
                {t(submitLabel)}
                <ArrowRight className="rtl:rotate-180" />
              </Button>
            </form>

            {mode === "login" && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => changeMode("reset")}
                className="mt-4 min-h-11 w-full text-center text-xs text-primary"
              >
                {t("Forgot password?")}
              </Button>
            )}
            <div className="my-6 h-px bg-border" />
            <p className="text-center text-sm text-muted-foreground">
              {t(mode === "login" ? "New here?" : "Already have an account?")}{" "}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => changeMode(mode === "login" ? "signup" : "login")}
                className="min-h-11 px-2 font-semibold text-primary"
              >
                {t(mode === "login" ? "Create an account" : "Sign in")}
              </Button>
            </p>
            {!configured && (
              <Button
                type="button"
                variant="ghost"
                className="mt-3 min-h-11 w-full"
                onClick={() => router.push("/")}
              >
                {t("Open interactive demo")}
              </Button>
            )}
            <div className="mt-6 flex items-center justify-center gap-2 text-[10px] text-muted-foreground">
              <ShieldCheck className="size-3.5" />
              {t("Secure, encrypted clinic access")}
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
