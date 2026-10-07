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
    if (saving) return;
    // Prefer the printable area inside the surrounding dialog, then fall back to the page.
    const scope: ParentNode = trigger.current?.closest('[data-slot="dialog-content"]') ?? document;
    const source = scope.querySelector<HTMLElement>(".print-area");
    if (!source) {
      toast.error(t("Printable content is not available. Close and try again."));
      return;
    }
    setSaving(true);
    try {
      const { exportPdf } = await import("@/lib/export-pdf");
      await exportPdf(source, filename);
    } catch {
      toast.error(t("PDF could not be created. Try again or use Print."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button type="button" variant="outline" onClick={() => window.print()}>
        <Printer />{t("Print")}
      </Button>
      <Button ref={trigger} type="button" disabled={saving} aria-busy={saving} onClick={() => void save()}>
        <Download />{t(saving ? "Preparing PDF…" : "Save PDF")}
      </Button>
    </>
  );
}
