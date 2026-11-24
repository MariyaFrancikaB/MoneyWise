import { useMemo, useState } from 'react';
import type { ExpenseEntry, IncomeEntry } from '../../types/finance';
import {
  computeMonthlySeries,
  currentMonthKey,
  formatINR,
  getStartOfWeekISO,
  shiftMonthKey,
  todayISO,
} from '../../utils/formatters';
import {
  CategoryBarChart,
  CategoryDoughnutChart,
  IncomeExpenseBarChart,
  SavingsLineChart,
} from '../Charts';

interface AnalyticsViewProps {
  incomes: IncomeEntry[];
  expenses: ExpenseEntry[];
}

export function AnalyticsView({ incomes, expenses }: AnalyticsViewProps) {
  const mKey = currentMonthKey();
  const [startDate, setStartDate] = useState(`${mKey}-01`);
  const [endDate, setEndDate] = useState(todayISO());

  const applyPreset = (preset: 'week' | 'month' | 'quarter' | 'year') => {
    const today = todayISO();
    setEndDate(today);
    if (preset === 'week') {
      setStartDate(getStartOfWeekISO());
    } else if (preset === 'month') {
      setStartDate(`${currentMonthKey()}-01`);
    } else if (preset === 'quarter') {
      setStartDate(`${shiftMonthKey(currentMonthKey(), -2)}-01`);
    } else {
      setStartDate(`${today.slice(0, 4)}-01-01`);
    }
  };

  const analytics = useMemo(() => {
    const rangeInc = incomes.filter((i) => i.date >= startDate && i.date <= endDate);
    const rangeExp = expenses.filter((e) => e.date >= startDate && e.date <= endDate);

    const totalIncome = rangeInc.reduce((s, i) => s + i.amount, 0);
    const totalExpenses = rangeExp.reduce((s, e) => s + e.amount, 0);
    const totalSavings = totalIncome - totalExpenses;
    const savingsPct = totalIncome > 0 ? (totalSavings / totalIncome) * 100 : 0;

    const fixedExpenses = rangeExp.filter((e) => e.isFixed).reduce((s, e) => s + e.amount, 0);
    const variableExpenses = totalExpenses - fixedExpenses;
    const unnecessaryExpenses = rangeExp.filter((e) => e.isUnnecessary).reduce((s, e) => s + e.amount, 0);

    const sDate = new Date(startDate + 'T00:00:00');
    const eDate = new Date(endDate + 'T00:00:00');
    const daySpan = Math.max(1, Math.round((eDate.getTime() - sDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    const dailyAverage = totalExpenses / daySpan;

    // Previous equal-length window comparison
    const prevEnd = new Date(sDate.getTime() - 24 * 60 * 60 * 1000);
    const prevStart = new Date(prevEnd.getTime() - (daySpan - 1) * 24 * 60 * 60 * 1000);
    const prevStartStr = prevStart.toISOString().slice(0, 10);
    const prevEndStr = prevEnd.toISOString().slice(0, 10);
    const prevExpenses = expenses
      .filter((e) => e.date >= prevStartStr && e.date <= prevEndStr)
      .reduce((s, e) => s + e.amount, 0);
    const prevDeltaPct = prevExpenses > 0 ? ((totalExpenses - prevExpenses) / prevExpenses) * 100 : 0;

    const categoryTotals: Record<string, number> = {};
    for (const exp of rangeExp) {
      categoryTotals[exp.category] = (categoryTotals[exp.category] ?? 0) + exp.amount;
    }

    let highestCategory: { name: string; amount: number } | null = null;
    for (const [name, amount] of Object.entries(categoryTotals)) {
      if (!highestCategory || amount > highestCategory.amount) {
        highestCategory = { name, amount };
      }
    }

    return {
      totalIncome,
      totalExpenses,
      totalSavings,
      savingsPct,
      fixedExpenses,
      variableExpenses,
      unnecessaryExpenses,
      dailyAverage,
      prevExpenses,
      prevDeltaPct,
      categoryTotals,
      highestCategory,
    };
  }, [incomes, expenses, startDate, endDate]);

  const monthlySeries = useMemo(() => computeMonthlySeries(incomes, expenses, 6), [incomes, expenses]);

  return (
    <div className="space-y-6">
      {/* Custom Date Range & Presets */}
      <div className="bg-[#131020] border border-violet-500/15 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-[#0b0914] border border-violet-500/15 rounded-xl w-fit">
          {(
            [
              ['week', 'This Week'],
              ['month', 'This Month'],
              ['quarter', 'Last 3 Months'],
              ['year', 'This Year'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => applyPreset(key)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-violet-600/25 transition-colors cursor-pointer whitespace-nowrap"
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>From</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[#0b0914] border border-violet-500/20 text-xs font-mono text-white"
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>To</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[#0b0914] border border-violet-500/20 text-xs font-mono text-white"
            />
          </div>
        </div>
      </div>

      {/* Key Analytical Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#131020] border border-violet-500/15 rounded-xl p-5">
          <p className="text-xs text-slate-400">Period Income vs Expenses</p>
          <p className="text-xl font-bold font-mono tabular-nums text-white mt-1.5">
            {formatINR(analytics.totalIncome)} <span className="text-slate-500">/</span>{' '}
            <span className="text-rose-300">{formatINR(analytics.totalExpenses)}</span>
          </p>
          <p className="text-xs text-slate-400 mt-1.5 font-mono tabular-nums">
            Net Savings: {formatINR(analytics.totalSavings)} ({analytics.savingsPct.toFixed(1)}%)
          </p>
        </div>

        <div className="bg-[#131020] border border-violet-500/15 rounded-xl p-5">
          <p className="text-xs text-slate-400">Highest Spending Category</p>
          <p className="text-xl font-bold text-white mt-1.5 truncate">
            {analytics.highestCategory ? analytics.highestCategory.name : 'None'}
          </p>
          <p className="text-xs text-violet-300 mt-1.5 font-mono tabular-nums">
            {analytics.highestCategory ? formatINR(analytics.highestCategory.amount) : '₹0'}
          </p>
        </div>

        <div className="bg-[#131020] border border-violet-500/15 rounded-xl p-5">
          <p className="text-xs text-slate-400">Avoidable / Unnecessary Spend</p>
          <p className="text-xl font-bold font-mono tabular-nums text-amber-300 mt-1.5">
            {formatINR(analytics.unnecessaryExpenses)}
          </p>
          <p className="text-xs text-slate-400 mt-1.5 font-mono tabular-nums">
            Fixed {formatINR(analytics.fixedExpenses)} · Variable {formatINR(analytics.variableExpenses)}
          </p>
        </div>

        <div className="bg-[#131020] border border-violet-500/15 rounded-xl p-5">
          <p className="text-xs text-slate-400">Daily Avg & Period Comparison</p>
          <p className="text-xl font-bold font-mono tabular-nums text-white mt-1.5">
            {formatINR(analytics.dailyAverage)} <span className="text-xs text-slate-400 font-normal">/ day</span>
          </p>
          <p className="text-xs text-slate-400 mt-1.5 font-mono tabular-nums">
            {analytics.prevExpenses > 0
              ? `${analytics.prevDeltaPct >= 0 ? '+' : ''}${analytics.prevDeltaPct.toFixed(1)}% vs prior period`
              : 'No prior period baseline'}
          </p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#131020] border border-violet-500/15 rounded-2xl p-6">
          <h3 className="text-base font-semibold text-white mb-1">Category Spending Distribution</h3>
          <p className="text-xs text-slate-400 mb-4">Selected date range breakdown</p>
          <CategoryDoughnutChart dataMap={analytics.categoryTotals} height={270} />
        </div>

        <div className="bg-[#131020] border border-violet-500/15 rounded-2xl p-6">
          <h3 className="text-base font-semibold text-white mb-1">Top Categories Comparison</h3>
          <p className="text-xs text-slate-400 mb-4">Ranked by total INR spent</p>
          <CategoryBarChart dataMap={analytics.categoryTotals} height={270} />
        </div>

        <div className="bg-[#131020] border border-violet-500/15 rounded-2xl p-6">
          <h3 className="text-base font-semibold text-white mb-1">Income vs Expense Trend</h3>
          <p className="text-xs text-slate-400 mb-4">6-month cashflow trajectory</p>
          <IncomeExpenseBarChart series={monthlySeries} height={270} />
        </div>

        <div className="bg-[#131020] border border-violet-500/15 rounded-2xl p-6">
          <h3 className="text-base font-semibold text-white mb-1">Monthly Net Savings Growth</h3>
          <p className="text-xs text-slate-400 mb-4">Monthly surplus retained after expenses</p>
          <SavingsLineChart
            series={monthlySeries.map((m) => ({ label: m.label, value: m.savings }))}
            height={270}
          />
        </div>
      </div>
    </div>
  );
}
