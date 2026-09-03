/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { FormEvent, useState } from "react";
import { Switch } from "@heroui/react";
import {
  Bell,
  Building2,
  Check,
  CreditCard,
  Database,
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
import { cn } from "@/lib/utils";
import type { ClinicInfo } from "@/lib/types";

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Switch
      aria-label="Toggle preference"
      isSelected={checked}
      onChange={onChange}
      size="sm"
    >
      <Switch.Control>
        <Switch.Thumb />
      </Switch.Control>
    </Switch>
  );
}

const sections = [
  { key: "clinic", label: "Clinic profile", icon: Building2 },
  { key: "localization", label: "Application language", icon: Languages },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "security", label: "Security & access", icon: ShieldCheck },
  { key: "billing", label: "Billing & plan", icon: CreditCard },
  { key: "data", label: "Data & integrations", icon: Database },
];

export function SettingsPage({ clinic, onSaveClinic }: {
  clinic: ClinicInfo;
  onSaveClinic: (clinic: ClinicInfo) => Promise<boolean>;
}) {
  const { language, setLanguage, currency, setCurrency } = useClinicPreferences();
  const [active, setActive] = useState("clinic");
  const [emailReminders, setEmailReminders] = useState(true);
  const [smsReminders, setSmsReminders] = useState(true);
  const [lowStock, setLowStock] = useState(true);
  const saveClinic = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const saved = await onSaveClinic({
      ...clinic, name: String(form.get("name")), phone: String(form.get("phone")),
      email: String(form.get("email")), address: {
        ...(clinic.address ?? {}), street: String(form.get("street")), city: String(form.get("city")),
      },
    });
    if (saved) toast.success("Clinic profile saved");
  };
  return (
    <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
      <Card className="h-fit">
        <CardContent className="p-2">
          {sections.map((s) => {
            const Icon = s.icon;
            return (
              <Button
                key={s.key}
                onClick={() => setActive(s.key)}
                variant={active === s.key ? "default" : "ghost"}
                className="w-full justify-start"
              >
                <Icon className="size-4" />
                {s.label}
              </Button>
            );
          })}
        </CardContent>
      </Card>
      <div>
        {active === "clinic" && (
          <Card>
            <CardHeader>
              <CardTitle>Clinic profile</CardTitle>
              <p className="text-xs text-muted-foreground">
                Information shown on receipts, reminders, and patient
                communications.
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={saveClinic} className="space-y-5">
              <div className="flex items-center gap-4">
                <div className="grid size-20 place-items-center rounded-2xl bg-primary text-3xl font-black text-white">
                  B
                </div>
                <div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toast.success("Logo uploader opened")}
                  >
                    Change logo
                  </Button>
                  <p className="mt-2 text-[10px] text-muted-foreground">
                    PNG or SVG · max 2 MB
                  </p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  ["Clinic name", "name", clinic.name],
                  ["Phone", "phone", clinic.phone ?? ""],
                  ["Email", "email", clinic.email ?? ""],
                  ["Address", "street", clinic.address?.street ?? ""],
                  ["City & ZIP", "city", clinic.address?.city ?? ""],
                ].map((x) => (
                  <label key={x[0]} className="text-xs font-semibold">
                    {x[0]}
                    <Input name={x[1]} defaultValue={x[2]} required={x[1] === "name"} className="mt-1.5" />
                  </label>
                ))}
              </div>
              <div className="flex justify-end">
                <Button type="submit">
                  <Save />
                  Save changes
                </Button>
              </div>
              </form>
            </CardContent>
          </Card>
        )}
        {active === "localization" && (
          <Card>
            <CardHeader>
              <CardTitle>Application language</CardTitle>
              <p className="text-xs text-muted-foreground">
                Choose the language used throughout this clinic workspace.
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              <label className="block max-w-md text-xs font-semibold">
                Application language
                <Select
                  value={language}
                  onChange={(event) => {
                    setLanguage(event.target.value as "en" | "ar");
                    toast.success("Application language updated");
                  }}
                  className="mt-1.5 h-10 w-full rounded-xl border bg-white px-3 text-sm"
                >
                  <option value="en">English</option>
                  <option value="ar">Arabic</option>
                </Select>
              </label>
              <label className="block max-w-md text-xs font-semibold">
                Clinic currency
                <Select
                  value={currency}
                  onChange={(event) => {
                    setCurrency(event.target.value as "USD" | "IQD");
                    toast.success("Clinic currency updated");
                  }}
                  className="mt-1.5 h-10 w-full rounded-xl border bg-white px-3 text-sm"
                >
                  <option value="IQD">Iraqi Dinar (IQD)</option>
                  <option value="USD">US Dollar (USD)</option>
                </Select>
              </label>
            </CardContent>
          </Card>
        )}
        {active === "notifications" && (
          <Card>
            <CardHeader>
              <CardTitle>Notification preferences</CardTitle>
              <p className="text-xs text-muted-foreground">
                Choose how the clinic and patients receive updates.
              </p>
            </CardHeader>
            <CardContent className="divide-y">
              {[
                [
                  "Email appointment reminders",
                  "Send patients confirmations and reminders by email",
                  emailReminders,
                  setEmailReminders,
                ],
                [
                  "SMS appointment reminders",
                  "Send a text 24 hours before each visit",
                  smsReminders,
                  setSmsReminders,
                ],
                [
                  "Low-stock alerts",
                  "Notify administrators when supplies reach reorder level",
                  lowStock,
                  setLowStock,
                ],
              ].map((x: any) => (
                <div
                  key={x[0]}
                  className="flex items-center justify-between gap-4 py-4"
                >
                  <div>
                    <p className="text-sm font-semibold">{x[0]}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{x[1]}</p>
                  </div>
                  <Toggle checked={x[2]} onChange={x[3]} />
                </div>
              ))}
              <div className="flex justify-end pt-5">
                <Button
                  onClick={() =>
                    toast.success("Notification preferences saved")
                  }
                >
                  <Save />
                  Save preferences
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        {active === "security" && (
          <Card>
            <CardHeader>
              <CardTitle>Security & access</CardTitle>
              <p className="text-xs text-muted-foreground">
                Protect clinical data and control session behavior.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 rounded-2xl border p-4">
                <div className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                  <LockKeyhole className="size-5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">
                    Multi-factor authentication
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Required for owners and administrators
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                  <Check className="size-4" />
                  Enabled
                </span>
              </div>
              <label className="block text-xs font-semibold">
                Automatic sign-out
                <Select className="mt-1.5 h-10 w-full rounded-xl border bg-white px-3 text-sm">
                  <option>After 30 minutes of inactivity</option>
                  <option>After 1 hour</option>
                  <option>At the end of the day</option>
                </Select>
              </label>
              <Button onClick={() => toast.success("Security policy updated")}>
                Update security policy
              </Button>
            </CardContent>
          </Card>
        )}
        {active === "billing" && (
          <Card>
            <CardHeader>
              <CardTitle>Billing & subscription</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-2xl bg-gradient-to-br from-primary to-[#087a70] p-6 text-white">
                <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
                  Professional plan
                </p>
                <p className="mt-2 text-3xl font-bold">
                  $149{" "}
                  <span className="text-sm font-medium text-white/70">
                    / month
                  </span>
                </p>
                <p className="mt-3 max-w-lg text-sm text-white/80">
                  Unlimited patients, up to 15 staff, clinical storage,
                  reporting, realtime updates, and priority support.
                </p>
                <Button
                  className="mt-5 bg-white text-primary hover:bg-white/90"
                  onClick={() => toast.success("Billing portal opened")}
                >
                  Manage subscription
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        {active === "data" && (
          <Card>
            <CardHeader>
              <CardTitle>Data & integrations</CardTitle>
              <p className="text-xs text-muted-foreground">
                Database status and connected clinic services.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                [
                  "Supabase database",
                  "Connected · Realtime enabled",
                  "bg-emerald-500",
                ],
                [
                  "Private clinical storage",
                  "Configured · RLS protected",
                  "bg-emerald-500",
                ],
                ["Insurance clearinghouse", "Not connected", "bg-slate-300"],
                ["Accounting export", "Ready", "bg-emerald-500"],
              ].map((x) => (
                <div
                  key={x[0]}
                  className="flex items-center gap-3 rounded-xl border p-4"
                >
                  <span className={cn("size-2.5 rounded-full", x[2])} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{x[0]}</p>
                    <p className="text-xs text-muted-foreground">{x[1]}</p>
                  </div>
                  <Button size="sm" variant="outline">
                    Configure
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
