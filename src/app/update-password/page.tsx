"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useClinicPreferences } from "@/lib/clinic-preferences";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Notice = { tone: "error" | "success"; text: string; server?: boolean };

export default function UpdatePasswordPage() {
  const { language, setLanguage, t } = useClinicPreferences();
  const router = useRouter();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");
    setNotice(null);
    if (password !== confirmPassword) {
      setNotice({ tone: "error", text: "Passwords do not match." });
      return;
    }
    const client = createClient();
    if (!client) {
      setNotice({ tone: "error", text: "Supabase is not configured." });
      return;
    }
    setLoading(true);
    try {
      const { error } = await client.auth.updateUser({ password });
      if (error) {
        setNotice({ tone: "error", text: error.message, server: true });
        return;
      }
      setNotice({ tone: "success", text: "Password saved. Opening your clinic workspace." });
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

  return (
    <main className="relative grid min-h-screen place-items-center bg-slate-50 p-5">
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
      <Card className="w-full max-w-md">
        <CardContent className="p-8">
          <div className="grid size-11 place-items-center rounded-2xl bg-primary text-white">
            <KeyRound />
          </div>
          <h1 className="mt-5 text-2xl font-bold">{t("Set your password")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("Create the password you will use on this clinic workstation.")}
          </p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block text-xs font-semibold">
              {t("New password")}
              <Input
                name="password"
                type="password"
                minLength={8}
                required
                autoComplete="new-password"
                className="mt-1.5"
                placeholder={t("At least 8 characters")}
              />
            </label>
            <label className="block text-xs font-semibold">
              {t("Confirm new password")}
              <Input
                name="confirmPassword"
                type="password"
                minLength={8}
                required
                autoComplete="new-password"
                className="mt-1.5"
                placeholder={t("Re-enter your password")}
              />
            </label>
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
                {notice.server ? <span data-no-translate>{notice.text}</span> : t(notice.text)}
              </div>
            )}
            <Button className="w-full min-h-11" disabled={loading}>
              {loading ? t("Saving…") : t("Save password")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
