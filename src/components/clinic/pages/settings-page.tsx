"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Switch } from "@/components/ui/switch";
import {
  Bell,
  Building2,
  Check,
  Languages,
  LockKeyhole,
  Save,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useClinicPreferences } from "@/lib/clinic-preferences";
import { DEFAULT_CLINIC_TIME_ZONE, isValidTimeZone } from "@/lib/clinic-time";
import { loadClinicPreferences } from "@/lib/supabase/clinic-data";
import { hasSupabaseConfig } from "@/lib/supabase/client";
import type { AppLanguage, ClinicCurrency, ClinicInfo, ClinicRole } from "@/lib/types";

const sections = [
  { key: "clinic", label: "Clinic profile", icon: Building2 },
  { key: "localization", label: "Application language", icon: Languages },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "security", label: "Security & access", icon: ShieldCheck },
] as const;
type SectionKey = (typeof sections)[number]["key"];

/** Common clinic zones. Asia/Baghdad always comes first. */
const commonTimeZones = [
  DEFAULT_CLINIC_TIME_ZONE,
  "Asia/Riyadh",
  "Asia/Kuwait",
  "Asia/Dubai",
  "Asia/Amman",
  "Asia/Beirut",
  "Asia/Damascus",
  "Asia/Tehran",
  "Africa/Cairo",
  "Europe/Istanbul",
  "Europe/London",
  "America/New_York",
  "UTC",
];

const notificationItems = [
  { key: "email", title: "Email appointment reminders", description: "Send patients confirmations and reminders by email" },
  { key: "sms", title: "SMS appointment reminders", description: "Send a text 24 hours before each visit" },
  { key: "lowStock", title: "Low-stock alerts", description: "Notify administrators when supplies reach reorder level" },
] as const;
type NotificationKey = (typeof notificationItems)[number]["key"];

const signOutOptions = [
  "After 30 minutes of inactivity",
  "After 1 hour",
  "At the end of the day",
] as const;

/* Phones get 44px touch targets. Desktop keeps the compact height. */
const fieldClass = "mt-1.5 min-h-11 sm:min-h-0";
const selectClass = "mt-1.5 min-h-11 w-full rounded-xl border bg-white px-3 text-sm sm:min-h-0 sm:h-10";
const buttonTouch = "min-h-11 sm:min-h-0";

function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <Switch
      aria-label={label}
      checked={checked}
      disabled={disabled}
      onCheckedChange={onChange}
    />
  );
}

