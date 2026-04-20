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
        formatWeekdayName: (date) => {
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
        formatCaption: (date) => {
          const month = date.toLocaleString("pt-BR", { month: "long" });
          const year = date.getFullYear();
          return `${month.charAt(0).toUpperCase()}${month.slice(1)} ${year}`;
        },
      }}
      className={cn("p-4 animate-in fade-in-0 duration-200", className)}
      classNames={{
        // v9 root + grouping
        root: "w-fit",
        months: "flex flex-col sm:flex-row gap-6 relative",
        month: "flex flex-col gap-3",

        // v9 caption + nav
        month_caption: "flex items-center justify-center h-9 px-9 relative",
        caption_label: "text-base font-semibold tracking-tight text-foreground capitalize",
        nav: "absolute inset-x-0 top-0 flex items-center justify-between px-1 pointer-events-none",
        button_previous: cn(
          "pointer-events-auto inline-flex items-center justify-center h-7 w-7 rounded-full",
          "text-muted-foreground hover:text-foreground hover:bg-muted transition-colors",
        ),
        button_next: cn(
          "pointer-events-auto inline-flex items-center justify-center h-7 w-7 rounded-full",
          "text-muted-foreground hover:text-foreground hover:bg-muted transition-colors",
        ),

        // v9 month grid
        month_grid: "w-full border-collapse",
        weekdays: "grid grid-cols-7 mb-2",
        weekday:
          "text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70 h-8 flex items-center justify-center w-10",
        weeks: "flex flex-col gap-0.5",
        week: "grid grid-cols-7",

        // v9 day cell wrapper
        day: cn(
          "relative h-10 w-10 p-0 text-center text-sm",
          "[&:has([data-selected])]:bg-primary/10",
          "[&:has([data-range-start])]:rounded-l-full",
          "[&:has([data-range-end])]:rounded-r-full",
          "[&:has([data-range-start])]:bg-primary/10",
          "[&:has([data-range-end])]:bg-primary/10",
          "first:[&:has([data-selected])]:rounded-l-full",
          "last:[&:has([data-selected])]:rounded-r-full",
        ),

        // v9 day button (the actual interactive element)
        day_button: cn(
          "inline-flex items-center justify-center h-10 w-10 p-0",
          "text-sm font-medium rounded-full",
          "transition-colors duration-150 cursor-pointer select-none",
          "hover:bg-muted hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        ),

        // v9 modifier classNames — applied to the cell
        selected:
          "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary [&>button]:font-semibold",
        range_start:
          "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:rounded-full [&>button]:font-semibold",
        range_end:
          "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:rounded-full [&>button]:font-semibold",
        range_middle:
          "!rounded-none bg-primary/10 [&>button]:bg-transparent [&>button]:!rounded-none [&>button]:text-foreground [&>button]:hover:bg-primary/20",
        today:
          "[&>button]:ring-1 [&>button]:ring-primary [&>button]:ring-inset [&>button]:font-semibold",
        outside:
          "text-muted-foreground/30 [&>button]:text-muted-foreground/30 [&>button]:hover:bg-transparent",
        disabled:
          "text-muted-foreground/30 [&>button]:opacity-40 [&>button]:cursor-not-allowed [&>button]:hover:bg-transparent",
        hidden: "invisible",

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
