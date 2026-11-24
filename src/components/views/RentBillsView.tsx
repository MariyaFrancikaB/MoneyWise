import React, { useMemo, useState } from 'react';
import { CheckCircle2, Plus, Repeat, Trash2 } from 'lucide-react';
import {
  EXPENSE_CATEGORIES,
  LOAN_TYPES,
  PAYMENT_METHOD_TYPES,
  RECURRING_CATEGORIES,
  type Bill,
  type Loan,
  type RecurringExpense,
  type Subscription,
} from '../../types/finance';
import {
  computeTotalMonthlyRecurring,
  currentMonthKey,
  daysUntil,
  formatDateShort,
  formatINR,
  mapRecurringCategoryToExpenseCategory,
  todayISO,
} from '../../utils/formatters';

interface RentBillsViewProps {
  recurring: RecurringExpense[];
  bills: Bill[];
  subscriptions: Subscription[];
  loans: Loan[];
  onAddRecurring: (data: Omit<RecurringExpense, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onLogRecurring: (rec: RecurringExpense) => Promise<void>;
  onDeleteRecurring: (id: string) => Promise<void>;
  onAddBill: (data: Omit<Bill, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onPayBill: (bill: Bill) => Promise<void>;
  onDeleteBill: (id: string) => Promise<void>;
  onAddSubscription: (data: Omit<Subscription, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onToggleSubscription: (sub: Subscription) => Promise<void>;
  onDeleteSubscription: (id: string) => Promise<void>;
  onAddLoan: (data: Omit<Loan, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onRecordLoanPayment: (loan: Loan, amount: number) => Promise<void>;
  onDeleteLoan: (id: string) => Promise<void>;
}

type SubTab = 'recurring' | 'bills' | 'subscriptions' | 'loans';

export function RentBillsView(props: RentBillsViewProps) {
  const [tab, setTab] = useState<SubTab>('recurring');
  const mKey = currentMonthKey();

  // Recurring form
  const [recName, setRecName] = useState('');
  const [recCat, setRecCat] = useState<string>('House Rent');
  const [recAmount, setRecAmount] = useState('');
  const [recDueDay, setRecDueDay] = useState('5');
  const [recFreq, setRecFreq] = useState<'Monthly' | 'Quarterly' | 'Yearly'>('Monthly');
  const [recMethod, setRecMethod] = useState<string>('Net Banking');

  // Bill form
  const [billTitle, setBillTitle] = useState('');
  const [billCat, setBillCat] = useState<string>('Electricity');
  const [billAmount, setBillAmount] = useState('');
  const [billDue, setBillDue] = useState(todayISO());
  const [billMethod, setBillMethod] = useState<string>('UPI');

  // Subscription form
  const [subName, setSubName] = useState('');
  const [subAmount, setSubAmount] = useState('');
  const [subCycle, setSubCycle] = useState<'Monthly' | 'Yearly'>('Monthly');
  const [subDate, setSubDate] = useState(todayISO());
  const [subMethod, setSubMethod] = useState<string>('Credit Card');

  // Loan form
  const [loanTitle, setLoanTitle] = useState('');
  const [loanType, setLoanType] = useState<Loan['loanType']>('EMI / Bank Loan');
  const [loanParty, setLoanParty] = useState('');
  const [loanPrincipal, setLoanPrincipal] = useState('');
  const [loanRemaining, setLoanRemaining] = useState('');
  const [loanEmi, setLoanEmi] = useState('');
  const [loanRate, setLoanRate] = useState('9.5');
  const [loanPayAmounts, setLoanPayAmounts] = useState<Record<string, string>>({});

  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const monthlyRecurringTotal = useMemo(
    () => computeTotalMonthlyRecurring(props.recurring, props.subscriptions),
    [props.recurring, props.subscriptions]
  );

  const totalEmiMonthly = useMemo(
    () =>
      props.loans
        .filter((l) => l.status === 'Active' && l.loanType !== 'Money Lent')
        .reduce((s, l) => s + l.emiAmount, 0),
    [props.loans]
  );

  const totalLentRemaining = useMemo(
    () =>
      props.loans
        .filter((l) => l.status === 'Active' && l.loanType === 'Money Lent')
        .reduce((s, l) => s + l.remainingAmount, 0),
    [props.loans]
  );

  const handleRecurringSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const num = Number(recAmount);
    if (!recName.trim() || !Number.isFinite(num) || num <= 0) {
      setError('Enter valid recurring payment details.');
      return;
    }
    await props.onAddRecurring({
      name: recName.trim(),
      category: recCat,
      amount: num,
      dueDay: Math.min(31, Math.max(1, Number(recDueDay) || 1)),
      frequency: recFreq,
      paymentMethod: recMethod,
      reminderDaysBefore: 3,
      active: true,
      lastLoggedMonth: '',
      description: `Auto-mapped to ${mapRecurringCategoryToExpenseCategory(recCat)}`,
    });
    setRecName('');
    setRecAmount('');
  };

  const handleBillSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const num = Number(billAmount);
    if (!billTitle.trim() || !Number.isFinite(num) || num <= 0) {
      setError('Enter valid bill title and amount.');
      return;
    }
    await props.onAddBill({
      title: billTitle.trim(),
      category: billCat,
      amount: num,
      dueDate: billDue,
      status: daysUntil(billDue) < 0 ? 'Overdue' : 'Upcoming',
      paymentMethod: billMethod,
      paidMonth: '',
    });
    setBillTitle('');
    setBillAmount('');
  };

  const handleSubSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const num = Number(subAmount);
    if (!subName.trim() || !Number.isFinite(num) || num <= 0) {
      setError('Enter valid subscription name and amount.');
      return;
    }
    await props.onAddSubscription({
      name: subName.trim(),
      amount: num,
      billingCycle: subCycle,
      nextBillingDate: subDate,
      paymentMethod: subMethod,
      category: 'Subscriptions',
      active: true,
    });
    setSubName('');
    setSubAmount('');
  };

  const handleLoanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const principal = Number(loanPrincipal);
    const remaining = loanRemaining ? Number(loanRemaining) : principal;
    const emi = Number(loanEmi) || 0;
    if (!loanTitle.trim() || !loanParty.trim() || !Number.isFinite(principal) || principal <= 0) {
      setError('Enter valid loan title, counterparty, and principal amount.');
      return;
    }
    await props.onAddLoan({
      title: loanTitle.trim(),
      loanType,
      counterparty: loanParty.trim(),
      principalAmount: principal,
      remainingAmount: Math.max(0, remaining),
      emiAmount: Math.max(0, emi),
      interestRate: Number(loanRate) || 0,
      dueDay: 5,
      startDate: todayISO(),
      endDate: '',
      status: remaining <= 0 ? 'Closed' : 'Active',
    });
    setLoanTitle('');
    setLoanParty('');
    setLoanPrincipal('');
    setLoanRemaining('');
    setLoanEmi('');
  };

