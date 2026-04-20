import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3 sm:p-4", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-4 sm:gap-6",
        month: "space-y-3 w-full",
        caption: "flex justify-center pt-1 pb-2 relative items-center",
        caption_label: "text-sm font-semibold capitalize tracking-tight",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-7 w-7 bg-transparent p-0 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors",
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse",
        head_row: "grid grid-cols-7 mb-1",
        head_cell:
          "text-muted-foreground/70 font-medium text-[0.7rem] uppercase tracking-wider h-8 flex items-center justify-center",
        row: "grid grid-cols-7 mt-1",
        cell: cn(
          "relative h-9 w-9 sm:h-10 sm:w-10 p-0 text-center text-sm",
          "focus-within:relative focus-within:z-20",
          "[&:has([aria-selected])]:bg-accent/40",
          "first:[&:has([aria-selected])]:rounded-l-full last:[&:has([aria-selected])]:rounded-r-full",
          "[&:has([aria-selected].day-range-end)]:rounded-r-full",
          "[&:has([aria-selected].day-range-start)]:rounded-l-full",
          "[&:has([aria-selected].day-outside)]:bg-accent/20",
        ),
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 sm:h-10 sm:w-10 p-0 font-normal rounded-full transition-all duration-150",
          "hover:bg-accent hover:text-accent-foreground hover:scale-105",
          "aria-selected:opacity-100",
        ),
        day_range_start:
          "day-range-start !bg-primary !text-primary-foreground hover:!bg-primary rounded-full font-semibold shadow-sm",
        day_range_end:
          "day-range-end !bg-primary !text-primary-foreground hover:!bg-primary rounded-full font-semibold shadow-sm",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground font-semibold",
        day_today:
          "bg-accent/60 text-foreground font-semibold ring-1 ring-primary/30",
        day_outside:
          "day-outside text-muted-foreground/40 aria-selected:bg-accent/20 aria-selected:text-muted-foreground/60",
        day_disabled: "text-muted-foreground/30 opacity-50 hover:bg-transparent hover:scale-100 cursor-not-allowed",
        day_range_middle:
          "aria-selected:bg-accent/50 aria-selected:text-foreground rounded-none hover:scale-100",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, ...chevronProps }) =>
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
