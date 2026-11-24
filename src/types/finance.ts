export type NavSection =
  | 'dashboard'
  | 'income'
  | 'expenses'
  | 'rent-bills'
  | 'budgets'
  | 'savings'
  | 'analytics'
  | 'assistant'
  | 'reports'
  | 'settings';

export const INCOME_CATEGORIES = [
  'Monthly Salary',
  'Part-time Income',
  'Freelance Income',
  'Business Income',
  'Bonuses',
  'Other Income',
] as const;

export const EXPENSE_CATEGORIES = [
  'Food',
  'Groceries',
  'Rent',
  'Electricity',
  'Water',
  'Internet',
  'Mobile Recharge',
  'Transportation',
  'Petrol',
  'Shopping',
  'Entertainment',
  'Education',
  'Medical',
  'Travel',
  'Subscriptions',
  'EMI and Loans',
  'Personal Care',
  'Other Expenses',
] as const;

export const RECURRING_CATEGORIES = [
  'House Rent',
  'Electricity',
  'Water',
  'Internet',
  'Mobile Bills',
  'Insurance',
  'Loan EMI',
  'Subscriptions',
  'Other Recurring',
] as const;

export const SAVINGS_CATEGORIES = [
  'Emergency Fund',
  'Mobile Phone',
  'Laptop',
  'Education',
  'Travel',
  'House',
  'Personal Savings',
] as const;

export const PAYMENT_METHOD_TYPES = [
  'UPI',
  'Cash',
  'Debit Card',
  'Credit Card',
  'Net Banking',
] as const;

export const LOAN_TYPES = [
  'EMI / Bank Loan',
  'Money Borrowed',
  'Money Lent',
] as const;

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  monthlySalaryTarget: number;
  dailySpendLimit: number;
  weeklySpendLimit: number;
  monthlySpendLimit: number;
  monthlySavingsTarget: number;
  noSpendDays: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface IncomeEntry {
  id: string;
  userId: string;
  title: string;
  amount: number;
  category: string;
  date: string;
  description?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ExpenseEntry {
  id: string;
  userId: string;
  name: string;
  amount: number;
  category: string;
  date: string;
  paymentMethod: string;
  description?: string;
  isUnnecessary: boolean;
  isFixed: boolean;
  recurringId?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface RecurringExpense {
  id: string;
  userId: string;
  name: string;
  category: string;
  amount: number;
  dueDay: number;
  frequency: 'Monthly' | 'Quarterly' | 'Yearly';
  paymentMethod: string;
  reminderDaysBefore: number;
  active: boolean;
  lastLoggedMonth?: string;
  description?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Budget {
  id: string;
  userId: string;
  category: string;
  limitAmount: number;
  period: 'Monthly' | 'Weekly';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SavingsGoal {
  id: string;
  userId: string;
  title: string;
  category: string;
  targetAmount: number;
  currentSavings: number;
  targetDate: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SavingsContribution {
  id: string;
  userId: string;
  goalId: string;
  goalTitle: string;
  amount: number;
  date: string;
  note?: string;
  createdAt?: unknown;
}

export interface Bill {
  id: string;
  userId: string;
  title: string;
  category: string;
  amount: number;
  dueDate: string;
  status: 'Upcoming' | 'Paid' | 'Overdue';
  paymentMethod: string;
  recurringId?: string;
  paidMonth?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Loan {
  id: string;
  userId: string;
  title: string;
  loanType: 'EMI / Bank Loan' | 'Money Borrowed' | 'Money Lent';
  counterparty: string;
  principalAmount: number;
  remainingAmount: number;
  emiAmount: number;
  interestRate?: number;
  dueDay?: number;
  startDate?: string;
  endDate?: string;
  status: 'Active' | 'Closed';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Subscription {
  id: string;
  userId: string;
  name: string;
  amount: number;
  billingCycle: 'Monthly' | 'Yearly';
  nextBillingDate: string;
  paymentMethod: string;
  category?: string;
  active: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PaymentMethod {
  id: string;
  userId: string;
  name: string;
  type: string;
  lastFour?: string;
  monthlyLimit?: number;
  isDefault: boolean;
  createdAt?: unknown;
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  severity: 'info' | 'warning' | 'alert' | 'success';
  isRead: boolean;
  dedupeKey?: string;
  createdAt?: unknown;
}
