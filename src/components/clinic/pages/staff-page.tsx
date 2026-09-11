"use client";

import { FormEvent, useState } from "react";
import { CalendarDays, Check, Mail, Plus, Search, ShieldCheck, Stethoscope, Users } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { ClinicMember, ClinicRole } from "@/lib/types";
import { initials } from "@/lib/utils";
import { EmptyState, SectionHeader, StatCard } from "@/components/clinic/app-ui";

const roleLabels: Partial<Record<ClinicRole, string>> = {
  dentist: "Dentist", hygienist: "Dental hygienist", assistant: "Dental assistant",
  front_desk: "Front desk", billing: "Billing",
};

const access = {
  dentist: ["Assigned patients only", "Clinical information", "Dental charts", "Patient treatment plans"],
  front_desk: ["All patients (view)", "Appointments", "Patient payments", "Printable receipts"],
};

export function StaffPage({ members, role, onCreate }: {
  members: ClinicMember[];
  role: ClinicRole;
  onCreate: (input: { fullName: string; email?: string; role: "dentist" | "front_desk"; specialty?: string }) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [accountType, setAccountType] = useState<"dentist" | "front_desk">("dentist");
  const [search, setSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState("all");
  const canAdmin = role === "owner" || role === "admin";
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const saved = await onCreate({
      fullName: String(form.get("name")).trim(),
      email: String(form.get("email")).trim() || undefined,
      role: accountType,
      specialty: String(form.get("specialty") ?? "").trim() || undefined,
    });
    setSaving(false);
    if (saved) { setOpen(false); toast.success("Staff member added"); }
  };
  const managed = members.filter((member) => ["dentist", "hygienist", "front_desk", "assistant", "billing"].includes(member.role));
  const shown = managed.filter((member) =>
    (teamFilter === "all" || member.role === teamFilter) &&
    `${member.fullName} ${member.email ?? ""} ${member.specialty ?? ""}`.toLowerCase().includes(search.trim().toLowerCase()),
  );
  return <div className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-3">
      <StatCard label="Team members" value={managed.length} icon={Users} />
      <StatCard label="Doctors" value={managed.filter((member) => member.role === "dentist").length} icon={Stethoscope} tone="info" />
      <StatCard label="Staff" value={managed.filter((member) => member.role !== "dentist").length} icon={CalendarDays} tone="success" />
    </div>
    <SectionHeader title="Doctors & staff" action={canAdmin ? <Button onClick={() => setOpen(true)}><Plus /> Add staff</Button> : undefined} />
    <div className="flex flex-col gap-3 sm:flex-row">
      <div className="relative flex-1"><Search className="absolute start-3 top-3 size-4 text-muted-foreground" /><Input aria-label="Search team" placeholder="Search team…" value={search} onChange={(event) => setSearch(event.target.value)} className="bg-card ps-9" /></div>
      <Select aria-label="Filter by role" value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)} className="h-10 rounded-lg border bg-card px-3 sm:w-48"><option value="all">All roles</option>{Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
    </div>
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{shown.map((member) => {
      const clinical = member.role === "dentist" || member.role === "hygienist";
      const RoleIcon = clinical ? Stethoscope : Users;
      return <Card key={member.id} className="overflow-hidden shadow-none">
        <div className={clinical ? "h-2 bg-teal-200/70" : "h-2 bg-sky-200/70"} />
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <Avatar className="size-14 rounded-2xl"><AvatarFallback className={clinical ? "rounded-2xl bg-teal-50 text-lg text-teal-700" : "rounded-2xl bg-sky-50 text-lg text-sky-700"} data-no-translate>{initials(member.fullName)}</AvatarFallback></Avatar>
            <Badge variant={member.status === "active" ? "success" : "warning"} className="gap-1.5 capitalize"><span className="size-1.5 rounded-full bg-current" />{member.status}</Badge>
          </div>
          <h3 className="mt-4 break-words text-lg font-semibold tracking-tight" data-no-translate>{member.fullName}</h3>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-primary"><RoleIcon className="size-3.5" />{roleLabels[member.role]}</p>
          <p className="mt-2 min-h-5 break-words text-sm text-muted-foreground">{member.specialty ? <span data-no-translate>{member.specialty}</span> : member.role === "dentist" ? "General dentistry" : "Clinic team"}</p>
          <div className="mt-5 flex items-start gap-2.5 border-t pt-4 text-sm"><Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" />{member.email ? <span className="min-w-0 break-all" dir="ltr" data-no-translate>{member.email}</span> : <span className="text-muted-foreground">Email not recorded</span>}</div>
          <p className="mt-3 flex items-center gap-2.5 text-xs text-muted-foreground"><ShieldCheck className="size-4 shrink-0" />{member.userId ? "Login connected" : "Staff record only"}</p>
        </CardContent>
      </Card>;
    })}</div>
    {managed.length > 0 && !shown.length && <EmptyState icon={Search} title="No team members found" description="Try another name or choose a different role." action={<Button variant="outline" onClick={() => { setSearch(""); setTeamFilter("all"); }}>Clear filters</Button>} />}
    {!managed.length && <EmptyState icon={Users} title="No doctors or staff yet" description="An administrator can add the clinic team here." action={canAdmin ? <Button onClick={() => setOpen(true)}><Plus /> Add staff</Button> : undefined} />}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Add doctor or staff member</DialogTitle><DialogDescription>Name and role are all that is required. This does not send an invitation or create a login account.</DialogDescription></DialogHeader><form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-default p-1">{(["dentist", "front_desk"] as const).map((type) => <Button key={type} type="button" size="sm" variant={accountType === type ? "default" : "ghost"} onClick={() => setAccountType(type)}>{type === "dentist" ? "Doctor" : "Staff / employee"}</Button>)}</div>
      <label className="block text-xs font-semibold">Full name<Input name="name" required className="mt-1.5" /></label><label className="block text-xs font-semibold">Email address (optional)<Input name="email" type="email" className="mt-1.5" /></label><label className="block text-xs font-semibold">{accountType === "dentist" ? "Specialty" : "Job title"}<Input name="specialty" className="mt-1.5" /></label>
      <div className="rounded-xl border p-3"><p className="flex items-center gap-2 text-xs font-bold"><ShieldCheck className="size-4 text-primary" /> Enforced access</p><div className="mt-2 grid gap-1">{access[accountType].map((permission) => <p key={permission} className="flex items-center gap-2 text-xs text-muted-foreground"><Check className="size-3.5 text-emerald-600" />{permission}</p>)}</div>{accountType === "front_desk" && <p className="mt-2 text-[10px] font-semibold text-rose-700">No dental-chart, treatment-plan, profit, revenue-analytics, or Admin settings access.</p>}</div>
      <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={saving}><Check />{saving ? "Adding…" : "Add staff member"}</Button></DialogFooter>
    </form></DialogContent></Dialog>
  </div>;
}
