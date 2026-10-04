import {
  daysInMonth,
  formatGregorianDate,
  fromGregorian,
  isSupportedGregorianDate,
  isValidCalendarDate,
  toGregorian,
  type CalendarDate,
  type CalendarSystem,
  type GregorianDate,
} from "@reminder/domain";

export const JALALI_MONTH_NAMES = [
  "Farvardin",
  "Ordibehesht",
  "Khordad",
  "Tir",
  "Mordad",
  "Shahrivar",
  "Mehr",
  "Aban",
  "Azar",
  "Dey",
  "Bahman",
  "Esfand",
] as const;

export const GREGORIAN_MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export type MonthBounds = {
  startDate: Date;
  endDate: Date;
  label: string;
  subLabel: string;
  year: number;
  month: number;
  calendar: CalendarSystem;
};

export function getMonthBounds(refDate: Date, calendar: CalendarSystem): MonthBounds {
  if (calendar === "jalali") {
    const gDate: GregorianDate = {
      calendar: "gregorian",
      year: refDate.getUTCFullYear(),
      month: refDate.getUTCMonth() + 1,
      day: refDate.getUTCDate(),
    };
    const jDate = fromGregorian(gDate, "jalali");
    const monthLength = daysInMonth("jalali", jDate.year, jDate.month);

    const jStart: CalendarDate = {
      calendar: "jalali",
      year: jDate.year,
      month: jDate.month,
      day: 1,
    };
    const gStart = toGregorian(jStart);
    const startDate = new Date(Date.UTC(gStart.year, gStart.month - 1, gStart.day, 0, 0, 0, 0));

    const jEnd: CalendarDate = {
      calendar: "jalali",
      year: jDate.year,
      month: jDate.month,
      day: monthLength,
    };
    const gEnd = toGregorian(jEnd);
    const endDate = new Date(Date.UTC(gEnd.year, gEnd.month - 1, gEnd.day, 23, 59, 59, 999));

    const monthName = JALALI_MONTH_NAMES[jDate.month - 1] ?? `Month ${jDate.month}`;
    const formattedCode = `${jDate.year}/${jDate.month.toString().padStart(2, "0")}`;

    return {
      startDate,
      endDate,
      label: `${monthName} ${jDate.year}`,
      subLabel: formattedCode,
      year: jDate.year,
      month: jDate.month,
      calendar,
    };
  } else {
    const year = refDate.getUTCFullYear();
    const month = refDate.getUTCMonth(); // 0-indexed

    const startDate = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const endDate = new Date(Date.UTC(year, month, lastDay, 23, 59, 59, 999));

    const monthName = GREGORIAN_MONTH_NAMES[month] ?? `Month ${month + 1}`;
    const formattedCode = `${year}-${(month + 1).toString().padStart(2, "0")}`;

    return {
      startDate,
      endDate,
      label: `${monthName} ${year}`,
      subLabel: formattedCode,
      year,
      month: month + 1,
      calendar,
    };
  }
}

export function navigateMonth(
  refDate: Date,
  calendar: CalendarSystem,
  direction: "prev" | "next" | "today",
): Date {
  if (direction === "today") {
    return new Date();
  }

  if (calendar === "jalali") {
    const gDate: GregorianDate = {
      calendar: "gregorian",
      year: refDate.getUTCFullYear(),
      month: refDate.getUTCMonth() + 1,
      day: refDate.getUTCDate(),
    };
    const jDate = fromGregorian(gDate, "jalali");

    let targetYear = jDate.year;
    let targetMonth = jDate.month;

    if (direction === "prev") {
      if (targetMonth === 1) {
        targetYear -= 1;
        targetMonth = 12;
      } else {
        targetMonth -= 1;
      }
    } else {
      if (targetMonth === 12) {
        targetYear += 1;
        targetMonth = 1;
      } else {
        targetMonth += 1;
      }
    }

    const gTarget = toGregorian({
      calendar: "jalali",
      year: targetYear,
      month: targetMonth,
      day: 15,
    });

    return new Date(Date.UTC(gTarget.year, gTarget.month - 1, gTarget.day, 12, 0, 0));
  } else {
    const year = refDate.getUTCFullYear();
    const month = refDate.getUTCMonth();
    const delta = direction === "prev" ? -1 : 1;
    return new Date(Date.UTC(year, month + delta, 15, 12, 0, 0));
  }
}

// Format IRR minor units to Toman string (1 Toman = 10 IRR minor units)
export function formatToman(minor: string | number | bigint): string {
  const num = typeof minor === "bigint" ? minor : BigInt(String(minor || "0"));
  const toman = num / 10n;
  return toman.toLocaleString("en-US");
}

