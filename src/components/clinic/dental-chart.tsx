"use client";

import { useId, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Check, MousePointer2, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useClinicPreferences } from "@/lib/clinic-preferences";
import { cn } from "@/lib/utils";
import type {
  DentalChartState,
  ToothCondition,
  ToothSurface,
  ToothSurfaceChart,
} from "@/lib/types";

const conditions: { value: ToothCondition; color: string; dot: string }[] = [
  { value: "Healthy", color: "border-slate-200 bg-white text-slate-700", dot: "bg-slate-200" },
  { value: "Caries", color: "border-rose-300 bg-rose-50 text-rose-700", dot: "bg-rose-500" },
  { value: "Filling", color: "border-sky-300 bg-sky-50 text-sky-700", dot: "bg-sky-500" },
  { value: "Crown", color: "border-amber-300 bg-amber-50 text-amber-700", dot: "bg-amber-400" },
  { value: "Root Canal", color: "border-violet-300 bg-violet-50 text-violet-700", dot: "bg-violet-500" },
  { value: "Implant", color: "border-teal-300 bg-teal-50 text-teal-700", dot: "bg-teal-500" },
  { value: "Extraction", color: "border-orange-300 bg-orange-50 text-orange-700", dot: "bg-orange-500" },
  { value: "Missing", color: "border-dashed border-slate-300 bg-slate-100 text-slate-400", dot: "bg-slate-500" },
];

export const toothSurfaces: { value: ToothSurface; label: string; short: string }[] = [
  { value: "occlusal", label: "Occlusal", short: "O" },
  { value: "mesial", label: "Mesial", short: "M" },
  { value: "distal", label: "Distal", short: "D" },
  { value: "buccal", label: "Buccal / Facial", short: "B/F" },
  { value: "lingual", label: "Lingual / Palatal", short: "L/P" },
];

export const chartStates: { value: DentalChartState; label: string; color: string }[] = [
  { value: "healthy", label: "Healthy", color: "bg-white border-slate-300" },
  { value: "decay", label: "Decay / caries", color: "bg-rose-500 border-rose-600" },
  { value: "existing_restoration", label: "Existing restoration", color: "bg-sky-500 border-sky-600" },
  { value: "planned", label: "Planned treatment", color: "bg-amber-400 border-amber-500" },
  { value: "completed", label: "Completed treatment", color: "bg-emerald-500 border-emerald-600" },
  { value: "other", label: "Other finding", color: "bg-violet-500 border-violet-600" },
];

const surfaceFill: Record<DentalChartState, string> = {
  healthy: "#ffffff",
  decay: "#f43f5e",
  existing_restoration: "#0ea5e9",
  planned: "#fbbf24",
  completed: "#10b981",
  other: "#8b5cf6",
};

type ToothKind = "molar" | "premolar" | "canine" | "incisor";

// Universal numbering starts at the patient's upper right. Keep anatomical
// positions independent of the interface language and writing direction.
function toothKind(number: number): ToothKind {
  const position = number <= 16 ? number : 33 - number;
  const fromMidline = position <= 8 ? 9 - position : position - 8;
  return fromMidline >= 6 ? "molar" : fromMidline >= 4 ? "premolar" : fromMidline === 3 ? "canine" : "incisor";
}

