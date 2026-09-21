"use client";

import {
  BarChart3,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Layers,
  LoaderCircle,
  Plus,
  Receipt,
  Search,
  Settings2,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
  useToast,
} from "@reminder/ui";
import type { CalendarSystem, Expense, ExpenseCategory, RegularExpenseItem } from "@reminder/domain";
import {
  formatExpenseDate,
  formatToman,
  getMonthBounds,
  navigateMonth,
} from "@/lib/expenses-month";

export { formatExpenseDate, formatToman };

// Quick color palette options for categories
const COLOR_PALETTE = [
  "#10b981", // Emerald / Food
  "#3b82f6", // Blue / Subscriptions
  "#f59e0b", // Amber / Bills
  "#8b5cf6", // Purple / Fun
  "#ec4899", // Rose / Health
  "#64748b", // Slate / Others
  "#06b6d4", // Cyan
  "#f97316", // Orange
  "#84cc16", // Lime
  "#e11d48", // Crimson
];

export function ExpensesDashboard() {
  const { toast } = useToast();

  // Data state
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [monthTotalMinor, setMonthTotalMinor] = useState("0");
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [regularItems, setRegularItems] = useState<RegularExpenseItem[]>([]);

  // Filter & Navigation state (calendarSystem comes from settings / .env)
  const [refDate, setRefDate] = useState<Date>(new Date());
  const [calendarSystem, setCalendarSystem] = useState<CalendarSystem>("jalali");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Computed month bounds
  const monthBounds = useMemo(
    () => getMonthBounds(refDate, calendarSystem),
    [refDate, calendarSystem],
  );

  // Loading state
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Modals
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [expenseTitle, setExpenseTitle] = useState("");
  const [expenseAmountToman, setExpenseAmountToman] = useState("");
  const [expenseCategoryId, setExpenseCategoryId] = useState("");
  const [expenseSpentAt, setExpenseSpentAt] = useState("");
  const [expenseNote, setExpenseNote] = useState("");

  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState(COLOR_PALETTE[0]!);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);

  const [regularItemModalOpen, setRegularItemModalOpen] = useState(false);
  const [newPresetTitle, setNewPresetTitle] = useState("");
  const [newPresetAmountToman, setNewPresetAmountToman] = useState("");
  const [newPresetCategoryId, setNewPresetCategoryId] = useState("");
  const [editingPreset, setEditingPreset] = useState<RegularExpenseItem | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<{
    type: "expense" | "category" | "regularItem";
    id: string;
    title: string;
  } | null>(null);

  // 1. Load initial categories, regular items, and calendar settings
  const loadMeta = useCallback(async () => {
    try {
      const [catsRes, itemsRes, settingsRes] = await Promise.all([
        fetch("/api/v1/expenses/categories"),
        fetch("/api/v1/expenses/regular-items"),
        fetch("/api/v1/settings"),
      ]);

      if (catsRes.ok) {
        const catsData: ExpenseCategory[] = await catsRes.json();
        setCategories(catsData);
      }
      if (itemsRes.ok) {
        const itemsData: RegularExpenseItem[] = await itemsRes.json();
        setRegularItems(itemsData);
      }
      if (settingsRes.ok) {
        const settingsData = (await settingsRes.json()) as { calendarSystem?: CalendarSystem };
        if (settingsData.calendarSystem) {
          setCalendarSystem(settingsData.calendarSystem);
        }
      }
    } catch {
      toast("Failed to load categories or presets.", "error");
    }
  }, [toast]);

  // 2. Load expenses list for active month
  const loadExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set("q", searchQuery.trim());
      if (categoryFilter && categoryFilter !== "all") params.set("categoryId", categoryFilter);
      params.set("startDate", monthBounds.startDate.toISOString());
      params.set("endDate", monthBounds.endDate.toISOString());
      params.set("limit", "100");

      const res = await fetch(`/api/v1/expenses?${params.toString()}`);
      if (res.ok) {
        const data: { items: Expense[]; totalCount: number; totalAmountMinor: string } =
          await res.json();
        setExpenses(data.items);
        setTotalCount(data.totalCount);
        setMonthTotalMinor(data.totalAmountMinor);
      }
    } catch {
      toast("Failed to load expenses list.", "error");
    } finally {
      setLoading(false);
    }
  }, [searchQuery, categoryFilter, monthBounds, toast]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  // Fast-Add Regular Item (1-Click Record)
  const handleQuickAdd = async (item: RegularExpenseItem) => {
    try {
      const res = await fetch("/api/v1/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: item.title,
          amountMinor: item.amountMinor,
          currency: "IRR",
          categoryId: item.categoryId ?? undefined,
          spentAt: new Date().toISOString(),
        }),
      });

      if (!res.ok) throw new Error();

      toast(`Added ${item.title} (${formatToman(item.amountMinor)} Toman)`, "success");
      loadExpenses();
    } catch {
      toast(`Failed to record ${item.title}.`, "error");
    }
  };

  // Save Expense (Add or Edit) - input in Toman, saved in minor units (1 Toman = 10 minor)
  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseTitle.trim()) {
      toast("Title cannot be empty.", "error");
      return;
    }
    const cleanToman = expenseAmountToman.trim().replaceAll(",", "").replaceAll(" ", "");
    if (!cleanToman || !/^\d+$/.test(cleanToman)) {
      toast("Please enter a valid amount in Toman (numbers only).", "error");
      return;
    }

    setSubmitting(true);
    try {
      const amountMinor = (BigInt(cleanToman) * 10n).toString();
      const payload = {
        title: expenseTitle.trim(),
        amountMinor,
        currency: "IRR" as const,
        categoryId: expenseCategoryId && expenseCategoryId !== "none" ? expenseCategoryId : null,
        spentAt: expenseSpentAt ? new Date(expenseSpentAt).toISOString() : new Date().toISOString(),
        note: expenseNote.trim() || null,
      };

      let res: Response;
      if (editingExpense) {
        res = await fetch(`/api/v1/expenses/${editingExpense.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/v1/expenses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) throw new Error();

      toast(editingExpense ? "Expense updated!" : "Expense added!", "success");
      setExpenseModalOpen(false);
      setEditingExpense(null);
      loadExpenses();
    } catch {
      toast("Failed to save expense.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const openAddExpenseModal = (preset?: Partial<RegularExpenseItem>) => {
    setEditingExpense(null);
    setExpenseTitle(preset?.title ?? "");
    setExpenseAmountToman(
      preset?.amountMinor ? (BigInt(preset.amountMinor) / 10n).toString() : "",
    );
    setExpenseCategoryId(preset?.categoryId ?? categories[0]?.id ?? "");

    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    const localISOTime = new Date(now.getTime() - offset).toISOString().slice(0, 16);
    setExpenseSpentAt(localISOTime);
    setExpenseNote("");
    setExpenseModalOpen(true);
  };

  const openEditExpenseModal = (exp: Expense) => {
    setEditingExpense(exp);
    setExpenseTitle(exp.title);
    setExpenseAmountToman((BigInt(exp.amountMinor) / 10n).toString());
    setExpenseCategoryId(exp.categoryId ?? "");
    const d = new Date(exp.spentAt);
    const offset = d.getTimezoneOffset() * 60000;
    const localISOTime = new Date(d.getTime() - offset).toISOString().slice(0, 16);
    setExpenseSpentAt(localISOTime);
    setExpenseNote(exp.note ?? "");
    setExpenseModalOpen(true);
  };

  // Save Category
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) {
      toast("Category name cannot be empty.", "error");
      return;
    }

    setSubmitting(true);
    try {
      if (editingCategory) {
        const res = await fetch(`/api/v1/expenses/categories/${editingCategory.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newCatName.trim(), color: newCatColor }),
        });
        if (!res.ok) throw new Error();
        toast("Category updated!", "success");
      } else {
        const res = await fetch("/api/v1/expenses/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newCatName.trim(), color: newCatColor, icon: "tag" }),
        });
        if (!res.ok) throw new Error();
        toast("Category created!", "success");
      }
      setNewCatName("");
      setEditingCategory(null);
      loadMeta();
      loadExpenses();
    } catch {
      toast("Failed to save category.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Save Regular Item Preset - input in Toman, saved in minor units
  const handleSavePreset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPresetTitle.trim()) {
      toast("Title cannot be empty.", "error");
      return;
    }
    const cleanToman = newPresetAmountToman.trim().replaceAll(",", "").replaceAll(" ", "");
    if (!cleanToman || !/^\d+$/.test(cleanToman)) {
      toast("Please enter a valid amount in Toman.", "error");
      return;
    }

    setSubmitting(true);
    try {
      const amountMinor = (BigInt(cleanToman) * 10n).toString();
      if (editingPreset) {
        const res = await fetch(`/api/v1/expenses/regular-items/${editingPreset.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: newPresetTitle.trim(),
            amountMinor,
            categoryId: newPresetCategoryId && newPresetCategoryId !== "none" ? newPresetCategoryId : null,
            currency: "IRR",
          }),
        });
        if (!res.ok) throw new Error();
        toast("Preset updated!", "success");
      } else {
        const res = await fetch("/api/v1/expenses/regular-items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: newPresetTitle.trim(),
            amountMinor,
            categoryId: newPresetCategoryId && newPresetCategoryId !== "none" ? newPresetCategoryId : null,
            currency: "IRR",
          }),
        });
        if (!res.ok) throw new Error();
        toast("Preset created!", "success");
      }
      setNewPresetTitle("");
      setNewPresetAmountToman("");
      setEditingPreset(null);
      loadMeta();
    } catch {
      toast("Failed to save preset.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Deletions
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setSubmitting(true);
    try {
      if (deleteTarget.type === "expense") {
        await fetch(`/api/v1/expenses/${deleteTarget.id}`, { method: "DELETE" });
        toast("Expense deleted.", "success");
        loadExpenses();
      } else if (deleteTarget.type === "category") {
        await fetch(`/api/v1/expenses/categories/${deleteTarget.id}`, { method: "DELETE" });
        toast("Category deleted and items moved to Others.", "success");
        loadMeta();
        loadExpenses();
      } else if (deleteTarget.type === "regularItem") {
        await fetch(`/api/v1/expenses/regular-items/${deleteTarget.id}`, { method: "DELETE" });
        toast("Preset removed.", "success");
        loadMeta();
      }
      setDeleteTarget(null);
    } catch {
      toast("Deletion failed.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Navigate month
  const handleNavigateMonth = (direction: "prev" | "next" | "today") => {
    const nextDate = navigateMonth(refDate, calendarSystem, direction);
    setRefDate(nextDate);
  };

  return (
    <main className="app-main expenses-page">
      {/* 1. Hero Section: Spent Card and Action Buttons Stacked in Front */}
      <section className="expenses-hero-section">
        <div className="expenses-spent-card">
          <span className="type-label">Spent in {monthBounds.label}</span>
          <strong>{formatToman(monthTotalMinor)} Toman</strong>
          <div className="expenses-metric-sub">
            <span>{totalCount} transactions recorded</span>
          </div>
        </div>

        <div className="expenses-hero-actions">
          <Button variant="primary" onClick={() => openAddExpenseModal()}>
            <Plus size={16} />
            <span>Add Expense</span>
          </Button>

          <Button variant="secondary" onClick={() => setCategoryModalOpen(true)}>
            <Layers size={16} />
            <span>Manage Categories</span>
          </Button>

          <Link href="/expenses/reports" className="ui-button ui-button--secondary">
            <BarChart3 size={16} />
            <span>Reports</span>
          </Link>
        </div>
      </section>

      {/* 2. Fast-Add Regular Items Bar */}
      <section className="expenses-quick-bar" aria-label="Regular Items Quick Add">
        <div className="expenses-quick-bar-header">
          <div className="expenses-quick-bar-label">
            <Zap size={16} className="text-accent" />
            <span>
              Quick Add <span className="expenses-quick-bar-label-sub">Regular Items</span>
            </span>
          </div>
          <button
            type="button"
            className="expenses-presets-manage-link"
            onClick={() => setRegularItemModalOpen(true)}
          >
            <Settings2 size={14} />
            <span>Manage Presets</span>
          </button>
        </div>

        <div className="expenses-quick-chips">
          {regularItems.length === 0 ? (
            <p className="expenses-quick-empty">
              No regular presets yet. Click &quot;Manage Presets&quot; to configure fast-add items
              like Water or Gasoline!
            </p>
          ) : (
            regularItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className="expenses-quick-chip"
                onClick={() => handleQuickAdd(item)}
                title={`Click to quickly add ${item.title} (${formatToman(item.amountMinor)} Toman)`}
              >
                <span
                  className="quick-chip-dot"
                  style={{ backgroundColor: item.categoryColor || "#64748b" }}
                />
                <span className="quick-chip-title">+{item.title}</span>
                <span className="quick-chip-price">{formatToman(item.amountMinor)} Toman</span>
              </button>
            ))
          )}
        </div>
      </section>

      {/* 3. Monthly Expenses Transactions History (Search, Select, Month Navigator right above the table) */}
      <section className="expenses-history-section">
        <div className="expenses-history-header">
          <div className="expenses-filter-bar">
            {/* Search */}
            <div className="search-field expenses-search-field">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search description or note..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="search-clear-btn"
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Select Category */}
            <div className="expenses-category-select-wrapper">
              <Select
                aria-label="Filter by category"
                value={categoryFilter}
                onValueChange={setCategoryFilter}
                options={[
                  { value: "all", label: "All Categories" },
                  ...categories.map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
            </div>
          </div>

          {/* Month Navigator */}
          <div className="expenses-month-nav">
            <button
              type="button"
              className="analytics-nav-btn"
              onClick={() => handleNavigateMonth("prev")}
              title="Previous Month"
              aria-label="Previous Month"
            >
              <ChevronLeft size={18} />
            </button>

            <span className="expenses-month-label">
              <CalendarDays size={16} />
              <span>{monthBounds.label}</span>
            </span>

            <button
              type="button"
              className="analytics-nav-btn"
              onClick={() => handleNavigateMonth("next")}
              title="Next Month"
              aria-label="Next Month"
            >
              <ChevronRight size={18} />
            </button>

            <button
              type="button"
              className="analytics-today-btn"
              onClick={() => handleNavigateMonth("today")}
              title="Current Month"
            >
              This Month
            </button>
          </div>
        </div>

        {loading ? (
          <div className="expenses-table-loading">
            <LoaderCircle size={24} className="spin" />
            <span>Loading expenses for {monthBounds.label}...</span>
          </div>
        ) : expenses.length === 0 ? (
          <div className="empty-state expenses-empty-state">
            <Receipt size={36} />
            <h2>No expenses found for {monthBounds.label}</h2>
            <p>
              {searchQuery || categoryFilter !== "all"
                ? "No transactions in this month match your search filters."
                : `No expenses recorded yet in ${monthBounds.label}. Click "Add Expense" or use a Quick Add item above.`}
            </p>
            <Button variant="primary" onClick={() => openAddExpenseModal()}>
              <Plus size={16} />
              <span>Record Expense for {monthBounds.label}</span>
            </Button>
          </div>
        ) : (
          <>
            {/* Desktop View: Table */}
            <div className="expenses-table-card expenses-desktop-view">
              <table className="expenses-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Title</th>
                    <th>Date & Time</th>
                    <th className="text-right">Amount (Toman)</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((exp) => (
                    <tr key={exp.id}>
                      <td>
                        <span className="expenses-cat-badge">
                          <span
                            className="cat-color-dot"
                            style={{ backgroundColor: exp.categoryColor || "#64748b" }}
                          />
                          <span>{exp.categoryName || "Others"}</span>
                        </span>
                      </td>
                      <td>
                        <div className="expense-title-cell">
                          <strong>{exp.title}</strong>
                          {exp.note && <small className="expense-note-text">{exp.note}</small>}
                        </div>
                      </td>
                      <td className="expense-date-cell">
                        {formatExpenseDate(exp.spentAt, calendarSystem)}
                      </td>
                      <td className="text-right expense-amount-cell">
                        <strong>{formatToman(exp.amountMinor)} Toman</strong>
                      </td>
                      <td className="text-right">
                        <div className="expense-action-buttons">
                          <button
                            type="button"
                            className="expense-action-btn"
                            title="Edit expense"
                            aria-label={`Edit ${exp.title}`}
                            onClick={() => openEditExpenseModal(exp)}
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            type="button"
                            className="expense-action-btn expense-action-btn--delete"
                            title="Delete expense"
                            aria-label={`Delete ${exp.title}`}
                            onClick={() =>
                              setDeleteTarget({
                                type: "expense",
                                id: exp.id,
                                title: exp.title,
                              })
                            }
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile View: Cards */}
            <div className="expenses-cards-grid expenses-mobile-view" aria-label="Transactions">
              {expenses.map((exp) => (
                <article key={exp.id} className="expense-card">
                  <div className="expense-card-header">
                    <span className="expense-card-category">
                      <span
                        className="cat-color-dot"
                        style={{ backgroundColor: exp.categoryColor || "#64748b" }}
                      />
                      <span>{exp.categoryName || "Others"}</span>
                    </span>

                    <div className="expense-card-actions">
                      <button
                        type="button"
                        className="expense-action-btn"
                        title="Edit expense"
                        aria-label={`Edit ${exp.title}`}
                        onClick={() => openEditExpenseModal(exp)}
                      >
                        <Edit3 size={15} />
                      </button>
                      <button
                        type="button"
                        className="expense-action-btn expense-action-btn--delete"
                        title="Delete expense"
                        aria-label={`Delete ${exp.title}`}
                        onClick={() =>
                          setDeleteTarget({
                            type: "expense",
                            id: exp.id,
                            title: exp.title,
                          })
                        }
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  <div className="expense-card-body">
                    <h3 className="expense-card-title">{exp.title}</h3>
                    {exp.note && <p className="expense-card-note">{exp.note}</p>}
                  </div>

                  <div className="expense-card-footer">
                    <div className="expense-card-amount">
                      <strong className="expense-card-amount-val">
                        {formatToman(exp.amountMinor)}
                      </strong>
                      <span className="expense-card-currency">Toman</span>
                    </div>

                    <div className="expense-card-date">
                      <CalendarDays size={13} aria-hidden="true" />
                      <span>{formatExpenseDate(exp.spentAt, calendarSystem)}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      {/* MODAL 1: Add/Edit Expense (Amount in Toman) */}
      <Dialog open={expenseModalOpen} onOpenChange={setExpenseModalOpen}>
        <DialogContent className="ui-dialog-content">
          <form onSubmit={handleSaveExpense}>
            <DialogHeader>
              <DialogTitle>{editingExpense ? "Edit Expense" : "Record Expense"}</DialogTitle>
              <DialogDescription>
                Enter the details of your financial transaction in Toman.
              </DialogDescription>
            </DialogHeader>

            <div className="modal-form-fields">
              <div className="field">
                <label htmlFor="exp-title">Title / Item</label>
                <input
                  id="exp-title"
                  type="text"
                  placeholder="e.g. Gasoline fill-up, Groceries, Lunch"
                  value={expenseTitle}
                  onChange={(e) => setExpenseTitle(e.target.value)}
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="exp-amount">Amount (in Toman)</label>
                <div className="amount-input-group">
                  <input
                    id="exp-amount"
                    type="text"
                    inputMode="numeric"
                    placeholder="e.g. 50000"
                    value={expenseAmountToman}
                    onChange={(e) => setExpenseAmountToman(e.target.value)}
                    required
                  />
                  <span className="amount-currency-tag">Toman</span>
                </div>
              </div>

              <div className="field">
                <label>Category</label>
                <Select
                  aria-label="Category"
                  value={expenseCategoryId || (categories[0]?.id ?? "none")}
                  onValueChange={setExpenseCategoryId}
                  options={
                    categories.length > 0
                      ? categories.map((c) => ({ value: c.id, label: c.name }))
                      : [{ value: "none", label: "No categories available", disabled: true }]
                  }
                />
              </div>

              <div className="field">
                <label htmlFor="exp-date">Date & Time</label>
                <input
                  id="exp-date"
                  type="datetime-local"
                  value={expenseSpentAt}
                  onChange={(e) => setExpenseSpentAt(e.target.value)}
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="exp-note">Note (Optional)</label>
                <textarea
                  id="exp-note"
                  rows={2}
                  placeholder="Additional context or notes..."
                  value={expenseNote}
                  onChange={(e) => setExpenseNote(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setExpenseModalOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={submitting}>
                {submitting ? "Saving..." : editingExpense ? "Update Expense" : "Record Expense"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: Manage Categories */}
      <Dialog open={categoryModalOpen} onOpenChange={setCategoryModalOpen}>
        <DialogContent className="ui-dialog-content">
          <DialogHeader>
            <DialogTitle>Manage Categories</DialogTitle>
            <DialogDescription>
              Customize, add, or rename your expense categories.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveCategory} className="category-edit-form">
            <div className="field">
              <label htmlFor="cat-name">
                {editingCategory ? `Edit "${editingCategory.name}"` : "New Category Name"}
              </label>
              <div className="category-input-row">
                <input
                  id="cat-name"
                  type="text"
                  placeholder="e.g. Gifts, Education"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  required
                />
                <Button type="submit" variant="primary" disabled={submitting}>
                  {editingCategory ? "Update" : "Add"}
                </Button>
                {editingCategory && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setEditingCategory(null);
                      setNewCatName("");
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>

            <div className="field">
              <label>Color</label>
              <div className="palette-picker">
                {COLOR_PALETTE.map((col) => (
                  <button
                    key={col}
                    type="button"
                    className={`palette-swatch ${newCatColor === col ? "palette-swatch--selected" : ""}`}
                    style={{ backgroundColor: col }}
                    onClick={() => setNewCatColor(col)}
                  >
                    {newCatColor === col && <Check size={14} color="#fff" />}
                  </button>
                ))}
              </div>
            </div>
          </form>

          <div className="category-manage-list">
            <h4>Existing Categories ({categories.length})</h4>
            <div className="category-items-scroll">
              {categories.map((c) => (
                <div key={c.id} className="category-manage-row">
                  <div className="category-manage-info">
                    <span className="cat-color-dot" style={{ backgroundColor: c.color }} />
                    <strong>{c.name}</strong>
                    {c.isDefault && <span className="cat-default-tag">Default</span>}
                  </div>
                  <div className="category-manage-actions">
                    <button
                      type="button"
                      className="expense-action-btn"
                      title="Edit category"
                      onClick={() => {
                        setEditingCategory(c);
                        setNewCatName(c.name);
                        setNewCatColor(c.color);
                      }}
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      type="button"
                      className="expense-action-btn expense-action-btn--delete"
                      title="Delete category"
                      onClick={() =>
                        setDeleteTarget({
                          type: "category",
                          id: c.id,
                          title: c.name,
                        })
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setCategoryModalOpen(false);
                setEditingCategory(null);
              }}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: Manage Regular Items / Presets (Amounts in Toman) */}
      <Dialog open={regularItemModalOpen} onOpenChange={setRegularItemModalOpen}>
        <DialogContent className="ui-dialog-content">
          <DialogHeader>
            <DialogTitle>Manage Quick-Add Presets</DialogTitle>
            <DialogDescription>
              Configure regular items like Water or Gasoline with pre-set Toman amounts for 1-click
              recording.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSavePreset} className="category-edit-form">
            <div className="field">
              <label htmlFor="preset-title">
                {editingPreset ? `Edit "${editingPreset.title}"` : "New Regular Item Name"}
              </label>
              <input
                id="preset-title"
                type="text"
                placeholder="e.g. Water, Gasoline, Coffee, Bread"
                value={newPresetTitle}
                onChange={(e) => setNewPresetTitle(e.target.value)}
                required
              />
            </div>

            <div className="form-grid">
              <div className="field">
                <label htmlFor="preset-amount">Amount (in Toman)</label>
                <div className="amount-input-group">
                  <input
                    id="preset-amount"
                    type="text"
                    inputMode="numeric"
                    placeholder="e.g. 60000"
                    value={newPresetAmountToman}
                    onChange={(e) => setNewPresetAmountToman(e.target.value)}
                    required
                  />
                  <span className="amount-currency-tag">Toman</span>
                </div>
              </div>

              <div className="field">
                <label>Category</label>
                <Select
                  aria-label="Preset category"
                  value={newPresetCategoryId || "none"}
                  onValueChange={(val) => setNewPresetCategoryId(val === "none" ? "" : val)}
                  options={[
                    { value: "none", label: "No Category" },
                    ...categories.map((c) => ({ value: c.id, label: c.name })),
                  ]}
                />
              </div>
            </div>

            <div className="preset-form-buttons">
              <Button type="submit" variant="primary" disabled={submitting}>
                {editingPreset ? "Update Preset" : "Add Preset"}
              </Button>
              {editingPreset && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setEditingPreset(null);
                    setNewPresetTitle("");
                    setNewPresetAmountToman("");
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
          </form>

          <div className="category-manage-list">
            <h4>Existing Presets ({regularItems.length})</h4>
            <div className="category-items-scroll">
              {regularItems.map((item) => (
                <div key={item.id} className="category-manage-row">
                  <div className="category-manage-info">
                    <span
                      className="cat-color-dot"
                      style={{ backgroundColor: item.categoryColor || "#64748b" }}
                    />
                    <strong>{item.title}</strong>
                    <span className="preset-row-price">{formatToman(item.amountMinor)} Toman</span>
                  </div>
                  <div className="category-manage-actions">
                    <button
                      type="button"
                      className="expense-action-btn"
                      title="Edit preset"
                      onClick={() => {
                        setEditingPreset(item);
                        setNewPresetTitle(item.title);
                        setNewPresetAmountToman((BigInt(item.amountMinor) / 10n).toString());
                        setNewPresetCategoryId(item.categoryId ?? "");
                      }}
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      type="button"
                      className="expense-action-btn expense-action-btn--delete"
                      title="Delete preset"
                      onClick={() =>
                        setDeleteTarget({
                          type: "regularItem",
                          id: item.id,
                          title: item.title,
                        })
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setRegularItemModalOpen(false);
                setEditingPreset(null);
              }}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 4: Delete Confirmation */}
      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="ui-dialog-content confirmation-dialog">
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              {deleteTarget?.type === "category"
                ? `Are you sure you want to delete the category "${deleteTarget.title}"? Any expenses belonging to this category will be reassigned to "Others".`
                : deleteTarget?.type === "regularItem"
                  ? `Are you sure you want to remove "${deleteTarget?.title}" from quick presets?`
                  : `Are you sure you want to delete the expense "${deleteTarget?.title}"?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDeleteTarget(null)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleConfirmDelete}
              disabled={submitting}
            >
              {submitting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
