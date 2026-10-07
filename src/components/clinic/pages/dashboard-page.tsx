"use client";

import type { ReactNode } from "react";
import {
  Activity,
  ArrowRight,
  CalendarCheck2,
  CalendarDays,
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
import { DEFAULT_CLINIC_TIME_ZONE, clinicDateKey, clinicTodayKey } from "@/lib/clinic-time";
import { useClinicPreferences } from "@/lib/clinic-preferences";
import type { Appointment, NavKey, Patient, Payment, TreatmentSession } from "@/lib/types";
import { cn, initials } from "@/lib/utils";
import { EmptyState, StatCard } from "@/components/clinic/app-ui";

const STAT_TONES = ["accent", "info", "success", "warning", "danger"] as const;

const appointmentStatus = (status: Appointment["status"]) =>
  status === "Confirmed"
    ? "default"
    : status === "Checked in" || status === "In treatment"
      ? "success"
      : status === "Pending"
        ? "warning"
        : "secondary";

const isOpenSession = (session: TreatmentSession) =>
  session.status !== "completed" && session.status !== "cancelled";

/** Full amount on tablet and desktop, compact amount on phones so large totals fit a two-column grid. */
function ResponsiveMoney({ full, compact }: { full: string; compact: string }) {
  return (
    <>
      <span className="sm:hidden">{compact}</span>
      <span className="hidden sm:inline">{full}</span>
    </>
  );
}

export function DashboardPage({
  appointments,
  patients,
  payments,
  sessions,
  onNavigate,
  timeZone = DEFAULT_CLINIC_TIME_ZONE,
}: {
  appointments: Appointment[];
  patients: Patient[];
  payments: Payment[];
  sessions: TreatmentSession[];
  onNavigate: (key: NavKey) => void;
  timeZone?: string;
}) {
  const { t, locale, formatMoney, formatCompactMoney, formatDate, formatTime } = useClinicPreferences();

  const todayKey = clinicTodayKey(timeZone);
  const formatCount = (value: number) => new Intl.NumberFormat(locale).format(value);
  const formatPercent = (value: number) =>
    new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(value / 100);
  const countText = (count: number, one: string, many: string) =>
    count === 1 ? t(one) : t(many, { count });
  const appointmentTime = (appointment: Appointment) =>
    formatTime(appointment.startsAt, { timeZone }) || appointment.time;
  // Payments carry the `paidAt` instant. Their English `date` label is never parsed back into a date.
  const formatPaymentDate = (payment: Payment) =>
    payment.paidAt
      ? formatDate(payment.paidAt, { timeZone, month: "short", day: "numeric", year: "numeric" })
      : payment.date;

  const today = appointments
    .filter((appointment) => appointment.date === todayKey)
    .sort((a, b) => (a.startsAt < b.startsAt ? -1 : a.startsAt > b.startsAt ? 1 : 0));
  const shown = today.slice(0, 5);
  const confirmedToday = today.filter((appointment) => appointment.status === "Confirmed").length;
  const completedToday = today.filter((appointment) => appointment.status === "Completed").length;

  const revenue = payments.reduce((sum, payment) => sum + payment.paid, 0);
  const outstanding = payments.reduce(
    (sum, payment) => sum + Math.max(0, payment.total - payment.discount - payment.paid),
    0,
  );
  const openInvoices = payments.filter((payment) => payment.status !== "Paid").length;
  const openSessions = sessions.filter(isOpenSession);
  const activeTreatments = new Set(openSessions.map((session) => session.planId)).size;

  const monthTotals = new Map<string, number>();
  for (const payment of payments) {
    // Grouping uses the clinic-local calendar day of the payment instant.
    const dateKey = payment.paidAt ? clinicDateKey(payment.paidAt, timeZone) : "";
    if (!dateKey) continue;
    const month = dateKey.slice(0, 7);
    monthTotals.set(month, (monthTotals.get(month) ?? 0) + payment.paid);
  }
  const months = [...monthTotals.keys()].sort();
  const spansYears = new Set(months.map((month) => month.slice(0, 4))).size > 1;
  const yearOption: Intl.DateTimeFormatOptions = spansYears ? { year: "numeric" } : {};
  const paymentChartData = months.map((month) => ({
    month,
    label: formatDate(`${month}-01`, { timeZone, month: "short", ...yearOption }),
    revenue: monthTotals.get(month) ?? 0,
  }));
  if (!paymentChartData.length) paymentChartData.push({ month: "", label: "—", revenue: 0 });

  const stats: { label: string; value: ReactNode; note: string; icon: typeof CalendarCheck2 }[] = [
    {
      label: t("Today’s appointments"),
      value: formatCount(today.length),
      note: t("{count} confirmed", { count: confirmedToday }),
      icon: CalendarCheck2,
    },
    {
      label: t("Total patients"),
      value: formatCount(patients.length),
      note: t("Live patient records"),
      icon: Users,
    },
    {
      label: t("Total collected"),
      value: <ResponsiveMoney full={formatMoney(revenue)} compact={formatCompactMoney(revenue)} />,
      note: countText(payments.length, "1 invoice", "{count} invoices"),
      icon: CircleDollarSign,
    },
    {
      label: t("Outstanding"),
      value: <ResponsiveMoney full={formatMoney(outstanding)} compact={formatCompactMoney(outstanding)} />,
      note: countText(openInvoices, "1 open invoice", "{count} open invoices"),
      icon: CreditCard,
    },
    {
      label: t("Active treatments"),
      value: formatCount(activeTreatments),
      note: countText(openSessions.length, "1 session remaining", "{count} sessions remaining"),
      icon: Stethoscope,
    },
  ];

  const pipeline = [
    {
      label: t("Planned"),
      sessions: sessions.filter((session) => session.status === "planned"),
      indicator: "[&>div]:bg-blue-500",
    },
    {
      label: t("In progress"),
      sessions: sessions.filter((session) => session.status === "scheduled"),
      indicator: "[&>div]:bg-primary",
    },
    {
      label: t("Completed"),
      sessions: sessions.filter((session) => session.status === "completed"),
      indicator: "[&>div]:bg-violet-500",
    },
  ].map((item) => ({
    label: item.label,
    indicator: item.indicator,
    value: item.sessions.length,
    amount: item.sessions.reduce((sum, session) => sum + session.expectedAmount, 0),
  }));
  const maxPipeline = Math.max(1, ...pipeline.map((item) => item.value));

  const activePatients = patients.filter((patient) => patient.status === "Active").length;
  const retention = patients.length ? Math.round((activePatients / patients.length) * 100) : 0;

  const recentActivity = [
    ...payments
      .filter((payment) => payment.paid > 0)
      .slice(0, 2)
      .map((payment) => ({
        key: `payment-${payment.id}`,
        icon: CreditCard,
        title: t("Payment received"),
        detail: `${payment.patientName} · ${formatMoney(payment.lastPaymentAmount ?? payment.paid)}`,
        time: formatPaymentDate(payment),
        bg: "bg-emerald-50 text-emerald-700",
      })),
    ...today.slice(0, 2).map((appointment) => ({
      key: `appointment-${appointment.id}`,
      icon: CalendarCheck2,
      title: t("Appointment booked"),
      detail: `${appointment.patientName} · ${appointment.treatment}`,
      time: appointmentTime(appointment),
      bg: "bg-blue-50 text-blue-700",
    })),
  ].slice(0, 4);

  return (
    <div className="space-y-6">
      <section className="dashboard-stats grid grid-cols-2 gap-3 xl:grid-cols-5">
        {stats.map((stat, index) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            note={stat.note}
            icon={stat.icon}
            tone={STAT_TONES[index]}
            className={cn(index === 0 && "stat-featured", "[&_[data-slot=card-content]]:p-5")}
          />
        ))}
      </section>
      <section className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
        <Card className="min-w-0 xl:order-2">
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-4">
            <div>
              <CardTitle>{t("Revenue overview")}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">{t("Recorded payments")}</p>
            </div>
            <Badge variant="secondary">{t("All time")}</Badge>
          </CardHeader>
          <CardContent className="pt-5">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">{t("Total collected")}</p>
                <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{formatMoney(revenue)}</p>
              </div>
              <Badge variant="success">
                {payments.length
                  ? countText(payments.length, "1 live invoice", "{count} live invoices")
                  : t("No financial activity yet")}
              </Badge>
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
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: "#617388" }}
                    dy={8}
                  />
                  <YAxis
                    width={80}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: "#617388" }}
                    tickFormatter={(value) => formatCompactMoney(Number(value))}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      background: "var(--popover)",
                      color: "var(--popover-foreground)",
                      boxShadow: "0 12px 30px rgba(15,23,42,.10)",
                      fontSize: 12,
                    }}
                    formatter={(value) => formatMoney(Number(value))}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    name={t("Total collected")}
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
              <CardTitle>{t("Today’s schedule")}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatDate(todayKey, { timeZone, weekday: "long", month: "long", day: "numeric" })}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigate("appointments")}
            >
              {t("View calendar")}
              <ArrowRight className="rtl:rotate-180" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2 pt-4">
            {shown.map((appointment) => (
              <Button
                key={appointment.id}
                type="button"
                variant="ghost"
                onClick={() => onNavigate("appointments")}
                className="h-auto min-h-11 w-full justify-start gap-3 whitespace-normal rounded-lg border border-border/70 p-3.5 text-start hover:border-primary/30 hover:bg-accent/40"
              >
                <span className="flex w-16 shrink-0 flex-col">
                  <span className="whitespace-nowrap text-xs font-bold text-foreground">
                    {appointmentTime(appointment)}
                  </span>
                  <span className="text-xs text-muted-foreground" data-no-translate>
                    {appointment.room}
                  </span>
                </span>
                <span
                  className="h-9 w-1 shrink-0 rounded-full"
                  style={{ backgroundColor: appointment.color }}
                />
                <Avatar className="size-9 shrink-0">
                  <AvatarFallback data-no-translate>{initials(appointment.patientName)}</AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold" data-no-translate>
                    {appointment.patientName}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground" data-no-translate>
                    {appointment.treatment}
                  </span>
                </span>
                <Badge
                  variant={appointmentStatus(appointment.status)}
                  className="hidden sm:inline-flex"
                >
                  {t(appointment.status)}
                </Badge>
              </Button>
            ))}
            {!shown.length && (
              <EmptyState
                icon={CalendarCheck2}
                title={t("No appointments today")}
                action={
                  <Button variant="outline" onClick={() => onNavigate("appointments")}>
                    <CalendarDays />
                    {t("View calendar")}
                  </Button>
                }
                className="min-h-64 border-0 bg-transparent p-5"
              />
            )}
          </CardContent>
        </Card>
      </section>
      <section className="grid gap-5 lg:grid-cols-3">
        <Card className="min-w-0">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>{t("Treatment pipeline")}</CardTitle>
            <Stethoscope className="size-5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-5">
            {pipeline.map((item) => (
              <div key={item.label}>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-sm">
                  <span className="min-w-0 font-semibold">
                    {item.label}{" "}
                    <span className="font-normal text-muted-foreground">
                      · {formatCount(item.value)}
                    </span>
                  </span>
                  <span className="font-bold tabular-nums">{formatMoney(item.amount)}</span>
                </div>
                <Progress
                  value={(item.value / maxPipeline) * 100}
                  className={cn("h-2.5", item.indicator)}
                />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>{t("Patient care")}</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">{t("Recall and retention")}</p>
            </div>
            <Activity className="size-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center justify-around gap-4 py-2">
              <div
                className="relative grid size-28 shrink-0 place-items-center rounded-full"
                style={{
                  background: `conic-gradient(#087f8c 0 ${retention}%, #edf1f2 ${retention}% 100%)`,
                }}
              >
                <div className="grid size-[86px] place-items-center rounded-full bg-card text-center">
                  <div>
                    <p className="text-2xl font-bold tabular-nums">{formatPercent(retention)}</p>
                    <p className="text-xs text-muted-foreground">{t("Retention")}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-muted-foreground">{t("Active patients")}</p>
                  <p className="text-lg font-bold tabular-nums">{formatCount(activePatients)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("Completed visits")}</p>
                  <p className="text-lg font-bold tabular-nums text-primary">{formatCount(completedToday)}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>{t("Recent activity")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentActivity.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.key} className="flex items-center gap-3">
                  <div
                    className={cn(
                      "grid size-9 shrink-0 place-items-center rounded-xl",
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
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {item.time}
                  </span>
                </div>
              );
            })}
            {!recentActivity.length && (
              <EmptyState
                icon={Activity}
                title={t("No recent activity")}
                description={t("Payments and appointment updates will appear here.")}
                className="min-h-44 border-0 bg-transparent p-5"
              />
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
