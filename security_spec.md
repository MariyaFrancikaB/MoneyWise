# MoneyWise Security Specification

## 1. Data Invariants
1. **Strict Multi-Tenant Isolation**: Every document in `/users/{userId}` and all subcollections (`income`, `expenses`, `recurring_expenses`, `budgets`, `savings_goals`, `savings_contributions`, `bills`, `loans`, `subscriptions`, `payment_methods`, `notifications`) is strictly owned by `userId == request.auth.uid`.
2. **Email Verification Gate**: All authenticated read/write operations require `request.auth != null && request.auth.token.email_verified == true`.
3. **Immutable Ownership & Creation Timestamps**: `uid` / `userId` and `createdAt` cannot be modified after creation (`incoming().userId == existing().userId`, `incoming().createdAt == existing().createdAt`).
4. **Server-Side Temporal Integrity**: `createdAt` and `updatedAt` must equal `request.time`.
5. **Bounded Types & Strict Allowlisted Keys**: Every collection enforces exact `keys().hasAll(...)` and `keys().hasOnly(...)` on create, `affectedKeys().hasOnly(...)` on update, positive numeric bounds where applicable, and string `.size()` limits to prevent storage exhaustion.
6. **Path ID Hardening**: Single-document reads and writes verify `isValidId(id)` (`^[a-zA-Z0-9_\-]+$`, max 128 chars).

## 2. Dirty Dozen Attack Payloads (Expected: PERMISSION_DENIED)
1. **Cross-User Read**: User A attempts `getDoc('/users/userB/expenses/exp1')`.
2. **Cross-User List**: User A attempts `getDocs('/users/userB/income')`.
3. **Identity Spoofing on Create**: User A writes to `/users/userA/expenses/exp1` with `userId: "userB"`.
4. **Shadow Field Injection on Create**: User A includes `"isAdmin": true` in `/users/userA/budgets/b1`.
5. **Shadow Update Injection**: User A updates `/users/userA/expenses/exp1` adding `"extraField": "hack"`.
6. **Immutable `createdAt` Tampering**: User A updates `createdAt` to an older timestamp on an existing income entry.
7. **Client-Forged `updatedAt` Timestamp**: User A sets `updatedAt` to a past date instead of `serverTimestamp()`.
8. **Negative Amount Poisoning**: User A submits `amount: -5000` on an expense or income document.
9. **Oversized String / Denial of Wallet**: User A submits a 5,000-char `description` exceeding the 400-char limit.
10. **Invalid Document ID Injection**: User A creates a document with ID `"bad$id..with.dots"` or > 128 chars.
11. **Unbounded Array Injection on User Profile**: User A pushes > 31 items into `noSpendDays`.
12. **Unverified Email Write**: An authenticated user with `email_verified: false` attempts to create a savings goal.