const toothAnatomy: Record<ToothKind, { root: string; crown: string; detail: string; pulp: string }> = {
  molar: {
    root: "M10 60 C9 45 5 18 11 9 C14 4 18 36 23 46 C25 49 28 44 30 33 C33 18 36 4 40 9 C45 17 43 45 44 60 Z",
    crown: "M10 57 C7 61 6 73 10 83 C12 89 17 90 23 87 Q27 85 31 88 C38 91 44 87 46 80 C48 71 46 60 43 57 C39 54 32 57 27 57 C21 57 15 53 10 57 Z",
    detail: "M16 63 Q20 70 18 80 M37 63 Q33 70 35 81 M21 67 Q27 71 33 67 M27 70 L27 80",
    pulp: "M18 75 L21 62 Q23 49 17 24 M35 75 L32 62 Q31 48 38 24 M21 62 L32 62",
  },
  premolar: {
    root: "M16 59 C17 45 13 12 19 7 C23 5 23 31 27 38 C30 32 32 12 35 13 C41 19 37 45 38 59 Z",
    crown: "M16 56 C11 60 10 71 14 80 C17 87 21 90 27 86 C32 90 38 87 41 80 C45 71 42 60 38 57 Q31 54 27 58 Q21 54 16 56 Z",
    detail: "M19 64 Q24 68 23 79 M35 64 Q29 68 30 79 M23 69 L30 69",
    pulp: "M22 76 L25 60 Q25 45 20 23 M32 76 L29 60 Q30 44 35 27",
  },
  canine: {
    root: "M18 60 C20 42 20 12 25 4 C29 -1 32 17 33 29 L36 60 Z",
    crown: "M18 56 C14 62 13 74 18 80 L25 89 Q27 92 29 89 L38 80 C42 74 40 62 36 56 Q27 53 18 56 Z",
    detail: "M26 62 Q23 72 26 83 M31 64 Q34 70 33 76",
    pulp: "M27 81 L27 60 Q28 40 26 17",
  },
  incisor: {
    root: "M18 59 C20 43 21 13 26 6 C30 3 32 19 32 30 L36 59 Z",
    crown: "M18 56 C14 61 12 77 14 85 Q27 89 40 85 C42 77 39 61 36 56 Q27 53 18 56 Z",
    detail: "M20 63 L18 80 M34 63 L36 80 M18 83 Q27 85 36 83",
    pulp: "M27 80 L27 58 Q28 38 27 19",
  },
};

const conditionAppearance: Record<ToothCondition, { fill: string; stroke: string }> = {
  Healthy: { fill: "#fff", stroke: "#a4b5c3" },
  Caries: { fill: "#ffe4e6", stroke: "#e11d48" },
  Filling: { fill: "#e0f2fe", stroke: "#0284c7" },
  Crown: { fill: "#fde68a", stroke: "#b7791f" },
  "Root Canal": { fill: "#ede9fe", stroke: "#8b5cf6" },
  Implant: { fill: "#ccfbf1", stroke: "#0d9488" },
  Extraction: { fill: "#ffedd5", stroke: "#ea580c" },
  Missing: { fill: "#f1f5f9", stroke: "#94a3b8" },
};

function ToothAnatomy({ kind, condition, lower, selected }: {
  kind: ToothKind;
  condition: ToothCondition;
  lower: boolean;
  selected: boolean;
}) {
  const id = useId();
  const anatomy = toothAnatomy[kind];
  const appearance = conditionAppearance[condition];
  const outline = selected && condition === "Healthy" ? "#0d9488" : appearance.stroke;
  return (
    <svg viewBox="0 0 54 94" className="!h-[88px] !w-[50px] shrink-0 overflow-visible" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={condition === "Healthy" ? "#e8edf2" : appearance.fill} />
          <stop offset="0.42" stopColor={condition === "Healthy" ? "#ffffff" : appearance.fill} />
          <stop offset="1" stopColor={condition === "Healthy" ? "#edf2f6" : appearance.fill} />
        </linearGradient>
      </defs>
      <g transform={lower ? "translate(0 94) scale(1 -1)" : undefined} strokeLinecap="round" strokeLinejoin="round">
        {condition === "Implant" ? (
          <g fill="none" stroke="#0d9488" strokeWidth="2">
            <path d="M21 54 L22 18 Q27 7 32 18 L33 54" fill="#e2f3f1" />
            {[22, 29, 36, 43, 50].map((y) => <path key={y} d={`M20 ${y + 2} L34 ${y - 2}`} />)}
          </g>
        ) : (
          <path d={anatomy.root} fill={`url(#${id})`} stroke={outline} strokeWidth="1.4" strokeDasharray={condition === "Missing" ? "3 3" : undefined} opacity={condition === "Missing" ? 0.5 : 1} />
        )}
        <path d={anatomy.crown} fill={`url(#${id})`} stroke={outline} strokeWidth="1.5" strokeDasharray={condition === "Missing" ? "3 3" : undefined} opacity={condition === "Missing" ? 0.5 : 1} />
        {condition !== "Missing" && <path d={anatomy.detail} fill="none" stroke={outline} strokeWidth="1.1" opacity="0.5" />}
        {condition === "Caries" && <path d="M25 69 Q30 64 33 70 L31 77 L25 76 L22 72 Z" fill="#e11d48" />}
        {condition === "Filling" && <path d="M23 69 Q28 66 32 70 L32 77 Q27 80 23 76 Z" fill="#38bdf8" stroke="#0284c7" strokeWidth="1" />}
        {condition === "Root Canal" && <path d={anatomy.pulp} fill="none" stroke="#7c3aed" strokeWidth="2.2" />}
        {condition === "Crown" && <path d="M15 59 Q27 62 40 59" fill="none" stroke="#b7791f" strokeWidth="2" />}
        {(condition === "Extraction" || condition === "Missing") && <path d="M15 64 L39 87 M39 64 L15 87" fill="none" stroke={appearance.stroke} strokeWidth="2.5" />}
      </g>
    </svg>
  );
}

