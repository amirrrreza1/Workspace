import { z } from "zod";
import { currencies } from "./reminder.js";
import type { CurrencyCode } from "./types.js";
import { parseMinorAmount } from "./money.js";

export const DEFAULT_EXPENSE_CATEGORIES = [
  { name: "Snacks and food", color: "#10b981", icon: "utensils" },
  { name: "Subscriptions", color: "#3b82f6", icon: "repeat" },
  { name: "Internet and bills", color: "#f59e0b", icon: "receipt" },
  { name: "Fun", color: "#8b5cf6", icon: "sparkles" },
  { name: "Health", color: "#ec4899", icon: "heart-pulse" },
  { name: "Others", color: "#64748b", icon: "more-horizontal" },
] as const;

export type ExpenseCategory = {
  id: string;
  name: string;
  color: string;
  icon: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export const createExpenseCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Category name cannot be empty")
    .max(80, "Category name must be at most 80 characters"),
  color: z
    .string()
    .trim()
    .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Must be a valid hex color code")
    .default("#6366f1"),
  icon: z.string().trim().min(1).max(40).default("tag"),
});

export type CreateExpenseCategoryInput = z.infer<typeof createExpenseCategorySchema>;

export const updateExpenseCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Category name cannot be empty")
    .max(80, "Category name must be at most 80 characters")
    .optional(),
  color: z
    .string()
    .trim()
    .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Must be a valid hex color code")
    .optional(),
  icon: z.string().trim().min(1).max(40).optional(),
});

export type UpdateExpenseCategoryInput = z.infer<typeof updateExpenseCategorySchema>;

export type RegularExpenseItem = {
  id: string;
  title: string;
  categoryId: string | null;
  categoryName?: string | null;
  categoryColor?: string | null;
  categoryIcon?: string | null;
  amountMinor: string;
  currency: CurrencyCode;
  icon?: string | null;
  createdAt: string;
  updatedAt: string;
};

export const createRegularExpenseItemSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title cannot be empty")
    .max(120, "Title must be at most 120 characters"),
  categoryId: z.string().uuid().nullable().optional(),
  amountMinor: z.string().refine((val) => {
    try {
      parseMinorAmount(val);
      return true;
    } catch {
      return false;
    }
  }, "Amount must be a valid non-negative integer minor unit."),
  currency: z.enum(currencies).default("IRR"),
  icon: z.string().trim().max(40).nullable().optional(),
});

export type CreateRegularExpenseItemInput = z.infer<typeof createRegularExpenseItemSchema>;

export const updateRegularExpenseItemSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title cannot be empty")
    .max(120, "Title must be at most 120 characters")
    .optional(),
  categoryId: z.string().uuid().nullable().optional(),
  amountMinor: z
    .string()
    .refine((val) => {
      try {
        parseMinorAmount(val);
        return true;
      } catch {
        return false;
      }
    }, "Amount must be a valid non-negative integer minor unit.")
    .optional(),
  currency: z.enum(currencies).optional(),
  icon: z.string().trim().max(40).nullable().optional(),
});

export type UpdateRegularExpenseItemInput = z.infer<typeof updateRegularExpenseItemSchema>;

export type Expense = {
  id: string;
  title: string;
  categoryId: string | null;
  categoryName?: string | null;
  categoryColor?: string | null;
  categoryIcon?: string | null;
  amountMinor: string;
  currency: CurrencyCode;
  spentAt: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export const createExpenseSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title cannot be empty")
    .max(150, "Title must be at most 150 characters"),
  categoryId: z.string().uuid().nullable().optional(),
  amountMinor: z.string().refine((val) => {
    try {
      parseMinorAmount(val);
      return true;
    } catch {
      return false;
    }
  }, "Amount must be a valid non-negative integer minor unit."),
  currency: z.enum(currencies).default("IRR"),
  spentAt: z
    .string()
    .datetime({ offset: true })
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .default(() => new Date().toISOString()),
  note: z.string().max(2000, "Note must be at most 2000 characters").nullable().optional(),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

export const updateExpenseSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title cannot be empty")
    .max(150, "Title must be at most 150 characters")
    .optional(),
  categoryId: z.string().uuid().nullable().optional(),
  amountMinor: z
    .string()
    .refine((val) => {
      try {
        parseMinorAmount(val);
        return true;
      } catch {
        return false;
      }
    }, "Amount must be a valid non-negative integer minor unit.")
    .optional(),
  currency: z.enum(currencies).optional(),
  spentAt: z
    .string()
    .datetime({ offset: true })
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .optional(),
  note: z.string().max(2000, "Note must be at most 2000 characters").nullable().optional(),
});

export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;

export const expenseFilterSchema = z.object({
  q: z.string().trim().optional(),
  categoryId: z.string().uuid().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ExpenseFilter = z.infer<typeof expenseFilterSchema>;

export type ExpensePeriodType = "week" | "month";

export type DailyBreakdownItem = {
  date: string;
  dayLabel: string;
  amountMinor: string;
  count: number;
};

export type CategoryBreakdownItem = {
  categoryId: string | null;
  categoryName: string;
  color: string;
  icon: string;
  amountMinor: string;
  count: number;
  percentage: number;
};

export type ExpenseReportSummary = {
  periodType: ExpensePeriodType;
  startDate: string;
  endDate: string;
  periodLabel: string;
  currency: CurrencyCode;
  totalMinor: string;
  previousTotalMinor: string;
  changePercentage: number | null;
  transactionCount: number;
  dailyAverageMinor: string;
  highestCategory: {
    name: string;
    color: string;
    amountMinor: string;
  } | null;
  dailyBreakdown: DailyBreakdownItem[];
  categoryBreakdown: CategoryBreakdownItem[];
};
