"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Check, MousePointer2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
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

function SurfaceMap({ states }: { states: Partial<Record<ToothSurface, DentalChartState>> }) {
  const fill = (surface: ToothSurface) => surfaceFill[states[surface] ?? "healthy"];
  return (
    <svg viewBox="0 0 48 48" className="size-10 drop-shadow-sm" aria-hidden="true">
      <path d="M8 8 L18 18 L18 30 L8 40 Z" fill={fill("mesial")} stroke="#94a3b8" />
      <path d="M40 8 L30 18 L30 30 L40 40 Z" fill={fill("distal")} stroke="#94a3b8" />
      <path d="M8 8 L40 8 L30 18 L18 18 Z" fill={fill("buccal")} stroke="#94a3b8" />
      <path d="M8 40 L40 40 L30 30 L18 30 Z" fill={fill("lingual")} stroke="#94a3b8" />
      <rect x="18" y="18" width="12" height="12" rx="3" fill={fill("occlusal")} stroke="#94a3b8" />
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
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={`Tooth ${number}, ${condition}`}
      className={cn(
        "group h-auto min-w-11 flex-col items-center gap-1 rounded-xl border border-transparent px-1 py-1.5 transition hover:bg-white hover:shadow-sm",
        selected && "border-primary bg-primary/5 shadow-sm ring-2 ring-primary/15",
        condition === "Missing" && "opacity-45",
      )}
    >
      <span className="text-[10px] font-bold text-slate-600">{number}</span>
      <span className="relative">
        <SurfaceMap states={states} />
        {condition === "Missing" && <span className="absolute inset-0 grid place-items-center text-3xl font-light text-slate-500">×</span>}
      </span>
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
    <div className="space-y-4">
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {chartStates.map((item) => (
          <div key={item.value} className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <span className={cn("size-2.5 rounded-full border", item.color)} />{item.label}
          </div>
        ))}
      </div>
      <div className="overflow-x-auto rounded-2xl border bg-slate-50/70 p-3 sm:p-5">
        <div className="mx-auto min-w-[760px] max-w-5xl space-y-5">
          {renderRow(Array.from({ length: 16 }, (_, index) => index + 1))}
          <div className="relative h-px bg-border">
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-50 px-3 text-[10px] font-bold uppercase tracking-[.2em] text-muted-foreground">Midline</span>
          </div>
          {renderRow(Array.from({ length: 16 }, (_, index) => 32 - index))}
        </div>
      </div>
      {selectedTeeth.length ? (
        <div className="animate-in fade-in slide-in-from-bottom-2 space-y-4 rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold">{selectedTeeth.length} {selectedTeeth.length === 1 ? "tooth selected" : "teeth selected"}</p>
              <p className="text-xs text-muted-foreground" data-no-translate>#{selectedTeeth.join(", #")}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSelectedTeeth([])}><RotateCcw /> Clear selection</Button>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold">Tooth surfaces</p>
            <div className="flex flex-wrap gap-2">
              {toothSurfaces.map((surface) => (
                <Button key={surface.value} type="button" size="sm" variant="outline" onClick={() => toggleSurface(surface.value)}
                  className={cn("rounded-xl text-xs",
                    selectedSurfaces.includes(surface.value) && "border-primary bg-primary/5 text-primary ring-2 ring-primary/10")}>
                  <span className="me-1.5 text-[10px] text-muted-foreground">{surface.short}</span>{surface.label}
                </Button>
              ))}
            </div>
          </div>
          {onSurfaceChange && selectedSurfaces.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold">Mark selected surfaces</p>
              <div className="flex flex-wrap gap-2">
                {chartStates.map((state) => (
                  <Button key={state.value} type="button" size="sm" variant="outline" onClick={() => assignSurfaceState(state.value)}>
                    <span className={cn("size-3 rounded-full border", state.color)} />{state.label}
                  </Button>
                ))}
              </div>
            </div>
          )}
          <details>
            <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">Whole-tooth condition</summary>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {conditions.map((item) => (
                <Button key={item.value} type="button" size="sm" variant="outline" onClick={() => assignCondition(item.value)}
                  className={cn("justify-start rounded-xl text-start text-xs", item.color,
                    selectedConditions.length === 1 && selectedConditions[0] === item.value && "ring-2 ring-primary ring-offset-2")}>
                  <span className={cn("flex size-4 items-center justify-center rounded-full", item.dot)}>
                    {selectedConditions.length === 1 && selectedConditions[0] === item.value && <Check className="size-3 text-white" />}
                  </span>{item.value}
                </Button>
              ))}
            </div>
          </details>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 rounded-xl bg-primary/5 px-4 py-3 text-center text-sm text-primary">
          <MousePointer2 className="size-4" /> Select one or multiple teeth to chart findings or plan care.
        </div>
      )}
    </div>
  );
}
