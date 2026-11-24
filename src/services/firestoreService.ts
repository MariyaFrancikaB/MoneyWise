import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import type {
  Bill,
  Budget,
  ExpenseEntry,
  IncomeEntry,
  Loan,
  NotificationItem,
  PaymentMethod,
  RecurringExpense,
  SavingsContribution,
  SavingsGoal,
  Subscription,
  UserProfile,
} from '../types/finance';
import { currentMonthKey, formatINR, shiftMonthKey, todayISO } from '../utils/formatters';

function userDocRef(uid: string) {
  return doc(db, 'users', uid);
}

function userCol(uid: string, colName: string) {
  return collection(db, 'users', uid, colName);
}

function clampStr(val: string | undefined | null, maxLen: number, fallback = ''): string {
  return (val ?? fallback).toString().trim().slice(0, maxLen);
}

function clampNum(val: number, min: number, max = 1000000000): number {
  const n = Number(val);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function ensureDateISO(val: string | undefined): string {
  if (val && /^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  return todayISO();
}

export async function ensureUserProfile(uid: string, email: string, displayName: string): Promise<UserProfile> {
  const path = `users/${uid}`;
  try {
    const ref = userDocRef(uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }
    const profilePayload = {
      uid: clampStr(uid, 128),
      email: clampStr(email || 'user@moneywise.app', 200),
      displayName: clampStr(displayName || 'MoneyWise User', 120) || 'MoneyWise User',
      monthlySalaryTarget: 0,
      dailySpendLimit: 1500,
      weeklySpendLimit: 8000,
      monthlySpendLimit: 35000,
      monthlySavingsTarget: 15000,
      noSpendDays: [] as string[],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(ref, profilePayload);

    // Seed default payment methods if none exist
    const pmSnap = await getDocs(query(userCol(uid, 'payment_methods'), where('userId', '==', uid)));
    if (pmSnap.empty) {
      const defaults = [
        { name: 'Primary UPI', type: 'UPI', lastFour: 'UPI', monthlyLimit: 25000, isDefault: true },
        { name: 'Cash Wallet', type: 'Cash', lastFour: '', monthlyLimit: 5000, isDefault: false },
        { name: 'HDFC Debit Card', type: 'Debit Card', lastFour: '4821', monthlyLimit: 30000, isDefault: false },
        { name: 'ICICI Credit Card', type: 'Credit Card', lastFour: '9014', monthlyLimit: 40000, isDefault: false },
      ];
      for (const pm of defaults) {
        await addDoc(userCol(uid, 'payment_methods'), {
          userId: uid,
          name: pm.name,
          type: pm.type,
          lastFour: pm.lastFour,
          monthlyLimit: pm.monthlyLimit,
          isDefault: pm.isDefault,
          createdAt: serverTimestamp(),
        });
      }
    }

    return {
      ...profilePayload,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateUserProfile(
  uid: string,
  updates: Partial<
    Pick<
      UserProfile,
      | 'displayName'
      | 'monthlySalaryTarget'
      | 'dailySpendLimit'
      | 'weeklySpendLimit'
      | 'monthlySpendLimit'
      | 'monthlySavingsTarget'
      | 'noSpendDays'
    >
  >
) {
  const path = `users/${uid}`;
  try {
    const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (updates.displayName !== undefined) payload.displayName = clampStr(updates.displayName, 120) || 'MoneyWise User';
    if (updates.monthlySalaryTarget !== undefined) payload.monthlySalaryTarget = clampNum(updates.monthlySalaryTarget, 0, 100000000);
    if (updates.dailySpendLimit !== undefined) payload.dailySpendLimit = clampNum(updates.dailySpendLimit, 0, 10000000);
    if (updates.weeklySpendLimit !== undefined) payload.weeklySpendLimit = clampNum(updates.weeklySpendLimit, 0, 50000000);
    if (updates.monthlySpendLimit !== undefined) payload.monthlySpendLimit = clampNum(updates.monthlySpendLimit, 0, 100000000);
    if (updates.monthlySavingsTarget !== undefined) payload.monthlySavingsTarget = clampNum(updates.monthlySavingsTarget, 0, 100000000);
    if (updates.noSpendDays !== undefined) {
      payload.noSpendDays = updates.noSpendDays
        .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
        .slice(-31);
    }
    await updateDoc(userDocRef(uid), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function subscribeUserCollection<T>(
  uid: string,
  colName: string,
  onData: (items: T[]) => void
): Unsubscribe {
  const path = `users/${uid}/${colName}`;
  const q = query(userCol(uid, colName), where('userId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as T[];
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeUserProfile(uid: string, onData: (profile: UserProfile | null) => void): Unsubscribe {
  const path = `users/${uid}`;
  return onSnapshot(
    userDocRef(uid),
    (snap) => {
      onData(snap.exists() ? (snap.data() as UserProfile) : null);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

// --- Income CRUD ---
export async function addIncome(uid: string, data: Omit<IncomeEntry, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) {
  const path = `users/${uid}/income`;
  try {
    await addDoc(userCol(uid, 'income'), {
      userId: uid,
      title: clampStr(data.title, 140) || 'Income',
      amount: clampNum(data.amount, 1),
      category: clampStr(data.category, 60) || 'Other Income',
      date: ensureDateISO(data.date),
      description: clampStr(data.description, 400),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateIncome(uid: string, id: string, data: Omit<IncomeEntry, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) {
  const path = `users/${uid}/income/${id}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'income', id), {
      title: clampStr(data.title, 140) || 'Income',
      amount: clampNum(data.amount, 1),
      category: clampStr(data.category, 60) || 'Other Income',
      date: ensureDateISO(data.date),
      description: clampStr(data.description, 400),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteIncome(uid: string, id: string) {
  const path = `users/${uid}/income/${id}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'income', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Expenses CRUD ---
export async function addExpense(uid: string, data: Omit<ExpenseEntry, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) {
  const path = `users/${uid}/expenses`;
  try {
    const payload: Record<string, unknown> = {
      userId: uid,
      name: clampStr(data.name, 140) || 'Expense',
      amount: clampNum(data.amount, 1),
      category: clampStr(data.category, 60) || 'Other Expenses',
      date: ensureDateISO(data.date),
      paymentMethod: clampStr(data.paymentMethod, 60) || 'UPI',
      description: clampStr(data.description, 400),
      isUnnecessary: Boolean(data.isUnnecessary),
      isFixed: Boolean(data.isFixed),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (data.recurringId) {
      payload.recurringId = clampStr(data.recurringId, 128);
    }
    await addDoc(userCol(uid, 'expenses'), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateExpense(uid: string, id: string, data: Omit<ExpenseEntry, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'recurringId'>) {
  const path = `users/${uid}/expenses/${id}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'expenses', id), {
      name: clampStr(data.name, 140) || 'Expense',
      amount: clampNum(data.amount, 1),
      category: clampStr(data.category, 60) || 'Other Expenses',
      date: ensureDateISO(data.date),
      paymentMethod: clampStr(data.paymentMethod, 60) || 'UPI',
      description: clampStr(data.description, 400),
      isUnnecessary: Boolean(data.isUnnecessary),
      isFixed: Boolean(data.isFixed),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteExpense(uid: string, id: string) {
  const path = `users/${uid}/expenses/${id}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'expenses', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Recurring Expenses CRUD ---
export async function addRecurringExpense(uid: string, data: Omit<RecurringExpense, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) {
  const path = `users/${uid}/recurring_expenses`;
  try {
    await addDoc(userCol(uid, 'recurring_expenses'), {
      userId: uid,
      name: clampStr(data.name, 140) || 'Recurring Payment',
      category: clampStr(data.category, 60) || 'Other Recurring',
      amount: clampNum(data.amount, 1),
      dueDay: clampNum(data.dueDay, 1, 31),
      frequency: data.frequency || 'Monthly',
      paymentMethod: clampStr(data.paymentMethod, 60) || 'UPI',
      reminderDaysBefore: clampNum(data.reminderDaysBefore ?? 3, 0, 30),
      active: Boolean(data.active),
      lastLoggedMonth: clampStr(data.lastLoggedMonth, 10),
      description: clampStr(data.description, 400),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateRecurringExpense(uid: string, id: string, data: Omit<RecurringExpense, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'lastLoggedMonth'>) {
  const path = `users/${uid}/recurring_expenses/${id}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'recurring_expenses', id), {
      name: clampStr(data.name, 140) || 'Recurring Payment',
      category: clampStr(data.category, 60) || 'Other Recurring',
      amount: clampNum(data.amount, 1),
      dueDay: clampNum(data.dueDay, 1, 31),
      frequency: data.frequency || 'Monthly',
      paymentMethod: clampStr(data.paymentMethod, 60) || 'UPI',
      reminderDaysBefore: clampNum(data.reminderDaysBefore ?? 3, 0, 30),
      active: Boolean(data.active),
      description: clampStr(data.description, 400),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function markRecurringLoggedForMonth(uid: string, id: string, monthKey: string) {
  const path = `users/${uid}/recurring_expenses/${id}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'recurring_expenses', id), {
      lastLoggedMonth: clampStr(monthKey, 10),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteRecurringExpense(uid: string, id: string) {
  const path = `users/${uid}/recurring_expenses/${id}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'recurring_expenses', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Budgets CRUD ---
export async function addBudget(uid: string, data: Omit<Budget, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) {
  const path = `users/${uid}/budgets`;
  try {
    await addDoc(userCol(uid, 'budgets'), {
      userId: uid,
      category: clampStr(data.category, 60) || 'Food',
      limitAmount: clampNum(data.limitAmount, 1),
      period: data.period === 'Weekly' ? 'Weekly' : 'Monthly',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateBudget(uid: string, id: string, data: Omit<Budget, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) {
  const path = `users/${uid}/budgets/${id}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'budgets', id), {
      category: clampStr(data.category, 60) || 'Food',
      limitAmount: clampNum(data.limitAmount, 1),
      period: data.period === 'Weekly' ? 'Weekly' : 'Monthly',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteBudget(uid: string, id: string) {
  const path = `users/${uid}/budgets/${id}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'budgets', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Savings Goals & Contributions ---
export async function addSavingsGoal(uid: string, data: Omit<SavingsGoal, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) {
  const path = `users/${uid}/savings_goals`;
  try {
    await addDoc(userCol(uid, 'savings_goals'), {
      userId: uid,
      title: clampStr(data.title, 140) || 'Savings Goal',
      category: clampStr(data.category, 60) || 'Personal Savings',
      targetAmount: clampNum(data.targetAmount, 1),
      currentSavings: clampNum(data.currentSavings, 0),
      targetDate: ensureDateISO(data.targetDate),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateSavingsGoal(uid: string, id: string, data: Omit<SavingsGoal, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) {
  const path = `users/${uid}/savings_goals/${id}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'savings_goals', id), {
      title: clampStr(data.title, 140) || 'Savings Goal',
      category: clampStr(data.category, 60) || 'Personal Savings',
      targetAmount: clampNum(data.targetAmount, 1),
      currentSavings: clampNum(data.currentSavings, 0),
      targetDate: ensureDateISO(data.targetDate),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function contributeToSavingsGoal(uid: string, goal: SavingsGoal, amount: number, date: string, note: string) {
  const contribPath = `users/${uid}/savings_contributions`;
  try {
    const safeAmount = clampNum(amount, 1);
    const newTotal = clampNum(goal.currentSavings + safeAmount, 0);
    await addDoc(userCol(uid, 'savings_contributions'), {
      userId: uid,
      goalId: goal.id,
      goalTitle: clampStr(goal.title, 140),
      amount: safeAmount,
      date: ensureDateISO(date),
      note: clampStr(note, 300),
      createdAt: serverTimestamp(),
    });
    await updateDoc(doc(db, 'users', uid, 'savings_goals', goal.id), {
      currentSavings: newTotal,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, contribPath);
  }
}

export async function deleteSavingsGoal(uid: string, id: string) {
  const path = `users/${uid}/savings_goals/${id}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'savings_goals', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Bills CRUD ---
export async function addBill(uid: string, data: Omit<Bill, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) {
  const path = `users/${uid}/bills`;
  try {
    const payload: Record<string, unknown> = {
      userId: uid,
      title: clampStr(data.title, 140) || 'Bill',
      category: clampStr(data.category, 60) || 'Other Expenses',
      amount: clampNum(data.amount, 1),
      dueDate: ensureDateISO(data.dueDate),
      status: data.status || 'Upcoming',
      paymentMethod: clampStr(data.paymentMethod, 60) || 'UPI',
      paidMonth: clampStr(data.paidMonth, 10),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (data.recurringId) payload.recurringId = clampStr(data.recurringId, 128);
    await addDoc(userCol(uid, 'bills'), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateBillStatus(uid: string, id: string, status: Bill['status'], paidMonth = '') {
  const path = `users/${uid}/bills/${id}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'bills', id), {
      status,
      paidMonth: clampStr(paidMonth, 10),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteBill(uid: string, id: string) {
  const path = `users/${uid}/bills/${id}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'bills', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Loans & Borrowed/Lent CRUD ---
export async function addLoan(uid: string, data: Omit<Loan, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) {
  const path = `users/${uid}/loans`;
  try {
    await addDoc(userCol(uid, 'loans'), {
      userId: uid,
      title: clampStr(data.title, 140) || 'Loan',
      loanType: data.loanType,
      counterparty: clampStr(data.counterparty, 120) || 'Bank / Individual',
      principalAmount: clampNum(data.principalAmount, 1),
      remainingAmount: clampNum(data.remainingAmount, 0),
      emiAmount: clampNum(data.emiAmount, 0),
      interestRate: clampNum(data.interestRate ?? 0, 0, 100),
      dueDay: clampNum(data.dueDay ?? 5, 1, 31),
      startDate: ensureDateISO(data.startDate),
      endDate: clampStr(data.endDate, 10),
      status: data.status || 'Active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function recordLoanPayment(uid: string, loan: Loan, paidAmount: number) {
  const path = `users/${uid}/loans/${loan.id}`;
  try {
    const nextRemaining = Math.max(0, loan.remainingAmount - clampNum(paidAmount, 1));
    const nextStatus: Loan['status'] = nextRemaining <= 0 ? 'Closed' : 'Active';
    await updateDoc(doc(db, 'users', uid, 'loans', loan.id), {
      remainingAmount: nextRemaining,
      status: nextStatus,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteLoan(uid: string, id: string) {
  const path = `users/${uid}/loans/${id}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'loans', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Subscriptions CRUD ---
export async function addSubscription(uid: string, data: Omit<Subscription, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) {
  const path = `users/${uid}/subscriptions`;
  try {
    await addDoc(userCol(uid, 'subscriptions'), {
      userId: uid,
      name: clampStr(data.name, 120) || 'Subscription',
      amount: clampNum(data.amount, 1, 100000000),
      billingCycle: data.billingCycle === 'Yearly' ? 'Yearly' : 'Monthly',
      nextBillingDate: ensureDateISO(data.nextBillingDate),
      paymentMethod: clampStr(data.paymentMethod, 60) || 'UPI',
      category: clampStr(data.category, 60) || 'Subscriptions',
      active: Boolean(data.active),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function toggleSubscriptionActive(uid: string, sub: Subscription) {
  const path = `users/${uid}/subscriptions/${sub.id}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'subscriptions', sub.id), {
      active: !sub.active,
      nextBillingDate: sub.nextBillingDate,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteSubscription(uid: string, id: string) {
  const path = `users/${uid}/subscriptions/${id}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'subscriptions', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Payment Methods CRUD ---
export async function addPaymentMethod(uid: string, data: Omit<PaymentMethod, 'id' | 'userId' | 'createdAt'>) {
  const path = `users/${uid}/payment_methods`;
  try {
    await addDoc(userCol(uid, 'payment_methods'), {
      userId: uid,
      name: clampStr(data.name, 80) || 'Payment Method',
      type: clampStr(data.type, 40) || 'UPI',
      lastFour: clampStr(data.lastFour, 10),
      monthlyLimit: clampNum(data.monthlyLimit ?? 0, 0, 100000000),
      isDefault: Boolean(data.isDefault),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deletePaymentMethod(uid: string, id: string) {
  const path = `users/${uid}/payment_methods/${id}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'payment_methods', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Notifications ---
export async function createNotificationIfNew(
  uid: string,
  existingNotifications: NotificationItem[],
  item: Omit<NotificationItem, 'id' | 'userId' | 'createdAt'>
) {
  if (item.dedupeKey && existingNotifications.some((n) => n.dedupeKey === item.dedupeKey)) {
    return;
  }
  const path = `users/${uid}/notifications`;
  try {
    await addDoc(userCol(uid, 'notifications'), {
      userId: uid,
      title: clampStr(item.title, 140),
      message: clampStr(item.message, 400),
      type: clampStr(item.type, 40),
      severity: item.severity,
      isRead: false,
      dedupeKey: clampStr(item.dedupeKey, 120),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function markNotificationRead(uid: string, id: string) {
  const path = `users/${uid}/notifications/${id}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'notifications', id), { isRead: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteNotification(uid: string, id: string) {
  const path = `users/${uid}/notifications/${id}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'notifications', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Realistic Sample Data Seeder ---
export async function seedRealisticSampleData(uid: string, email: string, displayName: string) {
  await ensureUserProfile(uid, email, displayName);
  const m0 = currentMonthKey();
  const m1 = shiftMonthKey(m0, -1);
  const m2 = shiftMonthKey(m0, -2);
  const today = todayISO();

  const batch = writeBatch(db);

  batch.update(userDocRef(uid), {
    monthlySalaryTarget: 65000,
    dailySpendLimit: 1500,
    weeklySpendLimit: 9000,
    monthlySpendLimit: 42000,
    monthlySavingsTarget: 22000,
    noSpendDays: [`${m0}-04`, `${m0}-09`, `${m0}-14`],
    updatedAt: serverTimestamp(),
  });

  const sampleIncomes = [
    { title: 'Monthly Tech Salary', amount: 65000, category: 'Monthly Salary', date: `${m0}-01`, description: 'Net credited salary' },
    { title: 'UI Consulting Freelance', amount: 12000, category: 'Freelance Income', date: `${m0}-10`, description: 'Landing page audit' },
    { title: 'Monthly Tech Salary', amount: 65000, category: 'Monthly Salary', date: `${m1}-01`, description: 'Net credited salary' },
    { title: 'Quarterly Performance Bonus', amount: 8500, category: 'Bonuses', date: `${m1}-15`, description: 'Q3 delivery bonus' },
    { title: 'Monthly Tech Salary', amount: 62000, category: 'Monthly Salary', date: `${m2}-01`, description: 'Net credited salary' },
  ];

  for (const inc of sampleIncomes) {
    const ref = doc(userCol(uid, 'income'));
    batch.set(ref, { ...inc, userId: uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  }

  const sampleExpenses = [
    { name: 'House Rent (Koramangala)', amount: 18000, category: 'Rent', date: `${m0}-02`, paymentMethod: 'Net Banking', description: 'Monthly 1BHK rent', isUnnecessary: false, isFixed: true },
    { name: 'BESCOM Electricity Bill', amount: 1450, category: 'Electricity', date: `${m0}-05`, paymentMethod: 'UPI', description: 'Monthly power bill', isUnnecessary: false, isFixed: true },
    { name: 'ACT Fibernet WiFi', amount: 1099, category: 'Internet', date: `${m0}-06`, paymentMethod: 'UPI', description: '150 Mbps plan', isUnnecessary: false, isFixed: true },
    { name: 'BigBasket Weekly Groceries', amount: 3400, category: 'Groceries', date: `${m0}-07`, paymentMethod: 'Debit Card', description: 'Vegetables, staples & dairy', isUnnecessary: false, isFixed: false },
    { name: 'Swiggy & Cafe Orders', amount: 2650, category: 'Food', date: `${m0}-11`, paymentMethod: 'UPI', description: 'Late night & weekend orders', isUnnecessary: true, isFixed: false },
    { name: 'Myntra Sneakers & Apparel', amount: 4200, category: 'Shopping', date: `${m0}-13`, paymentMethod: 'Credit Card', description: 'Impulse weekend sale order', isUnnecessary: true, isFixed: false },
    { name: 'Shell Petrol Refill', amount: 1800, category: 'Petrol', date: `${m0}-15`, paymentMethod: 'UPI', description: 'Two-wheeler fuel', isUnnecessary: false, isFixed: false },
    { name: 'Bike Loan EMI', amount: 4800, category: 'EMI and Loans', date: `${m0}-05`, paymentMethod: 'Net Banking', description: 'HDFC Auto EMI #14', isUnnecessary: false, isFixed: true },
    { name: 'PVR IMAX Movie & Snacks', amount: 1250, category: 'Entertainment', date: `${m0}-17`, paymentMethod: 'Credit Card', description: 'Weekend movie outing', isUnnecessary: true, isFixed: false },
    { name: 'Local Grocery & Milk', amount: 480, category: 'Groceries', date: today, paymentMethod: 'UPI', description: 'Daily essentials', isUnnecessary: false, isFixed: false },
    // Previous months for real comparison
    { name: 'House Rent', amount: 18000, category: 'Rent', date: `${m1}-02`, paymentMethod: 'Net Banking', description: 'Monthly rent', isUnnecessary: false, isFixed: true },
    { name: 'Electricity & Water', amount: 1700, category: 'Electricity', date: `${m1}-06`, paymentMethod: 'UPI', description: 'Utility bills', isUnnecessary: false, isFixed: true },
    { name: 'Groceries & Produce', amount: 4900, category: 'Groceries', date: `${m1}-12`, paymentMethod: 'Debit Card', description: 'Monthly groceries', isUnnecessary: false, isFixed: false },
    { name: 'Dining & Food Delivery', amount: 3100, category: 'Food', date: `${m1}-18`, paymentMethod: 'UPI', description: 'Restaurants', isUnnecessary: true, isFixed: false },
    { name: 'Online Shopping', amount: 5400, category: 'Shopping', date: `${m1}-22`, paymentMethod: 'Credit Card', description: 'Gadgets & clothes', isUnnecessary: true, isFixed: false },
    { name: 'Bike Loan EMI', amount: 4800, category: 'EMI and Loans', date: `${m1}-05`, paymentMethod: 'Net Banking', description: 'HDFC Auto EMI #13', isUnnecessary: false, isFixed: true },
    { name: 'House Rent', amount: 18000, category: 'Rent', date: `${m2}-02`, paymentMethod: 'Net Banking', description: 'Monthly rent', isUnnecessary: false, isFixed: true },
    { name: 'Groceries & Utilities', amount: 6200, category: 'Groceries', date: `${m2}-10`, paymentMethod: 'Debit Card', description: 'Monthly household', isUnnecessary: false, isFixed: false },
    { name: 'Bike Loan EMI', amount: 4800, category: 'EMI and Loans', date: `${m2}-05`, paymentMethod: 'Net Banking', description: 'HDFC Auto EMI #12', isUnnecessary: false, isFixed: true },
  ];

  for (const exp of sampleExpenses) {
    const ref = doc(userCol(uid, 'expenses'));
    batch.set(ref, { ...exp, userId: uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  }

  const sampleRecurring = [
    { name: 'House Rent', category: 'House Rent', amount: 18000, dueDay: 2, frequency: 'Monthly', paymentMethod: 'Net Banking', reminderDaysBefore: 3, active: true, lastLoggedMonth: m0, description: 'Monthly landlord transfer' },
    { name: 'Electricity Bill', category: 'Electricity', amount: 1450, dueDay: 5, frequency: 'Monthly', paymentMethod: 'UPI', reminderDaysBefore: 3, active: true, lastLoggedMonth: m0, description: 'BESCOM power' },
    { name: 'ACT Fibernet WiFi', category: 'Internet', amount: 1099, dueDay: 6, frequency: 'Monthly', paymentMethod: 'UPI', reminderDaysBefore: 2, active: true, lastLoggedMonth: m0, description: 'Home broadband' },
    { name: 'Health Insurance', category: 'Insurance', amount: 12000, dueDay: 28, frequency: 'Yearly', paymentMethod: 'Net Banking', reminderDaysBefore: 7, active: true, lastLoggedMonth: '', description: 'Annual policy renewal' },
  ];

  for (const rec of sampleRecurring) {
    const ref = doc(userCol(uid, 'recurring_expenses'));
    batch.set(ref, { ...rec, userId: uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  }

  const sampleBudgets = [
    { category: 'Food', limitAmount: 3000, period: 'Monthly' },
    { category: 'Groceries', limitAmount: 5500, period: 'Monthly' },
    { category: 'Shopping', limitAmount: 3500, period: 'Monthly' },
    { category: 'Entertainment', limitAmount: 1500, period: 'Monthly' },
    { category: 'Petrol', limitAmount: 2500, period: 'Monthly' },
  ];

  for (const b of sampleBudgets) {
    const ref = doc(userCol(uid, 'budgets'));
    batch.set(ref, { ...b, userId: uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  }

  const sampleGoals = [
    { title: '6-Month Emergency Fund', category: 'Emergency Fund', targetAmount: 180000, currentSavings: 95000, targetDate: '2027-08-01' },
    { title: 'MacBook Pro M4 Upgrade', category: 'Laptop', targetAmount: 145000, currentSavings: 62000, targetDate: '2027-04-15' },
    { title: 'Kerala Family Trip', category: 'Travel', targetAmount: 45000, currentSavings: 18000, targetDate: '2027-02-10' },
  ];

  for (const g of sampleGoals) {
    const ref = doc(userCol(uid, 'savings_goals'));
    batch.set(ref, { ...g, userId: uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  }

  const sampleBills = [
    { title: 'Jio Fiber & Mobile Postpaid', category: 'Mobile Recharge', amount: 799, dueDate: `${m0}-27`, status: 'Upcoming', paymentMethod: 'UPI', paidMonth: '' },
    { title: 'Water Maintenance Charge', category: 'Water', amount: 650, dueDate: `${m0}-28`, status: 'Upcoming', paymentMethod: 'UPI', paidMonth: '' },
    { title: 'House Rent', category: 'Rent', amount: 18000, dueDate: `${m0}-02`, status: 'Paid', paymentMethod: 'Net Banking', paidMonth: m0 },
  ];

  for (const bill of sampleBills) {
    const ref = doc(userCol(uid, 'bills'));
    batch.set(ref, { ...bill, userId: uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  }

  const sampleLoans = [
    { title: 'Royal Enfield Bike EMI', loanType: 'EMI / Bank Loan', counterparty: 'HDFC Bank', principalAmount: 140000, remainingAmount: 72000, emiAmount: 4800, interestRate: 9.5, dueDay: 5, startDate: '2025-09-01', endDate: '2028-02-01', status: 'Active' },
    { title: 'Lent to Rohan (Medical)', loanType: 'Money Lent', counterparty: 'Rohan Sharma', principalAmount: 10000, remainingAmount: 6000, emiAmount: 2000, interestRate: 0, dueDay: 10, startDate: '2026-09-10', endDate: '2027-01-10', status: 'Active' },
  ];

  for (const loan of sampleLoans) {
    const ref = doc(userCol(uid, 'loans'));
    batch.set(ref, { ...loan, userId: uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  }

  const sampleSubs = [
    { name: 'Netflix Standard', amount: 649, billingCycle: 'Monthly', nextBillingDate: `${m0}-28`, paymentMethod: 'Credit Card', category: 'Subscriptions', active: true },
    { name: 'Spotify Duo', amount: 149, billingCycle: 'Monthly', nextBillingDate: `${m0}-26`, paymentMethod: 'UPI', category: 'Subscriptions', active: true },
    { name: 'Google One 200GB', amount: 2100, billingCycle: 'Yearly', nextBillingDate: '2027-03-14', paymentMethod: 'Credit Card', category: 'Subscriptions', active: true },
  ];

  for (const sub of sampleSubs) {
    const ref = doc(userCol(uid, 'subscriptions'));
    batch.set(ref, { ...sub, userId: uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  }

  const sampleNotifs = [
    {
      title: 'Shopping Budget Exceeded (120%)',
      message: `You spent ${formatINR(4200)} against your ${formatINR(3500)} Shopping budget this month.`,
      type: 'Budget',
      severity: 'alert',
      isRead: false,
      dedupeKey: `seed-budget-shopping-${m0}`,
    },
    {
      title: 'Upcoming Bill: Jio Fiber & Mobile',
      message: `${formatINR(799)} due on ${m0}-27 via UPI.`,
      type: 'Bill',
      severity: 'warning',
      isRead: false,
      dedupeKey: `seed-bill-jio-${m0}`,
    },
    {
      title: 'Emergency Fund Milestone (52%)',
      message: `Your Emergency Fund reached ${formatINR(95000)} of ${formatINR(180000)}.`,
      type: 'Milestone',
      severity: 'success',
      isRead: false,
      dedupeKey: `seed-goal-ef-${m0}`,
    },
  ];

  for (const n of sampleNotifs) {
    const ref = doc(userCol(uid, 'notifications'));
    batch.set(ref, { ...n, userId: uid, createdAt: serverTimestamp() });
  }

  await batch.commit();
}

export async function clearUserFinancialData(uid: string) {
  const collections = [
    'income',
    'expenses',
    'recurring_expenses',
    'budgets',
    'savings_goals',
    'savings_contributions',
    'bills',
    'loans',
    'subscriptions',
    'notifications',
  ];
  for (const colName of collections) {
    const snap = await getDocs(query(userCol(uid, colName), where('userId', '==', uid)));
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    if (!snap.empty) {
      await batch.commit();
    }
  }
}
