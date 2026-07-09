"use client";

import React from "react";

import { cn } from "@/lib/utils";

const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

interface CalendarDayProps {
  day: string | number;
  isHeader?: boolean;
  isToday?: boolean;
  compact?: boolean;
}

const CalendarDay: React.FC<CalendarDayProps> = ({ day, isHeader, isToday, compact }) => {
  return (
    <div
      className={cn(
        "col-span-1 row-span-1 flex items-center justify-center",
        compact ? "h-6 min-w-0" : "h-9 w-10"
      )}
    >
      <span
        className={cn(
          "font-medium",
          isHeader
            ? compact
              ? "text-[9px]"
              : "text-xs"
            : compact
              ? "flex h-6 w-7 items-center justify-center rounded-lg text-[11px]"
              : "flex h-9 w-10 items-center justify-center rounded-xl text-sm",
          isToday && "bg-white text-black"
        )}
      >
        {day}
      </span>
    </div>
  );
};

interface CalendarProps {
  compact?: boolean;
  className?: string;
  headerAction?: React.ReactNode;
}

export function Calendar({
  compact = false,
  className,
  headerAction,
}: CalendarProps = {}) {
  const currentDate = new Date();
  const currentMonth = currentDate.toLocaleString("default", { month: "long" });
  const currentYear = currentDate.getFullYear();
  const firstDayOfMonth = new Date(currentYear, currentDate.getMonth(), 1);
  const firstDayOfWeek = firstDayOfMonth.getDay();
  const daysInMonth = new Date(
    currentYear,
    currentDate.getMonth() + 1,
    0
  ).getDate();
  const today = currentDate.getDate();

  const renderCalendarDays = () => {
    let days: React.ReactNode[] = [
      ...dayNames.map((day) => (
        <CalendarDay key={`header-${day}`} day={day} isHeader compact={compact} />
      )),
      ...Array(firstDayOfWeek).map((_, i) => (
        <div
          key={`empty-start-${i}`}
          className={cn(
            "col-span-1 row-span-1",
            compact ? "h-6 min-w-0" : "h-9 w-10"
          )}
        />
      )),
      ...Array(daysInMonth)
        .fill(null)
        .map((_, i) => (
          <CalendarDay
            key={`date-${i + 1}`}
            day={i + 1}
            isToday={i + 1 === today}
            compact={compact}
          />
        )),
    ];

    return days;
  };

  return (
    <div
      className={cn(
        "grid h-full w-full p-1",
        compact && "content-start px-0.5 pt-0.5",
        className
      )}
    >
      <div>
        <div className="flex items-center justify-between gap-2">
          <p className={cn(compact ? "text-[13px] leading-4" : "text-base")}>
            <span className="font-medium">
              {currentMonth}, {currentYear}
            </span>
          </p>
          {headerAction}
        </div>
        <div
          className={cn(
            "grid grid-cols-7",
            compact
              ? "mt-0.5 auto-rows-[1.5rem] gap-x-0.5 gap-y-0.5"
              : "mt-1 auto-rows-[2.25rem] gap-1"
          )}
        >
          {renderCalendarDays()}
        </div>
      </div>
    </div>
  );
}
