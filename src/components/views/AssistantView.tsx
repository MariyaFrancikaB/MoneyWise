import React, { useMemo, useState } from 'react';
import { Bot, Calculator, Loader2, Send } from 'lucide-react';
import type {
  Bill,
  ExpenseEntry,
  IncomeEntry,
  Loan,
  SavingsGoal,
  Subscription,
  UserProfile,
} from '../../types/finance';
import { currentMonthKey, formatINR, type FinancialSummary } from '../../utils/formatters';

interface AssistantViewProps {
  summary: FinancialSummary;
  incomes: IncomeEntry[];
  expenses: ExpenseEntry[];
  bills: Bill[];
  goals: SavingsGoal[];
  loans: Loan[];
  subscriptions: Subscription[];
  profile: UserProfile | null;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const QUICK_QUESTIONS = [
  'Where am I wasting money?',
  'Which expenses should I reduce?',
  'How much can I save next month?',
  'How much can I spend daily?',
  'Am I spending more than last month?',
  'How can I reach my savings goal faster?',
];

export function AssistantView({
  summary,
  expenses,
  bills,
  goals,
  loans,
  subscriptions,
  profile,
}: AssistantViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hello ${profile?.displayName || 'there'}. I analyze your actual MoneyWise records in Indian Rupees (₹). Your current month shows ${formatINR(summary.totalIncome)} income, ${formatINR(summary.totalExpenses)} expenses, and ${formatINR(summary.totalSavings)} net savings (${summary.savingsPercentage.toFixed(1)}%). Ask any question below.`,
    },
  ]);
  const [input, setInput] = useState('');
  const [purchaseItem, setPurchaseItem] = useState('');
  const [purchaseCost, setPurchaseCost] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const financialSnapshot = useMemo(() => {
    const mKey = currentMonthKey();
    const recentMonthExpenses = expenses
      .filter((e) => e.date.startsWith(mKey))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 25)
      .map((e) => ({
        name: e.name,
        amountINR: e.amount,
        category: e.category,
        date: e.date,
        paymentMethod: e.paymentMethod,
        isFixed: e.isFixed,
        isUnnecessary: e.isUnnecessary,
      }));

    return {
      month: mKey,
      currency: 'INR',
      monthlySalary: summary.monthlySalary,
      additionalIncome: summary.additionalIncome,
      totalIncome: summary.totalIncome,
      totalExpenses: summary.totalExpenses,
      remainingBalance: summary.remainingBalance,
      totalSavings: summary.totalSavings,
      savingsPercentage: Number(summary.savingsPercentage.toFixed(2)),
      fixedExpenses: summary.fixedExpenses,
      variableExpenses: summary.variableExpenses,
      unnecessaryExpenses: summary.unnecessaryExpenses,
      dailySpendingToday: summary.dailySpending,
      dailyAverageThisMonth: Number(summary.dailyAverage.toFixed(2)),
      weeklySpending: summary.weeklySpending,
      previousMonthIncome: summary.prevMonthIncome,
      previousMonthExpenses: summary.prevMonthExpenses,
      previousMonthSavings: summary.prevMonthSavings,
      expenseChangeVsLastMonthPct: Number(summary.expenseChangePct.toFixed(2)),
      categoryTotals: summary.categoryTotals,
      budgetStatuses: summary.budgetStatuses.map((b) => ({
        category: b.budget.category,
        period: b.budget.period,
        limitINR: b.budget.limitAmount,
        spentINR: b.spent,
        remainingINR: b.remaining,
        utilizationPct: Number(b.pct.toFixed(1)),
      })),
      upcomingUnpaidBills: bills
        .filter((b) => b.status !== 'Paid')
        .map((b) => ({ title: b.title, amountINR: b.amount, dueDate: b.dueDate })),
      savingsGoals: goals.map((g) => ({
        title: g.title,
        category: g.category,
        targetINR: g.targetAmount,
        savedINR: g.currentSavings,
        targetDate: g.targetDate,
      })),
      activeLoans: loans
        .filter((l) => l.status === 'Active')
        .map((l) => ({
          title: l.title,
          type: l.loanType,
          remainingINR: l.remainingAmount,
          emiINR: l.emiAmount,
        })),
      activeSubscriptions: subscriptions
        .filter((s) => s.active)
        .map((s) => ({ name: s.name, amountINR: s.amount, cycle: s.billingCycle })),
      userLimits: {
        dailySpendLimit: profile?.dailySpendLimit ?? 0,
        weeklySpendLimit: profile?.weeklySpendLimit ?? 0,
        monthlySpendLimit: profile?.monthlySpendLimit ?? 0,
        monthlySavingsTarget: profile?.monthlySavingsTarget ?? 0,
      },
      topCurrentMonthTransactions: recentMonthExpenses,
    };
  }, [summary, expenses, bills, goals, loans, subscriptions, profile]);

  const askAssistant = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed || loading) return;
    setError(null);
    const userMsg: ChatMessage = {
      id: `${Date.now()}-u`,
      role: 'user',
      content: trimmed,
    };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: trimmed,
          financialSnapshot,
          history: nextMessages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reach MoneyWise AI.');
      }
      setMessages((prev) => [
        ...prev,
        { id: `${Date.now()}-a`, role: 'assistant', content: data.answer },
      ]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to analyze records right now.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void askAssistant(input);
  };

  const handleAffordabilityCheck = (e: React.FormEvent) => {
    e.preventDefault();
    const cost = Number(purchaseCost);
    if (!purchaseItem.trim() || !Number.isFinite(cost) || cost <= 0) return;
    const q = `Can I afford to buy "${purchaseItem.trim()}" for ${formatINR(cost)} right now without hurting my upcoming bills and savings goals?`;
    setPurchaseItem('');
    setPurchaseCost('');
    void askAssistant(q);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Sidebar: Quick Prompts & Affordability Checker */}
      <div className="lg:col-span-4 space-y-6">
        <div className="bg-[#131020] border border-violet-500/15 rounded-2xl p-6 space-y-3">
          <h2 className="text-base font-semibold text-white">One-Click Financial Questions</h2>
          <p className="text-xs text-slate-400">
            Every answer cites your real Firestore transactions and balances.
          </p>
          <div className="space-y-2 pt-1">
            {QUICK_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                disabled={loading}
                onClick={() => void askAssistant(q)}
                className="w-full text-left px-3.5 py-2.5 rounded-xl bg-[#0b0914] hover:bg-violet-600/20 border border-violet-500/15 hover:border-violet-400/40 text-xs text-slate-200 transition-colors cursor-pointer disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        <form
          onSubmit={handleAffordabilityCheck}
          className="bg-[#131020] border border-violet-500/15 rounded-2xl p-6 space-y-3"
        >
          <div className="flex items-center gap-2 text-white">
            <Calculator className="w-4 h-4 text-violet-400" />
            <h3 className="text-sm font-semibold">Can I Afford This Purchase?</h3>
          </div>
          <input
            type="text"
            required
            value={purchaseItem}
            onChange={(e) => setPurchaseItem(e.target.value)}
            placeholder="Item (e.g. Sony Headphones)"
            className="w-full px-3.5 py-2 rounded-xl bg-[#0b0914] border border-violet-500/20 text-xs text-white"
          />
          <input
            type="number"
            required
            min="1"
            value={purchaseCost}
            onChange={(e) => setPurchaseCost(e.target.value)}
            placeholder="Price in ₹ (e.g. 15000)"
            className="w-full px-3.5 py-2 rounded-xl bg-[#0b0914] border border-violet-500/20 text-xs font-mono text-white"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium cursor-pointer disabled:opacity-50"
          >
            Check Affordability
          </button>
        </form>
      </div>

      {/* Right Chat Panel */}
      <div className="lg:col-span-8 bg-[#131020] border border-violet-500/15 rounded-2xl flex flex-col h-[640px] overflow-hidden">
        <div className="px-6 py-4 border-b border-violet-500/15 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Bot className="w-5 h-5 text-violet-400" />
            <div>
              <h2 className="text-sm font-semibold text-white">MoneyWise AI Money Assistant</h2>
              <p className="text-[11px] text-slate-400">
                Grounded in {expenses.length} expenses, {bills.length} bills, and {goals.length} savings goals
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-violet-600 text-white'
                    : 'bg-[#0b0914] border border-violet-500/20 text-slate-200'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-violet-300">
              <Loader2 className="w-4 h-4 animate-spin" />
              Analyzing your real database records...
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-200">
              {error}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-4 border-t border-violet-500/15 flex items-center gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about spending habits, savings targets, or monthly trends..."
            className="flex-1 px-4 py-2.5 rounded-xl bg-[#0b0914] border border-violet-500/20 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-400"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium cursor-pointer"
          >
            <Send className="w-4 h-4" />
            Ask
          </button>
        </form>
      </div>
    </div>
  );
}
