import React, { useMemo, useState } from 'react';
import { PiggyBank, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import {
  SAVINGS_CATEGORIES,
  type SavingsContribution,
  type SavingsGoal,
} from '../../types/finance';
import {
  computeGoalRequirements,
  formatDateShort,
  formatINR,
  todayISO,
  type FinancialSummary,
} from '../../utils/formatters';

interface SavingsGoalsViewProps {
  goals: SavingsGoal[];
  contributions: SavingsContribution[];
  summary: FinancialSummary;
  onAddGoal: (data: Omit<SavingsGoal, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onContribute: (goal: SavingsGoal, amount: number, date: string, note: string) => Promise<void>;
  onDeleteGoal: (id: string) => Promise<void>;
}

export function SavingsGoalsView({
  goals,
  contributions,
  summary,
  onAddGoal,
  onContribute,
  onDeleteGoal,
}: SavingsGoalsViewProps) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string>('Emergency Fund');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentSavings, setCurrentSavings] = useState('0');
  const [targetDate, setTargetDate] = useState('2027-06-01');
  const [contribAmounts, setContribAmounts] = useState<Record<string, string>>({});
  const [contribNotes, setContribNotes] = useState<Record<string, string>>({});

  const totalSavedAcrossGoals = useMemo(
    () => goals.reduce((s, g) => s + g.currentSavings, 0),
    [goals]
  );

  // Emergency Fund Planner: 6 months of essential/fixed expenses (or total monthly spend)
  const monthlyEssentials = Math.max(summary.fixedExpenses, summary.totalExpenses * 0.65, 15000);
  const recommendedEmergencyFund = Math.round(monthlyEssentials * 6);
  const existingEmergency = goals
    .filter((g) => g.category === 'Emergency Fund')
    .reduce((s, g) => s + g.currentSavings, 0);

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = Number(targetAmount);
    const current = Number(currentSavings) || 0;
    if (!title.trim() || !Number.isFinite(target) || target <= 0) return;
    await onAddGoal({
      title: title.trim(),
      category,
      targetAmount: target,
      currentSavings: Math.max(0, current),
      targetDate,
    });
    setTitle('');
    setTargetAmount('');
    setCurrentSavings('0');
  };

  return (
    <div className="space-y-6">
      {/* Emergency Fund Planner Banner */}
      <div className="bg-[#131020] border border-violet-500/20 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
        <div className="md:col-span-2 space-y-1.5">
          <div className="flex items-center gap-2 text-violet-300 text-xs font-medium">
            <ShieldCheck className="w-4 h-4" />
            <span>Emergency Fund Planner (6-Month Safety Runway)</span>
          </div>
          <h2 className="text-lg font-semibold text-white">
            Recommended Emergency Buffer: {formatINR(recommendedEmergencyFund)}
          </h2>
          <p className="text-xs text-slate-400">
            Calculated from your monthly essential run-rate ({formatINR(monthlyEssentials)}/mo × 6 months). Currently funded:{' '}
            <span className="text-emerald-400 font-mono">{formatINR(existingEmergency)}</span>.
          </p>
        </div>
        <div className="text-left md:text-right">
          <p className="text-xs text-slate-400">Total Saved Across All Goals</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-emerald-400 mt-1">
            {formatINR(totalSavedAcrossGoals)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Create Goal Form */}
        <form
          onSubmit={handleAddGoal}
          className="lg:col-span-4 bg-[#131020] border border-violet-500/15 rounded-2xl p-6 space-y-4 h-fit"
        >
          <h3 className="text-base font-semibold text-white">Create Savings Goal</h3>
          <div>
            <label className="block text-xs text-slate-300 mb-1.5">Goal Name</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. MacBook Air / Emergency Fund"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0b0914] border border-violet-500/20 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-300 mb-1.5">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-[#0b0914] border border-violet-500/20 text-sm text-white"
            >
              {SAVINGS_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-300 mb-1.5">Target (₹)</label>
              <input
                type="number"
                required
                min="1"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                placeholder="100000"
                className="w-full px-3 py-2.5 rounded-xl bg-[#0b0914] border border-violet-500/20 text-sm font-mono text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1.5">Initial Saved (₹)</label>
              <input
                type="number"
                min="0"
                value={currentSavings}
                onChange={(e) => setCurrentSavings(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2.5 rounded-xl bg-[#0b0914] border border-violet-500/20 text-sm font-mono text-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-300 mb-1.5">Target Date</label>
            <input
              type="date"
              required
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0b0914] border border-violet-500/20 text-sm font-mono text-white"
            />
          </div>
          <button
            type="submit"
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Savings Goal
          </button>
        </form>

        {/* Goals List */}
        <div className="lg:col-span-8 space-y-4">
          {goals.length === 0 ? (
            <div className="bg-[#131020] border border-violet-500/15 rounded-2xl p-8 text-center text-sm text-slate-400">
              No savings goals created yet. Add your first goal on the left to calculate daily, weekly, and monthly targets.
            </div>
          ) : (
            goals.map((goal) => {
              const req = computeGoalRequirements(goal);
              const depositVal = contribAmounts[goal.id] ?? '';
              const depositNote = contribNotes[goal.id] ?? '';

              return (
                <div
                  key={goal.id}
                  className="bg-[#131020] border border-violet-500/15 rounded-2xl p-6 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <PiggyBank className="w-4 h-4 text-violet-400" />
                        <h4 className="text-base font-semibold text-white">{goal.title}</h4>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {goal.category} · Target Date {formatDateShort(goal.targetDate)} ({req.daysLeft} days left)
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-mono tabular-nums font-bold text-white">
                          {formatINR(goal.currentSavings)} / {formatINR(goal.targetAmount)}
                        </p>
                        <p className="text-xs font-mono tabular-nums text-emerald-400">
                          {req.progressPct.toFixed(1)}% · Remaining {formatINR(req.remaining)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onDeleteGoal(goal.id)}
                        aria-label="Delete savings goal"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/15 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="h-2.5 rounded-full bg-[#1d1831] overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-violet-600 to-emerald-500 rounded-full transition-all"
                      style={{ width: `${req.progressPct}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-xs bg-[#0e0b18] border border-violet-500/10 rounded-xl p-3">
                    <div>
                      <span className="text-slate-400 block">Required Daily</span>
                      <span className="font-mono tabular-nums text-white font-semibold">
                        {formatINR(req.dailyRequired)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Required Weekly</span>
                      <span className="font-mono tabular-nums text-white font-semibold">
                        {formatINR(req.weeklyRequired)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Required Monthly</span>
                      <span className="font-mono tabular-nums text-white font-semibold">
                        {formatINR(req.monthlyRequired)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <input
                      type="number"
                      min="1"
                      value={depositVal}
                      onChange={(e) =>
                        setContribAmounts((prev) => ({ ...prev, [goal.id]: e.target.value }))
                      }
                      placeholder="Deposit ₹"
                      className="w-32 px-3 py-2 rounded-xl bg-[#0b0914] border border-violet-500/20 text-xs font-mono text-white"
                    />
                    <input
                      type="text"
                      value={depositNote}
                      onChange={(e) =>
                        setContribNotes((prev) => ({ ...prev, [goal.id]: e.target.value }))
                      }
                      placeholder="Note (optional)"
                      className="flex-1 min-w-[140px] px-3 py-2 rounded-xl bg-[#0b0914] border border-violet-500/20 text-xs text-white"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        const amt = Number(depositVal);
                        if (!Number.isFinite(amt) || amt <= 0) return;
                        await onContribute(goal, amt, todayISO(), depositNote);
                        setContribAmounts((prev) => ({ ...prev, [goal.id]: '' }));
                        setContribNotes((prev) => ({ ...prev, [goal.id]: '' }));
                      }}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium cursor-pointer whitespace-nowrap"
                    >
                      Add Deposit
                    </button>
                  </div>
                </div>
              );
            })
          )}

          {contributions.length > 0 && (
            <div className="bg-[#131020] border border-violet-500/15 rounded-2xl p-6 space-y-3">
              <h3 className="text-sm font-semibold text-white">Recent Savings Deposits</h3>
              <div className="divide-y divide-violet-500/10">
                {[...contributions]
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .slice(0, 8)
                  .map((c) => (
                    <div key={c.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-medium text-white">{c.goalTitle}</span>
                        <span className="text-slate-400">
                          {' '}
                          · {formatDateShort(c.date)}
                          {c.note ? ` · ${c.note}` : ''}
                        </span>
                      </div>
                      <span className="font-mono tabular-nums text-emerald-400 font-semibold">
                        +{formatINR(c.amount)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
