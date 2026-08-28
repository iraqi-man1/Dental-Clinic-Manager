"use client";

import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarCheck2,
  CircleDollarSign,
  CreditCard,
  MoreHorizontal,
  Stethoscope,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { Appointment, NavKey, Patient, Payment, TreatmentSession } from "@/lib/types";
import { cn, initials } from "@/lib/utils";
import { useClinicPreferences } from "@/lib/clinic-preferences";

const statStyle = [
  {
    label: "Today’s appointments",
    value: "0",
    note: "0 confirmed",
    trend: "Live",
    up: true,
    icon: CalendarCheck2,
    tint: "bg-teal-50 text-teal-700",
  },
  {
    label: "Total patients",
    value: "0",
    note: "Live patient records",
    trend: "Live",
    up: true,
    icon: Users,
    tint: "bg-blue-50 text-blue-700",
  },
  {
    label: "Revenue this month",
    value: "0",
    amount: 0,
    note: "0 invoices",
    trend: "Live",
    up: true,
    icon: CircleDollarSign,
    tint: "bg-violet-50 text-violet-700",
  },
  {
    label: "Outstanding",
    value: "0",
    amount: 0,
    note: "0 open invoices",
    trend: "Live",
    up: true,
    icon: CreditCard,
    tint: "bg-amber-50 text-amber-700",
  },
  {
    label: "Active treatments",
    value: "0",
    note: "0 sessions remaining",
    trend: "Live",
    up: true,
    icon: Stethoscope,
    tint: "bg-rose-50 text-rose-700",
  },
];

const appointmentStatus = (status: Appointment["status"]) =>
  status === "Confirmed"
    ? "default"
    : status === "Checked in" || status === "In treatment"
      ? "success"
      : status === "Pending"
        ? "warning"
        : "secondary";

