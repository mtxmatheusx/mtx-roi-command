import { useState } from "react";
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
    ? `${format(new Date(value.since + "T00:00:00"), "dd/MM", { locale: ptBR })} – ${format(new Date(value.until + "T00:00:00"), "dd/MM", { locale: ptBR })}`
    : "Últimos 7 dias";

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {shortcuts.map((s) => (
        <Button
          key={s.label}
          variant="ghost"
          size="sm"
          onClick={() => onChange(s.range())}
          className={cn(
            "h-8 px-3 text-xs border border-border",
            activeLabel === s.label && "border-primary/50 text-primary bg-primary/10"
          )}
        >
          {s.label}
        </Button>
      ))}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-2 text-xs">
            <CalendarIcon className="w-3.5 h-3.5" />
            {displayText}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="range"
            selected={selectedRange}
            onSelect={handleSelect}
            numberOfMonths={2}
            locale={ptBR}
            disabled={(date) => date > new Date()}
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
