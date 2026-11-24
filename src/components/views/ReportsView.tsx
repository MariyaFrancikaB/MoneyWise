import { useMemo, useState } from 'react';
import { Download, FileSpreadsheet, ShieldCheck } from 'lucide-react';
import type {
  Budget,
  ExpenseEntry,
  IncomeEntry,
  Loan,
  SavingsGoal,
  UserProfile,
} from '../../types/finance';
import {
  computeFinancialSummary,
  currentMonthKey,
  formatINR,
  formatMonthLabel,
  getStartOfWeekISO,
  shiftMonthKey,
  todayISO,
} from '../../utils/formatters';
import { exportReportToExcel, exportReportToPDF } from '../../utils/reportExport';

interface ReportsViewProps {
  incomes: IncomeEntry[];
  expenses: ExpenseEntry[];
  budgets: Budget[];
  goals: SavingsGoal[];
  loans: Loan[];
  profile: UserProfile | null;
}

type ReportScope = 'weekly' | 'monthly' | 'yearly';

export function ReportsView({ incomes, expenses, budgets, goals, loans, profile }: ReportsViewProps) {
  const [scope, setScope] = useState<ReportScope>('monthly');
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey());
  const [selectedYear, setSelectedYear] = useState(todayISO().slice(0, 4));

  const monthOptions = useMemo(() => {
    const cur = currentMonthKey();
    return Array.from({ length: 12 }, (_, idx) => shiftMonthKey(cur, -idx));
  }, []);

  const reportData = useMemo(() => {
    const today = todayISO();
    const weekStart = getStartOfWeekISO();

    let scopedIncomes = incomes;
    let scopedExpenses = expenses;
    let periodLabel = formatMonthLabel(selectedMonth);

    if (scope === 'weekly') {
      scopedIncomes = incomes.filter((i) => i.date >= weekStart && i.date <= today);
      scopedExpenses = expenses.filter((e) => e.date >= weekStart && e.date <= today);
      periodLabel = `Weekly (${weekStart} to ${today})`;
    } else if (scope === 'monthly') {
      scopedIncomes = incomes.filter((i) => i.date.startsWith(selectedMonth));
      scopedExpenses = expenses.filter((e) => e.date.startsWith(selectedMonth));
      periodLabel = formatMonthLabel(selectedMonth);
    } else {
      scopedIncomes = incomes.filter((i) => i.date.startsWith(selectedYear));
      scopedExpenses = expenses.filter((e) => e.date.startsWith(selectedYear));
      periodLabel = `Year ${selectedYear}`;
    }

    const monthlySummary = computeFinancialSummary({
      incomes,
      expenses,
      budgets,
      bills: [],
      goals,
      loans,
      profile,
      monthKey: scope === 'monthly' ? selectedMonth : currentMonthKey(),
    });

    const totalIncome = scopedIncomes.reduce((s, i) => s + i.amount, 0);
    const salaryIncome = scopedIncomes
      .filter((i) => i.category === 'Monthly Salary')
      .reduce((s, i) => s + i.amount, 0);
    const additionalIncome = totalIncome - salaryIncome;
    const totalExpenses = scopedExpenses.reduce((s, e) => s + e.amount, 0);
    const totalSavings = totalIncome - totalExpenses;
    const savingsPct = totalIncome > 0 ? (totalSavings / totalIncome) * 100 : 0;

    const categoryMap: Record<string, number> = {};
    for (const e of scopedExpenses) {
      categoryMap[e.category] = (categoryMap[e.category] ?? 0) + e.amount;
    }
    const categoryRows = Object.entries(categoryMap).sort((a, b) => b[1] - a[1]);

    return {
      periodLabel,
      scopedIncomes,
      scopedExpenses,
      salaryIncome,
      additionalIncome,
      totalIncome,
      totalExpenses,
      totalSavings,
      savingsPct,
      categoryRows,
      summary: {
        ...monthlySummary,
        monthlySalary: salaryIncome,
        additionalIncome,
        totalIncome,
        totalExpenses,
        remainingBalance: totalSavings,
        totalSavings,
        savingsPercentage: savingsPct,
        categoryTotals: categoryMap,
      },
    };
  }, [scope, selectedMonth, selectedYear, incomes, expenses, budgets, goals, loans, profile]);

  return (
    <div className="space-y-6">
      {/* Controls & Exports */}
      <div className="bg-[#131020] border border-violet-500/15 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-[#0b0914] border border-violet-500/15 rounded-xl">
            {(['weekly', 'monthly', 'yearly'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScope(s)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium capitalize cursor-pointer ${
                  scope === s ? 'bg-violet-600 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {scope === 'monthly' && (
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[#0b0914] border border-violet-500/20 text-xs text-white"
            >
              {monthOptions.map((m) => (
                <option key={m} value={m}>
                  {formatMonthLabel(m)}
                </option>
              ))}
            </select>
          )}

          {scope === 'yearly' && (
            <input
              type="number"
              min="2020"
              max="2035"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-24 px-3 py-2 rounded-xl bg-[#0b0914] border border-violet-500/20 text-xs font-mono text-white"
            />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() =>
              exportReportToPDF({
                periodLabel: reportData.periodLabel,
                userName: profile?.displayName || 'MoneyWise User',
                summary: reportData.summary,
                incomes: reportData.scopedIncomes,
                expenses: reportData.scopedExpenses,
                goals,
                loans,
              })
            }
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium cursor-pointer whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            Download PDF Report
          </button>

          <button
            type="button"
            onClick={() =>
              exportReportToExcel({
                periodLabel: reportData.periodLabel,
                summary: reportData.summary,
                incomes: reportData.scopedIncomes,
                expenses: reportData.scopedExpenses,
                budgets,
                goals,
                loans,
              })
            }
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1c1630] hover:bg-[#271f42] border border-violet-500/25 text-slate-100 text-xs font-medium cursor-pointer whitespace-nowrap"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            Download Excel (.xlsx)
          </button>
        </div>
      </div>

      {/* Executive Summary Statement */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-[#131020] border border-violet-500/15 rounded-2xl p-6 space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Financial Statement — {reportData.periodLabel}
            </h2>
            <p className="text-xs text-slate-400">Complete breakdown of income, spending, and savings rate</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-[#0b0914] border border-violet-500/10">
              <p className="text-[11px] text-slate-400">Total Income</p>
              <p className="text-lg font-bold font-mono tabular-nums text-emerald-400 mt-1">
                {formatINR(reportData.totalIncome)}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-[#0b0914] border border-violet-500/10">
              <p className="text-[11px] text-slate-400">Total Expenses</p>
              <p className="text-lg font-bold font-mono tabular-nums text-rose-300 mt-1">
                {formatINR(reportData.totalExpenses)}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-[#0b0914] border border-violet-500/10">
              <p className="text-[11px] text-slate-400">Total Savings</p>
              <p className="text-lg font-bold font-mono tabular-nums text-white mt-1">
                {formatINR(reportData.totalSavings)}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-[#0b0914] border border-violet-500/10">
              <p className="text-[11px] text-slate-400">Savings Percentage</p>
              <p className="text-lg font-bold font-mono tabular-nums text-violet-300 mt-1">
                {reportData.savingsPct.toFixed(2)}%
              </p>
            </div>
          </div>

          {scope === 'monthly' && reportData.summary.prevMonthExpenses > 0 && (
            <div className="p-4 rounded-xl bg-[#0e0b18] border border-violet-500/15 text-xs text-slate-300">
              Compared to previous month ({formatINR(reportData.summary.prevMonthExpenses)} spent), your expenses changed by{' '}
              <span
                className={`font-mono font-semibold ${
                  reportData.summary.expenseChangePct > 0 ? 'text-rose-300' : 'text-emerald-400'
                }`}
              >
                {reportData.summary.expenseChangePct >= 0 ? '+' : ''}
                {reportData.summary.expenseChangePct.toFixed(1)}%
              </span>
              .
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold text-white mb-3">Where Your Money Was Spent</h3>
            {reportData.categoryRows.length === 0 ? (
              <p className="text-sm text-slate-400 py-6 text-center">No expenses recorded in this reporting window.</p>
            ) : (
              <div className="divide-y divide-violet-500/10">
                {reportData.categoryRows.map(([cat, amt]) => {
                  const share = reportData.totalExpenses > 0 ? (amt / reportData.totalExpenses) * 100 : 0;
                  return (
                    <div key={cat} className="py-2.5 flex items-center justify-between text-sm">
                      <span className="text-slate-200">{cat}</span>
                      <div className="flex items-center gap-4 font-mono tabular-nums">
                        <span className="text-xs text-slate-400">{share.toFixed(1)}%</span>
                        <span className="font-semibold text-white w-28 text-right">{formatINR(amt)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Financial Health Score Breakdown */}
        <div className="lg:col-span-4 bg-[#131020] border border-violet-500/15 rounded-2xl p-6 space-y-4 h-fit">
          <div className="flex items-center gap-2 text-violet-300">
            <ShieldCheck className="w-5 h-5" />
            <h3 className="text-base font-semibold text-white">Financial Health Score</h3>
          </div>
          <div className="p-5 rounded-xl bg-[#0b0914] border border-violet-500/15 text-center">
            <p className="text-4xl font-bold font-mono tabular-nums text-white">
              {reportData.summary.healthScore.score}
              <span className="text-base text-slate-500 font-normal"> / 100</span>
            </p>
            <p className="text-xs text-violet-300 mt-1">{reportData.summary.healthScore.label}</p>
          </div>
          <div className="space-y-3 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Savings Rate Score (max 35)</span>
              <span className="font-mono text-white">{reportData.summary.healthScore.savingsScore}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Budget Adherence Score (max 25)</span>
              <span className="font-mono text-white">{reportData.summary.healthScore.budgetScore}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Emergency Buffer Score (max 20)</span>
              <span className="font-mono text-white">{reportData.summary.healthScore.emergencyScore}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">EMI / Debt Load Score (max 20)</span>
              <span className="font-mono text-white">{reportData.summary.healthScore.debtScore}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
