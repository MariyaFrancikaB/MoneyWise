import type {
  Bill,
  Budget,
  ExpenseEntry,
  IncomeEntry,
  Loan,
  RecurringExpense,
  SavingsGoal,
  Subscription,
  UserProfile,
} from '../types/finance';

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const inrPreciseFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatINR(amount: number, showDecimals = false): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return showDecimals ? inrPreciseFormatter.format(safe) : inrFormatter.format(safe);
}

export function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function currentMonthKey(): string {
  return todayISO().slice(0, 7);
}

export function shiftMonthKey(monthKey: string, deltaMonths: number): string {
  const [yStr, mStr] = monthKey.split('-');
  const date = new Date(Number(yStr), Number(mStr) - 1 + deltaMonths, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function getStartOfWeekISO(): string {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday start
  const monday = new Date(now.getFullYear(), now.getMonth(), diff);
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, '0');
  const d = String(monday.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatDateShort(dateStr: string): string {
  if (!dateStr || dateStr.length < 10) return dateStr;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, 1);
  return dt.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

export function daysUntil(dateStr: string): number {
  const today = new Date(todayISO() + 'T00:00:00');
  const target = new Date(dateStr + 'T00:00:00');
  const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return Number.isFinite(diff) ? diff : 0;
}

export interface FinancialSummary {
  monthKey: string;
  monthlySalary: number;
  additionalIncome: number;
  totalIncome: number;
  totalExpenses: number;
  remainingBalance: number;
  totalSavings: number;
  savingsPercentage: number;
  dailySpending: number;
  weeklySpending: number;
  monthlySpending: number;
  fixedExpenses: number;
  variableExpenses: number;
  unnecessaryExpenses: number;
  dailyAverage: number;
  upcomingBillsTotal: number;
  upcomingBillsCount: number;
  prevMonthIncome: number;
  prevMonthExpenses: number;
  prevMonthSavings: number;
  expenseChangePct: number;
  topCategory: { category: string; amount: number } | null;
  categoryTotals: Record<string, number>;
  paymentMethodTotals: Record<string, number>;
  budgetStatuses: Array<{
    budget: Budget;
    spent: number;
    remaining: number;
    pct: number;
    level: 'ok' | 'warning75' | 'critical90' | 'exceeded100';
  }>;
  healthScore: {
    score: number;
    label: string;
    savingsScore: number;
    budgetScore: number;
    emergencyScore: number;
    debtScore: number;
  };
}

export function computeFinancialSummary(params: {
  incomes: IncomeEntry[];
  expenses: ExpenseEntry[];
  budgets: Budget[];
  bills: Bill[];
  goals: SavingsGoal[];
  loans: Loan[];
  profile: UserProfile | null;
  monthKey?: string;
}): FinancialSummary {
  const monthKey = params.monthKey ?? currentMonthKey();
  const prevKey = shiftMonthKey(monthKey, -1);
  const today = todayISO();
  const weekStart = getStartOfWeekISO();

  const monthIncomes = params.incomes.filter((i) => i.date.startsWith(monthKey));
  const prevIncomes = params.incomes.filter((i) => i.date.startsWith(prevKey));

  const monthlySalary = monthIncomes
    .filter((i) => i.category === 'Monthly Salary')
    .reduce((sum, i) => sum + i.amount, 0);
  const additionalIncome = monthIncomes
    .filter((i) => i.category !== 'Monthly Salary')
    .reduce((sum, i) => sum + i.amount, 0);
  const totalIncome = monthlySalary + additionalIncome;

  const monthExpenses = params.expenses.filter((e) => e.date.startsWith(monthKey));
  const prevExpenses = params.expenses.filter((e) => e.date.startsWith(prevKey));

  const totalExpenses = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
  const remainingBalance = totalIncome - totalExpenses;
  const totalSavings = remainingBalance;
  const savingsPercentage = totalIncome > 0 ? (totalSavings / totalIncome) * 100 : 0;

  const dailySpending = params.expenses
    .filter((e) => e.date === today)
    .reduce((sum, e) => sum + e.amount, 0);

  const weeklySpending = params.expenses
    .filter((e) => e.date >= weekStart && e.date <= today)
    .reduce((sum, e) => sum + e.amount, 0);

  const monthlySpending = totalExpenses;

  const fixedExpenses = monthExpenses
    .filter((e) => e.isFixed)
    .reduce((sum, e) => sum + e.amount, 0);
  const variableExpenses = totalExpenses - fixedExpenses;
  const unnecessaryExpenses = monthExpenses
    .filter((e) => e.isUnnecessary)
    .reduce((sum, e) => sum + e.amount, 0);

  const dayOfMonth = monthKey === currentMonthKey() ? Math.max(1, new Date().getDate()) : 30;
  const dailyAverage = totalExpenses / dayOfMonth;

  const categoryTotals: Record<string, number> = {};
  const paymentMethodTotals: Record<string, number> = {};
  for (const exp of monthExpenses) {
    categoryTotals[exp.category] = (categoryTotals[exp.category] ?? 0) + exp.amount;
    paymentMethodTotals[exp.paymentMethod] = (paymentMethodTotals[exp.paymentMethod] ?? 0) + exp.amount;
  }

  let topCategory: { category: string; amount: number } | null = null;
  for (const [category, amount] of Object.entries(categoryTotals)) {
    if (!topCategory || amount > topCategory.amount) {
      topCategory = { category, amount };
    }
  }

  const prevMonthIncome = prevIncomes.reduce((s, i) => s + i.amount, 0);
  const prevMonthExpenses = prevExpenses.reduce((s, e) => s + e.amount, 0);
  const prevMonthSavings = prevMonthIncome - prevMonthExpenses;
  const expenseChangePct =
    prevMonthExpenses > 0 ? ((totalExpenses - prevMonthExpenses) / prevMonthExpenses) * 100 : 0;

  const upcomingBills = params.bills.filter((b) => b.status !== 'Paid');
  const upcomingBillsTotal = upcomingBills.reduce((s, b) => s + b.amount, 0);
  const upcomingBillsCount = upcomingBills.length;

  const budgetStatuses = params.budgets.map((budget) => {
    const relevantExpenses =
      budget.period === 'Weekly'
        ? params.expenses.filter((e) => e.date >= weekStart && e.date <= today && e.category === budget.category)
        : monthExpenses.filter((e) => e.category === budget.category);
    const spent = relevantExpenses.reduce((s, e) => s + e.amount, 0);
    const remaining = budget.limitAmount - spent;
    const pct = budget.limitAmount > 0 ? (spent / budget.limitAmount) * 100 : 0;
    const level: 'ok' | 'warning75' | 'critical90' | 'exceeded100' =
      pct >= 100 ? 'exceeded100' : pct >= 90 ? 'critical90' : pct >= 75 ? 'warning75' : 'ok';
    return { budget, spent, remaining, pct, level };
  });

  // Financial Health Score (0 - 100) derived strictly from real records
  const savingsScore = totalIncome <= 0 ? 0 : Math.min(35, Math.max(0, Math.round((savingsPercentage / 30) * 35)));
  const overBudgetCount = budgetStatuses.filter((b) => b.pct > 100).length;
  const budgetScore =
    budgetStatuses.length === 0
      ? 15
      : Math.max(0, Math.round(((budgetStatuses.length - overBudgetCount) / budgetStatuses.length) * 25));

  const emergencyGoal = params.goals.find((g) => g.category === 'Emergency Fund');
  const totalGoalSavings = params.goals.reduce((s, g) => s + g.currentSavings, 0);
  const monthlyNeeds = Math.max(fixedExpenses, totalExpenses * 0.6, 1);
  const emergencyTarget = emergencyGoal ? emergencyGoal.targetAmount : monthlyNeeds * 3;
  const emergencyRatio = emergencyTarget > 0 ? Math.min(1, (emergencyGoal?.currentSavings ?? totalGoalSavings) / emergencyTarget) : 0;
  const emergencyScore = Math.round(emergencyRatio * 20);

  const monthlyEmiLoad = params.loans
    .filter((l) => l.status === 'Active' && l.loanType !== 'Money Lent')
    .reduce((s, l) => s + l.emiAmount, 0);
  const emiToIncome = totalIncome > 0 ? monthlyEmiLoad / totalIncome : 0;
  const debtScore = monthlyEmiLoad === 0 ? 20 : Math.max(0, Math.round((1 - Math.min(1, emiToIncome / 0.5)) * 20));

  const score = Math.min(100, Math.max(0, savingsScore + budgetScore + emergencyScore + debtScore));
  const label =
    score >= 80 ? 'Strong' : score >= 60 ? 'Healthy' : score >= 40 ? 'Fair' : 'Needs Attention';

  return {
    monthKey,
    monthlySalary,
    additionalIncome,
    totalIncome,
    totalExpenses,
    remainingBalance,
    totalSavings,
    savingsPercentage,
    dailySpending,
    weeklySpending,
    monthlySpending,
    fixedExpenses,
    variableExpenses,
    unnecessaryExpenses,
    dailyAverage,
    upcomingBillsTotal,
    upcomingBillsCount,
    prevMonthIncome,
    prevMonthExpenses,
    prevMonthSavings,
    expenseChangePct,
    topCategory,
    categoryTotals,
    paymentMethodTotals,
    budgetStatuses,
    healthScore: {
      score,
      label,
      savingsScore,
      budgetScore,
      emergencyScore,
      debtScore,
    },
  };
}

export function computeMonthlySeries(
  incomes: IncomeEntry[],
  expenses: ExpenseEntry[],
  monthsCount = 6
) {
  const current = currentMonthKey();
  const keys: string[] = [];
  for (let i = monthsCount - 1; i >= 0; i--) {
    keys.push(shiftMonthKey(current, -i));
  }
  return keys.map((key) => {
    const inc = incomes.filter((i) => i.date.startsWith(key)).reduce((s, i) => s + i.amount, 0);
    const exp = expenses.filter((e) => e.date.startsWith(key)).reduce((s, e) => s + e.amount, 0);
    return {
      monthKey: key,
      label: formatMonthLabel(key),
      income: inc,
      expenses: exp,
      savings: inc - exp,
    };
  });
}

export function computeGoalRequirements(goal: SavingsGoal) {
  const remaining = Math.max(0, goal.targetAmount - goal.currentSavings);
  const progressPct = goal.targetAmount > 0 ? Math.min(100, (goal.currentSavings / goal.targetAmount) * 100) : 0;
  const daysLeft = Math.max(1, daysUntil(goal.targetDate));
  const weeksLeft = Math.max(1, daysLeft / 7);
  const monthsLeft = Math.max(1, daysLeft / 30.4375);

  return {
    remaining,
    progressPct,
    daysLeft,
    dailyRequired: remaining / daysLeft,
    weeklyRequired: remaining / weeksLeft,
    monthlyRequired: remaining / monthsLeft,
  };
}

export function mapRecurringCategoryToExpenseCategory(recCategory: string): string {
  const map: Record<string, string> = {
    'House Rent': 'Rent',
    Electricity: 'Electricity',
    Water: 'Water',
    Internet: 'Internet',
    'Mobile Bills': 'Mobile Recharge',
    Insurance: 'Other Expenses',
    'Loan EMI': 'EMI and Loans',
    Subscriptions: 'Subscriptions',
    'Other Recurring': 'Other Expenses',
  };
  return map[recCategory] || 'Other Expenses';
}

export function computeTotalMonthlyRecurring(recurring: RecurringExpense[], subscriptions: Subscription[]): number {
  const recMonthly = recurring
    .filter((r) => r.active)
    .reduce((sum, r) => {
      if (r.frequency === 'Yearly') return sum + r.amount / 12;
      if (r.frequency === 'Quarterly') return sum + r.amount / 3;
      return sum + r.amount;
    }, 0);
  const subMonthly = subscriptions
    .filter((s) => s.active)
    .reduce((sum, s) => sum + (s.billingCycle === 'Yearly' ? s.amount / 12 : s.amount), 0);
  return recMonthly + subMonthly;
}
