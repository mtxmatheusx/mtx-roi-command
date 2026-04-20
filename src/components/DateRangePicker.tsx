import { useState, useEffect } from "react";
import { format, subDays, startOfMonth, startOfDay, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { RangeCalendar, RangeValue } from "@/components/ui/range-calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

  // Lock body scroll when bottom sheet is open
  useEffect(() => {
    if (isMobile && open) {
      const original = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = original; };
    }
  }, [isMobile, open]);

  const selectedRange: RangeValue | undefined = value
    ? { from: new Date(value.since + "T00:00:00"), to: new Date(value.until + "T00:00:00") }
    : undefined;

  const handleSelect = (range: RangeValue) => {
    if (range?.from) {
      onChange({
        since: fmt(startOfDay(range.from)),
        until: fmt(startOfDay(range.to || range.from)),
      });
    }
  };

  const activeInlineLabel = value
    ? inlineShortcuts.find((s) => {
        const r = s.range();
        return r.since === value.since && r.until === value.until;
      })?.label
    : null;

  const activePresetLabel = value
    ? popoverPresets.find((p) => {
        const r = p.range();
        return r.since === value.since && r.until === value.until;
      })?.label
    : null;

  const displayText = value
    ? `${format(new Date(value.since + "T00:00:00"), "dd MMM", { locale: ptBR })} – ${format(new Date(value.until + "T00:00:00"), "dd MMM", { locale: ptBR })}`
    : "Últimos 7 dias";

  const rangePillText = value
    ? (() => {
        const from = new Date(value.since + "T00:00:00");
        const to = new Date(value.until + "T00:00:00");
        const sameYear = from.getFullYear() === to.getFullYear();
        if (value.since === value.until) {
          return format(from, "dd 'de' MMM yyyy", { locale: ptBR });
        }
        const fromStr = format(from, sameYear ? "dd MMM" : "dd MMM yyyy", { locale: ptBR });
        const toStr = format(to, "dd MMM yyyy", { locale: ptBR });
        return `${fromStr} — ${toStr}`;
      })()
    : "Selecione um período";

  // Number of months in calendar: 2 only on desktop
  const numberOfMonths: 1 | 2 = breakpoint === "desktop" ? 2 : 1;

  /* ====== Calendar body (shared) ====== */
  const CalendarBody = (
    <>
      {/* Range pill header */}
      <div className="flex items-center justify-between gap-3 px-3 sm:px-4 py-2.5 sm:py-3 border-b border-border/40 bg-muted/30">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 truncate">
            Período selecionado
          </p>
          <span className="inline-flex items-center px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full bg-primary/10 text-primary text-[11px] sm:text-xs font-semibold tabular-nums">
            {rangePillText}
          </span>
        </div>
      </div>

      <div className="flex flex-col md:flex-row min-w-0">
        {/* Sidebar presets */}
        <div
          className={cn(
            "flex md:flex-col gap-1 p-2 md:p-3 md:border-r border-b md:border-b-0 border-border/40 bg-muted/10",
            "overflow-x-auto md:overflow-visible no-scrollbar",
            "md:min-w-[150px]",
            "snap-x snap-mandatory md:snap-none",
          )}
        >
          {popoverPresets.map((p) => (
            <button
              key={p.label}
              onClick={() => onChange(p.range())}
              className={cn(
                "shrink-0 snap-start text-left px-3 py-2 md:py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap min-h-[40px] md:min-h-0 inline-flex items-center touch-manipulation",
                activePresetLabel === p.label
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Calendar */}
        <div className="min-w-0 flex-1">
          <RangeCalendar
            value={selectedRange}
            onChange={handleSelect}
            numberOfMonths={numberOfMonths}
            disabledAfter={new Date()}
            defaultMonth={selectedRange?.from || new Date()}
          />
        </div>
      </div>
    </>
  );

  return (
    <div className="flex items-center gap-2 flex-wrap min-w-0 max-w-full">
      {/* Inline chips — horizontal scroll on mobile, wrap on tablet+ */}
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

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-9 sm:h-8 gap-2 text-xs rounded-full border-border/60 bg-background/60 backdrop-blur-sm hover:bg-accent/60 touch-manipulation"
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            <span className="font-medium">{displayText}</span>
          </Button>
        </PopoverTrigger>

        {isMobile ? (
          /* === Mobile: Bottom Sheet === */
          <PopoverContent
            side="bottom"
            align="center"
            sideOffset={0}
            avoidCollisions={false}
            className={cn(
              "p-0 border-0 bg-transparent shadow-none",
              "fixed left-0 right-0 bottom-0 top-auto !translate-x-0 !translate-y-0",
              "w-screen max-w-none rounded-none",
              "z-50",
              "data-[state=open]:animate-in data-[state=closed]:animate-out",
              "data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
              "duration-200",
            )}
            style={{ width: "100vw" }}
          >
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-sm -z-10 data-[state=open]:animate-in data-[state=open]:fade-in-0"
              onClick={() => setOpen(false)}
              aria-hidden
            />
            {/* Sheet */}
            <div className="relative bg-popover/95 backdrop-blur-2xl border-t border-border/40 rounded-t-2xl shadow-[0_-12px_40px_-8px_rgba(0,0,0,0.25)] overflow-hidden max-h-[85vh] flex flex-col">
              {/* Drag handle */}
              <div className="flex justify-center pt-2 pb-1 shrink-0">
                <div className="w-8 h-1 rounded-full bg-muted-foreground/30" />
              </div>
              <div className="overflow-y-auto overscroll-contain">
                {CalendarBody}
              </div>
            </div>
          </PopoverContent>
        ) : (
          /* === Tablet & Desktop: anchored popover === */
          <PopoverContent
            className={cn(
              "p-0 rounded-2xl border border-border/40 overflow-hidden bg-popover/85 backdrop-blur-2xl",
              "shadow-[0_24px_48px_-12px_rgba(0,0,0,0.18),0_0_0_1px_rgba(0,0,0,0.04)]",
              breakpoint === "tablet" ? "w-[340px]" : "w-auto",
              "data-[state=open]:animate-in data-[state=closed]:animate-out",
              "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
              "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
              "data-[state=open]:slide-in-from-top-1 data-[state=closed]:slide-out-to-top-1"
            )}
            align="end"
            sideOffset={8}
          >
            {CalendarBody}
          </PopoverContent>
        )}
      </Popover>
    </div>
  );
}