export function SettingsPage({ clinic, onSaveClinic, role }: {
  clinic: ClinicInfo;
  onSaveClinic: (clinic: ClinicInfo) => Promise<boolean>;
  /**
   * The signed-in user's clinic role. Only owners and admins see the clinic default language.
   * The database enforces the same rule. A missing role hides the control.
   */
  role?: ClinicRole;
}) {
  const { language, setLanguage, currency, setCurrency, setClinicDefaultLanguage, t } = useClinicPreferences();
  const configured = hasSupabaseConfig();
  const canManageDefaults = role === "owner" || role === "admin";
  const [active, setActive] = useState<SectionKey>("clinic");
  const [savingClinic, setSavingClinic] = useState(false);
  const [clinicSaveFailed, setClinicSaveFailed] = useState(false);
  const [clinicDefault, setClinicDefault] = useState<AppLanguage | null>(configured ? null : language);
  const [clinicDefaultLoadFailed, setClinicDefaultLoadFailed] = useState(false);
  const [savingDefault, setSavingDefault] = useState(false);
  const [savingCurrency, setSavingCurrency] = useState(false);
  // Notification toggles are not stored anywhere yet. They are shown for review only.
  const [notifications, setNotifications] = useState<Record<NotificationKey, boolean>>({
    email: true,
    sms: true,
    lowStock: true,
  });

  const currentZone = clinic.timezone && isValidTimeZone(clinic.timezone) ? clinic.timezone : DEFAULT_CLINIC_TIME_ZONE;
  const zoneOptions = useMemo(
    () => [...new Set([...commonTimeZones.filter(isValidTimeZone), currentZone])],
    [currentZone],
  );

  useEffect(() => {
    if (!canManageDefaults || !configured) return;
    let cancelled = false;
    loadClinicPreferences()
      .then((preferences) => {
        if (cancelled) return;
        if (preferences) setClinicDefault(preferences.language);
        else setClinicDefaultLoadFailed(true);
      })
      .catch(() => {
        if (!cancelled) setClinicDefaultLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [canManageDefaults, configured]);

  const saveClinic = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (savingClinic) return;
    const form = new FormData(event.currentTarget);
    const timezone = String(form.get("timezone") ?? "");
    if (!isValidTimeZone(timezone)) { toast.error(t("Choose a valid time zone.")); return; }
    setSavingClinic(true);
    try {
      const saved = await onSaveClinic({
        ...clinic,
        name: String(form.get("name") ?? ""),
        phone: String(form.get("phone") ?? ""),
        email: String(form.get("email") ?? ""),
        address: {
          ...(clinic.address ?? {}),
          street: String(form.get("street") ?? ""),
          city: String(form.get("city") ?? ""),
        },
        timezone,
      });
      setClinicSaveFailed(!saved);
      if (saved) toast.success(t("Clinic profile saved"));
    } finally {
      setSavingClinic(false);
    }
  };

  const changeClinicDefault = async (next: AppLanguage) => {
    setSavingDefault(true);
    try {
      const result = await setClinicDefaultLanguage(next);
      if (!result.ok) { toast.error(result.error ?? t("The clinic default could not be saved.")); return; }
      setClinicDefault(next);
      toast.success(t("Clinic default language updated"));
    } finally {
      setSavingDefault(false);
    }
  };

  const changeCurrency = async (next: ClinicCurrency) => {
    setSavingCurrency(true);
    try {
      const result = await setCurrency(next);
      if (result.ok) toast.success(t("Clinic currency updated"));
      else toast.error(result.error ?? t("The clinic currency could not be saved."));
    } finally {
      setSavingCurrency(false);
    }
  };

  const profileFields = [
    { name: "name", label: "Clinic name", value: clinic.name, required: true },
    { name: "phone", label: "Phone", value: clinic.phone ?? "", required: false },
    { name: "email", label: "Email", value: clinic.email ?? "", required: false },
    { name: "street", label: "Address", value: clinic.address?.street ?? "", required: false },
    { name: "city", label: "City & ZIP", value: clinic.address?.city ?? "", required: false },
  ];

  return (
    <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
      <Card className="h-fit">
        <CardContent className="flex flex-col gap-1 p-3 sm:p-3">
          {sections.map((s) => {
            const Icon = s.icon;
            return (
              <Button
                key={s.key}
                onClick={() => setActive(s.key)}
                variant={active === s.key ? "default" : "ghost"}
                className="h-auto min-h-11 w-full justify-start gap-3 whitespace-normal px-3 py-3 text-start"
              >
                <Icon className="size-4" />
                {t(s.label)}
              </Button>
            );
          })}
        </CardContent>
      </Card>
      <div className="min-w-0">
        {active === "clinic" && (
          <Card>
            <CardHeader>
              <CardTitle>{t("Clinic profile")}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={saveClinic} className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  {profileFields.map((field) => (
                    <label key={field.name} className="text-xs font-semibold">
                      {t(field.label)}
                      <Input name={field.name} defaultValue={field.value} required={field.required} className={fieldClass} />
                    </label>
                  ))}
                  <label className="text-xs font-semibold sm:col-span-2">
                    {t("Time zone")}
                    <Select name="timezone" defaultValue={currentZone} className={selectClass}>
                      {zoneOptions.map((zone) => (
                        <option key={zone} value={zone} data-no-translate>{zone}</option>
                      ))}
                    </Select>
                    <span className="mt-1.5 block text-[11px] font-normal text-muted-foreground">
                      {t("Appointment times and today's date use this time zone. Default: {zone}", { zone: DEFAULT_CLINIC_TIME_ZONE })}
                    </span>
                  </label>
                </div>
                {clinicSaveFailed && (
                  <p role="alert" className="text-sm font-semibold text-rose-700">
                    {t("Clinic profile was not saved. Check the details and try again.")}
                  </p>
                )}
                <div className="flex justify-end">
                  <Button type="submit" className={buttonTouch} disabled={savingClinic}>
                    <Save />
                    {savingClinic ? t("Saving…") : t("Save changes")}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
        {active === "localization" && (
          <Card>
            <CardHeader>
              <CardTitle>{t("Application language")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <p className="text-sm font-semibold">{t("This workstation")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("Changes the language on this computer only. It does not change what other staff see.")}
                </p>
                <label className="block max-w-md text-xs font-semibold">
                  {t("Language")}
                  <Select
                    value={language}
                    onChange={(event) => {
                      setLanguage(event.target.value as AppLanguage);
                      toast.success(t("Application language updated"));
                    }}
                    className={selectClass}
                  >
                    <option value="en">{t("English")}</option>
                    <option value="ar">{t("Arabic")}</option>
                  </Select>
                </label>
              </div>
              {canManageDefaults && (
                <div className="space-y-2 border-t pt-6">
                  <p className="text-sm font-semibold">{t("Clinic default")}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("Used by workstations that have not chosen a language yet. Only the clinic owner or an administrator can change it.")}
                  </p>
                  {clinicDefault === null ? (
                    <p className="text-xs text-muted-foreground" role={clinicDefaultLoadFailed ? "alert" : undefined}>
                      {clinicDefaultLoadFailed ? t("The clinic default could not be loaded.") : t("Loading clinic default…")}
                    </p>
                  ) : (
                    <label className="block max-w-md text-xs font-semibold">
                      {t("Language")}
                      <Select
                        value={clinicDefault}
                        disabled={savingDefault}
                        onChange={(event) => void changeClinicDefault(event.target.value as AppLanguage)}
                        className={selectClass}
                      >
                        <option value="en">{t("English")}</option>
                        <option value="ar">{t("Arabic")}</option>
                      </Select>
                    </label>
                  )}
                </div>
              )}
              <div className="border-t pt-6">
                <label className="block max-w-md text-xs font-semibold">
                  {t("Clinic currency")}
                  <Select
                    value={currency}
                    disabled={savingCurrency}
                    onChange={(event) => void changeCurrency(event.target.value as ClinicCurrency)}
                    className={selectClass}
                  >
                    <option value="IQD">{t("Iraqi Dinar (IQD)")}</option>
                    <option value="USD">{t("US Dollar (USD)")}</option>
                  </Select>
                </label>
              </div>
            </CardContent>
          </Card>
        )}
        {active === "notifications" && (
          <Card>
            <CardHeader>
              <CardTitle>{t("Notification preferences")}</CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
              <p className="pb-4 text-xs font-semibold text-amber-800">
                {t("These reminder settings are not connected to the clinic database yet, so changes are not saved.")}
              </p>
              {notificationItems.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between gap-4 py-4"
                >
                  <div>
                    <p className="text-sm font-semibold">{t(item.title)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{t(item.description)}</p>
                  </div>
                  <Toggle
                    checked={notifications[item.key]}
                    onChange={(value) => setNotifications((current) => ({ ...current, [item.key]: value }))}
                    label={t(item.title)}
                  />
                </div>
              ))}
              <div className="flex justify-end pt-5">
                <Button disabled className={buttonTouch}>
                  <Save />
                  {t("Save preferences")}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        {active === "security" && (
          <Card>
            <CardHeader>
              <CardTitle>{t("Security & access")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs font-semibold text-amber-800">
                {t("These security settings are not connected yet and cannot be changed from this screen.")}
              </p>
              <div className="flex items-center gap-4 rounded-2xl border p-4">
                <div className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                  <LockKeyhole className="size-5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">
                    {t("Multi-factor authentication")}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                  <Check className="size-4" />
                  {t("Enabled")}
                </span>
              </div>
              <label className="block text-xs font-semibold">
                {t("Automatic sign-out")}
                <Select disabled className={selectClass}>
                  {signOutOptions.map((option) => <option key={option}>{t(option)}</option>)}
                </Select>
              </label>
              <Button disabled className={buttonTouch}>
                {t("Update security policy")}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
