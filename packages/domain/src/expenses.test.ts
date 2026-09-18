import { describe, expect, it } from "vitest";
import {
  createExpenseCategorySchema,
  createExpenseSchema,
  createRegularExpenseItemSchema,
  DEFAULT_EXPENSE_CATEGORIES,
} from "./expenses.js";

describe("Expenses Domain Schemas", () => {
  it("defines 6 default expense categories matching user requirements", () => {
    expect(DEFAULT_EXPENSE_CATEGORIES).toHaveLength(6);
    const names = DEFAULT_EXPENSE_CATEGORIES.map((c) => c.name);
    expect(names).toContain("Snacks and food");
    expect(names).toContain("Subscriptions");
    expect(names).toContain("Internet and bills");
    expect(names).toContain("Fun");
    expect(names).toContain("Health");
    expect(names).toContain("Others");
  });

  it("validates category creation schema", () => {
    const valid = createExpenseCategorySchema.parse({
      name: "Coffee & Drinks",
      color: "#f59e0b",
      icon: "coffee",
    });
    expect(valid.name).toBe("Coffee & Drinks");
    expect(valid.color).toBe("#f59e0b");

    expect(() => createExpenseCategorySchema.parse({ name: "" })).toThrow();
    expect(() =>
      createExpenseCategorySchema.parse({ name: "Bad Color", color: "not-a-color" }),
    ).toThrow();
  });

  it("validates regular expense item with IRR default", () => {
    const item = createRegularExpenseItemSchema.parse({
      title: "Gasoline",
      amountMinor: "600000",
    });
    expect(item.currency).toBe("IRR");
    expect(item.amountMinor).toBe("600000");

    expect(() =>
      createRegularExpenseItemSchema.parse({
        title: "",
        amountMinor: "100",
      }),
    ).toThrow();

    expect(() =>
      createRegularExpenseItemSchema.parse({
        title: "Gas",
        amountMinor: "-500",
      }),
    ).toThrow();
  });

  it("validates expense creation", () => {
    const expense = createExpenseSchema.parse({
      title: "Water bottle",
      amountMinor: "15000",
    });
    expect(expense.currency).toBe("IRR");
    expect(expense.amountMinor).toBe("15000");
    expect(expense.spentAt).toBeDefined();

    expect(() =>
      createExpenseSchema.parse({
        title: "Test",
        amountMinor: "invalid",
      }),
    ).toThrow();
  });
});
