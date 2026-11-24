import React, { useEffect, useState } from 'react';
import { CreditCard, Database, Plus, Save, Trash2, User } from 'lucide-react';
import { PAYMENT_METHOD_TYPES, type PaymentMethod, type UserProfile } from '../../types/finance';
import { formatINR, type FinancialSummary } from '../../utils/formatters';

interface SettingsViewProps {
  profile: UserProfile | null;
  paymentMethods: PaymentMethod[];
  summary: FinancialSummary;
  onUpdateProfile: (updates: { displayName: string; monthlySalaryTarget: number }) => Promise<void>;
  onAddPaymentMethod: (data: Omit<PaymentMethod, 'id' | 'userId' | 'createdAt'>) => Promise<void>;
  onDeletePaymentMethod: (id: string) => Promise<void>;
  onLoadSampleData: () => Promise<void>;
  onClearData: () => Promise<void>;
}

export function SettingsView({
  profile,
  paymentMethods,
  summary,
  onUpdateProfile,
  onAddPaymentMethod,
  onDeletePaymentMethod,
  onLoadSampleData,
  onClearData,
}: SettingsViewProps) {
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [salaryTarget, setSalaryTarget] = useState(String(profile?.monthlySalaryTarget ?? 0));
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.displayName || '');
    setSalaryTarget(String(profile.monthlySalaryTarget ?? 0));
  }, [profile]);

  const [pmName, setPmName] = useState('');
  const [pmType, setPmType] = useState<string>('UPI');
  const [pmLastFour, setPmLastFour] = useState('');
  const [pmLimit, setPmLimit] = useState('25000');

  const [busyData, setBusyData] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await onUpdateProfile({
        displayName: displayName.trim() || 'MoneyWise User',
        monthlySalaryTarget: Number(salaryTarget) || 0,
      });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2500);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAddPm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pmName.trim()) return;
    await onAddPaymentMethod({
      name: pmName.trim(),
      type: pmType,
      lastFour: pmLastFour.trim(),
      monthlyLimit: Number(pmLimit) || 0,
      isDefault: paymentMethods.length === 0,
    });
    setPmName('');
    setPmLastFour('');
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Profile Card */}
        <form
          onSubmit={handleSaveProfile}
          className="lg:col-span-5 bg-[#131020] border border-violet-500/15 rounded-2xl p-6 space-y-4 h-fit"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full overflow-hidden border border-violet-500/30 bg-[#1a142b] shrink-0">
              {!avatarError ? (
                <img
                  src="/src/assets/images/avatar_user_profile_1795505076085.jpg"
                  alt="User avatar"
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarError(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User className="w-6 h-6 text-violet-300" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-white truncate">{profile?.displayName || 'User Profile'}</h2>
              <p className="text-xs text-slate-400 truncate">{profile?.email}</p>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-300 mb-1.5">Display Name</label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0b0914] border border-violet-500/20 text-sm text-white"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-300 mb-1.5">Expected Monthly Salary (₹)</label>
            <input
              type="number"
              min="0"
              value={salaryTarget}
              onChange={(e) => setSalaryTarget(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0b0914] border border-violet-500/20 text-sm font-mono text-white"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              type="submit"
              disabled={savingProfile}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              {savingProfile ? 'Saving...' : 'Save Profile'}
            </button>
            {profileSaved && <span className="text-xs text-emerald-400">Profile saved</span>}
          </div>
        </form>

        {/* Payment Methods Manager */}
        <div className="lg:col-span-7 bg-[#131020] border border-violet-500/15 rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-violet-400" />
            <h2 className="text-base font-semibold text-white">Payment Methods (Cash, UPI, Cards)</h2>
          </div>

          <form onSubmit={handleAddPm} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <input
              type="text"
              required
              value={pmName}
              onChange={(e) => setPmName(e.target.value)}
              placeholder="Label (e.g. GPay UPI)"
              className="px-3 py-2 rounded-xl bg-[#0b0914] border border-violet-500/20 text-xs text-white"
            />
            <select
              value={pmType}
              onChange={(e) => setPmType(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[#0b0914] border border-violet-500/20 text-xs text-white"
            >
              {PAYMENT_METHOD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="0"
              value={pmLimit}
              onChange={(e) => setPmLimit(e.target.value)}
              placeholder="Monthly Limit ₹"
              className="px-3 py-2 rounded-xl bg-[#0b0914] border border-violet-500/20 text-xs font-mono text-white"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Method
            </button>
          </form>

          <div className="divide-y divide-violet-500/10">
            {paymentMethods.map((pm) => {
              const spentWithMethod =
                (summary.paymentMethodTotals[pm.type] ?? 0) +
                (pm.name !== pm.type ? summary.paymentMethodTotals[pm.name] ?? 0 : 0);
              return (
                <div key={pm.id} className="py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-white">
                      {pm.name} {pm.lastFour ? `· ${pm.lastFour}` : ''}
                    </p>
                    <p className="text-xs text-slate-400">
                      {pm.type} · Monthly spent {formatINR(spentWithMethod)}
                      {pm.monthlyLimit ? ` / Limit ${formatINR(pm.monthlyLimit)}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeletePaymentMethod(pm.id)}
                    aria-label="Delete payment method"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/15 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Data Management */}
      <div className="bg-[#131020] border border-violet-500/15 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-white">Sample Testing Data & Workspace Reset</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Populate realistic Indian Rupee records for testing or reset your personal ledger.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={busyData}
            onClick={async () => {
              setBusyData(true);
              try {
                await onLoadSampleData();
              } finally {
                setBusyData(false);
              }
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium cursor-pointer disabled:opacity-60"
          >
            <Database className="w-3.5 h-3.5" />
            {busyData ? 'Working...' : 'Load Sample Data'}
          </button>

          {!confirmClear ? (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="px-4 py-2 rounded-xl bg-[#1c1630] hover:bg-rose-500/20 border border-violet-500/25 text-xs text-rose-300 cursor-pointer"
            >
              Clear All Financial Records
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={busyData}
                onClick={async () => {
                  setBusyData(true);
                  try {
                    await onClearData();
                    setConfirmClear(false);
                  } finally {
                    setBusyData(false);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium cursor-pointer"
              >
                Confirm Delete All
              </button>
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="px-3 py-2 rounded-xl bg-[#1c1630] text-slate-300 text-xs cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
