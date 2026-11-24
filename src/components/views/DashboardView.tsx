import { useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  CreditCard,
  Database,
  Plus,
  ShieldCheck,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import type {
  Bill,
  Budget,
  ExpenseEntry,
  IncomeEntry,
  Loan,
  NavSection,
  SavingsGoal,
  UserProfile,
} from '../../types/finance';
import {
  computeMonthlySeries,
  formatDateShort,
  formatINR,
  type FinancialSummary,
} from '../../utils/formatters';
import { CategoryDoughnutChart, IncomeExpenseBarChart } from '../Charts';

interface DashboardViewProps {
  summary: FinancialSummary;
  incomes: IncomeEntry[];
  expenses: ExpenseEntry[];
  budgets: Budget[];
  bills: Bill[];
  goals: SavingsGoal[];
  loans: Loan[];
  profile: UserProfile | null;
  onNavigate: (tab: NavSection) => void;
  onOpenAddExpense: () => void;
  onLoadSampleData: () => Promise<void>;
}

export function DashboardView({
  summary,
  incomes,
  expenses,
  bills,
  profile,
  onNavigate,
  onOpenAddExpense,
  onLoadSampleData,
}: DashboardViewProps) {
  const [seeding, setSeeding] = useState(false);

  const isEmpty = incomes.length === 0 && expenses.length === 0 && bills.length === 0;
  const monthlySeries = computeMonthlySeries(incomes, expenses, 6);
  const recentExpenses = [...expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  const upcomingBills = bills
    .filter((b) => b.status !== 'Paid')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 4);

  const dailyLimit = profile?.dailySpendLimit ?? 1500;
  const remainingDailyBudget = Math.max(0, dailyLimit - summary.dailySpending);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await onLoadSampleData();
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-8">
      {isEmpty && (
        <div className="bg-gradient-to-r from-[#1c1333] via-[#17112a] to-[#120e1f] border border-violet-500/30 rounded-2xl p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-white">Welcome to MoneyWise</h2>
            <p className="text-sm text-slate-300 max-w-2xl">
              Your workspace starts clean. Load realistic Indian Rupee sample records to explore charts, AI insights, and reports immediately, or record your first salary and expense.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleSeed}
              disabled={seeding}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60"
            >
              <Database className="w-4 h-4" />
              {seeding ? 'Loading Sample Data...' : 'Load Sample Data (₹)'}
            </button>
            <button
              type="button"
              onClick={onOpenAddExpense}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1f1936] hover:bg-[#2a2247] border border-violet-500/25 text-slate-100 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Log First Expense
            </button>
          </div>
        </div>
      )}

      {/* Primary KPI Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div
          onClick={() => onNavigate('income')}
          className="bg-[#131020] border border-violet-500/15 hover:border-violet-400/35 rounded-2xl p-5 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Total Monthly Income</span>
            <ArrowUpRight className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold font-mono tabular-nums text-white mt-2">
            {formatINR(summary.totalIncome)}
          </p>
          <p className="text-xs text-slate-400 mt-2 font-mono tabular-nums">
            Salary {formatINR(summary.monthlySalary)} · Extra {formatINR(summary.additionalIncome)}
          </p>
        </div>

        <div
          onClick={() => onNavigate('expenses')}
          className="bg-[#131020] border border-violet-500/15 hover:border-violet-400/35 rounded-2xl p-5 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Total Monthly Expenses</span>
            <ArrowDownRight className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-2xl font-bold font-mono tabular-nums text-white mt-2">
            {formatINR(summary.totalExpenses)}
          </p>
          <p className="text-xs text-slate-400 mt-2 font-mono tabular-nums">
            Fixed {formatINR(summary.fixedExpenses)} · Variable {formatINR(summary.variableExpenses)}
          </p>
        </div>

        <div
          onClick={() => onNavigate('savings')}
          className="bg-[#131020] border border-violet-500/15 hover:border-violet-400/35 rounded-2xl p-5 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Remaining Balance & Savings</span>
            <Wallet className="w-4 h-4 text-violet-400" />
          </div>
          <p
            className={`text-2xl font-bold font-mono tabular-nums mt-2 ${
              summary.remainingBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {formatINR(summary.remainingBalance)}
          </p>
          <p className="text-xs text-slate-400 mt-2 font-mono tabular-nums">
            Savings Rate {summary.savingsPercentage.toFixed(1)}% · Net {formatINR(summary.totalSavings)}
          </p>
        </div>

        <div
          onClick={() => onNavigate('reports')}
          className="bg-[#131020] border border-violet-500/15 hover:border-violet-400/35 rounded-2xl p-5 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Financial Health Score</span>
            <ShieldCheck className="w-4 h-4 text-violet-300" />
          </div>
          <p className="text-2xl font-bold font-mono tabular-nums text-white mt-2">
            {summary.healthScore.score}
            <span className="text-sm text-slate-400 font-normal"> / 100</span>
          </p>
          <p className="text-xs text-violet-300 mt-2">
            Status: {summary.healthScore.label}
          </p>
        </div>
      </section>

      {/* Spending Cadence & Daily Calculator Strip */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#110e1c] border border-violet-500/15 rounded-xl p-4">
          <p className="text-xs text-slate-400">Daily Spending (Today)</p>
          <p className="text-xl font-semibold font-mono tabular-nums text-white mt-1">
            {formatINR(summary.dailySpending)}
          </p>
          <p className="text-xs text-slate-400 mt-1 font-mono tabular-nums">
            Safe remaining today: {formatINR(remainingDailyBudget)}
          </p>
        </div>

        <div className="bg-[#110e1c] border border-violet-500/15 rounded-xl p-4">
          <p className="text-xs text-slate-400">Weekly Spending</p>
          <p className="text-xl font-semibold font-mono tabular-nums text-white mt-1">
            {formatINR(summary.weeklySpending)}
          </p>
          <p className="text-xs text-slate-400 mt-1 font-mono tabular-nums">
            Limit: {formatINR(profile?.weeklySpendLimit ?? 8000)}
          </p>
        </div>

        <div className="bg-[#110e1c] border border-violet-500/15 rounded-xl p-4">
          <p className="text-xs text-slate-400">Monthly Spending Avg / Day</p>
          <p className="text-xl font-semibold font-mono tabular-nums text-white mt-1">
            {formatINR(summary.dailyAverage)}
          </p>
          <p className="text-xs text-slate-400 mt-1 font-mono tabular-nums">
            Monthly cap: {formatINR(profile?.monthlySpendLimit ?? 35000)}
          </p>
        </div>

        <div
          onClick={() => onNavigate('rent-bills')}
          className="bg-[#110e1c] border border-violet-500/15 hover:border-violet-400/35 rounded-xl p-4 cursor-pointer transition-colors"
        >
          <p className="text-xs text-slate-400">Upcoming Unpaid Bills</p>
          <p className="text-xl font-semibold font-mono tabular-nums text-amber-300 mt-1">
            {formatINR(summary.upcomingBillsTotal)}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {summary.upcomingBillsCount} pending payment{summary.upcomingBillsCount === 1 ? '' : 's'}
          </p>
        </div>
      </section>

      {/* Main Charts Row */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-[#131020] border border-violet-500/15 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-white">Income vs Expenses (6 Months)</h3>
              <p className="text-xs text-slate-400">Monthly cashflow tracked in Indian Rupees</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('analytics')}
              className="text-xs font-medium text-violet-300 hover:text-violet-200 cursor-pointer"
            >
              Deep Analytics →
            </button>
          </div>
          <IncomeExpenseBarChart series={monthlySeries} height={270} />
        </div>

        <div className="lg:col-span-5 bg-[#131020] border border-violet-500/15 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-white">Category Spending Mix</h3>
              <p className="text-xs text-slate-400">
                {summary.topCategory
                  ? `Top: ${summary.topCategory.category} (${formatINR(summary.topCategory.amount)})`
                  : 'Current month breakdown'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('expenses')}
              className="text-xs font-medium text-violet-300 hover:text-violet-200 cursor-pointer"
            >
              All Expenses →
            </button>
          </div>
          <CategoryDoughnutChart dataMap={summary.categoryTotals} height={270} />
        </div>
      </section>

      {/* Budget Status + Upcoming Bills + Recent Transactions */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-[#131020] border border-violet-500/15 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-white">Budget Status</h3>
            <button
              type="button"
              onClick={() => onNavigate('budgets')}
              className="text-xs font-medium text-violet-300 hover:text-violet-200 cursor-pointer"
            >
              Manage Budgets →
            </button>
          </div>

          {summary.budgetStatuses.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">
              No category budgets set yet. Create budgets to unlock 75%, 90%, and 100% alerts.
            </p>
          ) : (
            <div className="space-y-4">
              {summary.budgetStatuses.slice(0, 5).map(({ budget, spent, pct, level }) => {
                const barColor =
                  level === 'exceeded100'
                    ? 'bg-rose-500'
                    : level === 'critical90'
                    ? 'bg-amber-500'
                    : level === 'warning75'
                    ? 'bg-amber-400'
                    : 'bg-violet-500';
                const statusLabel =
                  level === 'exceeded100'
                    ? 'Exceeded'
                    : level === 'critical90'
                    ? '90%+ Alert'
                    : level === 'warning75'
                    ? '75%+ Warning'
                    : 'On Track';

                return (
                  <div key={budget.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-200">
                        {budget.category} · <span className="text-slate-400">{statusLabel}</span>
                      </span>
                      <span className="font-mono tabular-nums text-slate-300">
                        {formatINR(spent)} / {formatINR(budget.limitAmount)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-[#1d1831] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${barColor}`}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="lg:col-span-7 bg-[#131020] border border-violet-500/15 rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-white">Recent Expenses</h3>
            <button
              type="button"
              onClick={onOpenAddExpense}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-violet-200 text-xs font-medium cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Expense
            </button>
          </div>

          {recentExpenses.length === 0 ? (
            <p className="text-sm text-slate-400 py-4">No expenses logged yet.</p>
          ) : (
            <div className="divide-y divide-violet-500/10">
              {recentExpenses.map((exp) => (
                <div key={exp.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{exp.name}</p>
                    <p className="text-xs text-slate-400 truncate">
                      {exp.category} · {formatDateShort(exp.date)} · {exp.paymentMethod}
                      {exp.isUnnecessary ? ' · Avoidable' : ''}
                    </p>
                  </div>
                  <span className="text-sm font-mono tabular-nums font-semibold text-rose-300 shrink-0">
                    -{formatINR(exp.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {upcomingBills.length > 0 && (
            <div className="pt-4 border-t border-violet-500/15">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                  <CalendarClock className="w-3.5 h-3.5 text-amber-400" />
                  Next Due Bills
                </span>
                <button
                  type="button"
                  onClick={() => onNavigate('rent-bills')}
                  className="text-xs text-violet-300 hover:text-violet-200 cursor-pointer"
                >
                  Pay Bills →
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {upcomingBills.map((bill) => (
                  <div
                    key={bill.id}
                    className="p-3 rounded-xl bg-[#0e0b18] border border-violet-500/15 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-white truncate">{bill.title}</p>
                      <p className="text-[11px] text-slate-400">Due {formatDateShort(bill.dueDate)}</p>
                    </div>
                    <span className="text-xs font-mono tabular-nums text-amber-300 shrink-0">
                      {formatINR(bill.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Quick Action Bar */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          type="button"
          onClick={() => onNavigate('assistant')}
          className="p-4 rounded-xl bg-[#131020] border border-violet-500/20 hover:border-violet-400/40 text-left transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-white">Ask AI Money Assistant</span>
            <TrendingUp className="w-4 h-4 text-violet-400" />
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Find wasteful spending & get personalized savings targets from your real records.
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('rent-bills')}
          className="p-4 rounded-xl bg-[#131020] border border-violet-500/20 hover:border-violet-400/40 text-left transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-white">Rent, EMIs & Subscriptions</span>
            <CreditCard className="w-4 h-4 text-violet-400" />
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Log monthly recurring bills once without duplicate charges.
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('reports')}
          className="p-4 rounded-xl bg-[#131020] border border-violet-500/20 hover:border-violet-400/40 text-left transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-white">Export PDF / Excel Report</span>
            <Wallet className="w-4 h-4 text-violet-400" />
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Generate weekly, monthly, or yearly INR financial statements.
          </p>
        </button>
      </section>
    </div>
  );
}
