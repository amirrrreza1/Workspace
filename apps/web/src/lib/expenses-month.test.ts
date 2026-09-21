import { describe, expect, it } from "vitest";
import { formatExpenseDate, formatToman, getMonthBounds, navigateMonth } from "./expenses-month";

describe("expenses-month", () => {
  it("computes Gregorian month bounds correctly", () => {
    const testDate = new Date(Date.UTC(2026, 8, 21)); // September 21, 2026
    const bounds = getMonthBounds(testDate, "gregorian");

    expect(bounds.label).toBe("September 2026");
    expect(bounds.subLabel).toBe("2026-09");
    expect(bounds.year).toBe(2026);
    expect(bounds.month).toBe(9);
    expect(bounds.startDate.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(bounds.endDate.toISOString()).toBe("2026-09-30T23:59:59.999Z");
  });

  it("computes Jalali month bounds correctly", () => {
    // 2026-09-21 corresponds to 1405-06-30 (Shahrivar 30, 1405)
    const testDate = new Date(Date.UTC(2026, 8, 21));
    const bounds = getMonthBounds(testDate, "jalali");

    expect(bounds.label).toBe("Shahrivar 1405");
    expect(bounds.subLabel).toBe("1405/06");
    expect(bounds.year).toBe(1405);
    expect(bounds.month).toBe(6);
    // Shahrivar has 31 days
    expect(bounds.startDate.getUTCFullYear()).toBe(2026);
    expect(bounds.endDate.getUTCFullYear()).toBe(2026);
  });

  it("navigates Gregorian months forward and backward", () => {
    const testDate = new Date(Date.UTC(2026, 8, 15)); // September 2026
    const prev = navigateMonth(testDate, "gregorian", "prev");
    const next = navigateMonth(testDate, "gregorian", "next");

    expect(getMonthBounds(prev, "gregorian").subLabel).toBe("2026-08");
    expect(getMonthBounds(next, "gregorian").subLabel).toBe("2026-10");
  });

  it("navigates Jalali months forward and backward across year rollover", () => {
    // Farvardin 1405
    const farvardin = new Date(Date.UTC(2026, 2, 25));
    const boundsFarvardin = getMonthBounds(farvardin, "jalali");
    expect(boundsFarvardin.month).toBe(1);

    const esfand = navigateMonth(farvardin, "jalali", "prev");
    const boundsEsfand = getMonthBounds(esfand, "jalali");
    expect(boundsEsfand.month).toBe(12);
    expect(boundsEsfand.year).toBe(boundsFarvardin.year - 1);

    const backToFarvardin = navigateMonth(esfand, "jalali", "next");
    expect(getMonthBounds(backToFarvardin, "jalali").month).toBe(1);
    expect(getMonthBounds(backToFarvardin, "jalali").year).toBe(boundsFarvardin.year);
  });

  it("formats minor units to Toman correctly", () => {
    // 500,000 IRR = 50,000 Toman
    expect(formatToman("500000")).toBe("50,000");
    expect(formatToman(1000000)).toBe("100,000");
    expect(formatToman(0n)).toBe("0");
  });

  it("formats expense dates according to calendar system", () => {
    const iso = "2026-09-21T12:00:00.000Z";
    const jalaliFormatted = formatExpenseDate(iso, "jalali");
    const gregorianFormatted = formatExpenseDate(iso, "gregorian");

    expect(jalaliFormatted).toContain("1405");
    expect(gregorianFormatted).toContain("2026");
  });
});
