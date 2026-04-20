import { useState, useEffect, useCallback } from "react";
import { format, subDays, startOfMonth, startOfDay, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { RangeCalendar, RangeValue } from "@/components/ui/range-calendar";
import type { DateRange } from "@/hooks/useMetaAds";

interface DateRangePickerProps {
  value?: DateRange;
  onChange: (range: DateRange) => void;
}

const fmt = (d: Date) => format(d, "yyyy-MM-dd");

const inlineShortcuts = [
  { label: "Hoje", range: () => ({ since: fmt(new Date()), until: fmt(new Date()) }) },
  { label: "Ontem", range: () => { const y = subDays(new Date(), 1); return { since: fmt(y), until: fmt(y) }; } },
  { label: "7 dias", range: () => ({ since: fmt(subDays(new Date(), 6)), until: fmt(new Date()) }) },
  { label: "15 dias", range: () => ({ since: fmt(subDays(new Date(), 14)), until: fmt(new Date()) }) },
  { label: "30 dias", range: () => ({ since: fmt(subDays(new Date(), 29)), until: fmt(new Date()) }) },
  { label: "60 dias", range: () => ({ since: fmt(subDays(new Date(), 59)), until: fmt(new Date()) }) },
  { label: "90 dias", range: () => ({ since: fmt(subDays(new Date(), 89)), until: fmt(new Date()) }) },
  { label: "180 dias", range: () => ({ since: fmt(subDays(new Date(), 179)), until: fmt(new Date()) }) },
  { label: "Mês Atual", range: () => ({ since: fmt(startOfMonth(new Date())), until: fmt(new Date()) }) },
];

const popoverPresets = [
  { label: "Hoje", range: () => ({ since: fmt(new Date()), until: fmt(new Date()) }) },
  { label: "Últimos 7 dias", range: () => ({ since: fmt(subDays(new Date(), 6)), until: fmt(new Date()) }) },
  { label: "Últimos 15 dias", range: () => ({ since: fmt(subDays(new Date(), 14)), until: fmt(new Date()) }) },
  { label: "Últimos 30 dias", range: () => ({ since: fmt(subDays(new Date(), 29)), until: fmt(new Date()) }) },
  { label: "Este mês", range: () => ({ since: fmt(startOfMonth(new Date())), until: fmt(new Date()) }) },
  { label: "Mês passado", range: () => {
      const last = subMonths(new Date(), 1);
      return { since: fmt(startOfMonth(last)), until: fmt(endOfMonth(last)) };
    },
  },
];

type Breakpoint = "mobile" | "tablet" | "desktop";

function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>("desktop");
  useEffect(() => {
    const check = () => {
      const w = window.innerWidth;
      if (w < 480) setBp("mobile");
      else if (w < 768) setBp("tablet");
      else setBp("desktop");
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return bp;
}

export default function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const breakpoint = useBreakpoint();
  const isMobile = breakpoint === "mobile";

  // Lock body scroll when modal is open
  useEffect(() => {
    if (open) {
      const original = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = original; };
    }
  }, [open]);

  // Close on ESC
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  // Local pending state for partial selection
  const [pendingFrom, setPendingFrom] = useState<Date | null>(null);
  // Local pending range for "Aplicar" flow
  const [pendingRange, setPendingRange] = useState<DateRange | null>(null);

  const selectedRange: RangeValue | undefined = pendingFrom
    ? { from: pendingFrom, to: undefined }
    : (pendingRange || value)
    ? {
        from: new Date(((pendingRange || value)!.since) + "T00:00:00"),
        to: new Date(((pendingRange || value)!.until) + "T00:00:00"),
      }
    : undefined;

  const handleSelect = (range: RangeValue) => {
    if (range?.from && !range.to) {
      setPendingFrom(range.from);
      setPendingRange(null);
      return;
    }
    if (range?.from && range.to) {
      setPendingFrom(null);
      const newRange = {
        since: fmt(startOfDay(range.from)),
        until: fmt(startOfDay(range.to)),
      };
      setPendingRange(newRange);
    }
  };

  const handleApply = () => {
    if (pendingRange) {
      onChange(pendingRange);
    }
    setPendingFrom(null);
    setPendingRange(null);
    setOpen(false);
  };

  const handleCancel = () => {
    setPendingFrom(null);
    setPendingRange(null);
    setOpen(false);
  };

  // Init pending range when opening
  useEffect(() => {
    if (open && value) {
      setPendingRange(value);
    }
    if (!open) {
      setPendingFrom(null);
      setPendingRange(null);
    }
  }, [open]);

  const handlePresetInPopup = (range: DateRange) => {
    setPendingFrom(null);
    setPendingRange(range);
  };

  const activeInlineLabel = value
    ? inlineShortcuts.find((s) => {
        const r = s.range();
        return r.since === value.since && r.until === value.until;
      })?.label
    : null;

  const activePresetLabel = (pendingRange || value)
    ? popoverPresets.find((p) => {
        const r = p.range();
        const v = pendingRange || value;
        return v && r.since === v.since && r.until === v.until;
      })?.label
    : null;

  const displayText = value
    ? `${format(new Date(value.since + "T00:00:00"), "dd MMM", { locale: ptBR })} – ${format(new Date(value.until + "T00:00:00"), "dd MMM", { locale: ptBR })}`
    : "Últimos 7 dias";

  const currentDisplay = pendingRange || value;
  const rangePillText = pendingFrom
    ? `${format(pendingFrom, "dd 'de' MMM yyyy", { locale: ptBR })} — …`
    : currentDisplay
    ? (() => {
        const from = new Date(currentDisplay.since + "T00:00:00");
        const to = new Date(currentDisplay.until + "T00:00:00");
        const sameYear = from.getFullYear() === to.getFullYear();
        if (currentDisplay.since === currentDisplay.until) {
          return format(from, "dd 'de' MMM yyyy", { locale: ptBR });
        }
        const fromStr = format(from, sameYear ? "dd MMM" : "dd MMM yyyy", { locale: ptBR });
        const toStr = format(to, "dd MMM yyyy", { locale: ptBR });
        return `${fromStr} — ${toStr}`;
      })()
    : "Selecione um período";

  const numberOfMonths: 1 | 2 = breakpoint === "desktop" ? 2 : 1;

  return (
    <div className="flex items-center gap-2 flex-wrap min-w-0 max-w-full">
      {/* Inline chips */}
      <div
        className={cn(
          "flex items-center gap-1 p-1 rounded-2xl sm:rounded-full bg-muted/40 border border-border/50 backdrop-blur-sm",
          "max-w-full overflow-x-auto sm:overflow-visible no-scrollbar",
          "snap-x snap-mandatory sm:snap-none",
          "sm:flex-wrap",
        )}
      >
        {inlineShortcuts.map((s) => (
          <Button
            key={s.label}
            variant="ghost"
            size="sm"
            onClick={() => onChange(s.range())}
            className={cn(
              "h-9 sm:h-7 px-3 text-xs font-medium rounded-full transition-all duration-200 border-0 shrink-0 snap-start touch-manipulation",
              "hover:bg-background/80 hover:text-foreground",
              activeInlineLabel === s.label
                ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary hover:text-primary-foreground"
                : "text-muted-foreground"
            )}
          >
            {s.label}
          </Button>
        ))}
      </div>

      {/* Trigger pill */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-9 sm:h-8 gap-2 text-xs rounded-full border-border/60 bg-background/60 backdrop-blur-sm hover:bg-accent/60 touch-manipulation"
      >
        <CalendarIcon className="w-3.5 h-3.5" />
        <span className="font-medium">{displayText}</span>
      </Button>

      {/* Modal overlay */}
      {open && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          {/* Backdrop */}
          <div
            className={cn(
              "absolute inset-0 bg-black/40 backdrop-blur-sm",
              "animate-in fade-in-0 duration-200"
            )}
            onClick={handleCancel}
            aria-hidden
          />

          {/* Modal content */}
          <div
            className={cn(
              "relative z-10 bg-popover border border-border/40 overflow-hidden flex flex-col",
              "shadow-2xl",
              isMobile
                ? "fixed bottom-0 left-0 right-0 w-full rounded-t-2xl max-h-[85vh] animate-in slide-in-from-bottom duration-[250ms] ease-out"
                : "rounded-2xl w-[min(440px,calc(100vw-32px))] max-h-[min(640px,calc(100vh-48px))] animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 duration-200"
            )}
          >
            {/* Mobile drag handle */}
            {isMobile && (
              <div className="flex justify-center pt-2 pb-1 shrink-0">
                <div className="w-8 h-1 rounded-full bg-muted-foreground/30" />
              </div>
            )}

            <div className="overflow-y-auto overscroll-contain flex-1">
              {/* Header */}
              <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-border/40">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium mb-0.5">
                    Período
                  </p>
                  <span className="text-[13px] font-semibold text-foreground tabular-nums truncate block">
                    {rangePillText}
                  </span>
                </div>
                {!isMobile && (
                  <button
                    onClick={handleCancel}
                    className="shrink-0 h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Preset chips */}
              <div className="flex gap-1 px-4 py-2 overflow-x-auto no-scrollbar snap-x snap-mandatory border-b border-border/40">
                {popoverPresets.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => handlePresetInPopup(p.range())}
                    className={cn(
                      "shrink-0 snap-start px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors whitespace-nowrap min-h-[32px] inline-flex items-center touch-manipulation",
                      activePresetLabel === p.label
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground bg-muted/50 hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Calendar */}
              <div className="w-full">
                <RangeCalendar
                  value={selectedRange}
                  onChange={handleSelect}
                  numberOfMonths={numberOfMonths}
                  disabledAfter={new Date()}
                  defaultMonth={selectedRange?.from || new Date()}
                />
              </div>
            </div>

            {/* Footer with Apply/Cancel */}
            <div className="flex items-center gap-2 px-4 py-3 border-t border-border/40 shrink-0">
              <button
                onClick={handleCancel}
                className="flex-1 h-11 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleApply}
                disabled={!pendingRange && !pendingFrom}
                className="flex-1 h-11 rounded-lg bg-primary text-primary-foreground text-sm font-semibold transition-colors hover:bg-primary/90 disabled:opacity-40 disabled:pointer-events-none"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