export function DashboardPage({
  appointments,
  patients,
  payments,
  sessions,
  onNavigate,
}: {
  appointments: Appointment[];
  patients: Patient[];
  payments: Payment[];
  sessions: TreatmentSession[];
  onNavigate: (key: NavKey) => void;
}) {
  const { language, formatMoney, formatCompactMoney } = useClinicPreferences();
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const today = appointments.filter((appointment) => appointment.date === todayKey);
  const shown = today.slice(0, 5);
  const revenue = payments.reduce((sum, payment) => sum + payment.paid, 0);
  const outstanding = payments.reduce((sum, payment) => sum + Math.max(0, payment.total - payment.discount - payment.paid), 0);
  const activeTreatments = new Set(sessions.filter((session) => session.status !== "completed" && session.status !== "cancelled").map((session) => session.planId)).size;
  const paymentChartData = Object.values(payments.reduce((months, payment) => {
    const parsed = new Date(payment.date);
    const month = Number.isNaN(parsed.getTime()) ? payment.date : parsed.toLocaleDateString("en-US", { month: "short" });
    months[month] = months[month] ?? { month, revenue: 0, expenses: 0 };
    months[month].revenue += payment.paid;
    return months;
  }, {} as Record<string, { month: string; revenue: number; expenses: number }>));
  if (!paymentChartData.length) paymentChartData.push({ month: "—", revenue: 0, expenses: 0 });
  const stats = statStyle.map((stat) => stat.label === "Today’s appointments"
    ? { ...stat, value: String(today.length), note: `${today.filter((appointment) => appointment.status === "Confirmed").length} confirmed` }
    : stat.label === "Total patients" ? { ...stat, value: patients.length.toLocaleString(), note: "Live patient records" }
    : stat.label === "Revenue this month" ? { ...stat, amount: revenue, noteAmount: undefined, note: `${payments.length} invoices` }
    : stat.label === "Outstanding" ? { ...stat, amount: outstanding, note: `${payments.filter((payment) => payment.status !== "Paid").length} open invoices` }
    : stat.label === "Active treatments" ? { ...stat, value: String(activeTreatments), note: `${sessions.filter((session) => session.status !== "completed" && session.status !== "cancelled").length} sessions remaining` }
    : stat);
  const pipeline = [
    { label: "Planned", sessions: sessions.filter((session) => session.status === "planned"), color: "bg-blue-500" },
    { label: "In progress", sessions: sessions.filter((session) => session.status === "scheduled"), color: "bg-primary" },
    { label: "Completed", sessions: sessions.filter((session) => session.status === "completed"), color: "bg-violet-500" },
  ].map((item) => ({ ...item, value: item.sessions.length, amount: item.sessions.reduce((sum, session) => sum + session.expectedAmount, 0) }));
  const maxPipeline = Math.max(1, ...pipeline.map((item) => item.value));
  const activePatients = patients.filter((patient) => patient.status === "Active").length;
  const retention = patients.length ? Math.round((activePatients / patients.length) * 100) : 0;
  const completedVisits = today.filter((appointment) => appointment.status === "Completed").length;
  const recentActivity = [
    ...payments.filter((payment) => payment.paid > 0).slice(0, 2).map((payment) => ({ icon: CreditCard, title: "Payment received", detail: `${payment.patientName} · ${formatMoney(payment.lastPaymentAmount ?? payment.paid)}`, time: payment.date, bg: "bg-emerald-50 text-emerald-700" })),
    ...today.slice(0, 2).map((appointment) => ({ icon: CalendarCheck2, title: "Appointment booked", detail: `${appointment.patientName} · ${appointment.treatment}`, time: appointment.time, bg: "bg-blue-50 text-blue-700" })),
  ].slice(0, 4);
  return (
    <div className="space-y-5">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card
              key={stat.label}
              className="group overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <CardContent className="p-4 sm:p-5">
                <div className="mb-4 flex items-start justify-between">
                  <div
                    className={cn(
                      "grid size-10 place-items-center rounded-xl",
                      stat.tint,
                    )}
                  >
                    <Icon className="size-[18px]" />
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold",
                      stat.up
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-rose-50 text-rose-700",
                    )}
                  >
                    {stat.up ? (
                      <ArrowUpRight className="size-3" />
                    ) : (
                      <ArrowDownRight className="size-3" />
                    )}
                    {stat.trend}
                  </span>
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-[.08em] text-muted-foreground">
                  {stat.label}
                </p>
                <p className="mt-1 text-2xl font-bold tracking-tight">
                  {stat.amount !== undefined ? formatMoney(stat.amount) : stat.value}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {stat.note}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </section>
      <section className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Revenue overview</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Income compared with operating expenses
              </p>
            </div>
            <select className="rounded-lg border bg-white px-3 py-2 text-xs font-medium outline-none">
              <option>Last 6 months</option>
              <option>This year</option>
            </select>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex items-end gap-6">
              <div>
                <p className="text-xs text-muted-foreground">Net revenue</p>
                <p className="text-2xl font-bold">{formatMoney(revenue)}</p>
              </div>
              <Badge variant="success">{payments.length ? `${payments.length} live invoices` : "No financial activity yet"}</Badge>
            </div>
            <div className="h-[245px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={paymentChartData}
                  margin={{ left: -15, right: 10, top: 10 }}
                >
                  <defs>
                    <linearGradient id="revenue" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="#0f9f8f"
                        stopOpacity={0.25}
                      />
                      <stop offset="100%" stopColor="#0f9f8f" stopOpacity={0} />
                    </linearGradient>
                  </defs>
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
                    dy={8}
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
                      boxShadow: "0 12px 30px rgba(15,23,42,.10)",
                      fontSize: 12,
                    }}
                    formatter={(v) => formatMoney(Number(v))}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#0f9f8f"
                    strokeWidth={3}
                    fill="url(#revenue)"
                  />
                  <Area
                    type="monotone"
                    dataKey="expenses"
                    stroke="#c4cdd4"
                    strokeWidth={2}
                    fill="transparent"
                    strokeDasharray="5 5"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Today’s schedule</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date().toLocaleDateString(language === "ar" ? "ar-IQ" : "en-US", { weekday: "long", month: "long", day: "numeric" })}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate("appointments")}
            >
              View calendar <ArrowRight />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {shown.map((appt) => (
              <button
                key={appt.id}
                type="button"
                onClick={() => onNavigate("appointments")}
                className="flex w-full items-center gap-3 rounded-xl border border-transparent p-2.5 text-left transition hover:border-border hover:bg-slate-50"
              >
                <div className="w-14 shrink-0">
                  <p className="text-xs font-bold text-slate-800">
                    {appt.time.replace(" ", "")}{" "}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {appt.room}
                  </p>
                </div>
                <span
                  className="h-9 w-1 rounded-full"
                  style={{ backgroundColor: appt.color }}
                />
                <Avatar className="size-9">
                  <AvatarFallback>{initials(appt.patientName)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold" data-no-translate>
                    {appt.patientName}
                  </p>
                  <p className="truncate text-xs text-muted-foreground" data-no-translate>
                    {appt.treatment}
                  </p>
                </div>
                <Badge
                  variant={appointmentStatus(appt.status)}
                  className="hidden sm:inline-flex"
                >
                  {appt.status}
                </Badge>
              </button>
            ))}
          </CardContent>
        </Card>
      </section>
      <section className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Treatment pipeline</CardTitle>
            <Button variant="ghost" size="icon">
              <MoreHorizontal />
            </Button>
          </CardHeader>
          <CardContent className="space-y-5">
            {pipeline.map((item) => (
              <div key={item.label}>
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="font-semibold">
                    {item.label}{" "}
                    <span className="font-normal text-muted-foreground">
                      · {item.value}
                    </span>
                  </span>
                  <span className="font-bold">{formatMoney(item.amount)}</span>
                </div>
                <Progress
                  value={(item.value / maxPipeline) * 100}
                  className={cn(
                    "h-2.5 [&>div]:bg-primary",
                    item.label === "Planned" && "[&>div]:bg-blue-500",
                    item.label === "Completed" && "[&>div]:bg-violet-500",
                  )}
                />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Patient care</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Recall and retention
              </p>
            </div>
            <Activity className="size-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-around py-2">
              <div
                className="relative grid size-28 place-items-center rounded-full"
                style={{
                  background: `conic-gradient(#0f9f8f 0 ${retention}%, #edf1f2 ${retention}% 100%)`,
                }}
              >
                <div className="grid size-[86px] place-items-center rounded-full bg-white text-center">
                  <div>
                    <p className="text-2xl font-bold">{retention}%</p>
                    <p className="text-[10px] text-muted-foreground">
                      Retention
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-3 text-xs">
                <div>
                  <p className="text-muted-foreground">Active patients</p>
                  <p className="text-lg font-bold">{activePatients}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Completed visits</p>
                  <p className="text-lg font-bold text-primary">{completedVisits}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentActivity.map((item) => {
              const Icon = item.icon;
              return (
                <div key={`${item.title}-${item.detail}-${item.time}`} className="flex items-center gap-3">
                  <div
                    className={cn(
                      "grid size-9 place-items-center rounded-xl",
                      item.bg,
                    )}
                  >
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold">{item.title}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {item.detail}
                    </p>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {item.time}
                  </span>
                </div>
              );
            })}
            {!recentActivity.length && <p className="py-6 text-center text-sm text-muted-foreground">No recent activity yet.</p>}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