/** Group a Toman amount with thousands separators while it is typed. */
export function formatTomanInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Caret index in a grouped amount after `digitCount` digits. */
export function tomanInputCaret(formatted: string, digitCount: number): number {
  if (digitCount <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    const char = formatted[i];
    if (char >= "0" && char <= "9") {
      seen++;
      if (seen === digitCount) return i + 1;
    }
  }
  return formatted.length;
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

const JALALI_WEEKDAYS = ["Sa", "Su", "Mo", "Tu", "We", "Th", "Fr"] as const;
const GREGORIAN_WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;
const JALALI_WEEKDAY_NAMES = [
  "Saturday",
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
] as const;
const GREGORIAN_WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export type DatePickerCell = { day: number; dateOnly: string } | null;

export function parseDateOnly(value: string): GregorianDate | null {
  const match = DATE_ONLY.exec(value);
  if (!match) return null;
  const date: GregorianDate = {
    calendar: "gregorian",
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
  if (!isValidCalendarDate(date) || !isSupportedGregorianDate(date)) return null;
  return date;
}

export function localDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isoToLocalDateOnly(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return localDateOnly(date);
}

/** Stores a calendar day at local noon so the chosen day stays stable across time zones. */
export function dateOnlyToSpentAt(value: string): string {
  const parsed = parseDateOnly(value);
  if (!parsed) return new Date().toISOString();
  return new Date(parsed.year, parsed.month - 1, parsed.day, 12, 0, 0, 0).toISOString();
}

export function calendarDateFromDateOnly(
  value: string,
  calendar: CalendarSystem,
): CalendarDate | null {
  const parsed = parseDateOnly(value);
  if (!parsed) return null;
  try {
    return fromGregorian(parsed, calendar);
  } catch {
    return null;
  }
}

export function dateOnlyFromCalendarDate(date: CalendarDate): string {
  return formatGregorianDate(toGregorian(date));
}

export function weekdayLabels(calendar: CalendarSystem): readonly string[] {
  return calendar === "jalali" ? JALALI_WEEKDAYS : GREGORIAN_WEEKDAYS;
}

export function weekdayColumn(date: CalendarDate): number {
  const gregorian = toGregorian(date);
  const jsDay = new Date(Date.UTC(gregorian.year, gregorian.month - 1, gregorian.day)).getUTCDay();
  return date.calendar === "jalali" ? (jsDay + 1) % 7 : jsDay;
}

export function shiftCalendarMonth(date: CalendarDate, delta: number): CalendarDate | null {
  if (!Number.isInteger(delta)) return null;
  const index = date.year * 12 + (date.month - 1) + delta;
  const year = Math.floor(index / 12);
  const month = index - year * 12 + 1;
  const length = daysInMonth(date.calendar, year, month);
  if (length < 1) return null;
  const next: CalendarDate = {
    calendar: date.calendar,
    year,
    month,
    day: Math.min(Math.max(date.day, 1), length),
  };
  try {
    if (!isSupportedGregorianDate(toGregorian(next))) return null;
    return next;
  } catch {
    return null;
  }
}

export function buildMonthGrid(
  calendar: CalendarSystem,
  year: number,
  month: number,
): DatePickerCell[] {
  const length = daysInMonth(calendar, year, month);
  if (length < 1) return [];
  let lead = 0;
  try {
    lead = weekdayColumn({ calendar, year, month, day: 1 });
  } catch {
    return [];
  }
  const cells: DatePickerCell[] = Array.from({ length: lead }, () => null);
  for (let day = 1; day <= length; day += 1) {
    cells.push({
      day,
      dateOnly: dateOnlyFromCalendarDate({ calendar, year, month, day }),
    });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function formatCalendarDay(value: string, calendar: CalendarSystem): string {
  const date = calendarDateFromDateOnly(value, calendar);
  if (!date) return value;
  if (calendar === "jalali") {
    const monthName = JALALI_MONTH_NAMES[date.month - 1];
    return monthName ? `${date.day} ${monthName} ${date.year}` : value;
  }
  const monthName = GREGORIAN_MONTH_NAMES[date.month - 1];
  return monthName ? `${monthName.slice(0, 3)} ${date.day}, ${date.year}` : value;
}

export function formatCalendarDayLong(value: string, calendar: CalendarSystem): string {
  const date = calendarDateFromDateOnly(value, calendar);
  if (!date) return "Select a date";
  const names = calendar === "jalali" ? JALALI_WEEKDAY_NAMES : GREGORIAN_WEEKDAY_NAMES;
  const weekday = names[weekdayColumn(date)];
  return `${weekday}, ${formatCalendarDay(value, calendar)}`;
}

export function formatExpenseDate(iso: string, calendar: CalendarSystem): string {
  const dateOnly = isoToLocalDateOnly(iso);
  if (!dateOnly) return "—";
  return formatCalendarDay(dateOnly, calendar);
}
