"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    const password = String(new FormData(event.currentTarget).get("password"));
    const client = createClient();
    if (!client) setMessage("Supabase is not configured.");
    else {
      const { error } = await client.auth.updateUser({ password });
      if (error) setMessage(error.message);
      else {
        router.push("/");
        router.refresh();
      }
    }
    setLoading(false);
  };
  return <main className="grid min-h-screen place-items-center bg-slate-50 p-5">
    <Card className="w-full max-w-md"><CardContent className="p-8">
      <div className="grid size-11 place-items-center rounded-2xl bg-primary text-white"><KeyRound /></div>
      <h1 className="mt-5 text-2xl font-bold">Set your password</h1>
      <p className="mt-2 text-sm text-muted-foreground">Create the password you will use on this clinic workstation.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="block text-xs font-semibold">New password
          <Input name="password" type="password" minLength={8} required className="mt-1.5" autoComplete="new-password" />
        </label>
        {message && <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">{message}</p>}
        <Button className="w-full" disabled={loading}>{loading ? "Saving…" : "Save password"}</Button>
      </form>
    </CardContent></Card>
  </main>;
}
