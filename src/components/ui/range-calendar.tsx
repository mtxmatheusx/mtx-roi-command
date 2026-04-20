import { useState, useMemo, useEffect } from "react";
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

const WEEKDAYS_FULL = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const WEEKDAYS_SHORT = ["D", "S", "T", "Q", "Q", "S", "S"];

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
  compactWeekdays,
}: {
  monthDate: Date;
  value?: RangeValue;
  hoverDate?: Date | null;
  onDayClick: (d: Date) => void;
  onDayHover: (d: Date | null) => void;
  disabledAfter?: Date;
  direction: number;
  compactWeekdays: boolean;
}) {
  const days = useMemo(() => buildMonthMatrix(monthDate), [monthDate]);

  const from = value?.from;
  const to = value?.to ?? (from && hoverDate && isAfter(hoverDate, from) ? hoverDate : value?.to);
  const liveStart = from && to ? (isAfter(from, to) ? to : from) : from;
  const liveEnd = from && to ? (isAfter(from, to) ? from : to) : to;

  const labels = compactWeekdays ? WEEKDAYS_SHORT : WEEKDAYS_FULL;

  return (
    <div className="flex flex-col gap-2 w-full min-w-0">
      {/* Weekday header */}
      <div className="grid grid-cols-7 w-full">
        {labels.map((w, i) => (
          <div
            key={`${w}-${i}`}
            className="h-8 flex items-center justify-center text-[clamp(0.625rem,2vw,0.6875rem)] font-medium uppercase tracking-[0.05em] text-muted-foreground/60 min-w-0"
          >
            {w}
          </div>
        ))}
      </div>

      {/* Days grid with slide+fade transition */}
      <div className="relative overflow-hidden w-full">
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={format(monthDate, "yyyy-MM")}
            custom={direction}
            initial={{ opacity: 0, x: direction > 0 ? 8 : -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction > 0 ? -8 : 8 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="grid grid-cols-7 gap-y-0.5 w-full"
            style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}
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

              const rangeStripClasses = cn(
                inRange && "bg-primary/[0.08]",
                (isStart || isEnd) && liveStart && liveEnd && !isSameDay(liveStart, liveEnd) && "bg-primary/[0.08]",
                isStart && liveEnd && !isSameDay(liveStart, liveEnd) && "rounded-l-lg",
                isEnd && liveStart && !isSameDay(liveStart, liveEnd) && "rounded-r-lg",
              );

              const staggerDelay = inRange ? Math.min(idx * 0.012, 0.18) : 0;

              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "relative flex items-center justify-center min-w-0 aspect-square min-h-[40px] sm:min-h-0 sm:h-9",
                    rangeStripClasses
                  )}
                  style={inRange ? { transitionDelay: `${staggerDelay}s` } : undefined}
                >
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => !disabled && inMonth && onDayClick(day)}
                    onMouseEnter={() => onDayHover(day)}
                    onMouseLeave={() => onDayHover(null)}
                    className={cn(
                      "relative inline-flex items-center justify-center text-[clamp(0.8125rem,2.4vw,0.875rem)] rounded-lg",
                      "h-9 w-9 sm:h-9 sm:w-9",
                      "transition-all duration-150 ease-[cubic-bezier(0.4,0,0.2,1)]",
                      "font-normal cursor-pointer select-none touch-manipulation",
                      inMonth ? "text-foreground" : "text-muted-foreground/30",
                      !isSelected &&
                        inMonth &&
                        !disabled &&
                        "hover:bg-muted hover:scale-[1.05]",
                      isSelected &&
                        "!bg-primary !text-primary-foreground font-medium shadow-[0_1px_3px_hsl(var(--primary)/0.35)] hover:scale-[1.02]",
                      disabled && "pointer-events-none opacity-25",
                      !inMonth && "pointer-events-none",
                    )}
                  >
                    {format(day, "d")}
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
  const [, setPending] = useState<Date | null>(null);

  // Detect very small screens for 1-letter weekday labels
  const [compactWeekdays, setCompactWeekdays] = useState(false);
  useEffect(() => {
    const check = () => setCompactWeekdays(window.innerWidth < 380);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const handleNav = (dir: number) => {
    setDirection(dir);
    setViewMonth((m) => (dir > 0 ? addMonths(m, 1) : subMonths(m, 1)));
  };

  const handleDayClick = (day: Date) => {
    if (!value?.from || (value.from && value.to)) {
      setPending(day);
      onChange?.({ from: day, to: undefined });
    } else if (value.from && !value.to) {
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
    <div className="px-3 sm:px-4 py-3 select-none w-full min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <button
          type="button"
          onClick={() => handleNav(-1)}
          className="inline-flex items-center justify-center h-11 w-11 sm:h-7 sm:w-7 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-all duration-150 shrink-0 touch-manipulation"
          aria-label="Mês anterior"
        >
          <ChevronLeft className="h-4 w-4 sm:h-3.5 sm:w-3.5" strokeWidth={2.25} />
        </button>

        <div
          className="flex-1 grid min-w-0"
          style={{ gridTemplateColumns: `repeat(${numberOfMonths}, minmax(0, 1fr))` }}
        >
          {months.map((m) => (
            <div
              key={format(m, "yyyy-MM")}
              className="text-center text-[clamp(0.8125rem,2.4vw,0.875rem)] font-medium tracking-tight text-foreground capitalize truncate px-1"
            >
              {format(m, "MMMM yyyy", { locale: ptBR })}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => handleNav(1)}
          className="inline-flex items-center justify-center h-11 w-11 sm:h-7 sm:w-7 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-all duration-150 shrink-0 touch-manipulation"
          aria-label="Próximo mês"
        >
          <ChevronRight className="h-4 w-4 sm:h-3.5 sm:w-3.5" strokeWidth={2.25} />
        </button>
      </div>

      <div className="h-px bg-border/40 -mx-3 sm:-mx-4 mb-3" />

      {/* Months grid */}
      <div className="flex flex-col md:flex-row gap-6 w-full min-w-0">
        {months.map((m) => (
          <MonthGrid
            key={format(m, "yyyy-MM")}
            monthDate={m}
            value={value}
            hoverDate={hoverDate}
            onDayClick={handleDayClick}
            onDayHover={setHoverDate}
            disabledAfter={disabledAfter}
            direction={direction}
            compactWeekdays={compactWeekdays}
          />
        ))}
      </div>
    </div>
  );
}
