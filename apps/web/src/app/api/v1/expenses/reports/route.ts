import type { CalendarSystem, ExpensePeriodType } from "@reminder/domain";

import { errorResponse, expensesRepository, noStore, repository } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const periodParam = url.searchParams.get("period");
    const period: ExpensePeriodType = periodParam === "month" ? "month" : "week";
    const dateParam = url.searchParams.get("date") ?? undefined;

    let calendar: CalendarSystem = "gregorian";
    const calendarParam = url.searchParams.get("calendar");
    if (calendarParam === "jalali" || calendarParam === "gregorian") {
      calendar = calendarParam;
    } else {
      try {
        const settings = await repository().getSettings();
        calendar = settings.calendarSystem;
      } catch {
        calendar = "jalali";
      }
    }

    const report = await expensesRepository().getReport({
      period,
      targetDate: dateParam,
      calendarSystem: calendar,
    });

    return noStore(Response.json(report));
  } catch (error) {
    return errorResponse(error);
  }
}
