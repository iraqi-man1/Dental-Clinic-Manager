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
      <Card><CardContent className="flex items-center gap-4 p-5"><div className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary"><Users /></div><div><p className="text-xs text-muted-foreground">Team members</p><p className="text-2xl font-bold">{managed.length}</p></div></CardContent></Card>
      <Card><CardContent className="flex items-center gap-4 p-5"><div className="grid size-11 place-items-center rounded-xl bg-blue-50 text-blue-700"><Stethoscope /></div><div><p className="text-xs text-muted-foreground">Doctors</p><p className="text-2xl font-bold">{managed.filter((member) => member.role === "dentist").length}</p></div></CardContent></Card>
      <Card><CardContent className="flex items-center gap-4 p-5"><div className="grid size-11 place-items-center rounded-xl bg-violet-50 text-violet-700"><CalendarDays /></div><div><p className="text-xs text-muted-foreground">Staff</p><p className="text-2xl font-bold">{managed.filter((member) => member.role !== "dentist").length}</p></div></CardContent></Card>
    </div>
    <div className="flex items-center justify-between gap-4"><div><h2 className="font-bold">Doctors & staff</h2><p className="text-xs text-muted-foreground">Create staff records immediately. Login access can be linked separately when needed.</p></div>{canAdmin && <Button onClick={() => setOpen(true)}><Plus /> Add staff</Button>}</div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{managed.map((member) => <Card key={member.id}><CardContent className="p-5"><div className="flex items-start gap-3"><Avatar><AvatarFallback>{initials(member.fullName)}</AvatarFallback></Avatar><div className="min-w-0 flex-1"><p className="font-semibold" data-no-translate>{member.fullName}</p><p className="truncate text-xs text-muted-foreground" data-no-translate>{member.email ?? "Email not recorded"}</p>{!member.userId && <p className="mt-1 text-[10px] font-semibold text-slate-500">No login account</p>}</div><Badge variant={member.status === "active" ? "success" : "warning"}>{member.status}</Badge></div><div className="mt-4 rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold">{member.role === "dentist" ? "Doctor" : "Staff / employee"}</p><p className="mt-1 text-[10px] text-muted-foreground" data-no-translate>{member.specialty || (member.role === "dentist" ? "General dentistry" : "Front desk")}</p></div></CardContent></Card>)}</div>
    {!managed.length && <Card><CardContent className="grid place-items-center p-12 text-center"><Users className="size-10 text-slate-300" /><p className="mt-3 font-semibold">No doctors or staff yet</p><p className="mt-1 text-sm text-muted-foreground">An administrator can add the clinic team here.</p></CardContent></Card>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Add doctor or staff member</DialogTitle><DialogDescription>Name and role are all that is required. This does not send an invitation or create a login account.</DialogDescription></DialogHeader><form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1">{(["dentist", "front_desk"] as const).map((type) => <button key={type} type="button" onClick={() => setAccountType(type)} className={`rounded-lg px-3 py-2 text-xs font-semibold ${accountType === type ? "bg-white text-primary shadow-sm" : "text-slate-500"}`}>{type === "dentist" ? "Doctor" : "Staff / employee"}</button>)}</div>
      <label className="block text-xs font-semibold">Full name<Input name="name" required className="mt-1.5" /></label><label className="block text-xs font-semibold">Email address (optional)<Input name="email" type="email" className="mt-1.5" /></label><label className="block text-xs font-semibold">{accountType === "dentist" ? "Specialty" : "Job title"}<Input name="specialty" className="mt-1.5" /></label>
      <div className="rounded-xl border p-3"><p className="flex items-center gap-2 text-xs font-bold"><ShieldCheck className="size-4 text-primary" /> Enforced access</p><div className="mt-2 grid gap-1">{access[accountType].map((permission) => <p key={permission} className="flex items-center gap-2 text-xs text-muted-foreground"><Check className="size-3.5 text-emerald-600" />{permission}</p>)}</div>{accountType === "front_desk" && <p className="mt-2 text-[10px] font-semibold text-rose-700">No dental-chart, treatment-plan, profit, revenue-analytics, or Admin settings access.</p>}</div>
      <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={saving}><Check />{saving ? "Adding…" : "Add staff member"}</Button></DialogFooter>
    </form></DialogContent></Dialog>
  </div>;
}