  return (
    <div className="space-y-6">
      {/* Top KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#131020] border border-violet-500/15 rounded-xl p-5">
          <p className="text-xs text-slate-400">Monthly Fixed & Subscriptions</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-white mt-1.5">
            {formatINR(monthlyRecurringTotal)}
          </p>
        </div>
        <div className="bg-[#131020] border border-violet-500/15 rounded-xl p-5">
          <p className="text-xs text-slate-400">Upcoming Unpaid Bills</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-amber-300 mt-1.5">
            {formatINR(props.bills.filter((b) => b.status !== 'Paid').reduce((s, b) => s + b.amount, 0))}
          </p>
        </div>
        <div className="bg-[#131020] border border-violet-500/15 rounded-xl p-5">
          <p className="text-xs text-slate-400">Monthly EMI Load</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-rose-300 mt-1.5">
            {formatINR(totalEmiMonthly)}
          </p>
        </div>
        <div className="bg-[#131020] border border-violet-500/15 rounded-xl p-5">
          <p className="text-xs text-slate-400">Money Lent Receivable</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-emerald-400 mt-1.5">
            {formatINR(totalLentRemaining)}
          </p>
        </div>
      </div>

      {/* Segmented Navigation */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-[#131020] border border-violet-500/15 rounded-xl w-fit">
        {(
          [
            ['recurring', 'Rent & Fixed Recurring'],
            ['bills', 'Bill Reminders'],
            ['subscriptions', 'Subscriptions'],
            ['loans', 'Loans, EMI & Borrowed/Lent'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setTab(key);
              setError(null);
            }}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              tab === key
                ? 'bg-violet-600 text-white'
                : 'text-slate-300 hover:text-white hover:bg-violet-500/10'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-200">
          {error}
        </div>
      )}

      {tab === 'recurring' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleRecurringSubmit}
            className="lg:col-span-4 bg-[#131020] border border-violet-500/15 rounded-2xl p-6 space-y-4 h-fit"
          >
            <h3 className="text-base font-semibold text-white">Add Recurring Payment</h3>
            <input
              type="text"
              required
              value={recName}
              onChange={(e) => setRecName(e.target.value)}
              placeholder="e.g. House Rent"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0b0914] border border-violet-500/20 text-sm text-white"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                required
                min="1"
                value={recAmount}
                onChange={(e) => setRecAmount(e.target.value)}
                placeholder="Amount (₹)"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0b0914] border border-violet-500/20 text-sm font-mono text-white"
              />
              <input
                type="number"
                min="1"
                max="31"
                value={recDueDay}
                onChange={(e) => setRecDueDay(e.target.value)}
                placeholder="Due Day (1-31)"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0b0914] border border-violet-500/20 text-sm font-mono text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <select
                value={recCat}
                onChange={(e) => setRecCat(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-[#0b0914] border border-violet-500/20 text-xs text-white"
              >
                {RECURRING_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                value={recFreq}
                onChange={(e) => setRecFreq(e.target.value as 'Monthly' | 'Quarterly' | 'Yearly')}
                className="w-full px-3 py-2.5 rounded-xl bg-[#0b0914] border border-violet-500/20 text-xs text-white"
              >
                <option value="Monthly">Monthly</option>
                <option value="Quarterly">Quarterly</option>
                <option value="Yearly">Yearly</option>
              </select>
            </div>
            <select
              value={recMethod}
              onChange={(e) => setRecMethod(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-[#0b0914] border border-violet-500/20 text-xs text-white"
            >
              {PAYMENT_METHOD_TYPES.map((pm) => (
                <option key={pm} value={pm}>
                  {pm}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Save Recurring Obligation
            </button>
          </form>

          <div className="lg:col-span-8 bg-[#131020] border border-violet-500/15 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Recurring Rent & Fixed Payments</h3>
              <span className="text-xs text-slate-400">Duplicate monthly logs are automatically blocked</span>
            </div>
            {props.recurring.length === 0 ? (
              <p className="text-sm text-slate-400 py-8 text-center">No recurring payments configured yet.</p>
            ) : (
              <div className="divide-y divide-violet-500/10">
                {props.recurring.map((rec) => {
                  const alreadyLogged = rec.lastLoggedMonth === mKey;
                  return (
                    <div key={rec.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-white">{rec.name}</p>
                        <p className="text-xs text-slate-400">
                          {rec.category} · Due day {rec.dueDay} · {rec.frequency} · {rec.paymentMethod}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-mono tabular-nums font-semibold text-white">
                          {formatINR(rec.amount)}
                        </span>
                        <button
                          type="button"
                          disabled={alreadyLogged || busyId === rec.id}
                          onClick={async () => {
                            setBusyId(rec.id);
                            try {
                              await props.onLogRecurring(rec);
                            } finally {
                              setBusyId(null);
                            }
                          }}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
                            alreadyLogged
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 cursor-default'
                              : 'bg-violet-600 hover:bg-violet-500 text-white cursor-pointer'
                          }`}
                        >
                          {alreadyLogged ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Logged ({mKey})
                            </>
                          ) : (
                            <>
                              <Repeat className="w-3.5 h-3.5" />
                              Log for {mKey}
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => props.onDeleteRecurring(rec.id)}
                          aria-label="Delete recurring expense"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/15 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'bills' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleBillSubmit}
            className="lg:col-span-4 bg-[#131020] border border-violet-500/15 rounded-2xl p-6 space-y-4 h-fit"
          >
            <h3 className="text-base font-semibold text-white">Add Bill Reminder</h3>
            <input
              type="text"
              required
              value={billTitle}
              onChange={(e) => setBillTitle(e.target.value)}
              placeholder="e.g. BESCOM Electricity Bill"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0b0914] border border-violet-500/20 text-sm text-white"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                required
                min="1"
                value={billAmount}
                onChange={(e) => setBillAmount(e.target.value)}
                placeholder="Amount (₹)"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0b0914] border border-violet-500/20 text-sm font-mono text-white"
              />
              <input
                type="date"
                required
                value={billDue}
                onChange={(e) => setBillDue(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-[#0b0914] border border-violet-500/20 text-xs font-mono text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <select
                value={billCat}
                onChange={(e) => setBillCat(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-[#0b0914] border border-violet-500/20 text-xs text-white"
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                value={billMethod}
                onChange={(e) => setBillMethod(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-[#0b0914] border border-violet-500/20 text-xs text-white"
              >
                {PAYMENT_METHOD_TYPES.map((pm) => (
                  <option key={pm} value={pm}>
                    {pm}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Bill
            </button>
          </form>

          <div className="lg:col-span-8 bg-[#131020] border border-violet-500/15 rounded-2xl p-6 space-y-4">
            <h3 className="text-base font-semibold text-white">Upcoming & Paid Bills</h3>
            {props.bills.length === 0 ? (
              <p className="text-sm text-slate-400 py-8 text-center">No bill reminders added yet.</p>
            ) : (
              <div className="divide-y divide-violet-500/10">
                {[...props.bills]
                  .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
                  .map((bill) => {
                    const isPaid = bill.status === 'Paid';
                    return (
                      <div key={bill.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-white">{bill.title}</p>
                          <p className="text-xs text-slate-400">
                            {bill.category} · Due {formatDateShort(bill.dueDate)} · {bill.paymentMethod} ·{' '}
                            <span className={isPaid ? 'text-emerald-400' : 'text-amber-300'}>{bill.status}</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-mono tabular-nums font-semibold text-white">
                            {formatINR(bill.amount)}
                          </span>
                          {!isPaid && (
                            <button
                              type="button"
                              disabled={busyId === bill.id}
                              onClick={async () => {
                                setBusyId(bill.id);
                                try {
                                  await props.onPayBill(bill);
                                } finally {
                                  setBusyId(null);
                                }
                              }}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium cursor-pointer whitespace-nowrap"
                            >
                              Mark Paid & Log
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => props.onDeleteBill(bill.id)}
                            aria-label="Delete bill"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/15 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'subscriptions' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleSubSubmit}
            className="lg:col-span-4 bg-[#131020] border border-violet-500/15 rounded-2xl p-6 space-y-4 h-fit"
          >
            <h3 className="text-base font-semibold text-white">Track Subscription</h3>
            <input
              type="text"
              required
              value={subName}
              onChange={(e) => setSubName(e.target.value)}
              placeholder="e.g. Netflix, Spotify, iCloud"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0b0914] border border-violet-500/20 text-sm text-white"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                required
                min="1"
                value={subAmount}
                onChange={(e) => setSubAmount(e.target.value)}
                placeholder="Amount (₹)"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0b0914] border border-violet-500/20 text-sm font-mono text-white"
              />
              <select
                value={subCycle}
                onChange={(e) => setSubCycle(e.target.value as 'Monthly' | 'Yearly')}
                className="w-full px-3 py-2.5 rounded-xl bg-[#0b0914] border border-violet-500/20 text-xs text-white"
              >
                <option value="Monthly">Monthly</option>
                <option value="Yearly">Yearly</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                required
                value={subDate}
                onChange={(e) => setSubDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-[#0b0914] border border-violet-500/20 text-xs font-mono text-white"
              />
              <select
                value={subMethod}
                onChange={(e) => setSubMethod(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-[#0b0914] border border-violet-500/20 text-xs text-white"
              >
                {PAYMENT_METHOD_TYPES.map((pm) => (
                  <option key={pm} value={pm}>
                    {pm}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Subscription
            </button>
          </form>

          <div className="lg:col-span-8 bg-[#131020] border border-violet-500/15 rounded-2xl p-6 space-y-4">
            <h3 className="text-base font-semibold text-white">Active & Paused Subscriptions</h3>
            {props.subscriptions.length === 0 ? (
              <p className="text-sm text-slate-400 py-8 text-center">No subscriptions tracked yet.</p>
            ) : (
              <div className="divide-y divide-violet-500/10">
                {props.subscriptions.map((sub) => (
                  <div key={sub.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-white">{sub.name}</p>
                      <p className="text-xs text-slate-400">
                        {sub.billingCycle} · Next renewal {formatDateShort(sub.nextBillingDate)} · {sub.paymentMethod} ·{' '}
                        <span className={sub.active ? 'text-emerald-400' : 'text-slate-400'}>
                          {sub.active ? 'Active' : 'Paused'}
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-mono tabular-nums font-semibold text-white">
                        {formatINR(sub.amount)}
                      </span>
                      <button
                        type="button"
                        onClick={() => props.onToggleSubscription(sub)}
                        className="px-3 py-1.5 rounded-lg bg-[#1d1632] hover:bg-[#2a2047] text-xs text-slate-200 cursor-pointer"
                      >
                        {sub.active ? 'Pause' : 'Resume'}
                      </button>
                      <button
                        type="button"
                        onClick={() => props.onDeleteSubscription(sub.id)}
                        aria-label="Delete subscription"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/15 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'loans' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleLoanSubmit}
            className="lg:col-span-4 bg-[#131020] border border-violet-500/15 rounded-2xl p-6 space-y-4 h-fit"
          >
            <h3 className="text-base font-semibold text-white">Add Loan / EMI / Borrowed-Lent</h3>
            <select
              value={loanType}
              onChange={(e) => setLoanType(e.target.value as Loan['loanType'])}
              className="w-full px-3 py-2.5 rounded-xl bg-[#0b0914] border border-violet-500/20 text-sm text-white"
            >
              {LOAN_TYPES.map((lt) => (
                <option key={lt} value={lt}>
                  {lt}
                </option>
              ))}
            </select>
            <input
              type="text"
              required
              value={loanTitle}
              onChange={(e) => setLoanTitle(e.target.value)}
              placeholder="e.g. Home Loan / Lent to Friend"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0b0914] border border-violet-500/20 text-sm text-white"
            />
            <input
              type="text"
              required
              value={loanParty}
              onChange={(e) => setLoanParty(e.target.value)}
              placeholder="Bank or Person Name"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0b0914] border border-violet-500/20 text-sm text-white"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                required
                min="1"
                value={loanPrincipal}
                onChange={(e) => setLoanPrincipal(e.target.value)}
                placeholder="Principal (₹)"
                className="w-full px-3 py-2.5 rounded-xl bg-[#0b0914] border border-violet-500/20 text-sm font-mono text-white"
              />
              <input
                type="number"
                min="0"
                value={loanRemaining}
                onChange={(e) => setLoanRemaining(e.target.value)}
                placeholder="Remaining (₹)"
                className="w-full px-3 py-2.5 rounded-xl bg-[#0b0914] border border-violet-500/20 text-sm font-mono text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                min="0"
                value={loanEmi}
                onChange={(e) => setLoanEmi(e.target.value)}
                placeholder="Monthly EMI (₹)"
                className="w-full px-3 py-2.5 rounded-xl bg-[#0b0914] border border-violet-500/20 text-sm font-mono text-white"
              />
              <input
                type="number"
                step="0.1"
                min="0"
                value={loanRate}
                onChange={(e) => setLoanRate(e.target.value)}
                placeholder="Interest %"
                className="w-full px-3 py-2.5 rounded-xl bg-[#0b0914] border border-violet-500/20 text-sm font-mono text-white"
              />
            </div>
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Save Record
            </button>
          </form>

          <div className="lg:col-span-8 bg-[#131020] border border-violet-500/15 rounded-2xl p-6 space-y-4">
            <h3 className="text-base font-semibold text-white">EMI, Loans & Money Borrowed/Lent</h3>
            {props.loans.length === 0 ? (
              <p className="text-sm text-slate-400 py-8 text-center">No active EMIs or personal loans recorded.</p>
            ) : (
              <div className="space-y-4">
                {props.loans.map((loan) => {
                  const paidPct =
                    loan.principalAmount > 0
                      ? Math.min(100, ((loan.principalAmount - loan.remainingAmount) / loan.principalAmount) * 100)
                      : 100;
                  const payVal = loanPayAmounts[loan.id] ?? String(loan.emiAmount || loan.remainingAmount);

                  return (
                    <div
                      key={loan.id}
                      className="p-4 rounded-xl bg-[#0e0b18] border border-violet-500/15 space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-white">{loan.title}</p>
                          <p className="text-xs text-slate-400">
                            {loan.loanType} · {loan.counterparty} · EMI {formatINR(loan.emiAmount)} ·{' '}
                            <span className={loan.status === 'Closed' ? 'text-emerald-400' : 'text-violet-300'}>
                              {loan.status}
                            </span>
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-xs text-slate-400">Remaining</p>
                            <p className="text-sm font-mono tabular-nums font-bold text-white">
                              {formatINR(loan.remainingAmount)} / {formatINR(loan.principalAmount)}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => props.onDeleteLoan(loan.id)}
                            aria-label="Delete loan"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/15 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="h-2 rounded-full bg-[#1d1831] overflow-hidden">
                        <div className="h-full bg-violet-500 rounded-full" style={{ width: `${paidPct}%` }} />
                      </div>

                      {loan.status === 'Active' && (
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <input
                            type="number"
                            min="1"
                            value={payVal}
                            onChange={(e) =>
                              setLoanPayAmounts((prev) => ({ ...prev, [loan.id]: e.target.value }))
                            }
                            className="w-32 px-3 py-1.5 rounded-lg bg-[#141022] border border-violet-500/20 text-xs font-mono text-white"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const amt = Number(payVal);
                              if (amt > 0) props.onRecordLoanPayment(loan, amt);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium cursor-pointer"
                          >
                            {loan.loanType === 'Money Lent' ? 'Record Repayment Received' : 'Record Payment / EMI'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
