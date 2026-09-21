"use client";

import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Layers,
  LoaderCircle,
  PieChart,
  Plus,
  Trash2,
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
import type {
  CalendarSystem,
  ExpenseCategory,
  ExpensePeriodType,
  ExpenseReportSummary,
} from "@reminder/domain";

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

// Helper to format amounts in Toman (1 Toman = 10 IRR minor units)
export function formatToman(minor: string | number | bigint): string {
  const num = typeof minor === "bigint" ? minor : BigInt(String(minor || "0"));
  const toman = num / 10n;
  return toman.toLocaleString("en-US");
}

export function ReportsDashboard() {
  const { toast } = useToast();

  // Filter & Navigation state (calendarSystem comes from settings / .env)
  const [period, setPeriod] = useState<ExpensePeriodType>("month");
  const [refDate, setRefDate] = useState<Date>(new Date());
  const [calendarSystem, setCalendarSystem] = useState<CalendarSystem>("jalali");

  // Data state
  const [report, setReport] = useState<ExpenseReportSummary | null>(null);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Active chart hover state
  const [hoveredDayIndex, setHoveredDayIndex] = useState<number | null>(null);

  // Modals
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [expenseTitle, setExpenseTitle] = useState("");
  const [expenseAmountToman, setExpenseAmountToman] = useState("");
  const [expenseCategoryId, setExpenseCategoryId] = useState("");
  const [expenseSpentAt, setExpenseSpentAt] = useState("");
  const [expenseNote, setExpenseNote] = useState("");

  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState(COLOR_PALETTE[0]!);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<{
    type: "category";
    id: string;
    title: string;
  } | null>(null);

  // Load initial settings & categories
  const loadMeta = useCallback(async () => {
    try {
      const [catsRes, settingsRes] = await Promise.all([
        fetch("/api/v1/expenses/categories"),
        fetch("/api/v1/settings"),
      ]);

      if (catsRes.ok) {
        const catsData: ExpenseCategory[] = await catsRes.json();
        setCategories(catsData);
      }
      if (settingsRes.ok) {
        const settingsData = (await settingsRes.json()) as { calendarSystem?: CalendarSystem };
        if (settingsData.calendarSystem) {
          setCalendarSystem(settingsData.calendarSystem);
        }
      }
    } catch {
      toast("Failed to load settings or categories.", "error");
    }
  }, [toast]);

  // Load report data
  const loadReport = useCallback(async () => {
    setReportLoading(true);
    try {
      const dateStr = refDate.toISOString().slice(0, 10);
      const res = await fetch(
        `/api/v1/expenses/reports?period=${period}&date=${dateStr}&calendar=${calendarSystem}`,
      );
      if (res.ok) {
        const data: ExpenseReportSummary = await res.json();
        setReport(data);
      }
    } catch {
      toast("Failed to load expense report.", "error");
    } finally {
      setReportLoading(false);
    }
  }, [period, refDate, calendarSystem, toast]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  // Save Expense in Toman
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

      const res = await fetch("/api/v1/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error();

      toast("Expense added!", "success");
      setExpenseModalOpen(false);
      loadReport();
    } catch {
      toast("Failed to save expense.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const openAddExpenseModal = () => {
    setExpenseTitle("");
    setExpenseAmountToman("");
    setExpenseCategoryId(categories[0]?.id ?? "");
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    const localISOTime = new Date(now.getTime() - offset).toISOString().slice(0, 16);
    setExpenseSpentAt(localISOTime);
    setExpenseNote("");
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
      loadReport();
    } catch {
      toast("Failed to save category.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setSubmitting(true);
    try {
      if (deleteTarget.type === "category") {
        await fetch(`/api/v1/expenses/categories/${deleteTarget.id}`, { method: "DELETE" });
        toast("Category deleted and items moved to Others.", "success");
        loadMeta();
        loadReport();
      }
      setDeleteTarget(null);
    } catch {
      toast("Deletion failed.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Period Navigation
  const navigatePeriod = (direction: "prev" | "next" | "today") => {
    if (direction === "today") {
      setRefDate(new Date());
      return;
    }

    const next = new Date(refDate);
    if (period === "week") {
      const delta = direction === "prev" ? -7 : 7;
      next.setUTCDate(refDate.getUTCDate() + delta);
    } else {
      const delta = direction === "prev" ? -1 : 1;
      next.setUTCMonth(refDate.getUTCMonth() + delta);
    }
    setRefDate(next);
  };

  // Chart computation helpers
  const maxDayAmount = useMemo(() => {
    if (!report?.dailyBreakdown?.length) return 1n;
    let max = 1n;
    for (const d of report.dailyBreakdown) {
      const val = BigInt(d.amountMinor || "0");
      if (val > max) max = val;
    }
    return max;
  }, [report]);

  // Donut chart SVG calculations
  const donutSlices = useMemo(() => {
    if (!report?.categoryBreakdown?.length || BigInt(report.totalMinor || "0") === 0n) {
      return [];
    }
    const total = BigInt(report.totalMinor);
    let cumulativePercent = 0;

    return report.categoryBreakdown.map((cat) => {
      const amt = BigInt(cat.amountMinor || "0");
      const ratio = Number(amt) / Number(total);
      const startAngle = cumulativePercent * 360;
      cumulativePercent += ratio;
      const endAngle = cumulativePercent * 360;

      const startRad = ((startAngle - 90) * Math.PI) / 180;
      const endRad = ((endAngle - 90) * Math.PI) / 180;
      const x1 = 100 + 70 * Math.cos(startRad);
      const y1 = 100 + 70 * Math.sin(startRad);
      const x2 = 100 + 70 * Math.cos(endRad);
      const y2 = 100 + 70 * Math.sin(endRad);

      const largeArc = endAngle - startAngle > 180 ? 1 : 0;
      const pathData = `M 100 100 L ${x1} ${y1} A 70 70 0 ${largeArc} 1 ${x2} ${y2} Z`;

      return {
        ...cat,
        pathData,
        percentage: Math.round(ratio * 100),
      };
    });
  }, [report]);

  return (
    <main className="app-main expenses-page">
      {/* 1. Clean Top Bar */}
      <div className="expenses-top-bar">
        <Link href="/expenses" className="ui-button ui-button--secondary">
          <ArrowLeft size={16} />
          <span>Back to Expenses</span>
        </Link>

        <div className="expenses-header-actions">
          <Button variant="secondary" onClick={() => setCategoryModalOpen(true)}>
            <Layers size={16} />
            <span>Manage Categories</span>
          </Button>

          <Button variant="primary" onClick={openAddExpenseModal}>
            <Plus size={16} />
            <span>Add Expense</span>
          </Button>
        </div>
      </div>

      {/* 2. Metrics Summary Cards (All in Toman) */}
      <section className="summary-grid expenses-summary-grid">
        <div className="summary-card">
          <span className="type-label">
            {period === "week" ? "This Week's Spending" : "This Month's Spending"}
          </span>
          <strong>{formatToman(report?.totalMinor ?? "0")} Toman</strong>
          {report?.changePercentage !== null && report?.changePercentage !== undefined && (
            <div className="expenses-metric-sub">
              <span
                className={`metric-change ${report.changePercentage >= 0 ? "metric-change--up" : "metric-change--down"}`}
              >
                {report.changePercentage >= 0 ? (
                  <ArrowUpRight size={14} />
                ) : (
                  <ArrowDownRight size={14} />
                )}
                {Math.abs(report.changePercentage)}% vs last {period}
              </span>
            </div>
          )}
        </div>

        <div className="summary-card">
          <span className="type-label">Daily Average</span>
          <strong>{formatToman(report?.dailyAverageMinor ?? "0")} Toman</strong>
          <div className="expenses-metric-sub">
            <span>Per day</span>
          </div>
        </div>

        <div className="summary-card">
          <span className="type-label">Top Category</span>
          {report?.highestCategory ? (
            <>
              <div className="highest-cat-row">
                <span
                  className="cat-color-badge"
                  style={{ backgroundColor: report.highestCategory.color }}
                />
                <strong className="highest-cat-name">{report.highestCategory.name}</strong>
              </div>
              <div className="expenses-metric-sub">
                <span>{formatToman(report.highestCategory.amountMinor)} Toman</span>
              </div>
            </>
          ) : (
            <>
              <strong>None yet</strong>
              <div className="expenses-metric-sub">
                <span>No spending recorded</span>
              </div>
            </>
          )}
        </div>
      </section>

      {/* 3. Reporting & Interactive Charts Section */}
      <section className="expenses-analytics-card">
        <div className="analytics-toolbar">
          {/* Segmented pill toggle for Weekly vs Monthly only (solar/gregorian toggle removed) */}
          <div className="analytics-period-toggle">
            <button
              type="button"
              className={`period-toggle-btn ${period === "week" ? "period-toggle-btn--active" : ""}`}
              onClick={() => setPeriod("week")}
            >
              <BarChart3 size={15} />
              <span>Weekly Report</span>
            </button>
            <button
              type="button"
              className={`period-toggle-btn ${period === "month" ? "period-toggle-btn--active" : ""}`}
              onClick={() => setPeriod("month")}
            >
              <PieChart size={15} />
              <span>Monthly Report</span>
            </button>
          </div>

          <div className="analytics-nav">
            <button
              type="button"
              className="analytics-nav-btn"
              onClick={() => navigatePeriod("prev")}
              title="Previous period"
            >
              <ChevronLeft size={18} />
            </button>

            <span className="analytics-current-label">
              <CalendarDays size={15} />
              <strong>{report?.periodLabel || "Loading..."}</strong>
            </span>

            <button
              type="button"
              className="analytics-nav-btn"
              onClick={() => navigatePeriod("next")}
              title="Next period"
            >
              <ChevronRight size={18} />
            </button>

            <button
              type="button"
              className="analytics-today-btn"
              onClick={() => navigatePeriod("today")}
              title="Current period"
            >
              Today
            </button>
          </div>
        </div>

        {reportLoading ? (
          <div className="expenses-chart-loading">
            <LoaderCircle size={28} className="spin" />
            <span>Loading analytics...</span>
          </div>
        ) : (
          <div className="analytics-charts-grid">
            {/* Day-by-Day Bar Chart */}
            <div className="chart-panel">
              <div className="chart-panel-header">
                <h3>Daily Spending Trend</h3>
                <span className="chart-panel-sub">
                  {report?.transactionCount ?? 0} transactions
                </span>
              </div>

              {report?.dailyBreakdown && report.dailyBreakdown.length > 0 ? (
                <div className="bar-chart-wrapper">
                  <div className="bar-chart-container">
                    {report.dailyBreakdown.map((item, idx) => {
                      const amt = BigInt(item.amountMinor || "0");
                      const heightPercent =
                        maxDayAmount > 0n ? Math.max(4, Number((amt * 100n) / maxDayAmount)) : 4;
                      const isHovered = hoveredDayIndex === idx;

                      return (
                        <div
                          key={item.date}
                          className="bar-col"
                          onMouseEnter={() => setHoveredDayIndex(idx)}
                          onMouseLeave={() => setHoveredDayIndex(null)}
                        >
                          <div className="bar-track">
                            <div
                              className={`bar-fill ${amt > 0n ? "bar-fill--active" : ""} ${isHovered ? "bar-fill--hover" : ""}`}
                              style={{ height: `${amt > 0n ? heightPercent : 2}%` }}
                            />
                            {isHovered && amt > 0n && (
                              <div className="bar-tooltip">
                                <strong>{formatToman(item.amountMinor)} Toman</strong>
                                <small>
                                  {item.count} {item.count === 1 ? "expense" : "expenses"}
                                </small>
                              </div>
                            )}
                          </div>
                          <span className="bar-label">{item.dayLabel}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="chart-empty">No daily data available for this period.</div>
              )}
            </div>

            {/* Category Breakdown Donut & Rank (All in Toman) */}
            <div className="chart-panel">
              <div className="chart-panel-header">
                <h3>Category Breakdown</h3>
                <span className="chart-panel-sub">By total amount</span>
              </div>

              {donutSlices.length > 0 ? (
                <div className="donut-and-list">
                  <div className="donut-chart-box">
                    <svg viewBox="0 0 200 200" className="donut-svg">
                      {donutSlices.map((slice) => (
                        <path
                          key={slice.categoryName}
                          d={slice.pathData}
                          fill={slice.color}
                          className="donut-slice"
                        >
                          <title>{`${slice.categoryName}: ${formatToman(slice.amountMinor)} Toman (${slice.percentage}%)`}</title>
                        </path>
                      ))}
                      <circle cx="100" cy="100" r="46" className="donut-center-cutout" />
                    </svg>
                    <div className="donut-center-text">
                      <span className="donut-center-sub">Total</span>
                      <strong>{formatToman(report?.totalMinor ?? "0")}</strong>
                      <span className="donut-center-curr">Toman</span>
                    </div>
                  </div>

                  <div className="category-rank-list">
                    {report?.categoryBreakdown.map((cat) => (
                      <div key={cat.categoryId ?? cat.categoryName} className="category-rank-item">
                        <div className="category-rank-meta">
                          <span className="cat-color-dot" style={{ backgroundColor: cat.color }} />
                          <span className="category-rank-title">{cat.categoryName}</span>
                          <span className="category-rank-count">({cat.count})</span>
                          <span className="category-rank-amount">
                            {formatToman(cat.amountMinor)} Toman
                          </span>
                        </div>
                        <div className="category-progress-track">
                          <div
                            className="category-progress-fill"
                            style={{
                              width: `${cat.percentage}%`,
                              backgroundColor: cat.color,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="chart-empty">No category spending recorded in this period.</div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* MODAL 1: Add Expense (Amount in Toman) */}
      <Dialog open={expenseModalOpen} onOpenChange={setExpenseModalOpen}>
        <DialogContent className="ui-dialog-content">
          <form onSubmit={handleSaveExpense}>
            <DialogHeader>
              <DialogTitle>Record Expense</DialogTitle>
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
                {submitting ? "Saving..." : "Record Expense"}
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

      {/* MODAL 3: Delete Category Confirmation */}
      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="ui-dialog-content confirmation-dialog">
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the category &quot;{deleteTarget?.title}&quot;? Any
              expenses belonging to this category will be reassigned to &quot;Others&quot;.
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
