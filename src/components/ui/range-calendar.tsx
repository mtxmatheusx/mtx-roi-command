import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  format,
  isSameMonth,
  isSameDay,
  isToday,
  isAfter,
  isBefore,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export interface RangeValue {
  from?: Date;
  to?: Date;
}

interface RangeCalendarProps {
  value?: RangeValue;
  onChange?: (range: RangeValue) => void;
  numberOfMonths?: 1 | 2;
  disabledAfter?: Date;
  defaultMonth?: Date;
}

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function buildMonthMatrix(monthDate: Date): Date[] {
  const start = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 0 });
  const end = endOfWeek(endOfMonth(monthDate), { weekStartsOn: 0 });
  const days: Date[] = [];
  let cursor = start;
  while (cursor <= end) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}

function MonthGrid({
  monthDate,
  value,
  hoverDate,
  onDayClick,
  onDayHover,
  disabledAfter,
  direction,
}: {
  monthDate: Date;
  value?: RangeValue;
  hoverDate?: Date | null;
  onDayClick: (d: Date) => void;
  onDayHover: (d: Date | null) => void;
  disabledAfter?: Date;
  direction: number;
}) {
  const days = useMemo(() => buildMonthMatrix(monthDate), [monthDate]);

  // Compute the "live" range (from + (to ?? hover))
  const from = value?.from;
  const to = value?.to ?? (from && hoverDate && isAfter(hoverDate, from) ? hoverDate : value?.to);
  const liveStart = from && to ? (isAfter(from, to) ? to : from) : from;
  const liveEnd = from && to ? (isAfter(from, to) ? from : to) : to;

  return (
    <div className="flex flex-col gap-2 min-w-[260px]">
      {/* Weekday header */}
      <div className="grid grid-cols-7">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="h-8 flex items-center justify-center text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground/60"
          >
            {w}
          </div>
        ))}
      </div>

      {/* Days grid with slide+fade transition */}
      <div className="relative overflow-hidden">
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={format(monthDate, "yyyy-MM")}
            custom={direction}
            initial={{ opacity: 0, x: direction > 0 ? 8 : -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction > 0 ? -8 : 8 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="grid grid-cols-7 gap-y-0.5"
          >
            {days.map((day, idx) => {
              const inMonth = isSameMonth(day, monthDate);
              const disabled = disabledAfter ? isAfter(day, disabledAfter) : false;
              const isStart = liveStart && isSameDay(day, liveStart);
              const isEnd = liveEnd && isSameDay(day, liveEnd);
              const inRange =
                liveStart &&
                liveEnd &&
                !isSameDay(liveStart, liveEnd) &&
                isAfter(day, liveStart) &&
                isBefore(day, liveEnd);
              const isSelected = isStart || isEnd;
              const today = isToday(day);

              // Position within range strip
              const rangeStripClasses = cn(
                inRange && "bg-primary/[0.08]",
                (isStart || isEnd) && liveStart && liveEnd && !isSameDay(liveStart, liveEnd) && "bg-primary/[0.08]",
                isStart && liveEnd && !isSameDay(liveStart, liveEnd) && "rounded-l-lg",
                isEnd && liveStart && !isSameDay(liveStart, liveEnd) && "rounded-r-lg",
              );

              // Stagger delay for range fill animation
              const staggerDelay = inRange ? Math.min(idx * 0.012, 0.18) : 0;

              return (
                <div
                  key={day.toISOString()}
                  className={cn("relative h-9 flex items-center justify-center", rangeStripClasses)}
                  style={inRange ? { transitionDelay: `${staggerDelay}s` } : undefined}
                >
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => !disabled && inMonth && onDayClick(day)}
                    onMouseEnter={() => onDayHover(day)}
                    onMouseLeave={() => onDayHover(null)}
                    className={cn(
                      "relative h-9 w-9 inline-flex items-center justify-center text-sm rounded-lg",
                      "transition-all duration-150 ease-[cubic-bezier(0.4,0,0.2,1)]",
                      "font-normal cursor-pointer select-none",
                      // Default text colors
                      inMonth ? "text-foreground" : "text-muted-foreground/30",
                      // Hover (only if not selected and in month)
                      !isSelected &&
                        inMonth &&
                        !disabled &&
                        "hover:bg-muted hover:scale-[1.05]",
                      // Selected (start/end)
                      isSelected &&
                        "!bg-primary !text-primary-foreground font-medium shadow-[0_1px_3px_hsl(var(--primary)/0.35)] hover:scale-[1.02]",
                      // Disabled
                      disabled && "pointer-events-none opacity-25",
                      // Outside month (no interaction)
                      !inMonth && "pointer-events-none",
                    )}
                  >
                    {format(day, "d")}
                    {/* Today dot indicator */}
                    {today && !isSelected && (
                      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-[3px] h-[3px] rounded-full bg-primary" />
                    )}
                  </button>
                </div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export function RangeCalendar({
  value,
  onChange,
  numberOfMonths = 2,
  disabledAfter,
  defaultMonth,
}: RangeCalendarProps) {
  const [viewMonth, setViewMonth] = useState<Date>(
    () => defaultMonth || value?.from || new Date()
  );
  const [direction, setDirection] = useState(0);
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  // Internal selection state — first click sets `from`, second click sets `to`
  const [pending, setPending] = useState<Date | null>(null);

  const handleNav = (dir: number) => {
    setDirection(dir);
    setViewMonth((m) => (dir > 0 ? addMonths(m, 1) : subMonths(m, 1)));
  };

  const handleDayClick = (day: Date) => {
    if (!value?.from || (value.from && value.to)) {
      // Start a new selection
      setPending(day);
      onChange?.({ from: day, to: undefined });
    } else if (value.from && !value.to) {
      // Complete selection
      const from = value.from;
      const range: RangeValue = isAfter(day, from)
        ? { from, to: day }
        : { from: day, to: from };
      setPending(null);
      onChange?.(range);
    } else {
      setPending(day);
      onChange?.({ from: day, to: undefined });
    }
  };

  const months = useMemo(() => {
    const arr: Date[] = [];
    for (let i = 0; i < numberOfMonths; i++) arr.push(addMonths(viewMonth, i));
    return arr;
  }, [viewMonth, numberOfMonths]);

  return (
    <div className="px-4 py-3 select-none">
      {/* Header: chevrons on outer edges, month label centered per month */}
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => handleNav(-1)}
          className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-all duration-150"
          aria-label="Mês anterior"
        >
          <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2.25} />
        </button>

        <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${numberOfMonths}, 1fr)` }}>
          {months.map((m) => (
            <div
              key={format(m, "yyyy-MM")}
              className="text-center text-sm font-medium tracking-tight text-foreground capitalize"
            >
              {format(m, "MMMM yyyy", { locale: ptBR })}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => handleNav(1)}
          className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-all duration-150"
          aria-label="Próximo mês"
        >
          <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.25} />
        </button>
      </div>

      {/* Subtle separator */}
      <div className="h-px bg-border/40 -mx-4 mb-3" />

      {/* Months grid */}
      <div className="flex flex-col sm:flex-row gap-6">
        {months.map((m, i) => (
          <MonthGrid
            key={format(m, "yyyy-MM")}
            monthDate={m}
            value={value}
            hoverDate={hoverDate}
            onDayClick={handleDayClick}
            onDayHover={setHoverDate}
            disabledAfter={disabledAfter}
            direction={direction}
          />
        ))}
      </div>
    </div>
  );
}
