import {
  daysInMonth,
  fromGregorian,
  toGregorian,
  type CalendarDate,
  type CalendarSystem,
  type CategoryBreakdownItem,
  type CreateExpenseCategoryInput,
  type CreateExpenseInput,
  type CreateRegularExpenseItemInput,
  type DailyBreakdownItem,
  type Expense,
  type ExpenseCategory,
  type ExpenseFilter,
  type ExpensePeriodType,
  type ExpenseReportSummary,
  type RegularExpenseItem,
  type UpdateExpenseCategoryInput,
  type UpdateExpenseInput,
  type UpdateRegularExpenseItemInput,
} from "@reminder/domain";
import type { Sql } from "postgres";

import { NotFoundError } from "./errors.js";
import { createSql } from "./index.js";

type CategoryRow = {
  id: string;
  name: string;
  color: string;
  icon: string;
  is_default: boolean;
  created_at: Date;
  updated_at: Date;
};

type RegularItemRow = {
  id: string;
  title: string;
  category_id: string | null;
  category_name: string | null;
  category_color: string | null;
  category_icon: string | null;
  amount_minor: bigint;
  currency: "IRR" | "USD";
  icon: string | null;
  created_at: Date;
  updated_at: Date;
};

type ExpenseRow = {
  id: string;
  title: string;
  category_id: string | null;
  category_name: string | null;
  category_color: string | null;
  category_icon: string | null;
  amount_minor: bigint;
  currency: "IRR" | "USD";
  spent_at: Date;
  note: string | null;
  created_at: Date;
  updated_at: Date;
};