function SurfaceMap({ states, kind, number }: {
  states: Partial<Record<ToothSurface, DentalChartState>>;
  kind: ToothKind;
  number: number;
}) {
  const fill = (surface: ToothSurface) => surfaceFill[states[surface] ?? "healthy"];
  // Mesial always faces the dental midline. On the lower arch, the facial
  // surface faces downward while the lingual surface faces the opposing arch.
  const patientRight = number <= 8 || number >= 25;
  const lower = number > 16;
  return (
    <svg viewBox="0 0 48 48" className="!size-10 shrink-0 drop-shadow-sm" aria-hidden="true">
      <g transform={kind === "incisor" || kind === "canine" ? "translate(6 0) scale(.75 1)" : undefined} stroke="#94a3b8" strokeWidth="1" strokeLinejoin="round">
        <path d="M10 7 Q4 11 5 24 Q4 36 11 41 L18 31 Q15 25 18 17 Z" fill={fill(patientRight ? "distal" : "mesial")} />
        <path d="M38 7 Q44 11 43 24 Q44 36 37 41 L30 31 Q33 25 30 17 Z" fill={fill(patientRight ? "mesial" : "distal")} />
        <path d="M10 7 Q16 2 24 5 Q32 2 38 7 L30 17 Q24 15 18 17 Z" fill={fill(lower ? "lingual" : "buccal")} />
        <path d="M11 41 Q16 46 24 43 Q32 46 37 41 L30 31 Q24 33 18 31 Z" fill={fill(lower ? "buccal" : "lingual")} />
        <path d="M18 17 Q24 15 30 17 Q33 24 30 31 Q24 33 18 31 Q15 24 18 17 Z" fill={fill("occlusal")} />
      </g>
    </svg>
  );
}

function Tooth({ number, condition, states, selected, onClick }: {
  number: number;
  condition: ToothCondition;
  states: Partial<Record<ToothSurface, DentalChartState>>;
  selected: boolean;
  onClick: () => void;
}) {
  const { t } = useClinicPreferences();
  const kind = toothKind(number);
  const lower = number > 16;
  const findings = toothSurfaces.flatMap((surface) => states[surface.value] && states[surface.value] !== "healthy"
    ? [`${t(surface.label)}: ${t(chartStates.find((state) => state.value === states[surface.value])!.label)}`]
    : []);
  const label = `${t("Tooth")} ${number}, ${t(kind === "molar" ? "Molar" : kind === "premolar" ? "Premolar" : kind === "canine" ? "Canine" : "Incisor")}, ${t(condition)}${findings.length ? `, ${findings.join(", ")}` : ""}`;
  const numberLabel = (
    <span className={cn("flex h-6 min-w-6 items-center justify-center rounded-md px-1 text-[11px] font-semibold tabular-nums", selected ? "bg-primary text-primary-foreground" : "text-muted-foreground")} data-no-translate>
      {number}
    </span>
  );
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={label}
      title={label}
      className={cn(
        "group relative h-auto min-w-0 flex-col items-center gap-1 rounded-lg border border-transparent px-0 py-2 transition hover:border-primary/25 hover:bg-primary/5 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-primary",
        selected && "border-primary/40 bg-primary/10 shadow-sm ring-1 ring-primary/20",
      )}
    >
      {!lower && numberLabel}
      {lower && <SurfaceMap states={states} kind={kind} number={number} />}
      <ToothAnatomy kind={kind} condition={condition} lower={lower} selected={selected} />
      {!lower && <SurfaceMap states={states} kind={kind} number={number} />}
      {lower && numberLabel}
      {selected && <span className="absolute end-0.5 top-0.5 grid size-3.5 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="!size-2.5" /></span>}
    </Button>
  );
}

