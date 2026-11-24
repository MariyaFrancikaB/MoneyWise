import { useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, sendEmailVerification, signOut, type User } from 'firebase/auth';
import {
  BarChart3,
  Bell,
  Bot,
  Check,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  PiggyBank,
  Plus,
  Receipt,
  Settings,
  Sliders,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react';
import { AuthScreen } from './components/AuthScreen';
import { ExpenseModal } from './components/ExpenseModal';
import { AnalyticsView } from './components/views/AnalyticsView';
import { AssistantView } from './components/views/AssistantView';
import { BudgetPlannerView } from './components/views/BudgetPlannerView';
import { DashboardView } from './components/views/DashboardView';
import { ExpensesView } from './components/views/ExpensesView';
import { IncomeView } from './components/views/IncomeView';
import { RentBillsView } from './components/views/RentBillsView';
import { ReportsView } from './components/views/ReportsView';
import { SavingsGoalsView } from './components/views/SavingsGoalsView';
import { SettingsView } from './components/views/SettingsView';
import { auth } from './lib/firebase';
import {
  addBill,
  addBudget,
  addExpense,
  addIncome,
  addLoan,
  addPaymentMethod,
  addRecurringExpense,
  addSavingsGoal,
  addSubscription,
  clearUserFinancialData,
  contributeToSavingsGoal,
  createNotificationIfNew,
  deleteBill,
  deleteBudget,
  deleteExpense,
  deleteIncome,
  deleteLoan,
  deleteNotification,
  deletePaymentMethod,
  deleteRecurringExpense,
  deleteSavingsGoal,
  deleteSubscription,
  ensureUserProfile,
  markNotificationRead,
  markRecurringLoggedForMonth,
  recordLoanPayment,
  seedRealisticSampleData,
  subscribeUserCollection,
  subscribeUserProfile,
  toggleSubscriptionActive,
  updateBillStatus,
  updateExpense,
  updateIncome,
  updateUserProfile,
} from './services/firestoreService';
import type {
  Bill,
  Budget,
  ExpenseEntry,
  IncomeEntry,
  Loan,
  NavSection,
  NotificationItem,
  PaymentMethod,
  RecurringExpense,
  SavingsContribution,
  SavingsGoal,
  Subscription,
  UserProfile,
} from './types/finance';
import {
  computeFinancialSummary,
  currentMonthKey,
  daysUntil,
  formatINR,
  mapRecurringCategoryToExpenseCategory,
  todayISO,
} from './utils/formatters';

const NAV_ITEMS: Array<{ id: NavSection; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'income', label: 'Income', icon: TrendingUp },
  { id: 'expenses', label: 'Expenses', icon: Receipt },
  { id: 'rent-bills', label: 'Rent & Bills', icon: FileText },
  { id: 'budgets', label: 'Budget Planner', icon: Sliders },
  { id: 'savings', label: 'Savings Goals', icon: PiggyBank },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'assistant', label: 'AI Money Assistant', icon: Bot },
  { id: 'reports', label: 'Reports', icon: FileText },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function App() {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState<NavSection>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [incomes, setIncomes] = useState<IncomeEntry[]>([]);
  const [expenses, setExpenses] = useState<ExpenseEntry[]>([]);
  const [recurring, setRecurring] = useState<RecurringExpense[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [contributions, setContributions] = useState<SavingsContribution[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseEntry | null>(null);
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);
  const notifFiredRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authUser || !authUser.emailVerified) {
      setProfile(null);
      setIncomes([]);
      setExpenses([]);
      setRecurring([]);
      setBudgets([]);
      setGoals([]);
      setContributions([]);
      setBills([]);
      setLoans([]);
      setSubscriptions([]);
      setPaymentMethods([]);
      setNotifications([]);
      return;
    }

    const uid = authUser.uid;
    let active = true;
    const unsubs: Array<() => void> = [];

    void ensureUserProfile(
      uid,
      authUser.email || 'user@moneywise.app',
      authUser.displayName || authUser.email?.split('@')[0] || 'MoneyWise User'
    ).then(() => {
      if (!active) return;
      unsubs.push(subscribeUserProfile(uid, setProfile));
      unsubs.push(subscribeUserCollection<IncomeEntry>(uid, 'income', setIncomes));
      unsubs.push(subscribeUserCollection<ExpenseEntry>(uid, 'expenses', setExpenses));
      unsubs.push(subscribeUserCollection<RecurringExpense>(uid, 'recurring_expenses', setRecurring));
      unsubs.push(subscribeUserCollection<Budget>(uid, 'budgets', setBudgets));
      unsubs.push(subscribeUserCollection<SavingsGoal>(uid, 'savings_goals', setGoals));
      unsubs.push(subscribeUserCollection<SavingsContribution>(uid, 'savings_contributions', setContributions));
      unsubs.push(subscribeUserCollection<Bill>(uid, 'bills', setBills));
      unsubs.push(subscribeUserCollection<Loan>(uid, 'loans', setLoans));
      unsubs.push(subscribeUserCollection<Subscription>(uid, 'subscriptions', setSubscriptions));
      unsubs.push(subscribeUserCollection<PaymentMethod>(uid, 'payment_methods', setPaymentMethods));
      unsubs.push(subscribeUserCollection<NotificationItem>(uid, 'notifications', setNotifications));
    });

    return () => {
      active = false;
      unsubs.forEach((u) => u());
    };
  }, [authUser]);

  const summary = useMemo(
    () =>
      computeFinancialSummary({
        incomes,
        expenses,
        budgets,
        bills,
        goals,
        loans,
        profile,
      }),
    [incomes, expenses, budgets, bills, goals, loans, profile]
  );

  // Automatic real-time alerts for budget thresholds (75%, 90%, 100%), upcoming bills, and savings milestones
  useEffect(() => {
    if (!authUser || !authUser.emailVerified) return;
    const uid = authUser.uid;
    const mKey = currentMonthKey();

    const maybeNotify = async (
      dedupeKey: string,
      payload: Omit<NotificationItem, 'id' | 'userId' | 'createdAt' | 'dedupeKey'>
    ) => {
      if (notifFiredRef.current.has(dedupeKey)) return;
      if (notifications.some((n) => n.dedupeKey === dedupeKey)) {
        notifFiredRef.current.add(dedupeKey);
        return;
      }
      notifFiredRef.current.add(dedupeKey);
      await createNotificationIfNew(uid, notifications, { ...payload, dedupeKey });
    };

    for (const bs of summary.budgetStatuses) {
      if (bs.level === 'exceeded100') {
        void maybeNotify(`budget-100-${bs.budget.id}-${mKey}`, {
          title: `${bs.budget.category} Budget Exceeded (${bs.pct.toFixed(0)}%)`,
          message: `Spent ${formatINR(bs.spent)} of ${formatINR(bs.budget.limitAmount)} ${bs.budget.period.toLowerCase()} limit.`,
          type: 'Budget',
          severity: 'alert',
          isRead: false,
        });
      } else if (bs.level === 'critical90') {
        void maybeNotify(`budget-90-${bs.budget.id}-${mKey}`, {
          title: `${bs.budget.category} Budget at ${bs.pct.toFixed(0)}%`,
          message: `Only ${formatINR(Math.max(0, bs.remaining))} remaining in your ${bs.budget.category} budget.`,
          type: 'Budget',
          severity: 'warning',
          isRead: false,
        });
      } else if (bs.level === 'warning75') {
        void maybeNotify(`budget-75-${bs.budget.id}-${mKey}`, {
          title: `${bs.budget.category} Budget Crossed 75%`,
          message: `You have used ${formatINR(bs.spent)} of ${formatINR(bs.budget.limitAmount)}.`,
          type: 'Budget',
          severity: 'info',
          isRead: false,
        });
      }
    }

    for (const bill of bills) {
      if (bill.status !== 'Paid') {
        const d = daysUntil(bill.dueDate);
        if (d <= 5) {
          void maybeNotify(`bill-due-${bill.id}-${bill.dueDate}`, {
            title: d < 0 ? `Overdue Bill: ${bill.title}` : `Upcoming Bill: ${bill.title}`,
            message: `${formatINR(bill.amount)} ${d < 0 ? 'was due' : `due in ${d} day(s)`} on ${bill.dueDate}.`,
            type: 'Bill',
            severity: d < 0 ? 'alert' : 'warning',
            isRead: false,
          });
        }
      }
    }

    for (const goal of goals) {
      const pct = goal.targetAmount > 0 ? (goal.currentSavings / goal.targetAmount) * 100 : 0;
      if (pct >= 100) {
        void maybeNotify(`goal-100-${goal.id}`, {
          title: `Goal Reached: ${goal.title}`,
          message: `You achieved ${formatINR(goal.currentSavings)} for ${goal.title}!`,
          type: 'Milestone',
          severity: 'success',
          isRead: false,
        });
      } else if (pct >= 50) {
        void maybeNotify(`goal-50-${goal.id}`, {
          title: `50% Milestone: ${goal.title}`,
          message: `Halfway there with ${formatINR(goal.currentSavings)} saved toward ${formatINR(goal.targetAmount)}.`,
          type: 'Milestone',
          severity: 'success',
          isRead: false,
        });
      }
    }
  }, [authUser, summary.budgetStatuses, bills, goals, notifications]);

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#09080f] text-slate-200 flex items-center justify-center">
        <div className="text-sm text-violet-300">Loading MoneyWise...</div>
      </div>
    );
  }

  if (!authUser) {
    return <AuthScreen />;
  }

  if (!authUser.emailVerified) {
    return (
      <div className="min-h-screen bg-[#09080f] text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#131020] border border-violet-500/25 rounded-2xl p-8 space-y-5">
          <h1 className="text-xl font-bold text-white">Verify your email address</h1>
          <p className="text-sm text-slate-300 leading-relaxed">
            A verification link was sent to <span className="text-violet-300">{authUser.email}</span>. Verify your inbox to unlock your private MoneyWise vault.
          </p>
          {verifyMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-200">
              {verifyMsg}
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={async () => {
                await authUser.reload();
                if (auth.currentUser?.emailVerified) {
                  setAuthUser({ ...auth.currentUser } as User);
                  window.location.reload();
                } else {
                  setVerifyMsg('Not verified yet. Please click the link in your email first.');
                }
              }}
              className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium cursor-pointer"
            >
              I Verified My Email
            </button>
            <button
              type="button"
              onClick={async () => {
                await sendEmailVerification(authUser);
                setVerifyMsg('Verification email resent.');
              }}
              className="px-4 py-2.5 rounded-xl bg-[#1d1632] text-slate-200 text-xs font-medium cursor-pointer"
            >
              Resend Link
            </button>
            <button
              type="button"
              onClick={() => signOut(auth)}
              className="px-4 py-2.5 rounded-xl bg-transparent border border-violet-500/20 text-slate-400 hover:text-white text-xs cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  const uid = authUser.uid;
  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const currentNavLabel = NAV_ITEMS.find((n) => n.id === activeTab)?.label || 'Dashboard';

  const handleLogRecurring = async (rec: RecurringExpense) => {
    const mKey = currentMonthKey();
    if (rec.lastLoggedMonth === mKey) return;
    await addExpense(uid, {
      name: rec.name,
      amount: rec.amount,
      category: mapRecurringCategoryToExpenseCategory(rec.category),
      date: `${mKey}-${String(Math.min(28, rec.dueDay)).padStart(2, '0')}`,
      paymentMethod: rec.paymentMethod,
      description: `Recurring (${rec.frequency})`,
      isUnnecessary: false,
      isFixed: true,
      recurringId: rec.id,
    });
    await markRecurringLoggedForMonth(uid, rec.id, mKey);
  };

  const handlePayBill = async (bill: Bill) => {
    const mKey = currentMonthKey();
    if (bill.status === 'Paid') return;
    await updateBillStatus(uid, bill.id, 'Paid', mKey);
    if (bill.paidMonth !== mKey) {
      await addExpense(uid, {
        name: bill.title,
        amount: bill.amount,
        category: bill.category,
        date: todayISO(),
        paymentMethod: bill.paymentMethod,
        description: `Bill payment (due ${bill.dueDate})`,
        isUnnecessary: false,
        isFixed: true,
        recurringId: bill.recurringId || bill.id,
      });
    }
  };

  const handleToggleNoSpend = async (dateStr: string) => {
    const current = profile?.noSpendDays ?? [];
    const exists = current.includes(dateStr);
    const next = exists ? current.filter((d) => d !== dateStr) : [...current, dateStr];
    await updateUserProfile(uid, { noSpendDays: next });
  };

  return (
    <div className="min-h-screen bg-[#09080f] text-slate-100 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 bg-[#0d0a17] border-r border-violet-500/15">
        <div className="px-6 py-5 border-b border-violet-500/15">
          <span className="text-xl font-bold tracking-tight text-white font-display">MoneyWise</span>
          <p className="text-[11px] text-slate-400 mt-0.5">Smart Money Manager · ₹ INR</p>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-violet-600/20 text-violet-200 border border-violet-500/30'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-white/5 border border-transparent'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-violet-500/15 space-y-3">
          <div className="px-2">
            <p className="text-xs font-medium text-white truncate">{profile?.displayName || authUser.displayName}</p>
            <p className="text-[11px] text-slate-400 truncate">{authUser.email}</p>
          </div>
          <button
            type="button"
            onClick={() => signOut(auth)}
            className="w-full flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-black/70" onClick={() => setMobileMenuOpen(false)} />
          <aside className="relative w-72 max-w-[80vw] bg-[#0d0a17] border-r border-violet-500/20 flex flex-col z-10">
            <div className="px-5 py-4 border-b border-violet-500/15 flex items-center justify-between">
              <span className="text-lg font-bold text-white font-display">MoneyWise</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium cursor-pointer ${
                      active
                        ? 'bg-violet-600/20 text-violet-200 border border-violet-500/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-violet-500/15">
              <button
                type="button"
                onClick={() => signOut(auth)}
                className="w-full flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-[#09080f]/90 backdrop-blur-md border-b border-violet-500/15 px-4 sm:px-8 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 rounded-lg bg-[#131020] border border-violet-500/20 text-slate-200"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-semibold text-white truncate">{currentNavLabel}</h1>
              <p className="text-xs text-slate-400 truncate hidden sm:block">
                MoneyWise · {currentMonthKey()} · Net Balance{' '}
                <span className="font-mono text-slate-200">{formatINR(summary.remainingBalance)}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 relative">
            <button
              type="button"
              onClick={() => setNotifOpen((prev) => !prev)}
              aria-label="Notifications"
              className="relative p-2.5 rounded-xl bg-[#131020] hover:bg-[#1c1630] border border-violet-500/20 text-slate-200 transition-colors cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-violet-600 text-[10px] font-mono font-bold text-white flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setEditingExpense(null);
                setExpenseModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs sm:text-sm font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add Expense</span>
            </button>

            {/* Notifications Dropdown */}
            {notifOpen && (
              <div className="absolute right-0 top-14 w-80 sm:w-96 bg-[#141022] border border-violet-500/25 rounded-2xl shadow-2xl z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-violet-500/15 flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">Financial Alerts ({notifications.length})</span>
                  <button
                    type="button"
                    onClick={() => setNotifOpen(false)}
                    className="p-1 text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-violet-500/10">
                  {notifications.length === 0 ? (
                    <p className="p-6 text-xs text-slate-400 text-center">No alerts right now.</p>
                  ) : (
                    notifications.map((n) => (
                      <div key={n.id} className={`p-3.5 space-y-1 ${n.isRead ? 'opacity-60' : ''}`}>
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-semibold text-white">{n.title}</p>
                          <div className="flex items-center gap-1 shrink-0">
                            {!n.isRead && (
                              <button
                                type="button"
                                onClick={() => markNotificationRead(uid, n.id)}
                                aria-label="Mark read"
                                className="p-1 text-emerald-400 hover:bg-emerald-500/15 rounded cursor-pointer"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => deleteNotification(uid, n.id)}
                              aria-label="Delete notification"
                              className="p-1 text-slate-400 hover:text-rose-400 rounded cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Active View Content */}
        <main className="flex-1 p-4 sm:p-8 max-w-[1440px] w-full mx-auto">
          {activeTab === 'dashboard' && (
            <DashboardView
              summary={summary}
              incomes={incomes}
              expenses={expenses}
              budgets={budgets}
              bills={bills}
              goals={goals}
              loans={loans}
              profile={profile}
              onNavigate={setActiveTab}
              onOpenAddExpense={() => {
                setEditingExpense(null);
                setExpenseModalOpen(true);
              }}
              onLoadSampleData={() =>
                seedRealisticSampleData(
                  uid,
                  authUser.email || 'user@moneywise.app',
                  profile?.displayName || authUser.displayName || 'MoneyWise User'
                )
              }
            />
          )}

          {activeTab === 'income' && (
            <IncomeView
              incomes={incomes}
              onAdd={(data) => addIncome(uid, data)}
              onUpdate={(id, data) => updateIncome(uid, id, data)}
              onDelete={(id) => deleteIncome(uid, id)}
            />
          )}

          {activeTab === 'expenses' && (
            <ExpensesView
              expenses={expenses}
              onOpenAdd={() => {
                setEditingExpense(null);
                setExpenseModalOpen(true);
              }}
              onOpenEdit={(exp) => {
                setEditingExpense(exp);
                setExpenseModalOpen(true);
              }}
              onDelete={(id) => deleteExpense(uid, id)}
            />
          )}

          {activeTab === 'rent-bills' && (
            <RentBillsView
              recurring={recurring}
              bills={bills}
              subscriptions={subscriptions}
              loans={loans}
              onAddRecurring={(data) => addRecurringExpense(uid, data)}
              onLogRecurring={handleLogRecurring}
              onDeleteRecurring={(id) => deleteRecurringExpense(uid, id)}
              onAddBill={(data) => addBill(uid, data)}
              onPayBill={handlePayBill}
              onDeleteBill={(id) => deleteBill(uid, id)}
              onAddSubscription={(data) => addSubscription(uid, data)}
              onToggleSubscription={(sub) => toggleSubscriptionActive(uid, sub)}
              onDeleteSubscription={(id) => deleteSubscription(uid, id)}
              onAddLoan={(data) => addLoan(uid, data)}
              onRecordLoanPayment={(loan, amt) => recordLoanPayment(uid, loan, amt)}
              onDeleteLoan={(id) => deleteLoan(uid, id)}
            />
          )}

          {activeTab === 'budgets' && (
            <BudgetPlannerView
              budgets={budgets}
              summary={summary}
              profile={profile}
              onAddBudget={(data) => addBudget(uid, data)}
              onDeleteBudget={(id) => deleteBudget(uid, id)}
              onUpdateLimits={(limits) => updateUserProfile(uid, limits)}
              onToggleNoSpendDay={handleToggleNoSpend}
            />
          )}

          {activeTab === 'savings' && (
            <SavingsGoalsView
              goals={goals}
              contributions={contributions}
              summary={summary}
              onAddGoal={(data) => addSavingsGoal(uid, data)}
              onContribute={(goal, amt, date, note) => contributeToSavingsGoal(uid, goal, amt, date, note)}
              onDeleteGoal={(id) => deleteSavingsGoal(uid, id)}
            />
          )}

          {activeTab === 'analytics' && <AnalyticsView incomes={incomes} expenses={expenses} />}

          {activeTab === 'assistant' && (
            <AssistantView
              summary={summary}
              incomes={incomes}
              expenses={expenses}
              bills={bills}
              goals={goals}
              loans={loans}
              subscriptions={subscriptions}
              profile={profile}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsView
              incomes={incomes}
              expenses={expenses}
              budgets={budgets}
              goals={goals}
              loans={loans}
              profile={profile}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              profile={profile}
              paymentMethods={paymentMethods}
              summary={summary}
              onUpdateProfile={(updates) => updateUserProfile(uid, updates)}
              onAddPaymentMethod={(data) => addPaymentMethod(uid, data)}
              onDeletePaymentMethod={(id) => deletePaymentMethod(uid, id)}
              onLoadSampleData={() =>
                seedRealisticSampleData(
                  uid,
                  authUser.email || 'user@moneywise.app',
                  profile?.displayName || authUser.displayName || 'MoneyWise User'
                )
              }
              onClearData={() => clearUserFinancialData(uid)}
            />
          )}
        </main>
      </div>

      <ExpenseModal
        open={expenseModalOpen}
        onClose={() => {
          setExpenseModalOpen(false);
          setEditingExpense(null);
        }}
        editingExpense={editingExpense}
        paymentMethods={paymentMethods}
        onSave={async (data) => {
          if (editingExpense) {
            await updateExpense(uid, editingExpense.id, data);
          } else {
            await addExpense(uid, data);
          }
        }}
      />
    </div>
  );
}
