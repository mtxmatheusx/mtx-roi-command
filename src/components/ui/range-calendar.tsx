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
  setMonth,
  setYear,
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
const MONTHS_PT = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

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

  // Compute live range across the full calendar (cross-month aware)
  const from = value?.from;
  const explicitTo = value?.to;
  // While selecting (only `from` set), use hoverDate as preview end
  const previewTo = !explicitTo && from && hoverDate ? hoverDate : explicitTo;

  const liveStart = from && previewTo
    ? (isAfter(from, previewTo) ? previewTo : from)
    : from;
  const liveEnd = from && previewTo
    ? (isAfter(from, previewTo) ? from : previewTo)
    : previewTo;

  const labels = compactWeekdays ? WEEKDAYS_SHORT : WEEKDAYS_FULL;

  return (
    <div className="flex flex-col gap-1.5 w-full min-w-0">
      {/* Weekday header */}
      <div className="grid grid-cols-7 w-full" style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}>
        {labels.map((w, i) => (
          <div
            key={`${w}-${i}`}
            className="h-7 flex items-center justify-center text-[10px] sm:text-[11px] font-medium uppercase tracking-wider text-muted-foreground/50 min-w-0"
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
            initial={{ opacity: 0, x: direction > 0 ? 6 : -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction > 0 ? -6 : 6 }}
            transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
            className="grid grid-cols-7 w-full"
            style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}
          >
            {days.map((day) => {
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
              const isSingleDay = liveStart && liveEnd && isSameDay(liveStart, liveEnd);

              const rangeStripClasses = cn(
                inRange && "bg-primary/[0.07]",
                (isStart || isEnd) && !isSingleDay && "bg-primary/[0.07]",
                isStart && liveEnd && !isSingleDay && "rounded-l-md",
                isEnd && liveStart && !isSingleDay && "rounded-r-md",
              );

              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "relative flex items-center justify-center min-w-0 h-10 sm:h-9",
                    rangeStripClasses
                  )}
                >
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => !disabled && onDayClick(day)}
                    onMouseEnter={() => onDayHover(day)}
                    onMouseLeave={() => onDayHover(null)}
                    className={cn(
                      "relative inline-flex items-center justify-center text-[13px] sm:text-[13px] rounded-md",
                      "h-9 w-9",
                      "transition-colors duration-100",
                      "font-normal cursor-pointer select-none touch-manipulation tabular-nums",
                      inMonth ? "text-foreground" : "text-muted-foreground/30",
                      !isSelected && !disabled && "hover:bg-muted",
                      isSelected && "!bg-primary !text-primary-foreground font-medium",
                      disabled && "pointer-events-none opacity-25",
                    )}
                  >
                    {format(day, "d")}
                    {today && !isSelected && (
                      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
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

/* ============= Month/Year picker ============= */
function MonthYearPicker({
  currentMonth,
  onSelect,
  onClose,
  disabledAfter,
}: {
  currentMonth: Date;
  onSelect: (d: Date) => void;
  onClose: () => void;
  disabledAfter?: Date;
}) {
  const [year, setYearState] = useState(currentMonth.getFullYear());
  const maxYear = disabledAfter ? disabledAfter.getFullYear() : 9999;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
      className="absolute inset-0 z-10 bg-popover/95 backdrop-blur-xl flex flex-col p-3"
    >
      {/* Year selector header */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => setYearState((y) => y - 1)}
          className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground/70 hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Ano anterior"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={2.25} />
        </button>
        <div className="text-sm font-semibold tracking-tight text-foreground tabular-nums">
          {year}
        </div>
        <button
          type="button"
          onClick={() => setYearState((y) => Math.min(y + 1, maxYear))}
          disabled={year >= maxYear}
          className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground/70 hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:pointer-events-none"
          aria-label="Próximo ano"
        >
          <ChevronRight className="h-4 w-4" strokeWidth={2.25} />
        </button>
      </div>

      {/* 4x3 month grid */}
      <div className="grid grid-cols-4 gap-2 flex-1 content-start">
        {MONTHS_PT.map((label, idx) => {
          const candidate = setMonth(setYear(new Date(), year), idx);
          const isCurrent =
            currentMonth.getFullYear() === year && currentMonth.getMonth() === idx;
          const disabled = disabledAfter
            ? isAfter(startOfMonth(candidate), startOfMonth(disabledAfter))
            : false;
          return (
            <button
              key={label}
              type="button"
              disabled={disabled}
              onClick={() => {
                onSelect(candidate);
                onClose();
              }}
              className={cn(
                "h-12 rounded-lg text-sm font-medium transition-all",
                "hover:bg-muted hover:scale-[1.03]",
                isCurrent && "!bg-primary !text-primary-foreground shadow-[0_1px_3px_hsl(var(--primary)/0.35)]",
                disabled && "opacity-25 pointer-events-none",
                !isCurrent && !disabled && "text-foreground"
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
    </motion.div>
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
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  // Sync view to the start of an externally-set range (e.g. presets)
  // Only navigates when the start date is in a different month than the current view.
  useEffect(() => {
    if (value?.from && !isSameMonth(value.from, viewMonth)) {
      setViewMonth(startOfMonth(value.from));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.from?.getTime(), value?.to?.getTime()]);

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
    // Cross-month two-click logic:
    // 1) No range or full range → start new range
    // 2) Only `from` set → set `to` (auto-swap if before `from`)
    if (!value?.from || (value.from && value.to)) {
      onChange?.({ from: day, to: undefined });
    } else if (value.from && !value.to) {
      const from = value.from;
      const range: RangeValue = isAfter(day, from) || isSameDay(day, from)
        ? { from, to: day }
        : { from: day, to: from };
      onChange?.(range);
    }
  };

  const months = useMemo(() => {
    const arr: Date[] = [];
    for (let i = 0; i < numberOfMonths; i++) arr.push(addMonths(viewMonth, i));
    return arr;
  }, [viewMonth, numberOfMonths]);

  return (
    <div className="px-3 sm:px-4 py-3 select-none w-full min-w-0 relative">
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
          {months.map((m, idx) => (
            <button
              key={format(m, "yyyy-MM")}
              type="button"
              onClick={() => idx === 0 && setShowMonthPicker(true)}
              disabled={idx !== 0}
              className={cn(
                "text-center text-[clamp(0.8125rem,2.4vw,0.875rem)] font-medium tracking-tight text-foreground capitalize truncate px-1 py-1 rounded-md transition-colors",
                idx === 0 && "hover:bg-muted/60 cursor-pointer",
                idx !== 0 && "cursor-default"
              )}
            >
              {format(m, "MMMM yyyy", { locale: ptBR })}
            </button>
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

      {/* Months grid (with subtle scale-down when month picker open) */}
      <motion.div
        animate={{ scale: showMonthPicker ? 0.95 : 1, opacity: showMonthPicker ? 0.4 : 1 }}
        transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
        className="flex flex-col md:flex-row gap-6 w-full min-w-0"
      >
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
      </motion.div>

      {/* Month/Year picker overlay */}
      <AnimatePresence>
        {showMonthPicker && (
          <MonthYearPicker
            currentMonth={viewMonth}
            onSelect={(d) => {
              setDirection(isAfter(d, viewMonth) ? 1 : -1);
              setViewMonth(startOfMonth(d));
            }}
            onClose={() => setShowMonthPicker(false)}
            disabledAfter={disabledAfter}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
