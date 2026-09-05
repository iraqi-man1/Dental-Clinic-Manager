"use client";

import {
  Activity,
  ArrowRight,
  CalendarCheck2,
  CircleDollarSign,
  CreditCard,
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
import { EmptyState, StatCard } from "@/components/clinic/app-ui";

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
    label: "Total collected",
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
    : stat.label === "Total collected" ? { ...stat, amount: revenue, noteAmount: undefined, note: `${payments.length} invoices` }
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
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-5 xl:grid-cols-3">
        {stats.map((stat, index) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.amount !== undefined ? formatMoney(stat.amount) : stat.value}
            note={stat.note}
            icon={stat.icon}
            tone={(index === 2 ? "success" : index === 3 ? "warning" : index === 4 ? "danger" : index === 1 ? "info" : "accent")}
            className={cn(index === 0 && "border-primary/20 bg-accent/45", "[&_[data-slot=card-content]]:p-5")}
          />
        ))}
      </section>
      <section className="grid gap-5 xl:grid-cols-[1.1fr_1fr]">
        <Card className="min-w-0 xl:order-2">
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-4">
            <div>
              <CardTitle>Revenue overview</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Recorded payments
              </p>
            </div>
            <Badge variant="secondary">All time</Badge>
          </CardHeader>
          <CardContent className="pt-5">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Total collected</p>
                <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{formatMoney(revenue)}</p>
              </div>
              <Badge variant="success">{payments.length ? `${payments.length} live invoices` : "No financial activity yet"}</Badge>
            </div>
            <div className="h-[225px] min-w-0 w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={paymentChartData}
                  margin={{ left: -15, right: 10, top: 10 }}
                >
                  <defs>
                    <linearGradient id="revenue" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="#087f8c"
                        stopOpacity={0.18}
                      />
                      <stop offset="100%" stopColor="#087f8c" stopOpacity={0} />
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
                    tick={{ fontSize: 12, fill: "#617388" }}
                    dy={8}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: "#617388" }}
                    tickFormatter={(v) => formatCompactMoney(Number(v))}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid #e5e9ec",
                      boxShadow: "0 12px 30px rgba(15,23,42,.10)",
                      fontSize: 12,
                    }}
                    formatter={(v) => formatMoney(Number(v))}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#087f8c"
                    strokeWidth={2.5}
                    fill="url(#revenue)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card className="min-w-0 xl:order-1">
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-4">
            <div>
              <CardTitle>Today’s schedule</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {new Date().toLocaleDateString(language === "ar" ? "ar-IQ" : "en-US", { weekday: "long", month: "long", day: "numeric" })}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigate("appointments")}
            >
              View calendar <ArrowRight />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2 pt-4">
            {shown.map((appt) => (
              <Button
                key={appt.id}
                type="button"
                variant="ghost"
                onClick={() => onNavigate("appointments")}
                className="h-auto w-full justify-start gap-3 rounded-lg border border-border/70 p-3 text-start hover:border-primary/30 hover:bg-accent/40"
              >
                <div className="w-14 shrink-0">
                  <p className="text-xs font-bold text-slate-800">
                    {appt.time.replace(" ", "")}{" "}
                  </p>
                  <p className="text-xs text-muted-foreground">
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
                  <p className="mt-0.5 truncate text-xs text-muted-foreground" data-no-translate>
                    {appt.treatment}
                  </p>
                </div>
                <Badge
                  variant={appointmentStatus(appt.status)}
                  className="hidden sm:inline-flex"
                >
                  {appt.status}
                </Badge>
              </Button>
            ))}
            {!shown.length && (
              <EmptyState
                icon={CalendarCheck2}
                title="No appointments today"
                description="The day is clear. New bookings will appear here immediately."
                className="min-h-64 border-0 bg-transparent p-5"
              />
            )}
          </CardContent>
        </Card>
      </section>
      <section className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Treatment pipeline</CardTitle>
            <Stethoscope className="size-5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-5">
            {pipeline.map((item) => (
              <div key={item.label}>
                <div className="mb-2 flex items-center justify-between gap-2 text-sm">
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
                className="relative grid size-28 shrink-0 place-items-center rounded-full"
                style={{
                  background: `conic-gradient(#087f8c 0 ${retention}%, #edf1f2 ${retention}% 100%)`,
                }}
              >
                <div className="grid size-[86px] place-items-center rounded-full bg-white text-center">
                  <div>
                    <p className="text-2xl font-bold">{retention}%</p>
                    <p className="text-xs text-muted-foreground">
                      Retention
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-3 text-sm">
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
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="truncate text-xs text-muted-foreground" data-no-translate>
                      {item.detail}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {item.time}
                  </span>
                </div>
              );
            })}
            {!recentActivity.length && (
              <EmptyState
                icon={Activity}
                title="No recent activity"
                description="Payments and appointment updates will appear here."
                className="min-h-44 border-0 bg-transparent p-5"
              />
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
