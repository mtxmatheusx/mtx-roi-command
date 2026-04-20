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

export default function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

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

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex flex-wrap items-center gap-1 p-1 rounded-2xl sm:rounded-full bg-muted/40 border border-border/50 backdrop-blur-sm">
        {inlineShortcuts.map((s) => (
          <Button
            key={s.label}
            variant="ghost"
            size="sm"
            onClick={() => onChange(s.range())}
            className={cn(
              "h-7 px-3 text-xs font-medium rounded-full transition-all duration-200 border-0 shrink-0",
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
            className="h-8 gap-2 text-xs rounded-full border-border/60 bg-background/60 backdrop-blur-sm hover:bg-accent/60"
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            <span className="font-medium">{displayText}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className={cn(
            "p-0 rounded-xl border-border/60 shadow-md overflow-hidden bg-popover/95 backdrop-blur-xl",
            "w-[calc(100vw-2rem)] sm:w-auto"
          )}
          align="end"
          sideOffset={8}
        >
          {/* Range pill header */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border/40 bg-muted/30">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                Período selecionado
              </p>
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold tabular-nums">
                {rangePillText}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row">
            {/* Sidebar presets */}
            <div className="flex sm:flex-col gap-1 p-2 sm:p-3 sm:border-r border-b sm:border-b-0 border-border/40 bg-muted/10 overflow-x-auto sm:overflow-visible sm:min-w-[150px]">
              {popoverPresets.map((p) => (
                <button
                  key={p.label}
                  onClick={() => onChange(p.range())}
                  className={cn(
                    "shrink-0 text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap",
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
            <RangeCalendar
              value={selectedRange}
              onChange={handleSelect}
              numberOfMonths={isMobile ? 1 : 2}
              disabledAfter={new Date()}
              defaultMonth={selectedRange?.from || new Date()}
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