type DentalChartProps = {
  value: Record<number, ToothCondition>;
  surfaceValue?: ToothSurfaceChart;
  onChange: (next: Record<number, ToothCondition>) => void;
  onSurfaceChange?: (next: ToothSurfaceChart) => void;
  selectedTeeth?: number[];
  onSelectedTeethChange?: Dispatch<SetStateAction<number[]>>;
  selectedSurfaces?: ToothSurface[];
  onSelectedSurfacesChange?: Dispatch<SetStateAction<ToothSurface[]>>;
};

export function DentalChart({
  value,
  surfaceValue = {},
  onChange,
  onSurfaceChange,
  selectedTeeth: controlledTeeth,
  onSelectedTeethChange,
  selectedSurfaces: controlledSurfaces,
  onSelectedSurfacesChange,
}: DentalChartProps) {
  const { t, language } = useClinicPreferences();
  const [localTeeth, setLocalTeeth] = useState<number[]>([]);
  const [localSurfaces, setLocalSurfaces] = useState<ToothSurface[]>([]);
  const selectedTeeth = controlledTeeth ?? localTeeth;
  const selectedSurfaces = controlledSurfaces ?? localSurfaces;
  const setSelectedTeeth = onSelectedTeethChange ?? setLocalTeeth;
  const setSelectedSurfaces = onSelectedSurfacesChange ?? setLocalSurfaces;
  const selectedConditions = useMemo(
    () => [...new Set(selectedTeeth.map((tooth) => value[tooth] ?? "Healthy"))],
    [selectedTeeth, value],
  );

  const toggleTooth = (tooth: number) =>
    setSelectedTeeth((current) => current.includes(tooth)
      ? current.filter((selected) => selected !== tooth)
      : [...current, tooth].sort((a, b) => a - b));
  const toggleSurface = (surface: ToothSurface) =>
    setSelectedSurfaces((current) => current.includes(surface)
      ? current.filter((selected) => selected !== surface)
      : [...current, surface]);
  const assignCondition = (condition: ToothCondition) => {
    if (!selectedTeeth.length) return;
    onChange(selectedTeeth.reduce((next, tooth) => ({ ...next, [tooth]: condition }), { ...value }));
  };
  const assignSurfaceState = (state: DentalChartState) => {
    if (!selectedTeeth.length || !selectedSurfaces.length || !onSurfaceChange) return;
    const next: ToothSurfaceChart = { ...surfaceValue };
    selectedTeeth.forEach((tooth) => {
      next[tooth] = { ...(next[tooth] ?? {}) };
      selectedSurfaces.forEach((surface) => { next[tooth]![surface] = state; });
    });
    onSurfaceChange(next);
  };

  const renderRow = (numbers: number[]) => (
    <div className="grid grid-cols-16 gap-1">
      {numbers.map((number) => (
        <Tooth key={number} number={number} condition={value[number] ?? "Healthy"}
          states={surfaceValue[number] ?? {}} selected={selectedTeeth.includes(number)}
          onClick={() => toggleTooth(number)} />
      ))}
    </div>
  );

  return (
    <div className="min-w-0 space-y-4" data-no-translate>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="text-xs font-semibold text-foreground">{t("Surface findings")}</p>
          {chartStates.map((item) => (
            <div key={item.value} className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
              <span className={cn("size-2 rounded-full border", item.color)} />{t(item.label)}
            </div>
          ))}
        </div>
        <Badge variant="outline" className="text-[10px]">{t("Permanent dentition")}</Badge>
      </div>
      <div className="min-w-0 max-w-full overflow-hidden rounded-xl border bg-muted/25">
        <div role="region" aria-label={t("Dental chart")} tabIndex={0} className="overflow-x-auto overscroll-x-contain p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:p-5" dir="ltr">
          <div className="mx-auto min-w-[864px] max-w-[1080px]">
            <div className="mb-3 grid grid-cols-3 items-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span dir={language === "ar" ? "rtl" : "ltr"} className="text-left">{t("Patient's right")}</span>
              <span className="text-center">{t("Upper arch")}</span>
              <span dir={language === "ar" ? "rtl" : "ltr"} className="text-right">{t("Patient's left")}</span>
            </div>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-1/2 border-s border-dashed border-primary/20" />
              {renderRow(Array.from({ length: 16 }, (_, index) => index + 1))}
              <div className="relative my-3 flex items-center gap-4">
                <div className="h-px flex-1 bg-border" />
                <span className="rounded-full border bg-background px-3 py-1 text-[9px] font-medium uppercase tracking-widest text-muted-foreground">{t("Midline")}</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              {renderRow(Array.from({ length: 16 }, (_, index) => 32 - index))}
            </div>
            <p className="mt-3 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t("Lower arch")}</p>
          </div>
        </div>
        <div className="border-t bg-background/70 px-4 py-2.5 text-center text-[11px] text-muted-foreground">{t("Universal numbering system · adult dentition")}</div>
      </div>
      {selectedTeeth.length ? (
        <Card className="animate-in fade-in slide-in-from-bottom-2 border-primary/20 shadow-none">
          <CardContent className="space-y-4 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary"><Check className="size-4" /></span>
                <div>
                  <p className="text-sm font-semibold" aria-live="polite">{selectedTeeth.length} {t(selectedTeeth.length === 1 ? "tooth selected" : "teeth selected")}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground" dir="ltr">#{selectedTeeth.join(", #")}</p>
                </div>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedTeeth([])}><RotateCcw />{t("Clear selection")}</Button>
            </div>
            <div>
              <p className="mb-2.5 text-xs font-semibold">{t("Whole-tooth condition")}</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {conditions.map((item) => {
                  const active = selectedConditions.length === 1 && selectedConditions[0] === item.value;
                  return (
                    <Button key={item.value} type="button" size="sm" variant="outline" aria-pressed={active} onClick={() => assignCondition(item.value)}
                      className={cn("h-9 justify-start text-start text-xs", item.color, active && "ring-1 ring-primary ring-offset-1")}>
                      <span className={cn("flex size-3.5 items-center justify-center rounded-full", item.dot)}>
                        {active && <Check className={cn("!size-2.5", item.value === "Healthy" ? "text-slate-700" : "text-white")} />}
                      </span>{t(item.value)}
                    </Button>
                  );
                })}
              </div>
            </div>
            <div className="border-t pt-4">
              <p className="mb-2.5 text-xs font-semibold">{t("Tooth surfaces")}</p>
              <div className="flex flex-wrap gap-2">
                {toothSurfaces.map((surface) => (
                  <Button key={surface.value} type="button" size="sm" variant="outline" aria-pressed={selectedSurfaces.includes(surface.value)} onClick={() => toggleSurface(surface.value)}
                    className={cn("h-9 text-xs", selectedSurfaces.includes(surface.value) && "border-primary bg-primary/5 text-primary")}>
                    <span className="text-[10px] font-bold text-muted-foreground" dir="ltr">{surface.short}</span>{t(surface.label)}
                    {selectedSurfaces.includes(surface.value) && <Check className="!size-3" />}
                  </Button>
                ))}
              </div>
            </div>
            {onSurfaceChange && selectedSurfaces.length > 0 && (
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="mb-2.5 text-xs font-semibold">{t("Mark selected surfaces")}</p>
                <div className="flex flex-wrap gap-2">
                  {chartStates.map((state) => (
                    <Button key={state.value} type="button" size="sm" variant="outline" onClick={() => assignSurfaceState(state.value)}>
                      <span className={cn("size-2.5 rounded-full border", state.color)} />{t(state.label)}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-primary/20 bg-primary/5 px-4 py-3 text-center text-xs text-primary">
          <MousePointer2 className="size-4 shrink-0" />{t("Select one or multiple teeth to chart findings or plan care.")}
        </div>
      )}
    </div>
  );
}
