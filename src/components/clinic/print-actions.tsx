"use client";

import { useRef, useState } from "react";
import { Download, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useClinicPreferences } from "@/lib/clinic-preferences";

export function PrintActions({ filename }: { filename: string }) {
  const { t } = useClinicPreferences();
  const [saving, setSaving] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const save = async () => {
    const source = trigger.current?.closest('[data-slot="dialog-content"]')?.querySelector<HTMLElement>(".print-area");
    if (!source || saving) return;
    setSaving(true);
    try {
      const { exportPdf } = await import("@/lib/export-pdf");
      await exportPdf(source, filename);
    } catch {
      toast.error(t("PDF could not be created. Try again or use Print."));
    } finally { setSaving(false); }
  };
  return <>
    <Button type="button" variant="outline" onClick={() => window.print()}><Printer />{t("Print")}</Button>
    <Button ref={trigger} type="button" disabled={saving} onClick={() => void save()}><Download />{t(saving ? "Preparing PDF…" : "Save PDF")}</Button>
  </>;
}
