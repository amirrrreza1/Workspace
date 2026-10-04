"use client";

import { addCalendarDays, toGregorian, isSupportedGregorianDate } from "@reminder/domain";
import type { CalendarDate, CalendarSystem } from "@reminder/domain";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";

import {
  GREGORIAN_MONTH_NAMES,
  JALALI_MONTH_NAMES,
  buildMonthGrid,
  calendarDateFromDateOnly,
  dateOnlyFromCalendarDate,
  formatCalendarDay,
  formatCalendarDayLong,
  localDateOnly,
  shiftCalendarMonth,
  weekdayColumn,
  weekdayLabels,
} from "@/lib/expenses-month";

type ExpenseDatePickerProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  calendar: CalendarSystem;
};

export function ExpenseDatePicker({ id, value, onChange, calendar }: ExpenseDatePickerProps) {
  const reactId = useId();
  const panelId = `${reactId}-panel`;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const focusSelectedRef = useRef(false);
  const [open, setOpen] = useState(false);

  const selected = calendarDateFromDateOnly(value, calendar);
  const fallback = calendarDateFromDateOnly(localDateOnly(new Date()), calendar);
  const anchor = selected ?? fallback;

  const [viewYear, setViewYear] = useState(anchor?.year ?? 1400);
  const [viewMonth, setViewMonth] = useState(anchor?.month ?? 1);
  const [calendarSeen, setCalendarSeen] = useState(calendar);

  if (calendarSeen !== calendar) {
    setCalendarSeen(calendar);
    if (anchor) {
      setViewYear(anchor.year);
      setViewMonth(anchor.month);
    }
  }

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const trigger = triggerRef.current;
    if (!panel || !trigger) return;

    const place = () => {
      const rect = trigger.getBoundingClientRect();
      const gap = 6;
      const width = panel.offsetWidth;
      const height = panel.offsetHeight;
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < height + gap && rect.top > height + gap;
      const top = openUp ? rect.top - height - gap : rect.bottom + gap;
      let left = rect.left;
      const maxLeft = window.innerWidth - width - 8;
      if (left > maxLeft) left = Math.max(8, maxLeft);
      panel.style.top = `${Math.max(8, top)}px`;
      panel.style.left = `${left}px`;
      panel.style.visibility = "visible";
    };

    place();
    const dialog = trigger.closest(".ui-dialog-content");
    window.addEventListener("resize", place);
    dialog?.addEventListener("scroll", place);
    return () => {
      window.removeEventListener("resize", place);
      dialog?.removeEventListener("scroll", place);
    };
  }, [open, viewYear, viewMonth]);

  useEffect(() => {
    if (!open || !focusSelectedRef.current) return;
    focusSelectedRef.current = false;
    panelRef.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus();
  }, [open, value, viewYear, viewMonth]);

  const monthNames = calendar === "jalali" ? JALALI_MONTH_NAMES : GREGORIAN_MONTH_NAMES;
  const monthName = monthNames[viewMonth - 1] ?? "";
  const labels = weekdayLabels(calendar);
  const fullLabels =
    calendar === "jalali"
      ? ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
      : ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const cells = buildMonthGrid(calendar, viewYear, viewMonth);
  const rows: (typeof cells)[] = [];
  for (let index = 0; index < cells.length; index += 7) rows.push(cells.slice(index, index + 7));
  const today = localDateOnly(new Date());
  const selectedInView = cells.some((cell) => cell?.dateOnly === value);
  const viewCursor: CalendarDate = { calendar, year: viewYear, month: viewMonth, day: 1 };
  const canGoPrev = shiftCalendarMonth(viewCursor, -1) !== null;
  const canGoNext = shiftCalendarMonth(viewCursor, 1) !== null;

  function openPicker() {
    if (anchor) {
      setViewYear(anchor.year);
      setViewMonth(anchor.month);
    }
    focusSelectedRef.current = true;
    setOpen(true);
  }

  function closePicker() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function commit(date: CalendarDate, closeAfter: boolean) {
    try {
      if (!isSupportedGregorianDate(toGregorian(date))) return;
    } catch {
      return;
    }
    onChange(dateOnlyFromCalendarDate(date));
    setViewYear(date.year);
    setViewMonth(date.month);
    if (closeAfter) closePicker();
    else focusSelectedRef.current = true;
  }

  function showMonth(delta: number) {
    const shifted = shiftCalendarMonth(viewCursor, delta);
    if (!shifted) return;
    setViewYear(shifted.year);
    setViewMonth(shifted.month);
  }

  function moveSelection(dateOnly: string, deltaDays: number) {
    const current = calendarDateFromDateOnly(dateOnly, calendar);
    if (!current) return;
    try {
      commit(addCalendarDays(current, deltaDays), false);
    } catch {
      return;
    }
  }

  function onDayKeyDown(event: KeyboardEvent<HTMLButtonElement>, dateOnly: string) {
    const current = calendarDateFromDateOnly(dateOnly, calendar);
    if (event.key === "Escape") {
      event.stopPropagation();
      event.preventDefault();
      closePicker();
      return;
    }
    if (!current) return;
    if (event.key === "PageUp" || event.key === "PageDown") {
      event.preventDefault();
      const shifted = shiftCalendarMonth(current, event.key === "PageUp" ? -1 : 1);
      if (shifted) commit(shifted, false);
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const column = weekdayColumn(current);
      moveSelection(dateOnly, event.key === "Home" ? -column : 6 - column);
      return;
    }
    const delta =
      event.key === "ArrowLeft"
        ? -1
        : event.key === "ArrowRight"
          ? 1
          : event.key === "ArrowUp"
            ? -7
            : event.key === "ArrowDown"
              ? 7
              : null;
    if (delta === null) return;
    event.preventDefault();
    moveSelection(dateOnly, delta);
  }

  return (
    <div
      className="date-picker"
      ref={rootRef}
      onKeyDown={(event) => {
        if (!open || event.key !== "Escape") return;
        event.stopPropagation();
        event.preventDefault();
        closePicker();
      }}
    >
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className="date-picker-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={formatCalendarDayLong(value, calendar)}
        onClick={() => (open ? setOpen(false) : openPicker())}
      >
        <span>{formatCalendarDay(value, calendar)}</span>
        <CalendarDays size={15} aria-hidden="true" />
      </button>

      {open &&
        createPortal(
        <div
          ref={panelRef}
          id={panelId}
          className="date-picker-panel"
          role="dialog"
          aria-label="Choose a date"
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.stopPropagation();
            event.preventDefault();
            closePicker();
          }}
        >
          <div className="date-picker-header">
            <button
              type="button"
              className="date-picker-nav"
              aria-label="Previous month"
              disabled={!canGoPrev}
              onClick={() => showMonth(-1)}
            >
              <ChevronLeft size={14} aria-hidden="true" />
            </button>
            <div className="date-picker-heading">
              <span className="date-picker-month">{monthName}</span>
              <span className="date-picker-year">{viewYear}</span>
            </div>
            <button
              type="button"
              className="date-picker-nav"
              aria-label="Next month"
              disabled={!canGoNext}
              onClick={() => showMonth(1)}
            >
              <ChevronRight size={14} aria-hidden="true" />
            </button>
          </div>

          <div className="date-picker-weekdays" aria-hidden="true">
            {labels.map((label, index) => (
              <abbr
                key={fullLabels[index]}
                className="date-picker-weekday"
                title={fullLabels[index]}
              >
                {label}
              </abbr>
            ))}
          </div>

          <div className="date-picker-grid" role="grid" aria-label={`${monthName} ${viewYear}`}>
            {rows.map((row, rowIndex) => (
              <div key={rowIndex} className="date-picker-row" role="row">
                {row.map((cell, columnIndex) =>
                  cell ? (
                    <button
                      key={cell.dateOnly}
                      type="button"
                      role="gridcell"
                      className={[
                        "date-picker-day",
                        cell.dateOnly === value ? "date-picker-day--selected" : "",
                        cell.dateOnly === today ? "date-picker-day--today" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      aria-selected={cell.dateOnly === value}
                      aria-current={cell.dateOnly === today ? "date" : undefined}
                      aria-label={formatCalendarDayLong(cell.dateOnly, calendar)}
                      tabIndex={
                        cell.dateOnly === value || (!selectedInView && cell.day === 1) ? 0 : -1
                      }
                      onClick={() => {
                        const picked = calendarDateFromDateOnly(cell.dateOnly, calendar);
                        if (picked) commit(picked, true);
                      }}
                      onKeyDown={(event) => onDayKeyDown(event, cell.dateOnly)}
                    >
                      {cell.day}
                    </button>
                  ) : (
                    <span
                      key={`empty-${rowIndex}-${columnIndex}`}
                      className="date-picker-day date-picker-day--empty"
                      role="gridcell"
                    />
                  ),
                )}
              </div>
            ))}
          </div>

          <div className="date-picker-footer">
            <button
              type="button"
              className="date-picker-today"
              onClick={() => {
                const current = calendarDateFromDateOnly(today, calendar);
                if (current) commit(current, true);
              }}
            >
              Today
            </button>
          </div>
        </div>,
          document.body,
        )}
    </div>
  );
}
