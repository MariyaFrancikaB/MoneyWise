// Verification test specification for MoneyWise Firestore Security Rules.
// Verifies the Dirty Dozen adversarial payloads against expected PERMISSION_DENIED outcomes.

export interface DirtyDozenCase {
  id: number;
  name: string;
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  auth: { uid: string; email_verified: boolean } | null;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_CASES: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Cross-user expense read',
    path: '/users/userB/expenses/exp_001',
    operation: 'get',
    auth: { uid: 'userA', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Cross-user income list',
    path: '/users/userB/income',
    operation: 'list',
    auth: { uid: 'userA', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Identity spoofing on create',
    path: '/users/userA/expenses/exp_002',
    operation: 'create',
    auth: { uid: 'userA', email_verified: true },
    payload: {
      userId: 'userB',
      name: 'Coffee',
      amount: 250,
      category: 'Food',
      date: '2026-11-23',
      paymentMethod: 'UPI',
      description: '',
      isUnnecessary: true,
      isFixed: false,
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Shadow field injection on budget create',
    path: '/users/userA/budgets/bud_001',
    operation: 'create',
    auth: { uid: 'userA', email_verified: true },
    payload: {
      userId: 'userA',
      category: 'Food',
      limitAmount: 5000,
      period: 'Monthly',
      isAdmin: true,
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Shadow update injection on expense',
    path: '/users/userA/expenses/exp_001',
    operation: 'update',
    auth: { uid: 'userA', email_verified: true },
    payload: {
      amount: 300,
      extraField: 'hack',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Immutable createdAt tampering on income update',
    path: '/users/userA/income/inc_001',
    operation: 'update',
    auth: { uid: 'userA', email_verified: true },
    payload: {
      createdAt: '2020-01-01T00:00:00Z',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Client-forged updatedAt timestamp',
    path: '/users/userA/expenses/exp_001',
    operation: 'create',
    auth: { uid: 'userA', email_verified: true },
    payload: {
      userId: 'userA',
      name: 'Lunch',
      amount: 180,
      category: 'Food',
      date: '2026-11-23',
      paymentMethod: 'Cash',
      description: '',
      isUnnecessary: false,
      isFixed: false,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Negative amount poisoning',
    path: '/users/userA/expenses/exp_003',
    operation: 'create',
    auth: { uid: 'userA', email_verified: true },
    payload: {
      userId: 'userA',
      name: 'Negative hack',
      amount: -5000,
      category: 'Food',
      date: '2026-11-23',
      paymentMethod: 'UPI',
      description: '',
      isUnnecessary: false,
      isFixed: false,
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Oversized description string',
    path: '/users/userA/expenses/exp_004',
    operation: 'create',
    auth: { uid: 'userA', email_verified: true },
    payload: {
      userId: 'userA',
      name: 'Oversized',
      amount: 100,
      category: 'Food',
      date: '2026-11-23',
      paymentMethod: 'UPI',
      description: 'x'.repeat(5000),
      isUnnecessary: false,
      isFixed: false,
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Invalid document ID injection',
    path: '/users/userA/expenses/bad$id..dots',
    operation: 'create',
    auth: { uid: 'userA', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Unbounded array injection on user profile',
    path: '/users/userA',
    operation: 'update',
    auth: { uid: 'userA', email_verified: true },
    payload: {
      noSpendDays: Array.from({ length: 45 }, (_, i) => `2026-11-${String((i % 28) + 1).padStart(2, '0')}`),
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Unverified email write attempt',
    path: '/users/userA/savings_goals/goal_001',
    operation: 'create',
    auth: { uid: 'userA', email_verified: false },
    payload: {
      userId: 'userA',
      title: 'Emergency Fund',
      category: 'Emergency Fund',
      targetAmount: 100000,
      currentSavings: 0,
      targetDate: '2027-06-01',
    },
    expected: 'PERMISSION_DENIED',
  },
];
