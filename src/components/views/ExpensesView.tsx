import { useMemo, useState } from 'react';
import { Edit2, Plus, Search, Trash2 } from 'lucide-react';
import {
  EXPENSE_CATEGORIES,
  PAYMENT_METHOD_TYPES,
  type ExpenseEntry,
} from '../../types/finance';
import { formatDateShort, formatINR } from '../../utils/formatters';

interface ExpensesViewProps {
  expenses: ExpenseEntry[];
  onOpenAdd: () => void;
  onOpenEdit: (expense: ExpenseEntry) => void;
  onDelete: (id: string) => Promise<void>;
}

export function ExpensesView({ expenses, onOpenAdd, onOpenEdit, onDelete }: ExpensesViewProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [methodFilter, setMethodFilter] = useState('All');
  const [onlyUnnecessary, setOnlyUnnecessary] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...expenses]
      .filter((e) => {
        if (categoryFilter !== 'All' && e.category !== categoryFilter) return false;
        if (methodFilter !== 'All' && e.paymentMethod !== methodFilter) return false;
        if (onlyUnnecessary && !e.isUnnecessary) return false;
        if (
          q &&
          !e.name.toLowerCase().includes(q) &&
          !e.category.toLowerCase().includes(q) &&
          !(e.description || '').toLowerCase().includes(q)
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [expenses, search, categoryFilter, methodFilter, onlyUnnecessary]);

  const totalFiltered = useMemo(
    () => filtered.reduce((sum, e) => sum + e.amount, 0),
    [filtered]
  );

  return (
    <div className="space-y-6">
      <div className="bg-[#131020] border border-violet-500/15 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search expense, merchant, notes..."
              className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[#0b0914] border border-violet-500/20 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-400"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2.5 rounded-xl bg-[#0b0914] border border-violet-500/20 text-xs text-slate-200 focus:outline-none"
          >
            <option value="All">All 18 Categories</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="px-3 py-2.5 rounded-xl bg-[#0b0914] border border-violet-500/20 text-xs text-slate-200 focus:outline-none"
          >
            <option value="All">All Payment Methods</option>
            {PAYMENT_METHOD_TYPES.map((pm) => (
              <option key={pm} value={pm}>
                {pm}
              </option>
            ))}
          </select>

          <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer px-2">
            <input
              type="checkbox"
              checked={onlyUnnecessary}
              onChange={(e) => setOnlyUnnecessary(e.target.checked)}
              className="rounded border-violet-500/40 bg-[#0b0914] text-rose-500"
            />
            Avoidable Only
          </label>
        </div>

        <div className="flex items-center justify-between lg:justify-end gap-4 shrink-0">
          <div className="text-right">
            <p className="text-[11px] text-slate-400">Filtered Total ({filtered.length})</p>
            <p className="text-base font-bold font-mono tabular-nums text-white">{formatINR(totalFiltered)}</p>
          </div>
          <button
            type="button"
            onClick={onOpenAdd}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Add / Voice / Scan
          </button>
        </div>
      </div>

      <div className="bg-[#131020] border border-violet-500/15 rounded-2xl p-6">
        {filtered.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-slate-400">No expenses found matching your filters.</p>
            <button
              type="button"
              onClick={onOpenAdd}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Record Expense
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-violet-500/15 text-xs text-slate-400">
                  <th className="py-2.5 pr-4 font-medium">Expense</th>
                  <th className="py-2.5 px-4 font-medium">Category</th>
                  <th className="py-2.5 px-4 font-medium">Payment</th>
                  <th className="py-2.5 px-4 font-medium">Date</th>
                  <th className="py-2.5 px-4 font-medium text-right">Amount</th>
                  <th className="py-2.5 pl-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-violet-500/10 text-sm">
                {filtered.map((exp) => (
                  <tr key={exp.id} className="hover:bg-violet-500/5 transition-colors">
                    <td className="py-3 pr-4">
                      <p className="font-medium text-white">{exp.name}</p>
                      <p className="text-xs text-slate-400">
                        {exp.isFixed ? 'Fixed' : 'Variable'}
                        {exp.isUnnecessary ? ' · Discretionary' : ''}
                        {exp.description ? ` · ${exp.description}` : ''}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-300">{exp.category}</td>
                    <td className="py-3 px-4 text-xs text-slate-300">{exp.paymentMethod}</td>
                    <td className="py-3 px-4 text-xs font-mono tabular-nums text-slate-400">
                      {formatDateShort(exp.date)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-rose-300">
                      {formatINR(exp.amount)}
                    </td>
                    <td className="py-3 pl-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onOpenEdit(exp)}
                          aria-label="Edit expense"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-violet-500/15 cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(exp.id)}
                          aria-label="Delete expense"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/15 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
