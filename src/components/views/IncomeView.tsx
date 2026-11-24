import React, { useMemo, useState } from 'react';
import { Edit2, Plus, Trash2 } from 'lucide-react';
import { INCOME_CATEGORIES, type IncomeEntry } from '../../types/finance';
import { currentMonthKey, formatDateShort, formatINR, todayISO } from '../../utils/formatters';

interface IncomeViewProps {
  incomes: IncomeEntry[];
  onAdd: (data: Omit<IncomeEntry, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdate: (id: string, data: Omit<IncomeEntry, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function IncomeView({ incomes, onAdd, onUpdate, onDelete }: IncomeViewProps) {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<string>('Monthly Salary');
  const [date, setDate] = useState(todayISO());
  const [description, setDescription] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterCat, setFilterCat] = useState<string>('All');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const monthKey = currentMonthKey();

  const stats = useMemo(() => {
    const thisMonth = incomes.filter((i) => i.date.startsWith(monthKey));
    const salary = thisMonth
      .filter((i) => i.category === 'Monthly Salary')
      .reduce((s, i) => s + i.amount, 0);
    const additional = thisMonth
      .filter((i) => i.category !== 'Monthly Salary')
      .reduce((s, i) => s + i.amount, 0);
    const allTime = incomes.reduce((s, i) => s + i.amount, 0);
    return { salary, additional, totalMonth: salary + additional, allTime };
  }, [incomes, monthKey]);

  const filtered = useMemo(() => {
    return [...incomes]
      .filter((i) => (filterCat === 'All' ? true : i.category === filterCat))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [incomes, filterCat]);

  const resetForm = () => {
    setTitle('');
    setAmount('');
    setCategory('Monthly Salary');
    setDate(todayISO());
    setDescription('');
    setEditingId(null);
    setError(null);
  };

  const startEdit = (entry: IncomeEntry) => {
    setEditingId(entry.id);
    setTitle(entry.title);
    setAmount(String(entry.amount));
    setCategory(entry.category);
    setDate(entry.date);
    setDescription(entry.description || '');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const num = Number(amount);
    if (!title.trim() || !Number.isFinite(num) || num <= 0) {
      setError('Enter a valid income title and amount greater than ₹0.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        amount: num,
        category,
        date,
        description: description.trim(),
      };
      if (editingId) {
        await onUpdate(editingId, payload);
      } else {
        await onAdd(payload);
      }
      resetForm();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save income record.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#131020] border border-violet-500/15 rounded-xl p-5">
          <p className="text-xs text-slate-400">Monthly Salary (This Month)</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-white mt-1.5">{formatINR(stats.salary)}</p>
        </div>
        <div className="bg-[#131020] border border-violet-500/15 rounded-xl p-5">
          <p className="text-xs text-slate-400">Additional Income (This Month)</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-emerald-400 mt-1.5">
            {formatINR(stats.additional)}
          </p>
        </div>
        <div className="bg-[#131020] border border-violet-500/15 rounded-xl p-5">
          <p className="text-xs text-slate-400">Total Monthly Income</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-violet-300 mt-1.5">
            {formatINR(stats.totalMonth)}
          </p>
        </div>
        <div className="bg-[#131020] border border-violet-500/15 rounded-xl p-5">
          <p className="text-xs text-slate-400">All-Time Recorded Income</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-slate-200 mt-1.5">{formatINR(stats.allTime)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Income Entry Form */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-4 bg-[#131020] border border-violet-500/15 rounded-2xl p-6 space-y-4 h-fit"
        >
          <h2 className="text-base font-semibold text-white">
            {editingId ? 'Edit Income Record' : 'Record Income'}
          </h2>
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-200">
              {error}
            </div>
          )}
          <div>
            <label className="block text-xs text-slate-300 mb-1.5">Title</label>
            <input
              type="text"
              required
              maxLength={140}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. November Salary"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0b0914] border border-violet-500/20 text-sm text-white focus:outline-none focus:border-violet-400"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-300 mb-1.5">Amount (₹)</label>
              <input
                type="number"
                required
                min="1"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="65000"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0b0914] border border-violet-500/20 text-sm font-mono text-white focus:outline-none focus:border-violet-400"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1.5">Date</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-[#0b0914] border border-violet-500/20 text-sm font-mono text-white focus:outline-none focus:border-violet-400"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-300 mb-1.5">Income Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-[#0b0914] border border-violet-500/20 text-sm text-white focus:outline-none focus:border-violet-400"
            >
              {INCOME_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-300 mb-1.5">Description</label>
            <textarea
              rows={2}
              maxLength={400}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Client, employer, or bonus notes"
              className="w-full px-3.5 py-2 rounded-xl bg-[#0b0914] border border-violet-500/20 text-sm text-white focus:outline-none focus:border-violet-400"
            />
          </div>
          <div className="flex items-center gap-2 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors cursor-pointer disabled:opacity-60"
            >
              <Plus className="w-4 h-4" />
              {saving ? 'Saving...' : editingId ? 'Update Income' : 'Add Income'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2.5 rounded-xl bg-[#1c1630] text-slate-300 text-sm cursor-pointer"
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        {/* Income Ledger */}
        <div className="lg:col-span-8 bg-[#131020] border border-violet-500/15 rounded-2xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 className="text-base font-semibold text-white">Income Ledger</h2>
            <select
              value={filterCat}
              onChange={(e) => setFilterCat(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[#0b0914] border border-violet-500/20 text-xs text-slate-200 focus:outline-none"
            >
              <option value="All">All Categories</option>
              {INCOME_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {filtered.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">
              No income records match this filter. Use the form on the left to add salary or side income.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-violet-500/15 text-xs text-slate-400">
                    <th className="py-2.5 pr-4 font-medium">Source</th>
                    <th className="py-2.5 px-4 font-medium">Category</th>
                    <th className="py-2.5 px-4 font-medium">Date</th>
                    <th className="py-2.5 px-4 font-medium text-right">Amount</th>
                    <th className="py-2.5 pl-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-violet-500/10 text-sm">
                  {filtered.map((item) => (
                    <tr key={item.id} className="hover:bg-violet-500/5 transition-colors">
                      <td className="py-3 pr-4">
                        <p className="font-medium text-white">{item.title}</p>
                        {item.description && <p className="text-xs text-slate-400">{item.description}</p>}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-300">{item.category}</td>
                      <td className="py-3 px-4 text-xs font-mono tabular-nums text-slate-400">
                        {formatDateShort(item.date)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-emerald-400">
                        +{formatINR(item.amount)}
                      </td>
                      <td className="py-3 pl-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => startEdit(item)}
                            aria-label="Edit income"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-violet-500/15 cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(item.id)}
                            aria-label="Delete income"
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
    </div>
  );
}
