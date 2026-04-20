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
        months: "flex flex-col sm:flex-row gap-6",
        month: "space-y-3",
        caption: "flex justify-center pt-1 pb-3 relative items-center gap-2",
        caption_label: "text-sm font-semibold capitalize tracking-tight",
        caption_dropdowns: "flex items-center gap-1.5",
        dropdowns: "flex items-center gap-1.5",
        dropdown_root: "relative inline-flex items-center",
        dropdown:
          "appearance-none bg-transparent text-sm font-semibold capitalize tracking-tight pl-2 pr-6 py-1 rounded-lg border border-transparent hover:bg-accent/60 hover:border-border/40 focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer transition-colors",
        dropdown_month: "relative",
        dropdown_year: "relative",
        nav: "flex items-center gap-1",
        nav_button: cn(
          "inline-flex items-center justify-center h-7 w-7 rounded-lg",
          "text-muted-foreground hover:text-foreground",
          "hover:bg-accent/60 transition-colors",
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse",
        head_row: "flex w-full",
        head_cell:
          "text-muted-foreground/70 font-medium text-[0.65rem] uppercase tracking-wider w-9 sm:w-10 h-8 flex items-center justify-center",
        row: "flex w-full mt-1",
        cell: cn(
          "relative h-9 w-9 sm:h-10 sm:w-10 p-0 text-center text-sm",
          "focus-within:relative focus-within:z-20",
          "[&:has([aria-selected])]:bg-accent/40",
          "first:[&:has([aria-selected])]:rounded-l-full",
          "last:[&:has([aria-selected])]:rounded-r-full",
          "[&:has([aria-selected].day-range-end)]:rounded-r-full",
          "[&:has([aria-selected].day-range-start)]:rounded-l-full",
          "[&:has([aria-selected].day-outside)]:bg-accent/20",
        ),
        day: cn(
          "inline-flex items-center justify-center h-9 w-9 sm:h-10 sm:w-10 p-0 font-normal text-sm",
          "rounded-full transition-all duration-150",
          "hover:bg-accent hover:text-accent-foreground",
          "aria-selected:opacity-100 cursor-pointer",
        ),
        day_range_start:
          "day-range-start !bg-primary !text-primary-foreground hover:!bg-primary rounded-full font-semibold shadow-md",
        day_range_end:
          "day-range-end !bg-primary !text-primary-foreground hover:!bg-primary rounded-full font-semibold shadow-md",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground font-semibold",
        day_today:
          "bg-accent/60 text-foreground font-semibold ring-1 ring-primary/40",
        day_outside:
          "day-outside text-muted-foreground/40 aria-selected:bg-accent/20 aria-selected:text-muted-foreground/60",
        day_disabled: "text-muted-foreground/30 opacity-40 hover:bg-transparent cursor-not-allowed",
        day_range_middle:
          "aria-selected:bg-accent/50 aria-selected:text-foreground !rounded-none",
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