function rowToCategory(row: CategoryRow): ExpenseCategory {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    icon: row.icon,
    isDefault: row.is_default,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function rowToRegularItem(row: RegularItemRow): RegularExpenseItem {
  return {
    id: row.id,
    title: row.title,
    categoryId: row.category_id,
    categoryName: row.category_name,
    categoryColor: row.category_color,
    categoryIcon: row.category_icon,
    amountMinor: row.amount_minor.toString(),
    currency: row.currency,
    icon: row.icon,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function rowToExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    title: row.title,
    categoryId: row.category_id,
    categoryName: row.category_name,
    categoryColor: row.category_color,
    categoryIcon: row.category_icon,
    amountMinor: row.amount_minor.toString(),
    currency: row.currency,
    spentAt: row.spent_at.toISOString(),
    note: row.note,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export class ExpensesRepository {
  constructor(private readonly databaseUrl: string) {}

  private async withSql<T>(work: (sql: Sql) => Promise<T>): Promise<T> {
    const sql = await createSql(this.databaseUrl);
    try {
      return await work(sql);
    } finally {
      await sql.end({ timeout: 5 });
    }
  }

  // Categories ----------------------------------------------------------------

  async listCategories(): Promise<ExpenseCategory[]> {
    return this.withSql(async (sql) => {
      const rows = await sql<CategoryRow[]>`
        select id, name, color, icon, is_default, created_at, updated_at
        from expense_categories
        order by created_at asc
      `;
      return rows.map(rowToCategory);
    });
  }

  async createCategory(input: CreateExpenseCategoryInput): Promise<ExpenseCategory> {
    return this.withSql(async (sql) => {
      const rows = await sql<CategoryRow[]>`
        insert into expense_categories (name, color, icon, is_default)
        values (${input.name}, ${input.color}, ${input.icon}, false)
        returning id, name, color, icon, is_default, created_at, updated_at
      `;
      const row = rows[0];
      if (!row) throw new Error("Failed to insert category.");
      return rowToCategory(row);
    });
  }

  async updateCategory(id: string, input: UpdateExpenseCategoryInput): Promise<ExpenseCategory> {
    return this.withSql(async (sql) => {
      const existing = await sql<CategoryRow[]>`
        select id, name, color, icon, is_default, created_at, updated_at
        from expense_categories
        where id = ${id}
      `;
      const current = existing[0];
      if (!current) throw new NotFoundError("Category not found.");

      const updatedName = input.name ?? current.name;
      const updatedColor = input.color ?? current.color;
      const updatedIcon = input.icon ?? current.icon;

      const rows = await sql<CategoryRow[]>`
        update expense_categories
        set name = ${updatedName},
            color = ${updatedColor},
            icon = ${updatedIcon},
            updated_at = now()
        where id = ${id}
        returning id, name, color, icon, is_default, created_at, updated_at
      `;
      const row = rows[0];
      if (!row) throw new NotFoundError("Category not found.");
      return rowToCategory(row);
    });
  }

  async deleteCategory(id: string): Promise<void> {
    return this.withSql(async (sql) => {
      await sql.begin(async (tx) => {
        // Find 'Others' category or fallback to any default category
        const othersRows = await tx<CategoryRow[]>`
          select id from expense_categories
          where name = 'Others' and id != ${id}
          limit 1
        `;
        const othersId = othersRows[0]?.id ?? null;

        // Reassign expenses
        await tx`
          update expenses
          set category_id = ${othersId}, updated_at = now()
          where category_id = ${id}
        `;

        // Reassign regular items
        await tx`
          update regular_expense_items
          set category_id = ${othersId}, updated_at = now()
          where category_id = ${id}
        `;

        // Delete category
        const result = await tx`
          delete from expense_categories where id = ${id}
        `;
        if (result.count === 0) throw new NotFoundError("Category not found.");
      });
    });
  }

  // Regular Expense Items -----------------------------------------------------

  async listRegularItems(): Promise<RegularExpenseItem[]> {
    return this.withSql(async (sql) => {
      const rows = await sql<RegularItemRow[]>`
        select
          r.id,
          r.title,
          r.category_id,
          c.name as category_name,
          c.color as category_color,
          c.icon as category_icon,
          r.amount_minor,
          r.currency,
          r.icon,
          r.created_at,
          r.updated_at
        from regular_expense_items r
        left join expense_categories c on r.category_id = c.id
        order by r.created_at asc
      `;
      return rows.map(rowToRegularItem);
    });
  }

  async createRegularItem(input: CreateRegularExpenseItemInput): Promise<RegularExpenseItem> {
    return this.withSql(async (sql) => {
      const rows = await sql<RegularItemRow[]>`
        insert into regular_expense_items (title, category_id, amount_minor, currency, icon)
        values (
          ${input.title},
          ${input.categoryId ?? null},
          ${input.amountMinor},
          ${input.currency},
          ${input.icon ?? null}
        )
        returning id, title, category_id, amount_minor, currency, icon, created_at, updated_at
      `;
      const inserted = rows[0];
      if (!inserted) throw new Error("Failed to insert regular item.");

      // Fetch with joined category
      const fullRows = await sql<RegularItemRow[]>`
        select
          r.id,
          r.title,
          r.category_id,
          c.name as category_name,
          c.color as category_color,
          c.icon as category_icon,
          r.amount_minor,
          r.currency,
          r.icon,
          r.created_at,
          r.updated_at
        from regular_expense_items r
        left join expense_categories c on r.category_id = c.id
        where r.id = ${inserted.id}
      `;
      const row = fullRows[0];
      if (!row) throw new Error("Failed to retrieve created regular item.");
      return rowToRegularItem(row);
    });
  }

  async updateRegularItem(
    id: string,
    input: UpdateRegularExpenseItemInput,
  ): Promise<RegularExpenseItem> {
    return this.withSql(async (sql) => {
      const existing = await sql<RegularItemRow[]>`
        select id, title, category_id, amount_minor, currency, icon
        from regular_expense_items where id = ${id}
      `;
      const current = existing[0];
      if (!current) throw new NotFoundError("Regular item not found.");

      const updatedTitle = input.title ?? current.title;
      const updatedCategoryId =
        input.categoryId !== undefined ? input.categoryId : current.category_id;
      const updatedAmount =
        input.amountMinor !== undefined ? input.amountMinor : current.amount_minor.toString();
      const updatedCurrency = input.currency ?? current.currency;
      const updatedIcon = input.icon !== undefined ? input.icon : current.icon;

      await sql`
        update regular_expense_items
        set title = ${updatedTitle},
            category_id = ${updatedCategoryId},
            amount_minor = ${updatedAmount},
            currency = ${updatedCurrency},
            icon = ${updatedIcon},
            updated_at = now()
        where id = ${id}
      `;

      const fullRows = await sql<RegularItemRow[]>`
        select
          r.id,
          r.title,
          r.category_id,
          c.name as category_name,
          c.color as category_color,
          c.icon as category_icon,
          r.amount_minor,
          r.currency,
          r.icon,
          r.created_at,
          r.updated_at
        from regular_expense_items r
        left join expense_categories c on r.category_id = c.id
        where r.id = ${id}
      `;
      const row = fullRows[0];
      if (!row) throw new NotFoundError("Regular item not found.");
      return rowToRegularItem(row);
    });
  }

  async deleteRegularItem(id: string): Promise<void> {
    return this.withSql(async (sql) => {
      const result = await sql`
        delete from regular_expense_items where id = ${id}
      `;
      if (result.count === 0) throw new NotFoundError("Regular item not found.");
    });
  }

  // Expenses ------------------------------------------------------------------

  async listExpenses(filter: ExpenseFilter = { limit: 50, offset: 0 }): Promise<{
    items: Expense[];
    totalCount: number;
    totalAmountMinor: string;
  }> {
    return this.withSql(async (sql) => {
      const search = filter.q ? `%${filter.q.trim()}%` : null;

      const rows = await sql<ExpenseRow[]>`
        select
          e.id,
          e.title,
          e.category_id,
          c.name as category_name,
          c.color as category_color,
          c.icon as category_icon,
          e.amount_minor,
          e.currency,
          e.spent_at,
          e.note,
          e.created_at,
          e.updated_at
        from expenses e
        left join expense_categories c on e.category_id = c.id
        where (
          ${filter.categoryId ? sql`e.category_id = ${filter.categoryId}` : sql`true`}
        )
        and (
          ${filter.startDate ? sql`e.spent_at >= ${new Date(filter.startDate)}` : sql`true`}
        )
        and (
          ${filter.endDate ? sql`e.spent_at <= ${new Date(filter.endDate)}` : sql`true`}
        )
        and (
          ${search ? sql`(e.title ilike ${search} or e.note ilike ${search})` : sql`true`}
        )
        order by e.spent_at desc, e.id desc
        limit ${filter.limit}
        offset ${filter.offset}
      `;

      const countRows = await sql<{ count: string; total_amount: string | null }[]>`
        select
          count(*)::text as count,
          coalesce(sum(amount_minor), 0)::text as total_amount
        from expenses e
        where (
          ${filter.categoryId ? sql`e.category_id = ${filter.categoryId}` : sql`true`}
        )
        and (
          ${filter.startDate ? sql`e.spent_at >= ${new Date(filter.startDate)}` : sql`true`}
        )
        and (
          ${filter.endDate ? sql`e.spent_at <= ${new Date(filter.endDate)}` : sql`true`}
        )
        and (
          ${search ? sql`(e.title ilike ${search} or e.note ilike ${search})` : sql`true`}
        )
      `;

      return {
        items: rows.map(rowToExpense),
        totalCount: Number(countRows[0]?.count ?? 0),
        totalAmountMinor: countRows[0]?.total_amount ?? "0",
      };
    });
  }

  async getExpenseById(id: string): Promise<Expense | null> {
    return this.withSql(async (sql) => {
      const rows = await sql<ExpenseRow[]>`
        select
          e.id,
          e.title,
          e.category_id,
          c.name as category_name,
          c.color as category_color,
          c.icon as category_icon,
          e.amount_minor,
          e.currency,
          e.spent_at,
          e.note,
          e.created_at,
          e.updated_at
        from expenses e
        left join expense_categories c on e.category_id = c.id
        where e.id = ${id}
      `;
      const row = rows[0];
      return row ? rowToExpense(row) : null;
    });
  }

  async createExpense(input: CreateExpenseInput): Promise<Expense> {
    return this.withSql(async (sql) => {
      const spentAtDate = new Date(input.spentAt);

      const rows = await sql<ExpenseRow[]>`
        insert into expenses (title, category_id, amount_minor, currency, spent_at, note)
        values (
          ${input.title},
          ${input.categoryId ?? null},
          ${input.amountMinor},
          ${input.currency},
          ${spentAtDate},
          ${input.note ?? null}
        )
        returning id
      `;
      const inserted = rows[0];
      if (!inserted) throw new Error("Failed to insert expense.");

      const fullRows = await sql<ExpenseRow[]>`
        select
          e.id,
          e.title,
          e.category_id,
          c.name as category_name,
          c.color as category_color,
          c.icon as category_icon,
          e.amount_minor,
          e.currency,
          e.spent_at,
          e.note,
          e.created_at,
          e.updated_at
        from expenses e
        left join expense_categories c on e.category_id = c.id
        where e.id = ${inserted.id}
      `;
      const row = fullRows[0];
      if (!row) throw new Error("Failed to retrieve created expense.");
      return rowToExpense(row);
    });
  }

  async updateExpense(id: string, input: UpdateExpenseInput): Promise<Expense> {
    return this.withSql(async (sql) => {
      const existing = await sql<ExpenseRow[]>`
        select id, title, category_id, amount_minor, currency, spent_at, note
        from expenses where id = ${id}
      `;
      const current = existing[0];
      if (!current) throw new NotFoundError("Expense not found.");

      const updatedTitle = input.title ?? current.title;
      const updatedCategoryId =
        input.categoryId !== undefined ? input.categoryId : current.category_id;
      const updatedAmount =
        input.amountMinor !== undefined ? input.amountMinor : current.amount_minor.toString();
      const updatedCurrency = input.currency ?? current.currency;
      const updatedSpentAt = input.spentAt ? new Date(input.spentAt) : current.spent_at;
      const updatedNote = input.note !== undefined ? input.note : current.note;

      await sql`
        update expenses
        set title = ${updatedTitle},
            category_id = ${updatedCategoryId},
            amount_minor = ${updatedAmount},
            currency = ${updatedCurrency},
            spent_at = ${updatedSpentAt},
            note = ${updatedNote},
            updated_at = now()
        where id = ${id}
      `;

      const fullRows = await sql<ExpenseRow[]>`
        select
          e.id,
          e.title,
          e.category_id,
          c.name as category_name,
          c.color as category_color,
          c.icon as category_icon,
          e.amount_minor,
          e.currency,
          e.spent_at,
          e.note,
          e.created_at,
          e.updated_at
        from expenses e
        left join expense_categories c on e.category_id = c.id
        where e.id = ${id}
      `;
      const row = fullRows[0];
      if (!row) throw new NotFoundError("Expense not found.");
      return rowToExpense(row);
    });
  }

  async deleteExpense(id: string): Promise<void> {
    return this.withSql(async (sql) => {
      const result = await sql`
        delete from expenses where id = ${id}
      `;
      if (result.count === 0) throw new NotFoundError("Expense not found.");
    });
  }

  // Reports & Analytics -------------------------------------------------------

  async getReport(options: {
    period: ExpensePeriodType;
    targetDate?: string;
    calendarSystem?: CalendarSystem;
  }): Promise<ExpenseReportSummary> {
    const calendar = options.calendarSystem ?? "gregorian";
    const refDate = options.targetDate ? new Date(options.targetDate) : new Date();

    const { start, end, prevStart, prevEnd, periodLabel, dayBuckets } = this.calculatePeriodBounds(
      options.period,
      refDate,
      calendar,
    );

    return this.withSql(async (sql) => {
      // 1. Current period transactions & sum
      const currentRows = await sql<
        {
          id: string;
          amount_minor: bigint;
          spent_at: Date;
          category_id: string | null;
          category_name: string | null;
          category_color: string | null;
          category_icon: string | null;
        }[]
      >`
        select
          e.id,
          e.amount_minor,
          e.spent_at,
          e.category_id,
          coalesce(c.name, 'Others') as category_name,
          coalesce(c.color, '#64748b') as category_color,
          coalesce(c.icon, 'more-horizontal') as category_icon
        from expenses e
        left join expense_categories c on e.category_id = c.id
        where e.spent_at >= ${start} and e.spent_at <= ${end}
        order by e.spent_at asc
      `;

      // 2. Previous period sum
      const prevRows = await sql<{ total: string | null }[]>`
        select coalesce(sum(amount_minor), 0)::text as total
        from expenses
        where spent_at >= ${prevStart} and spent_at <= ${prevEnd}
      `;

      let totalMinor = 0n;
      const categoryMap = new Map<
        string,
        {
          name: string;
          color: string;
          icon: string;
          amount: bigint;
          count: number;
        }
      >();

      const dayMap = new Map<string, { amount: bigint; count: number }>();
      for (const bucket of dayBuckets) {
        dayMap.set(bucket.dateKey, { amount: 0n, count: 0 });
      }

      for (const row of currentRows) {
        const rowAmount = BigInt(row.amount_minor);
        totalMinor += rowAmount;

        // Day bucket key YYYY-MM-DD
        const dateKey = row.spent_at.toISOString().slice(0, 10);
        const dayEntry = dayMap.get(dateKey);
        if (dayEntry) {
          dayEntry.amount += rowAmount;
          dayEntry.count += 1;
        } else {
          dayMap.set(dateKey, { amount: rowAmount, count: 1 });
        }

        // Category breakdown
        const catKey = row.category_id ?? "uncategorized";
        const cat = categoryMap.get(catKey);
        if (cat) {
          cat.amount += rowAmount;
          cat.count += 1;
        } else {
          categoryMap.set(catKey, {
            name: row.category_name ?? "Others",
            color: row.category_color ?? "#64748b",
            icon: row.category_icon ?? "more-horizontal",
            amount: rowAmount,
            count: 1,
          });
        }
      }

      const prevTotalMinor = BigInt(prevRows[0]?.total ?? "0");
      let changePercentage: number | null = null;
      if (prevTotalMinor > 0n) {
        changePercentage =
          Math.round((Number(totalMinor - prevTotalMinor) / Number(prevTotalMinor)) * 100 * 10) /
          10;
      }

      // Calculate daily average
      const daysCount = Math.max(1, dayBuckets.length);
      const dailyAverageMinor = (totalMinor / BigInt(daysCount)).toString();

      // Category breakdown sorted
      const categoryBreakdown: CategoryBreakdownItem[] = [];
      let highestCategory: ExpenseReportSummary["highestCategory"] = null;
      let maxCategoryAmount = -1n;

      for (const [key, val] of categoryMap.entries()) {
        const pct =
          totalMinor > 0n ? Math.round(Number((val.amount * 1000n) / totalMinor)) / 10 : 0;
        categoryBreakdown.push({
          categoryId: key === "uncategorized" ? null : key,
          categoryName: val.name,
          color: val.color,
          icon: val.icon,
          amountMinor: val.amount.toString(),
          count: val.count,
          percentage: pct,
        });

        if (val.amount > maxCategoryAmount) {
          maxCategoryAmount = val.amount;
          highestCategory = {
            name: val.name,
            color: val.color,
            amountMinor: val.amount.toString(),
          };
        }
      }

      categoryBreakdown.sort((a, b) => (BigInt(b.amountMinor) > BigInt(a.amountMinor) ? 1 : -1));

      // Daily breakdown
      const dailyBreakdown: DailyBreakdownItem[] = dayBuckets.map((bucket) => {
        const item = dayMap.get(bucket.dateKey);
        return {
          date: bucket.dateKey,
          dayLabel: bucket.label,
          amountMinor: (item?.amount ?? 0n).toString(),
          count: item?.count ?? 0,
        };
      });

      return {
        periodType: options.period,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        periodLabel,
        currency: "IRR",
        totalMinor: totalMinor.toString(),
        previousTotalMinor: prevTotalMinor.toString(),
        changePercentage,
        transactionCount: currentRows.length,
        dailyAverageMinor,
        highestCategory,
        dailyBreakdown,
        categoryBreakdown,
      };
    });
  }

  private calculatePeriodBounds(
    period: ExpensePeriodType,
    refDate: Date,
    calendar: CalendarSystem,
  ): {
    start: Date;
    end: Date;
    prevStart: Date;
    prevEnd: Date;
    periodLabel: string;
    dayBuckets: { dateKey: string; label: string }[];
  } {
    if (period === "week") {
      // In Iran/Jalali calendar, week starts on Saturday (day 6 of JS getUTCDay())
      // In Gregorian, week can start on Monday (day 1) or Saturday
      // To support Iranian week conventions, week starts on Saturday (Sat=0 in Jalali offset)
      const dayOfWeek = refDate.getUTCDay(); // 0 is Sunday, 6 is Saturday
      // Difference to get to preceding Saturday:
      // Sat(6) -> 0 days back; Sun(0) -> 1 day back; Mon(1) -> 2 days back ... Fri(5) -> 6 days back
      const daysSinceSaturday = (dayOfWeek + 1) % 7;

      const startDate = new Date(refDate);
      startDate.setUTCDate(refDate.getUTCDate() - daysSinceSaturday);
      startDate.setUTCHours(0, 0, 0, 0);

      const endDate = new Date(startDate);
      endDate.setUTCDate(startDate.getUTCDate() + 6);
      endDate.setUTCHours(23, 59, 59, 999);

      const prevStartDate = new Date(startDate);
      prevStartDate.setUTCDate(startDate.getUTCDate() - 7);

      const prevEndDate = new Date(endDate);
      prevEndDate.setUTCDate(endDate.getUTCDate() - 7);

      const dayBuckets: { dateKey: string; label: string }[] = [];
      const jalaliDayNames = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];

      for (let i = 0; i < 7; i++) {
        const d = new Date(startDate);
        d.setUTCDate(startDate.getUTCDate() + i);
        const dateKey = d.toISOString().slice(0, 10);
        dayBuckets.push({
          dateKey,
          label: jalaliDayNames[i] ?? `Day ${i + 1}`,
        });
      }

      const label = `${startDate.toISOString().slice(0, 10)} - ${endDate.toISOString().slice(0, 10)}`;

      return {
        start: startDate,
        end: endDate,
        prevStart: prevStartDate,
        prevEnd: prevEndDate,
        periodLabel: label,
        dayBuckets,
      };
    } else {
      // Monthly view
      let startDate: Date;
      let endDate: Date;
      let prevStartDate: Date;
      let prevEndDate: Date;
      let periodLabel = "";
      const dayBuckets: { dateKey: string; label: string }[] = [];

      if (calendar === "jalali") {
        const gDate = {
          calendar: "gregorian" as const,
          year: refDate.getUTCFullYear(),
          month: refDate.getUTCMonth() + 1,
          day: refDate.getUTCDate(),
        };
        const jDate = fromGregorian(gDate, "jalali");
        const monthLen = daysInMonth("jalali", jDate.year, jDate.month);

        const jStart: CalendarDate = {
          calendar: "jalali",
          year: jDate.year,
          month: jDate.month,
          day: 1,
        };
        const gStart = toGregorian(jStart);
        startDate = new Date(Date.UTC(gStart.year, gStart.month - 1, gStart.day, 0, 0, 0, 0));

        const jEnd: CalendarDate = {
          calendar: "jalali",
          year: jDate.year,
          month: jDate.month,
          day: monthLen,
        };
        const gEnd = toGregorian(jEnd);
        endDate = new Date(Date.UTC(gEnd.year, gEnd.month - 1, gEnd.day, 23, 59, 59, 999));

        // Previous Jalali month
        const prevJYear = jDate.month === 1 ? jDate.year - 1 : jDate.year;
        const prevJMonth = jDate.month === 1 ? 12 : jDate.month - 1;
        const prevMonthLen = daysInMonth("jalali", prevJYear, prevJMonth);

        const prevJStart: CalendarDate = {
          calendar: "jalali",
          year: prevJYear,
          month: prevJMonth,
          day: 1,
        };
        const prevGStart = toGregorian(prevJStart);
        prevStartDate = new Date(
          Date.UTC(prevGStart.year, prevGStart.month - 1, prevGStart.day, 0, 0, 0, 0),
        );

        const prevJEnd: CalendarDate = {
          calendar: "jalali",
          year: prevJYear,
          month: prevJMonth,
          day: prevMonthLen,
        };
        const prevGEnd = toGregorian(prevJEnd);
        prevEndDate = new Date(
          Date.UTC(prevGEnd.year, prevGEnd.month - 1, prevGEnd.day, 23, 59, 59, 999),
        );

        periodLabel = `${jDate.year}/${jDate.month.toString().padStart(2, "0")}`;

        for (let day = 1; day <= monthLen; day++) {
          const jd: CalendarDate = {
            calendar: "jalali",
            year: jDate.year,
            month: jDate.month,
            day,
          };
          const gd = toGregorian(jd);
          const dateKey = `${gd.year}-${gd.month.toString().padStart(2, "0")}-${gd.day.toString().padStart(2, "0")}`;
          dayBuckets.push({
            dateKey,
            label: `${day}`,
          });
        }
      } else {
        const year = refDate.getUTCFullYear();
        const month = refDate.getUTCMonth(); // 0-indexed

        startDate = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
        const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
        endDate = new Date(Date.UTC(year, month, lastDay, 23, 59, 59, 999));

        prevStartDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
        const prevLastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
        prevEndDate = new Date(Date.UTC(year, month - 1, prevLastDay, 23, 59, 59, 999));

        periodLabel = `${year}-${(month + 1).toString().padStart(2, "0")}`;

        for (let day = 1; day <= lastDay; day++) {
          const dateKey = `${year}-${(month + 1).toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
          dayBuckets.push({
            dateKey,
            label: `${day}`,
          });
        }
      }

      return {
        start: startDate,
        end: endDate,
        prevStart: prevStartDate,
        prevEnd: prevEndDate,
        periodLabel,
        dayBuckets,
      };
    }
  }
}
