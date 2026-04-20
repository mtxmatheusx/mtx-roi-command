import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      formatters={{
        formatWeekdayName: (date, options) => {
          const map: Record<number, string> = {
            0: "Dom",
            1: "Seg",
            2: "Ter",
            3: "Qua",
            4: "Qui",
            5: "Sex",
            6: "Sáb",
          };
          return map[date.getDay()] ?? "";
        },
        formatCaption: (date, options) => {
          const month = date.toLocaleString("pt-BR", { month: "long" });
          const year = date.getFullYear();
          return `${month.charAt(0).toUpperCase()}${month.slice(1)} ${year}`;
        },
      }}
      className={cn("p-3 sm:p-4 animate-in fade-in-0 duration-200", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-4 sm:gap-8",
        month: "space-y-3 w-full",
        caption: "relative flex items-center justify-center pt-1 pb-3 h-8",
        caption_label: "text-sm font-semibold tracking-tight text-foreground",
        nav: "flex items-center",
        nav_button: cn(
          "inline-flex items-center justify-center h-7 w-7 rounded-full",
          "text-muted-foreground hover:text-foreground",
          "hover:bg-accent transition-colors",
        ),
        nav_button_previous: "absolute left-0",
        nav_button_next: "absolute right-0",
        table: "w-full border-collapse",
        head_row: "grid grid-cols-7 mb-1",
        head_cell:
          "text-muted-foreground font-normal text-[10px] uppercase tracking-wide h-8 flex items-center justify-center",
        row: "grid grid-cols-7 mt-1",
        cell: cn(
          "relative h-9 w-9 sm:h-10 sm:w-10 p-0 text-center text-sm",
          "focus-within:relative focus-within:z-20",
          "[&:has([aria-selected])]:bg-primary/10",
          "first:[&:has([aria-selected])]:rounded-l-full",
          "last:[&:has([aria-selected])]:rounded-r-full",
          "[&:has([aria-selected].day-range-end)]:rounded-r-full",
          "[&:has([aria-selected].day-range-start)]:rounded-l-full",
          "[&:has([aria-selected].day-outside)]:bg-primary/5",
        ),
        day: cn(
          "inline-flex items-center justify-center h-9 w-9 sm:h-10 sm:w-10 p-0",
          "text-sm font-medium rounded-full",
          "transition-colors duration-150 cursor-pointer",
          "hover:bg-muted hover:text-foreground",
          "aria-selected:opacity-100",
        ),
        day_range_start:
          "day-range-start !bg-primary !text-primary-foreground hover:!bg-primary rounded-full font-semibold",
        day_range_end:
          "day-range-end !bg-primary !text-primary-foreground hover:!bg-primary rounded-full font-semibold",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground font-semibold",
        day_today:
          "ring-1 ring-primary/60 ring-inset bg-transparent text-foreground font-semibold",
        day_outside: "day-outside text-muted-foreground opacity-30 aria-selected:opacity-50",
        day_disabled: "text-muted-foreground opacity-30 cursor-not-allowed hover:bg-transparent",
        day_range_middle:
          "aria-selected:bg-primary/10 aria-selected:text-foreground !rounded-none hover:!bg-primary/15",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          ),
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
