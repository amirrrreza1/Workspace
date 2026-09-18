"use client";

import {
  ArrowDownRight,
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
  Receipt,
  Search,
  Settings2,
  Trash2,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  useToast,
} from "@reminder/ui";
import type {
  CalendarSystem,
  Expense,
  ExpenseCategory,
  ExpensePeriodType,
  ExpenseReportSummary,
  RegularExpenseItem,
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

// Helper to format IRR amounts nicely
export function formatIRR(minor: string | number | bigint): string {
  const num = typeof minor === "bigint" ? minor : BigInt(String(minor || "0"));
  return num.toLocaleString("en-US");
}

export function formatToman(minor: string | number | bigint): string {
  const num = typeof minor === "bigint" ? minor : BigInt(String(minor || "0"));
  const toman = num / 10n;
  return toman.toLocaleString("en-US");
}

export function ExpensesDashboard() {
  const { toast } = useToast();

  // Data state
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [regularItems, setRegularItems] = useState<RegularExpenseItem[]>([]);
  const [report, setReport] = useState<ExpenseReportSummary | null>(null);

  // Filter & Navigation state
  const [period, setPeriod] = useState<ExpensePeriodType>("week");
  const [refDate, setRefDate] = useState<Date>(new Date());
  const [calendarSystem, setCalendarSystem] = useState<CalendarSystem>("jalali");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Loading state
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Active chart hover state
  const [hoveredDayIndex, setHoveredDayIndex] = useState<number | null>(null);

  // Modals
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [expenseTitle, setExpenseTitle] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseCategoryId, setExpenseCategoryId] = useState("");
  const [expenseSpentAt, setExpenseSpentAt] = useState("");
  const [expenseNote, setExpenseNote] = useState("");

  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState(COLOR_PALETTE[0]!);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);

  const [regularItemModalOpen, setRegularItemModalOpen] = useState(false);
  const [newPresetTitle, setNewPresetTitle] = useState("");
  const [newPresetAmount, setNewPresetAmount] = useState("");
  const [newPresetCategoryId, setNewPresetCategoryId] = useState("");
  const [editingPreset, setEditingPreset] = useState<RegularExpenseItem | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<{
    type: "expense" | "category" | "regularItem";
    id: string;
    title: string;
  } | null>(null);

  // 1. Load initial categories & regular items
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

  // 2. Load report data
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

  // 3. Load expenses list
  const loadExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set("q", searchQuery.trim());
      if (categoryFilter && categoryFilter !== "all") params.set("categoryId", categoryFilter);
      params.set("limit", "100");

      const res = await fetch(`/api/v1/expenses?${params.toString()}`);
      if (res.ok) {
        const data: { items: Expense[]; totalCount: number; totalAmountMinor: string } =
          await res.json();
        setExpenses(data.items);
        setTotalCount(data.totalCount);
      }
    } catch {
      toast("Failed to load expenses list.", "error");
    } finally {
      setLoading(false);
    }
  }, [searchQuery, categoryFilter, toast]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

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

      toast(
        `Added ${item.title} (${formatIRR(item.amountMinor)} IRR / ${formatToman(item.amountMinor)} Toman)`,
        "success",
      );
      loadExpenses();
      loadReport();
    } catch {
      toast(`Failed to record ${item.title}.`, "error");
    }
  };

  // Save Expense (Add or Edit)
  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseTitle.trim()) {
      toast("Title cannot be empty.", "error");
      return;
    }
    const cleanAmount = expenseAmount.trim().replaceAll(",", "").replaceAll(" ", "");
    if (!cleanAmount || !/^\d+$/.test(cleanAmount)) {
      toast("Please enter a valid IRR amount (numbers only).", "error");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title: expenseTitle.trim(),
        amountMinor: cleanAmount,
        currency: "IRR" as const,
        categoryId: expenseCategoryId || null,
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
      loadReport();
    } catch {
      toast("Failed to save expense.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const openAddExpenseModal = (preset?: Partial<RegularExpenseItem>) => {
    setEditingExpense(null);
    setExpenseTitle(preset?.title ?? "");
    setExpenseAmount(preset?.amountMinor ?? "");
    setExpenseCategoryId(preset?.categoryId ?? categories[0]?.id ?? "");
    // Default to current local time in YYYY-MM-DDTHH:mm
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
    setExpenseAmount(exp.amountMinor);
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
      loadReport();
    } catch {
      toast("Failed to save category.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Save Regular Item Preset
  const handleSavePreset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPresetTitle.trim()) {
      toast("Title cannot be empty.", "error");
      return;
    }
    const cleanAmount = newPresetAmount.trim().replaceAll(",", "").replaceAll(" ", "");
    if (!cleanAmount || !/^\d+$/.test(cleanAmount)) {
      toast("Please enter a valid IRR amount.", "error");
      return;
    }

    setSubmitting(true);
    try {
      if (editingPreset) {
        const res = await fetch(`/api/v1/expenses/regular-items/${editingPreset.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: newPresetTitle.trim(),
            amountMinor: cleanAmount,
            categoryId: newPresetCategoryId || null,
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
            amountMinor: cleanAmount,
            categoryId: newPresetCategoryId || null,
            currency: "IRR",
          }),
        });
        if (!res.ok) throw new Error();
        toast("Preset created!", "success");
      }
      setNewPresetTitle("");
      setNewPresetAmount("");
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
        loadReport();
      } else if (deleteTarget.type === "category") {
        await fetch(`/api/v1/expenses/categories/${deleteTarget.id}`, { method: "DELETE" });
        toast("Category deleted and items moved to Others.", "success");
        loadMeta();
        loadExpenses();
        loadReport();
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

      // Calculate SVG arc path
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
      {/* 1. Header & Hero */}
      <header className="expenses-header">
        <div className="expenses-header-title">
          <div className="expenses-icon-badge">
            <Wallet size={24} />
          </div>
          <div>
            <h1>Financial Expenses</h1>
            <p>
              Track your spending, manage regular expenses, and review weekly & monthly reports in
              IRR.
            </p>
          </div>
        </div>

        <div className="expenses-header-actions">
          <Button variant="secondary" onClick={() => setCategoryModalOpen(true)}>
            <Layers size={16} />
            <span>Manage Categories</span>
          </Button>

          <Button variant="primary" onClick={() => openAddExpenseModal()}>
            <Plus size={16} />
            <span>Add Expense</span>
          </Button>
        </div>
      </header>

      {/* 2. Fast-Add Regular Items Bar */}
      <section className="expenses-quick-bar" aria-label="Regular Items Quick Add">
        <div className="expenses-quick-bar-header">
          <div className="expenses-quick-bar-label">
            <Zap size={16} className="text-accent" />
            <span>Quick Add Regular Items</span>
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
                title={`Click to quickly add ${item.title} (${formatIRR(item.amountMinor)} IRR)`}
              >
                <span
                  className="quick-chip-dot"
                  style={{ backgroundColor: item.categoryColor || "#64748b" }}
                />
                <span className="quick-chip-title">+{item.title}</span>
                <span className="quick-chip-price">{formatIRR(item.amountMinor)} IRR</span>
                <span className="quick-chip-toman">({formatToman(item.amountMinor)} T)</span>
              </button>
            ))
          )}
        </div>
      </section>

      {/* 3. Metrics Summary Cards */}
      <section className="summary-grid expenses-summary-grid">
        <div className="summary-card">
          <span className="type-label">
            {period === "week" ? "This Week's Spending" : "This Month's Spending"}
          </span>
          <strong>{formatIRR(report?.totalMinor ?? "0")} IRR</strong>
          <div className="expenses-metric-sub">
            <span>{formatToman(report?.totalMinor ?? "0")} Toman</span>
            {report?.changePercentage !== null && report?.changePercentage !== undefined && (
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
            )}
          </div>
        </div>

        <div className="summary-card">
          <span className="type-label">Daily Average</span>
          <strong>{formatIRR(report?.dailyAverageMinor ?? "0")} IRR</strong>
          <div className="expenses-metric-sub">
            <span>{formatToman(report?.dailyAverageMinor ?? "0")} Toman / day</span>
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
                <span>{formatIRR(report.highestCategory.amountMinor)} IRR</span>
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

      {/* 4. Reporting & Interactive Charts Section */}
      <section className="expenses-analytics-card">
        <div className="analytics-toolbar">
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

          <div className="analytics-period-toggle">
            <button
              type="button"
              className={`period-toggle-btn ${calendarSystem === "jalali" ? "period-toggle-btn--active" : ""}`}
              onClick={() => setCalendarSystem("jalali")}
            >
              <span>Jalali</span>
            </button>
            <button
              type="button"
              className={`period-toggle-btn ${calendarSystem === "gregorian" ? "period-toggle-btn--active" : ""}`}
              onClick={() => setCalendarSystem("gregorian")}
            >
              <span>Gregorian</span>
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
                                <strong>{formatIRR(item.amountMinor)} IRR</strong>
                                <span>{formatToman(item.amountMinor)} Toman</span>
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

            {/* Category Breakdown Donut & Rank */}
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
                          <title>{`${slice.categoryName}: ${formatIRR(slice.amountMinor)} IRR (${slice.percentage}%)`}</title>
                        </path>
                      ))}
                      {/* Center hole cutout for donut effect */}
                      <circle cx="100" cy="100" r="46" className="donut-center-cutout" />
                    </svg>
                    <div className="donut-center-text">
                      <span className="donut-center-sub">Total</span>
                      <strong>{formatIRR(report?.totalMinor ?? "0")}</strong>
                      <span className="donut-center-curr">IRR</span>
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
                            {formatIRR(cat.amountMinor)} IRR
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

      {/* 5. Expense Transactions History */}
      <section className="expenses-history-section">
        <div className="expenses-history-header">
          <h2>Expenses History{totalCount > 0 ? ` (${totalCount})` : ""}</h2>

          <div className="expenses-filter-bar">
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

            <div className="expenses-category-select-wrapper">
              <select
                className="expenses-select"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="expenses-table-loading">
            <LoaderCircle size={24} className="spin" />
            <span>Loading expenses...</span>
          </div>
        ) : expenses.length === 0 ? (
          <div className="empty-state expenses-empty-state">
            <Receipt size={36} />
            <h2>No expenses found</h2>
            <p>
              {searchQuery || categoryFilter !== "all"
                ? "No transactions match your search filters."
                : 'You have not recorded any expenses yet. Click "Add Expense" or use a Quick Add item above.'}
            </p>
            <Button variant="primary" onClick={() => openAddExpenseModal()}>
              <Plus size={16} />
              <span>Add Your First Expense</span>
            </Button>
          </div>
        ) : (
          <div className="expenses-table-card">
            <table className="expenses-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Title</th>
                  <th>Date & Time</th>
                  <th className="text-right">Amount (IRR)</th>
                  <th className="text-right">Toman</th>
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
                      {new Date(exp.spentAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="text-right expense-amount-cell">
                      <strong>{formatIRR(exp.amountMinor)}</strong>
                    </td>
                    <td className="text-right expense-toman-cell">
                      {formatToman(exp.amountMinor)} T
                    </td>
                    <td className="text-right">
                      <div className="expense-action-buttons">
                        <button
                          type="button"
                          className="expense-action-btn"
                          title="Edit expense"
                          onClick={() => openEditExpenseModal(exp)}
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          type="button"
                          className="expense-action-btn expense-action-btn--delete"
                          title="Delete expense"
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
        )}
      </section>

      {/* MODAL 1: Add/Edit Expense */}
      <Dialog open={expenseModalOpen} onOpenChange={setExpenseModalOpen}>
        <DialogContent className="ui-dialog-content">
          <form onSubmit={handleSaveExpense}>
            <DialogHeader>
              <DialogTitle>{editingExpense ? "Edit Expense" : "Record Expense"}</DialogTitle>
              <DialogDescription>
                Enter the details of your financial transaction in IRR.
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
                <label htmlFor="exp-amount">Amount (in IRR)</label>
                <div className="amount-input-group">
                  <input
                    id="exp-amount"
                    type="text"
                    inputMode="numeric"
                    placeholder="e.g. 500000"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    required
                  />
                  <span className="amount-currency-tag">IRR</span>
                </div>
                {expenseAmount && /^\d+$/.test(expenseAmount) && (
                  <small className="amount-toman-preview">
                    = {formatToman(expenseAmount)} Iranian Toman
                  </small>
                )}
              </div>

              <div className="field">
                <label htmlFor="exp-category">Category</label>
                <select
                  id="exp-category"
                  className="expenses-select"
                  value={expenseCategoryId}
                  onChange={(e) => setExpenseCategoryId(e.target.value)}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
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

          {/* Form to add or edit */}
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

          {/* Existing categories list */}
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

      {/* MODAL 3: Manage Regular Items / Presets */}
      <Dialog open={regularItemModalOpen} onOpenChange={setRegularItemModalOpen}>
        <DialogContent className="ui-dialog-content">
          <DialogHeader>
            <DialogTitle>Manage Quick-Add Presets</DialogTitle>
            <DialogDescription>
              Configure regular items like Water or Gasoline with pre-set IRR amounts for 1-click
              recording.
            </DialogDescription>
          </DialogHeader>

          {/* Form to add or edit preset */}
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
                <label htmlFor="preset-amount">Amount (IRR)</label>
                <input
                  id="preset-amount"
                  type="text"
                  inputMode="numeric"
                  placeholder="e.g. 600000"
                  value={newPresetAmount}
                  onChange={(e) => setNewPresetAmount(e.target.value)}
                  required
                />
                {newPresetAmount && /^\d+$/.test(newPresetAmount) && (
                  <small className="amount-toman-preview">
                    = {formatToman(newPresetAmount)} Toman
                  </small>
                )}
              </div>

              <div className="field">
                <label htmlFor="preset-category">Category</label>
                <select
                  id="preset-category"
                  className="expenses-select"
                  value={newPresetCategoryId}
                  onChange={(e) => setNewPresetCategoryId(e.target.value)}
                >
                  <option value="">No Category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
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
                    setNewPresetAmount("");
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
          </form>

          {/* Existing Presets List */}
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
                    <span className="preset-row-price">{formatIRR(item.amountMinor)} IRR</span>
                    <span className="preset-row-toman">({formatToman(item.amountMinor)} T)</span>
                  </div>
                  <div className="category-manage-actions">
                    <button
                      type="button"
                      className="expense-action-btn"
                      title="Edit preset"
                      onClick={() => {
                        setEditingPreset(item);
                        setNewPresetTitle(item.title);
                        setNewPresetAmount(item.amountMinor);
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
