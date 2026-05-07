import { useState, useRef, useEffect, useCallback, forwardRef } from "react";
import { createPortal } from "react-dom";
import { DayPicker } from "react-day-picker";
import { ptBR } from "date-fns/locale";
import {
  format, startOfDay, endOfDay,
  startOfWeek,
  startOfMonth, endOfMonth,
  subDays, subMonths,
  isSameDay,
} from "date-fns";
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface DateRangeValue {
  from: Date;
  to: Date;
}

type PresetId =
  | "today" | "yesterday" | "this_week"
  | "last_7" | "last_15" | "last_30"
  | "this_month" | "last_month" | "last_90"
  | "custom";

interface Preset {
  id: PresetId;
  label: string;
  getRange?: () => DateRangeValue;
}

// ─── Presets ───────────────────────────────────────────────────────────────────

function buildPresets(): Preset[] {
  const now = new Date();
  return [
    { id: "today", label: "Hoje",
      getRange: () => ({ from: startOfDay(now), to: endOfDay(now) }) },
    { id: "yesterday", label: "Ontem",
      getRange: () => { const y = subDays(now, 1); return { from: startOfDay(y), to: endOfDay(y) }; } },
    { id: "this_week", label: "Esta semana",
      getRange: () => ({ from: startOfWeek(now, { weekStartsOn: 0 }), to: endOfDay(now) }) },
    { id: "last_7", label: "Últimos 7 dias",
      getRange: () => ({ from: startOfDay(subDays(now, 6)), to: endOfDay(now) }) },
    { id: "last_15", label: "Últimos 15 dias",
      getRange: () => ({ from: startOfDay(subDays(now, 14)), to: endOfDay(now) }) },
    { id: "last_30", label: "Últimos 30 dias",
      getRange: () => ({ from: startOfDay(subDays(now, 29)), to: endOfDay(now) }) },
    { id: "this_month", label: "Este mês",
      getRange: () => ({ from: startOfMonth(now), to: endOfDay(now) }) },
    { id: "last_month", label: "Mês passado",
      getRange: () => { const m = subMonths(now, 1); return { from: startOfMonth(m), to: endOfMonth(m) }; } },
    { id: "last_90", label: "Últimos 90 dias",
      getRange: () => ({ from: startOfDay(subDays(now, 89)), to: endOfDay(now) }) },
    { id: "custom", label: "Personalizado" },
  ];
}

// ─── Format label ──────────────────────────────────────────────────────────────

function formatLabel(range: DateRangeValue, preset: PresetId): string {
  const labels: Record<string, string> = {
    today: "Hoje", yesterday: "Ontem", this_week: "Esta semana",
    last_7: "Últ. 7 dias", last_15: "Últ. 15 dias", last_30: "Últ. 30 dias",
    this_month: "Este mês", last_month: "Mês passado", last_90: "Últ. 90 dias",
  };
  if (labels[preset]) return labels[preset];
  const from = format(range.from, "dd/MM/yy");
  const to = format(range.to, "dd/MM/yy");
  return isSameDay(range.from, range.to) ? from : `${from} – ${to}`;
}

// ─── DayPicker classNames ──────────────────────────────────────────────────────

const DAY_CLASSES = {
  root: "p-0",
  months: "flex gap-6",
  month: "space-y-3",
  caption: "flex items-center justify-between px-1",
  caption_label: "text-sm font-semibold text-foreground",
  nav: "flex items-center gap-1",
  nav_button: "h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors",
  nav_button_previous: "",
  nav_button_next: "",
  table: "w-full border-collapse",
  head_row: "flex mb-1",
  head_cell: "w-9 text-center text-[10px] font-semibold text-muted-foreground/60 uppercase",
  row: "flex w-full mt-0.5",
  cell: "relative w-9 h-9 flex items-center justify-center p-0 text-sm",
  day: "h-9 w-9 rounded-lg flex items-center justify-center text-sm font-medium text-foreground hover:bg-muted transition-colors cursor-pointer select-none",
  day_selected: "!bg-primary !text-white hover:!bg-primary/90",
  day_today: "text-primary font-bold",
  day_outside: "text-muted-foreground/20 pointer-events-none",
  day_disabled: "text-muted-foreground/20 pointer-events-none",
  day_range_start: "!bg-primary !text-white !rounded-r-none",
  day_range_end: "!bg-primary !text-white !rounded-l-none",
  day_range_middle: "!bg-primary/15 !text-foreground !rounded-none hover:!bg-primary/25",
  day_hidden: "invisible",
};

