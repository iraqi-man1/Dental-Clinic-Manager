"use client";

import { Download, FileBarChart, TrendingUp, Users } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useClinicPreferences } from "@/lib/clinic-preferences";
import { DEFAULT_CLINIC_TIME_ZONE, clinicDateKey, clinicTodayKey } from "@/lib/clinic-time";
import type { Appointment, Patient, Payment } from "@/lib/types";
import {
  DataTable,
  EmptyState,
  FilterBar,
  StatCard,
  type DataTableColumn,
} from "@/components/clinic/app-ui";

const CHART_COLORS = ["#0f9f8f", "#6d5dfc", "#0ea5e9", "#f59e0b", "#e55f7c"];
const PATIENT_STATUSES = ["Active", "Inactive"] as const;
// Touch targets are 44px on phones and the desktop size from the sm breakpoint.
const TOUCH_HEIGHT = "h-11 sm:h-10";

function csvCell(value: string | number) {
  if (typeof value === "number") return String(value);
  // Spreadsheet apps run text that starts with these characters as formulas.
  const text = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${text.replaceAll('"', '""')}"`;
}

type ProviderRow = { name: string; production: number; patients: Set<string>; total: number; completed: number };

export function ReportsPage({ payments, patients, appointments, timeZone = DEFAULT_CLINIC_TIME_ZONE }: {
  payments: Payment[]; patients: Patient[]; appointments: Appointment[];
  /** Clinic time zone for month grouping and labels. Defaults to the clinic default zone. */
  timeZone?: string;
}) {
  const { formatCompactMoney, formatDate, formatMoney, t } = useClinicPreferences();
  // Payments carry the `paidAt` instant. The English `date` label is kept for the export fallback only.
  const paymentDate = (payment: Payment) =>
    payment.paidAt
      ? formatDate(payment.paidAt, { timeZone, month: "short", day: "numeric", year: "numeric" })
      : payment.date;
  const grossProduction = payments.reduce((sum, payment) => sum + payment.total, 0);
  const netCollection = payments.reduce((sum, payment) => sum + payment.paid, 0);
  const collectionRate = grossProduction ? (netCollection / grossProduction) * 100 : 0;
  const completedAppointments = appointments.filter((appointment) => appointment.status === "Completed");
  const completedVisits = completedAppointments.length;
  const completionRate = appointments.length ? Math.round((completedVisits / appointments.length) * 100) : 0;

  // Monthly collections, in calendar order. Each payment falls in the clinic-local month of its instant.
  const monthRevenue = new Map<string, number>();
  for (const payment of payments) {
    const dateKey = payment.paidAt ? clinicDateKey(payment.paidAt, timeZone) : "";
    if (!dateKey) continue;
    const monthKey = dateKey.slice(0, 7);
    monthRevenue.set(monthKey, (monthRevenue.get(monthKey) ?? 0) + payment.paid);
  }
  // YYYY-MM keys sort chronologically as plain strings.
  const monthlyData = [...monthRevenue.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([monthKey, revenue]) => ({
      label: formatDate(`${monthKey}-01`, { timeZone, month: "short", year: "2-digit" }),
      revenue,
    }));
  if (!monthlyData.length) monthlyData.push({ label: "—", revenue: 0 });

  // Procedure mix counts completed visits only, which matches the card description.
  const treatmentCounts = new Map<string, number>();
  for (const appointment of completedAppointments) {
    treatmentCounts.set(appointment.treatment, (treatmentCounts.get(appointment.treatment) ?? 0) + 1);
  }
  const procedures = [...treatmentCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count], index) => ({
      name,
      count,
      percent: completedVisits ? Math.round((count / completedVisits) * 100) : 0,
      color: CHART_COLORS[index],
    }));

  const patientStatus = PATIENT_STATUSES.map((status) => ({
    status,
    count: patients.filter((patient) => patient.status === status).length,
  }));

  const providerMap = new Map<string, ProviderRow>();
  for (const appointment of appointments) {
    const row = providerMap.get(appointment.doctor) ?? { name: appointment.doctor, production: 0, patients: new Set<string>(), total: 0, completed: 0 };
    row.production += appointment.treatmentPrice;
    row.patients.add(appointment.patientId);
    row.total += 1;
    if (appointment.status === "Completed") row.completed += 1;
    providerMap.set(appointment.doctor, row);
  }
  const providerPerformance = [...providerMap.values()];
  const utilizationOf = (provider: ProviderRow) => (provider.total ? Math.round((provider.completed / provider.total) * 100) : 0);

  const providerColumns: DataTableColumn<ProviderRow>[] = [
    { key: "provider", label: t("Provider"), isRowHeader: true, render: (provider) => <span className="font-semibold" data-no-translate>{provider.name}</span> },
    { key: "production", label: t("Production"), render: (provider) => formatMoney(provider.production) },
    { key: "patients", label: t("Patients"), render: (provider) => provider.patients.size },
    { key: "utilization", label: t("Utilization"), render: (provider) => <span className="font-semibold text-primary">{utilizationOf(provider)}%</span> },
  ];

  const stats: { label: string; value: string; note: string; icon: typeof TrendingUp; tone: "accent" | "success" | "info" | "warning" }[] = [
    { label: t("Gross production"), value: formatMoney(grossProduction), note: t("{count} invoices", { count: payments.length }), icon: TrendingUp, tone: "accent" },
    { label: t("Net collection"), value: formatMoney(netCollection), note: t("{rate}% collection rate", { rate: collectionRate.toFixed(1) }), icon: FileBarChart, tone: "success" },
    { label: t("Total patients"), value: String(patients.length), note: t("Live records"), icon: Users, tone: "info" },
    { label: t("Completed visits"), value: String(completedVisits), note: t("{rate}% of {total} scheduled", { rate: completionRate, total: appointments.length }), icon: TrendingUp, tone: "warning" },
  ];

  const downloadReport = () => {
    try {
      const rows: (string | number)[][] = [
        [t("Dental Clinic Executive Report")],
        [t("Generated"), formatDate(new Date(), { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone })],
        [],
        [t("Summary")],
        [t("Gross production"), formatMoney(grossProduction)],
        [t("Net collection"), formatMoney(netCollection)],
        [t("Collection rate"), `${collectionRate.toFixed(1)}%`],
        [t("Patients"), patients.length],
        [t("Appointments"), appointments.length],
        [t("Completed visits"), completedVisits],
        [],
        [t("Provider performance")],
        [t("Provider"), t("Production"), t("Patients"), t("Completed"), t("Appointments"), t("Utilization")],
        ...providerPerformance.map((provider) => [
          provider.name,
          provider.production,
          provider.patients.size,
          provider.completed,
          provider.total,
          `${utilizationOf(provider)}%`,
        ]),
        [],
        [t("Payments")],
        [t("Invoice"), t("Patient"), t("Treatment"), t("Date"), t("Total"), t("Paid"), t("Discount"), t("Status"), t("Method")],
        ...payments.map((payment) => [
          payment.invoice,
          payment.patientName,
          payment.treatment,
          paymentDate(payment),
          payment.total,
          payment.paid,
          payment.discount,
          payment.status,
          payment.method,
        ]),
        [],
        [t("Appointments")],
        [t("Date"), t("Time"), t("Patient"), t("Treatment"), t("Provider"), t("Room"), t("Status"), t("Price")],
        ...appointments.map((appointment) => [
          appointment.date,
          appointment.time,
          appointment.patientName,
          appointment.treatment,
          appointment.doctor,
          appointment.room,
          appointment.status,
          appointment.treatmentPrice,
        ]),
        [],
        [t("Patients")],
        [t("Patient number"), t("Name"), t("Phone"), t("Email"), t("Status"), t("Balance")],
        ...patients.map((patient) => [
          patient.patientNo,
          patient.name,
          patient.phone,
          patient.email,
          patient.status,
          patient.balance,
        ]),
      ];
      const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
      const url = URL.createObjectURL(new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `clinic-executive-report-${clinicTodayKey(timeZone)}.csv`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(t("Executive report downloaded"));
    } catch {
      toast.error(t("Report could not be downloaded"));
    }
  };

  return (
    <div className="space-y-5">
      <FilterBar className="justify-end">
        <Button className={TOUCH_HEIGHT} onClick={downloadReport}>
          <Download />
          {t("Download report")}
        </Button>
      </FilterBar>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            note={stat.note}
            icon={stat.icon}
            tone={stat.tone}
          />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>{t("Monthly collections")}</CardTitle>
            <p className="text-xs text-muted-foreground">{t("Amounts collected per month")}</p>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] sm:h-[310px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} barGap={5} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} stroke="#eef1f3" strokeDasharray="4 4" />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                    minTickGap={12}
                    tick={{ fontSize: 11, fill: "#82909c" }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    width={56}
                    tick={{ fontSize: 10, fill: "#9aa5af" }}
                    tickFormatter={(v) => formatCompactMoney(Number(v))}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid #e5e9ec", fontSize: 12 }}
                    formatter={(v) => formatMoney(Number(v))}
                  />
                  <Bar dataKey="revenue" fill="#0f9f8f" radius={[6, 6, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>{t("Procedure mix")}</CardTitle>
            <p className="text-xs text-muted-foreground">{t("Share of completed treatments")}</p>
          </CardHeader>
          <CardContent>
            {procedures.length ? (
              <>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={procedures} dataKey="count" nameKey="name" innerRadius={56} outerRadius={78} paddingAngle={3}>
                        {procedures.map((x) => (
                          <Cell key={x.name} fill={x.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => String(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {procedures.map((x) => (
                    <li key={x.name} className="flex min-w-0 items-center justify-between gap-2 text-xs">
                      <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                        <i className="size-2 shrink-0 rounded-full" style={{ background: x.color }} />
                        <span className="truncate" data-no-translate>{x.name}</span>
                      </span>
                      <b className="shrink-0">{x.percent}%</b>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <EmptyState
                icon={FileBarChart}
                title={t("No completed treatment data yet.")}
                description={t("Procedure mix appears after visits are marked completed.")}
              />
            )}
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("Patient status")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {patientStatus.map((x, i) => (
              <div key={x.status}>
                <div className="mb-1.5 flex justify-between text-xs">
                  <span className="font-semibold">{t(x.status)}</span>
                  <span className="text-muted-foreground">{t("{count} patients", { count: x.count })}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${patients.length ? (x.count / patients.length) * 100 : 0}%`, opacity: 1 - i * 0.12 }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("Provider performance")}</CardTitle>
          </CardHeader>
          <CardContent>
            {providerPerformance.length ? <DataTable ariaLabel={t("Provider performance")} columns={providerColumns} rows={providerPerformance} getRowKey={(provider) => provider.name} /> : <EmptyState icon={Users} title={t("No provider activity yet")} description={t("Provider performance will appear after appointments are scheduled.")} />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
