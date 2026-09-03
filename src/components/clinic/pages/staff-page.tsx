"use client";

import { FormEvent, useState } from "react";
import { CalendarDays, Check, Plus, ShieldCheck, Stethoscope, Users } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { ClinicMember, ClinicRole } from "@/lib/types";
import { initials } from "@/lib/utils";
import { EmptyState, SectionHeader, StatCard } from "@/components/clinic/app-ui";

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
  return <div className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-3">
      <StatCard label="Team members" value={managed.length} note="Active clinic records" icon={Users} />
      <StatCard label="Doctors" value={managed.filter((member) => member.role === "dentist").length} note="Clinical providers" icon={Stethoscope} tone="info" />
      <StatCard label="Staff" value={managed.filter((member) => member.role !== "dentist").length} note="Operations and support" icon={CalendarDays} tone="success" />
    </div>
    <SectionHeader title="Doctors & staff" description="Create staff records immediately. Login access can be linked separately when needed." action={canAdmin ? <Button onClick={() => setOpen(true)}><Plus /> Add staff</Button> : undefined} />
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{managed.map((member) => <Card key={member.id}><CardContent className="p-5"><div className="flex items-start gap-3"><Avatar><AvatarFallback>{initials(member.fullName)}</AvatarFallback></Avatar><div className="min-w-0 flex-1"><p className="font-semibold" data-no-translate>{member.fullName}</p><p className="truncate text-xs text-muted-foreground" data-no-translate>{member.email ?? "Email not recorded"}</p>{!member.userId && <p className="mt-1 text-[10px] font-semibold text-slate-500">No login account</p>}</div><Badge variant={member.status === "active" ? "success" : "warning"}>{member.status}</Badge></div><div className="mt-4 rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold">{member.role === "dentist" ? "Doctor" : "Staff / employee"}</p><p className="mt-1 text-[10px] text-muted-foreground" data-no-translate>{member.specialty || (member.role === "dentist" ? "General dentistry" : "Front desk")}</p></div></CardContent></Card>)}</div>
    {!managed.length && <EmptyState icon={Users} title="No doctors or staff yet" description="An administrator can add the clinic team here." action={canAdmin ? <Button onClick={() => setOpen(true)}><Plus /> Add staff</Button> : undefined} />}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Add doctor or staff member</DialogTitle><DialogDescription>Name and role are all that is required. This does not send an invitation or create a login account.</DialogDescription></DialogHeader><form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-default p-1">{(["dentist", "front_desk"] as const).map((type) => <Button key={type} type="button" size="sm" variant={accountType === type ? "default" : "ghost"} onClick={() => setAccountType(type)}>{type === "dentist" ? "Doctor" : "Staff / employee"}</Button>)}</div>
      <label className="block text-xs font-semibold">Full name<Input name="name" required className="mt-1.5" /></label><label className="block text-xs font-semibold">Email address (optional)<Input name="email" type="email" className="mt-1.5" /></label><label className="block text-xs font-semibold">{accountType === "dentist" ? "Specialty" : "Job title"}<Input name="specialty" className="mt-1.5" /></label>
      <div className="rounded-xl border p-3"><p className="flex items-center gap-2 text-xs font-bold"><ShieldCheck className="size-4 text-primary" /> Enforced access</p><div className="mt-2 grid gap-1">{access[accountType].map((permission) => <p key={permission} className="flex items-center gap-2 text-xs text-muted-foreground"><Check className="size-3.5 text-emerald-600" />{permission}</p>)}</div>{accountType === "front_desk" && <p className="mt-2 text-[10px] font-semibold text-rose-700">No dental-chart, treatment-plan, profit, revenue-analytics, or Admin settings access.</p>}</div>
      <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={saving}><Check />{saving ? "Adding…" : "Add staff member"}</Button></DialogFooter>
    </form></DialogContent></Dialog>
  </div>;
}