// ─── Dropdown Portal (with forwarded ref for outside-click detection) ──────────

interface DropdownContentProps {
  triggerRect: DOMRect;
  showCalendar: boolean;
  activePreset: PresetId;
  presets: Preset[];
  tempCustom: { from?: Date; to?: Date };
  onPreset: (p: Preset) => void;
  onDayClick: (day: Date) => void;
  onApply: () => void;
  onCancel: () => void;
}

// forwardRef so the parent can hold a ref to the dropdown DOM node
const DropdownContent = forwardRef<HTMLDivElement, DropdownContentProps>(
  function DropdownContent(
    { triggerRect, showCalendar, activePreset, presets, tempCustom, onPreset, onDayClick, onApply, onCancel },
    ref
  ) {
    const right = window.innerWidth - triggerRect.right;
    const top = triggerRect.bottom + 8;

    const pickerSelected = tempCustom.from
      ? { from: tempCustom.from, to: tempCustom.to ?? tempCustom.from }
      : undefined;

    const statusText = !tempCustom.from
      ? "Selecione a data inicial"
      : !tempCustom.to
      ? "Selecione a data final"
      : `${format(tempCustom.from, "dd/MM/yy")} – ${format(tempCustom.to!, "dd/MM/yy")}`;

    return createPortal(
      // This div is rendered in document.body and its ref is tracked by the parent
      <div
        ref={ref}
        style={{ position: "fixed", top, right, zIndex: 9999 }}
        className="rounded-2xl border border-border/60 bg-card shadow-card overflow-hidden animate-scale-in origin-top-right"
      >
        <div className={cn("flex", showCalendar && "divide-x divide-border/40")}>
          {/* Preset list */}
          <div className="flex flex-col p-2 min-w-[13rem]">
            <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              Período
            </p>
            {presets.map((p, i) => {
              const isActive = activePreset === p.id;
              return (
                <div key={p.id}>
                  {i === 9 && <div className="my-1 h-px bg-border/40 mx-3" />}
                  <button
                    onMouseDown={(e) => e.stopPropagation()} // prevent outside-click handler from firing
                    onClick={() => onPreset(p)}
                    className={cn(
                      "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left",
                      isActive
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-foreground/80 hover:bg-muted/50 hover:text-foreground"
                    )}
                  >
                    {p.label}
                    {isActive && <Check className="h-3.5 w-3.5 shrink-0" />}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Calendar panel */}
          {showCalendar && (
            <div className="p-5 space-y-4">
              <p className="text-xs font-medium text-muted-foreground">{statusText}</p>
              <DayPicker
                mode="range"
                numberOfMonths={2}
                locale={ptBR}
                selected={pickerSelected as any}
                onDayClick={onDayClick}
                classNames={DAY_CLASSES}
                components={{
                  IconLeft: () => <ChevronLeft className="h-4 w-4" />,
                  IconRight: () => <ChevronRight className="h-4 w-4" />,
                }}
                toDate={new Date()}
                captionLayout="dropdown-buttons"
                fromYear={2024}
                toYear={new Date().getFullYear()}
              />
              <div className="flex justify-end gap-2 pt-1 border-t border-border/40">
                <button
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={onCancel}
                  className="px-3 h-8 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={onApply}
                  disabled={!tempCustom.from || !tempCustom.to}
                  className="px-4 h-8 rounded-lg text-sm font-semibold bg-gradient-primary text-white hover:opacity-90 disabled:opacity-40 transition-all shadow-glow-sm"
                >
                  Aplicar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>,
      document.body
    );
  }
);

// ─── Main Component ────────────────────────────────────────────────────────────

interface DateRangePickerProps {
  value: DateRangeValue;
  onChange: (range: DateRangeValue) => void;
}

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const PRESETS = buildPresets();

  const [open, setOpen] = useState(false);
  const [activePreset, setActivePreset] = useState<PresetId>("last_30");
  const [tempCustom, setTempCustom] = useState<{ from?: Date; to?: Date }>({});
  const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  // ✅ Will hold a direct ref to the portal's DOM node in document.body
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Re-compute trigger position on scroll/resize while open
  const updateRect = useCallback(() => {
    if (triggerRef.current) setTriggerRect(triggerRef.current.getBoundingClientRect());
  }, []);

  useEffect(() => {
    if (!open) return;
    updateRect();
    window.addEventListener("scroll", updateRect, true);
    window.addEventListener("resize", updateRect);
    return () => {
      window.removeEventListener("scroll", updateRect, true);
      window.removeEventListener("resize", updateRect);
    };
  }, [open, updateRect]);

  // ✅ Outside click: checks BOTH the trigger ref AND the actual portal DOM node
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;   // click on trigger → ignore
      if (dropdownRef.current?.contains(target)) return;  // click inside portal → ignore
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const handleOpen = () => {
    updateRect();
    setOpen((o) => !o);
  };

  const handlePreset = (preset: Preset) => {
    if (preset.id === "custom") {
      setActivePreset("custom");
      setTempCustom({ from: value.from, to: value.to });
      return;
    }
    const range = preset.getRange!();
    setActivePreset(preset.id);
    onChange(range);
    setOpen(false);
  };

  const handleDayClick = (day: Date) => {
    if (!tempCustom.from || (tempCustom.from && tempCustom.to)) {
      setTempCustom({ from: startOfDay(day) });
    } else {
      const from = tempCustom.from!;
      const to = endOfDay(day);
      if (to < from) setTempCustom({ from: startOfDay(day) });
      else setTempCustom({ from, to });
    }
  };

  const applyCustom = () => {
    if (tempCustom.from && tempCustom.to) {
      onChange({ from: tempCustom.from, to: tempCustom.to });
      setOpen(false);
    }
  };

  const handleCancel = () => {
    // Revert to last_30
    setActivePreset("last_30");
    const p = PRESETS.find((x) => x.id === "last_30")!;
    onChange(p.getRange!());
    setOpen(false);
  };

  return (
    <>
      {/* Trigger button */}
      <button
        ref={triggerRef}
        onClick={handleOpen}
        className={cn(
          "flex items-center gap-2 h-9 px-3 rounded-xl border text-sm font-medium transition-all duration-200",
          open
            ? "border-primary/50 bg-primary/8 text-foreground shadow-glow-sm"
            : "border-border/60 bg-muted/50 text-foreground hover:border-border hover:bg-muted/70"
        )}
      >
        <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="whitespace-nowrap">{formatLabel(value, activePreset)}</span>
        <ChevronDown className={cn(
          "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200",
          open && "rotate-180"
        )} />
      </button>

      {/* Portal dropdown — ref points directly to the fixed div in document.body */}
      {open && triggerRect && (
        <DropdownContent
          ref={dropdownRef}
          triggerRect={triggerRect}
          showCalendar={activePreset === "custom"}
          activePreset={activePreset}
          presets={PRESETS}
          tempCustom={tempCustom}
          onPreset={handlePreset}
          onDayClick={handleDayClick}
          onApply={applyCustom}
          onCancel={handleCancel}
        />
      )}
    </>
  );
}
