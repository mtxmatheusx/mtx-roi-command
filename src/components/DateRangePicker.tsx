import { useState, useEffect } from "react";
import { format, subDays, startOfMonth, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { DateRange as DayPickerRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { DateRange } from "@/hooks/useMetaAds";

interface DateRangePickerProps {
  value?: DateRange;
  onChange: (range: DateRange) => void;
}

const fmt = (d: Date) => format(d, "yyyy-MM-dd");

const shortcuts = [
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

export default function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const selectedRange: DayPickerRange | undefined = value
    ? { from: new Date(value.since + "T00:00:00"), to: new Date(value.until + "T00:00:00") }
    : undefined;

  const handleSelect = (range: DayPickerRange | undefined) => {
    if (range?.from) {
      onChange({
        since: fmt(startOfDay(range.from)),
        until: fmt(startOfDay(range.to || range.from)),
      });
    }
  };

  const activeLabel = value
    ? shortcuts.find((s) => {
        const r = s.range();
        return r.since === value.since && r.until === value.until;
      })?.label
    : null;

  const displayText = value
    ? `${format(new Date(value.since + "T00:00:00"), "dd MMM", { locale: ptBR })} – ${format(new Date(value.until + "T00:00:00"), "dd MMM", { locale: ptBR })}`
    : "Últimos 7 dias";

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex flex-wrap items-center gap-1 p-1 rounded-2xl sm:rounded-full bg-muted/40 border border-border/50 backdrop-blur-sm">
        {shortcuts.map((s) => (
          <Button
            key={s.label}
            variant="ghost"
            size="sm"
            onClick={() => onChange(s.range())}
            className={cn(
              "h-7 px-3 text-xs font-medium rounded-full transition-all duration-200 border-0 shrink-0",
              "hover:bg-background/80 hover:text-foreground",
              activeLabel === s.label
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
          className="w-auto p-0 rounded-2xl border-border/60 shadow-2xl overflow-hidden bg-popover/95 backdrop-blur-xl"
          align="end"
          sideOffset={8}
        >
          <div className="px-4 pt-3 pb-2 border-b border-border/40 bg-muted/20">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Selecione o período
            </p>
            {value && (
              <p className="text-xs text-foreground mt-0.5 tabular-nums">
                {format(new Date(value.since + "T00:00:00"), "dd 'de' MMM, yyyy", { locale: ptBR })}
                {" → "}
                {format(new Date(value.until + "T00:00:00"), "dd 'de' MMM, yyyy", { locale: ptBR })}
              </p>
            )}
          </div>
          <Calendar
            mode="range"
            selected={selectedRange}
            onSelect={handleSelect}
            numberOfMonths={isMobile ? 1 : 2}
            locale={ptBR}
            disabled={(date) => date > new Date()}
            className={cn("pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
