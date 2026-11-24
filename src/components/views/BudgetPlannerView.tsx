import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Flame, Plus, Save, Trash2 } from 'lucide-react';
import { EXPENSE_CATEGORIES, type Budget, type UserProfile } from '../../types/finance';
import { currentMonthKey, formatINR, type FinancialSummary } from '../../utils/formatters';

interface BudgetPlannerViewProps {
  budgets: Budget[];
  summary: FinancialSummary;
  profile: UserProfile | null;
  onAddBudget: (data: Omit<Budget, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onDeleteBudget: (id: string) => Promise<void>;
  onUpdateLimits: (limits: {
    dailySpendLimit: number;
    weeklySpendLimit: number;
    monthlySpendLimit: number;
    monthlySavingsTarget: number;
  }) => Promise<void>;
  onToggleNoSpendDay: (dateStr: string) => Promise<void>;
}

export function BudgetPlannerView({
  budgets,
  summary,
  profile,
  onAddBudget,
  onDeleteBudget,
  onUpdateLimits,
  onToggleNoSpendDay,
}: BudgetPlannerViewProps) {
  const [category, setCategory] = useState<string>('Food');
  const [limitAmount, setLimitAmount] = useState('');
  const [period, setPeriod] = useState<'Monthly' | 'Weekly'>('Monthly');

  const [dailyLimit, setDailyLimit] = useState(String(profile?.dailySpendLimit ?? 1500));
  const [weeklyLimit, setWeeklyLimit] = useState(String(profile?.weeklySpendLimit ?? 8000));
  const [monthlyLimit, setMonthlyLimit] = useState(String(profile?.monthlySpendLimit ?? 35000));
  const [savingsTarget, setSavingsTarget] = useState(String(profile?.monthlySavingsTarget ?? 15000));
  const [savingLimits, setSavingLimits] = useState(false);
  const [limitSaved, setLimitSaved] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setDailyLimit(String(profile.dailySpendLimit ?? 1500));
    setWeeklyLimit(String(profile.weeklySpendLimit ?? 8000));
    setMonthlyLimit(String(profile.monthlySpendLimit ?? 35000));
    setSavingsTarget(String(profile.monthlySavingsTarget ?? 15000));
  }, [profile]);

  const monthKey = currentMonthKey();
  const daysInMonth = useMemo(() => {
    const [y, m] = monthKey.split('-').map(Number);
    const total = new Date(y, m, 0).getDate();
    return Array.from({ length: total }, (_, idx) => `${monthKey}-${String(idx + 1).padStart(2, '0')}`);
  }, [monthKey]);

  const noSpendSet = useMemo(() => new Set(profile?.noSpendDays ?? []), [profile?.noSpendDays]);

  const handleAddBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(limitAmount);
    if (!Number.isFinite(num) || num <= 0) return;
    await onAddBudget({ category, limitAmount: num, period });
    setLimitAmount('');
  };

  const handleSaveLimits = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingLimits(true);
    try {
      await onUpdateLimits({
        dailySpendLimit: Number(dailyLimit) || 0,
        weeklySpendLimit: Number(weeklyLimit) || 0,
        monthlySpendLimit: Number(monthlyLimit) || 0,
        monthlySavingsTarget: Number(savingsTarget) || 0,
      });
      setLimitSaved(true);
      setTimeout(() => setLimitSaved(false), 2500);
    } finally {
      setSavingLimits(false);
    }
  };

  const savingsChallengePct =
    (profile?.monthlySavingsTarget ?? 0) > 0
      ? Math.min(100, Math.max(0, (summary.totalSavings / (profile?.monthlySavingsTarget ?? 1)) * 100))
      : 0;

  return (
    <div className="space-y-6">
      {/* Global Spending Limits & Monthly Savings Challenge */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form
          onSubmit={handleSaveLimits}
          className="lg:col-span-7 bg-[#131020] border border-violet-500/15 rounded-2xl p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">Daily, Weekly & Monthly Spending Limits</h2>
              <p className="text-xs text-slate-400">Triggers real-time threshold alerts across your dashboard</p>
            </div>
            {limitSaved && <span className="text-xs text-emerald-400 font-medium">Saved</span>}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Daily Cap (₹)</label>
              <input
                type="number"
                min="0"
                value={dailyLimit}
                onChange={(e) => setDailyLimit(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#0b0914] border border-violet-500/20 text-sm font-mono text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Weekly Cap (₹)</label>
              <input
                type="number"
                min="0"
                value={weeklyLimit}
                onChange={(e) => setWeeklyLimit(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#0b0914] border border-violet-500/20 text-sm font-mono text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Monthly Cap (₹)</label>
              <input
                type="number"
                min="0"
                value={monthlyLimit}
                onChange={(e) => setMonthlyLimit(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#0b0914] border border-violet-500/20 text-sm font-mono text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Savings Challenge (₹)</label>
              <input
                type="number"
                min="0"
                value={savingsTarget}
                onChange={(e) => setSavingsTarget(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#0b0914] border border-violet-500/20 text-sm font-mono text-white"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={savingLimits}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            {savingLimits ? 'Updating...' : 'Update Limits'}
          </button>
        </form>

        {/* Monthly Savings Challenge Card */}
        <div className="lg:col-span-5 bg-[#131020] border border-violet-500/15 rounded-2xl p-6 flex flex-col justify-between space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-white">Monthly Savings Challenge</h3>
              <p className="text-xs text-slate-400">Net monthly savings vs your personal target</p>
            </div>
            <Flame className="w-5 h-5 text-violet-400 shrink-0" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm font-mono tabular-nums">
              <span className="text-emerald-400 font-semibold">{formatINR(Math.max(0, summary.totalSavings))}</span>
              <span className="text-slate-400">Target {formatINR(profile?.monthlySavingsTarget ?? 15000)}</span>
            </div>
            <div className="h-2.5 rounded-full bg-[#1d1831] overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${savingsChallengePct}%` }}
              />
            </div>
            <p className="text-xs text-slate-400">
              {savingsChallengePct >= 100
                ? 'Challenge achieved for this month!'
                : `${savingsChallengePct.toFixed(1)}% completed · ${formatINR(
                    Math.max(0, (profile?.monthlySavingsTarget ?? 15000) - summary.totalSavings)
                  )} left to save`}
            </p>
          </div>
        </div>
      </div>

      {/* Category Budgets + Suggestions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form
          onSubmit={handleAddBudget}
          className="lg:col-span-4 bg-[#131020] border border-violet-500/15 rounded-2xl p-6 space-y-4 h-fit"
        >
          <h3 className="text-base font-semibold text-white">Create Category Budget</h3>
          <div>
            <label className="block text-xs text-slate-300 mb-1.5">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-[#0b0914] border border-violet-500/20 text-sm text-white"
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-300 mb-1.5">Limit (₹)</label>
              <input
                type="number"
                required
                min="1"
                value={limitAmount}
                onChange={(e) => setLimitAmount(e.target.value)}
                placeholder="4000"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0b0914] border border-violet-500/20 text-sm font-mono text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1.5">Period</label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as 'Monthly' | 'Weekly')}
                className="w-full px-3 py-2.5 rounded-xl bg-[#0b0914] border border-violet-500/20 text-sm text-white"
              >
                <option value="Monthly">Monthly</option>
                <option value="Weekly">Weekly</option>
              </select>
            </div>
          </div>
          <button
            type="submit"
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Save Budget
          </button>
        </form>

        <div className="lg:col-span-8 bg-[#131020] border border-violet-500/15 rounded-2xl p-6 space-y-4">
          <h3 className="text-base font-semibold text-white">Category Budget Progress & Alerts</h3>
          {budgets.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">No category budgets configured yet.</p>
          ) : (
            <div className="space-y-4">
              {summary.budgetStatuses.map(({ budget, spent, remaining, pct, level }) => {
                const barColor =
                  level === 'exceeded100'
                    ? 'bg-rose-500'
                    : level === 'critical90'
                    ? 'bg-amber-500'
                    : level === 'warning75'
                    ? 'bg-amber-400'
                    : 'bg-violet-500';
                return (
                  <div key={budget.id} className="p-4 rounded-xl bg-[#0e0b18] border border-violet-500/15 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {level === 'ok' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <AlertTriangle
                            className={`w-4 h-4 shrink-0 ${
                              level === 'exceeded100' ? 'text-rose-400' : 'text-amber-400'
                            }`}
                          />
                        )}
                        <span className="text-sm font-semibold text-white">{budget.category}</span>
                        <span className="text-xs text-slate-400">· {budget.period}</span>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono tabular-nums text-slate-200">
                          {formatINR(spent)} / {formatINR(budget.limitAmount)} ({pct.toFixed(0)}%)
                        </span>
                        <button
                          type="button"
                          onClick={() => onDeleteBudget(budget.id)}
                          aria-label="Delete budget"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/15 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="h-2 rounded-full bg-[#1d1831] overflow-hidden">
                      <div
                        className={`h-full rounded-full ${barColor}`}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>

                    <p className="text-xs text-slate-400">
                      {remaining >= 0
                        ? `Remaining: ${formatINR(remaining)}${
                            level === 'critical90'
                              ? ' · Alert: Exceeded 90% threshold, pause non-essential spends.'
                              : level === 'warning75'
                              ? ' · Warning: Crossed 75% threshold.'
                              : ''
                          }`
                        : `Over budget by ${formatINR(Math.abs(remaining))}. Try trimming discretionary items in ${
                            budget.category
                          } next week.`}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* No-Spend Challenge Calendar */}
      <div className="bg-[#131020] border border-violet-500/15 rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-white">No-Spend Challenge ({monthKey})</h3>
            <p className="text-xs text-slate-400">
              Tap days you spent ₹0 on discretionary items to build a streak.
            </p>
          </div>
          <span className="text-sm font-mono tabular-nums text-emerald-400 font-semibold">
            {Array.from(noSpendSet).filter((d) => d.startsWith(monthKey)).length} No-Spend Days
          </span>
        </div>

        <div className="grid grid-cols-7 sm:grid-cols-10 md:grid-cols-16 gap-2">
          {daysInMonth.map((d) => {
            const active = noSpendSet.has(d);
            const dayNum = d.slice(-2);
            return (
              <button
                key={d}
                type="button"
                onClick={() => onToggleNoSpendDay(d)}
                className={`py-2 rounded-lg text-xs font-mono tabular-nums border transition-colors cursor-pointer ${
                  active
                    ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200 font-semibold'
                    : 'bg-[#0b0914] border-violet-500/15 text-slate-400 hover:border-violet-400/40'
                }`}
              >
                {dayNum}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
