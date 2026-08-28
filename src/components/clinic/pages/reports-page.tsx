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
import type { Appointment, Patient, Payment } from "@/lib/types";

function csvCell(value: string | number) {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function ReportsPage({ payments, patients, appointments }: {
  payments: Payment[]; patients: Patient[]; appointments: Appointment[];
}) {
  const { formatMoney, formatCompactMoney } = useClinicPreferences();
  const grossProduction = payments.reduce((sum, payment) => sum + payment.total, 0);
  const netCollection = payments.reduce((sum, payment) => sum + payment.paid, 0);
  const collectionRate = grossProduction ? (netCollection / grossProduction) * 100 : 0;
  const completedVisits = appointments.filter((appointment) => appointment.status === "Completed").length;
  const paymentChartData = Object.values(payments.reduce((months, payment) => {
    const parsed = new Date(payment.date);
    const month = Number.isNaN(parsed.getTime()) ? payment.date : parsed.toLocaleDateString("en-US", { month: "short" });
    months[month] = months[month] ?? { month, revenue: 0, expenses: 0 };
    months[month].revenue += payment.paid;
    return months;
  }, {} as Record<string, { month: string; revenue: number; expenses: number }>));
  if (!paymentChartData.length) paymentChartData.push({ month: "—", revenue: 0, expenses: 0 });
  const colors = ["#0f9f8f", "#6d5dfc", "#0ea5e9", "#f59e0b", "#e55f7c"];
  const procedureCounts = appointments.reduce((counts, appointment) => {
    counts[appointment.treatment] = (counts[appointment.treatment] ?? 0) + 1;
    return counts;
  }, {} as Record<string, number>);
  const procedureTotal = Math.max(1, appointments.length);
  const procedures = Object.entries(procedureCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([name, count], index) => ({ name, value: Math.round((count / procedureTotal) * 100), color: colors[index] }));
  const patientStatus = ["Active", "Inactive"].map((status) => ({
    source: status, patients: patients.filter((patient) => patient.status === status).length,
  }));
  const providerPerformance = Object.values(appointments.reduce((providers, appointment) => {
    const provider = providers[appointment.doctor] ?? { name: appointment.doctor, production: 0, patients: new Set<string>(), total: 0, completed: 0 };
    provider.production += appointment.treatmentPrice; provider.patients.add(appointment.patientId); provider.total += 1;
    if (appointment.status === "Completed") provider.completed += 1;
    providers[appointment.doctor] = provider; return providers;
  }, {} as Record<string, { name: string; production: number; patients: Set<string>; total: number; completed: number }>));
  const providers = [...new Set(appointments.map((appointment) => appointment.doctor))];
  const downloadReport = () => {
    try {
      const rows: (string | number)[][] = [
        ["Dental Clinic Executive Report"],
        ["Generated", new Date().toLocaleString()],
        [],
        ["Summary"],
        ["Gross production", formatMoney(grossProduction)],
        ["Net collection", formatMoney(netCollection)],
        ["Collection rate", `${collectionRate.toFixed(1)}%`],
        ["Patients", patients.length],
        ["Appointments", appointments.length],
        ["Completed visits", completedVisits],
        [],
        ["Provider performance"],
        ["Provider", "Production", "Patients", "Completed", "Appointments", "Utilization"],
        ...providerPerformance.map((provider) => [
          provider.name,
          provider.production,
          provider.patients.size,
          provider.completed,
          provider.total,
          `${provider.total ? Math.round((provider.completed / provider.total) * 100) : 0}%`,
        ]),
        [],
        ["Payments"],
        ["Invoice", "Patient", "Treatment", "Date", "Total", "Paid", "Discount", "Status", "Method"],
        ...payments.map((payment) => [
          payment.invoice,
          payment.patientName,
          payment.treatment,
          payment.date,
          payment.total,
          payment.paid,
          payment.discount,
          payment.status,
          payment.method,
        ]),
        [],
        ["Appointments"],
        ["Date", "Time", "Patient", "Treatment", "Provider", "Room", "Status", "Price"],
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
        ["Patients"],
        ["Patient number", "Name", "Phone", "Email", "Status", "Balance"],
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
      const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `clinic-executive-report-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      toast.success("Executive report downloaded");
    } catch {
      toast.error("Report could not be downloaded");
    }
  };
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap justify-between gap-3">
        <div className="flex gap-2">
          <select className="h-10 rounded-xl border bg-white px-3 text-sm">
            <option>All live records</option>
            <option>Last 90 days</option>
            <option>This year</option>
          </select>
          <select className="h-10 rounded-xl border bg-white px-3 text-sm">
            <option>All providers</option>
            {providers.map((provider) => <option key={provider} data-no-translate>{provider}</option>)}
          </select>
        </div>
        <Button onClick={downloadReport}>
          <Download />
          Download report
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            l: "Gross production",
            amount: grossProduction,
            d: `${payments.length} invoices`,
            icon: TrendingUp,
          },
          {
            l: "Net collection",
            amount: netCollection,
            d: `${collectionRate.toFixed(1)}% rate`,
            icon: FileBarChart,
          },
          { l: "New patients", v: String(patients.length), d: "Live records", icon: Users },
          { l: "Chair utilization", v: appointments.length ? `${Math.round((completedVisits / appointments.length) * 100)}%` : "0%", d: `${appointments.length} scheduled`, icon: TrendingUp },
        ].map((x) => {
          const Icon = x.icon;
          return (
            <Card key={x.l}>
              <CardContent className="p-5">
                <div className="flex justify-between">
                  <p className="text-xs text-muted-foreground">{x.l}</p>
                  <Icon className="size-4 text-primary" />
                </div>
                <p className="mt-2 text-2xl font-bold">
                  {x.amount ? formatMoney(x.amount) : x.v}
                </p>
                <p className="mt-1 text-xs font-semibold text-emerald-600">
                  {x.d}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Production & expenses</CardTitle>
            <p className="text-xs text-muted-foreground">
              Monthly financial performance
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-[310px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={paymentChartData} barGap={5}>
                  <CartesianGrid
                    vertical={false}
                    stroke="#eef1f3"
                    strokeDasharray="4 4"
                  />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "#82909c" }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: "#9aa5af" }}
                    tickFormatter={(v) => formatCompactMoney(Number(v))}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid #e5e9ec",
                      fontSize: 12,
                    }}
                    formatter={(v) => formatMoney(Number(v))}
                  />
                  <Bar
                    dataKey="revenue"
                    fill="#0f9f8f"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={28}
                  />
                  <Bar
                    dataKey="expenses"
                    fill="#d9e0e4"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={28}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Procedure mix</CardTitle>
            <p className="text-xs text-muted-foreground">
              Share of completed treatments
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={procedures}
                    dataKey="value"
                    innerRadius={56}
                    outerRadius={78}
                    paddingAngle={3}
                  >
                    {procedures.map((x) => (
                      <Cell key={x.name} fill={x.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {!procedures.length && <p className="-mt-24 pb-20 text-center text-sm text-muted-foreground">No completed treatment data yet.</p>}
            <div className="grid grid-cols-2 gap-2">
              {procedures.map((x) => (
                <div
                  key={x.name}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <i
                      className="size-2 rounded-full"
                      style={{ background: x.color }}
                    />
                    {x.name}
                  </span>
                  <b>{x.value}%</b>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Patient status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {patientStatus.map((x, i) => (
              <div key={x.source}>
                <div className="mb-1.5 flex justify-between text-xs">
                  <span className="font-semibold">{x.source}</span>
                  <span className="text-muted-foreground">
                    {x.patients} patients
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${patients.length ? (x.patients / patients.length) * 100 : 0}%`, opacity: 1 - i * 0.12 }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Provider performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="pb-3">Provider</th>
                    <th className="pb-3">Production</th>
                    <th className="pb-3">Patients</th>
                    <th className="pb-3">Utilization</th>
                  </tr>
                </thead>
                <tbody>
                  {providerPerformance.map((provider) => (
                    <tr key={provider.name} className="border-b last:border-0">
                      <td className="py-4 font-semibold" data-no-translate>{provider.name}</td>
                      <td className="py-4">{formatMoney(provider.production)}</td>
                      <td className="py-4">{provider.patients.size}</td>
                      <td className="py-4 font-semibold text-primary">
                        {provider.total ? Math.round((provider.completed / provider.total) * 100) : 0}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
