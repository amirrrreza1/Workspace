import {
  daysInMonth,
  fromGregorian,
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

// Format expense transaction date according to calendar system
export function formatExpenseDate(iso: string, calendar: CalendarSystem): string {
  try {
    const date = new Date(iso);
    return new Intl.DateTimeFormat(
      calendar === "jalali" ? "en-US-u-ca-persian" : "en-US",
      {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      },
    )
      .format(date)
      .replace(" AP", "");
  } catch {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
}
