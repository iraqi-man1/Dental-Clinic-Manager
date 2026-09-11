/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { FormEvent, useState } from "react";
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
import type { ClinicInfo } from "@/lib/types";

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <Switch
      aria-label={label}
      checked={checked}
      onCheckedChange={onChange}
    />
  );
}

const sections = [
  { key: "clinic", label: "Clinic profile", icon: Building2 },
  { key: "localization", label: "Application language", icon: Languages },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "security", label: "Security & access", icon: ShieldCheck },
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
                {s.label}
              </Button>
            );
          })}
        </CardContent>
      </Card>
      <div className="min-w-0">
        {active === "clinic" && (
          <Card>
            <CardHeader>
              <CardTitle>Clinic profile</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={saveClinic} className="space-y-5">
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
                  <Toggle checked={x[2]} onChange={x[3]} label={x[0]} />
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

      </div>
    </div>
  );
}
