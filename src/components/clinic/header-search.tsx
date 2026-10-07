"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Search } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useClinicPreferences } from "@/lib/clinic-preferences";
import { cn } from "@/lib/utils";
import type { Patient } from "@/lib/types";

const MIN_QUERY_LENGTH = 2;
const MAX_RESULTS = 5;

type HeaderSearchProps = {
  patients: Patient[];
  onSelectPatient: (patient: Patient) => void;
};

/**
 * Header patient search. It follows the combobox pattern: the input owns the popup, arrow keys move
 * the active option, and Enter selects it. The popup closes on select, on Escape, and on outside
 * pointer down. On phones the field is hidden behind a search button and opens as a full-width row.
 */
export function HeaderSearch({ patients, onSelectPatient }: HeaderSearchProps) {
  const { t } = useClinicPreferences();
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const mobileRowId = `${baseId}-mobile-row`;
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const trimmedQuery = query.trim();
  const queryReady = trimmedQuery.length >= MIN_QUERY_LENGTH;
  const results = useMemo(() => {
    if (!queryReady) return [];
    const needle = trimmedQuery.toLowerCase();
    return patients
      .filter((patient) => `${patient.name} ${patient.patientNo} ${patient.phone}`.toLowerCase().includes(needle))
      .slice(0, MAX_RESULTS);
  }, [patients, trimmedQuery, queryReady]);

  const popupVisible = open && queryReady;
  const expanded = popupVisible && results.length > 0;
  const optionId = (index: number) => `${baseId}-option-${index}`;

  useEffect(() => {
    if (mobileOpen) inputRef.current?.focus();
  }, [mobileOpen]);

  useEffect(() => {
    if (!open && !mobileOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
      setMobileOpen(false);
      setActiveIndex(-1);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, mobileOpen]);

  const close = () => {
    setOpen(false);
    setMobileOpen(false);
    setActiveIndex(-1);
  };

  const select = (patient: Patient) => {
    setQuery("");
    close();
    onSelectPatient(patient);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      if (open || mobileOpen) {
        event.preventDefault();
        close();
      }
      return;
    }
    if (!expanded) {
      if (event.key === "ArrowDown" && queryReady) setOpen(true);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index <= 0 ? results.length - 1 : index - 1));
    } else if (event.key === "Enter" && activeIndex >= 0 && results[activeIndex]) {
      event.preventDefault();
      select(results[activeIndex]);
    }
  };

  const containerClass = mobileOpen
    ? "absolute inset-x-0 top-full z-50 block border-b border-border bg-card px-4 py-3 shadow-overlay md:relative md:inset-auto md:top-auto md:block md:w-full md:max-w-sm md:border-0 md:bg-transparent md:p-0 md:shadow-none"
    : "hidden md:relative md:block md:w-full md:max-w-sm";

  return (
    <div ref={rootRef} className="contents">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-11 shrink-0 md:hidden"
        aria-label={t("Search patients")}
        aria-expanded={mobileOpen}
        aria-controls={mobileRowId}
        onClick={() => {
          if (mobileOpen) close();
          else setMobileOpen(true);
        }}
      >
        <Search className="size-5" />
      </Button>
      <div id={mobileRowId} className={containerClass}>
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            ref={inputRef}
            type="search"
            role="combobox"
            aria-label={t("Search patients")}
            aria-autocomplete="list"
            aria-expanded={expanded}
            aria-controls={expanded ? listboxId : undefined}
            aria-activedescendant={expanded && activeIndex >= 0 ? optionId(activeIndex) : undefined}
            autoComplete="off"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
              setActiveIndex(-1);
            }}
            onFocus={() => {
              if (queryReady) setOpen(true);
            }}
            onKeyDown={onKeyDown}
            className="h-11 border-transparent bg-muted/70 ps-10 shadow-none focus:bg-white md:h-10"
            placeholder={t("Search patients…")}
          />
          {popupVisible && (
            <div className="absolute inset-x-0 top-full z-50 mt-2 rounded-2xl border border-border bg-overlay p-2 shadow-overlay">
              {expanded ? (
                <div id={listboxId} role="listbox" aria-label={t("Matching patients")} className="space-y-1">
                  {results.map((patient, index) => (
                    <Button
                      key={patient.id}
                      id={optionId(index)}
                      type="button"
                      role="option"
                      aria-selected={index === activeIndex}
                      variant="ghost"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => select(patient)}
                      className={cn(
                        "h-auto min-h-11 w-full justify-start gap-3 rounded-xl p-2.5 text-start",
                        index === activeIndex && "bg-muted",
                      )}
                    >
                      <Avatar className="size-8">
                        <AvatarFallback className={patient.avatarColor} data-no-translate>
                          {patient.initials}
                        </AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold" data-no-translate>{patient.name}</span>
                        <span className="block truncate text-xs text-muted-foreground" data-no-translate>
                          {patient.patientNo} · {patient.phone}
                        </span>
                      </span>
                    </Button>
                  ))}
                </div>
              ) : (
                <p role="status" className="px-3 py-3 text-center text-xs text-muted-foreground">
                  {t("No matching patients")}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
