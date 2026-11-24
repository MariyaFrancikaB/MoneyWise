import React, { useEffect, useRef, useState } from 'react';
import { Camera, Loader2, Mic, MicOff, X } from 'lucide-react';
import { EXPENSE_CATEGORIES, PAYMENT_METHOD_TYPES, type ExpenseEntry, type PaymentMethod } from '../types/finance';
import { todayISO } from '../utils/formatters';

interface ExpenseModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: Omit<ExpenseEntry, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'recurringId'>) => Promise<void>;
  editingExpense?: ExpenseEntry | null;
  paymentMethods: PaymentMethod[];
}

interface SpeechRecognitionResultEventLike {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((ev: SpeechRecognitionResultEventLike) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
}

export function ExpenseModal({ open, onClose, onSave, editingExpense, paymentMethods }: ExpenseModalProps) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<string>('Food');
  const [date, setDate] = useState(todayISO());
  const [paymentMethod, setPaymentMethod] = useState<string>('UPI');
  const [description, setDescription] = useState('');
  const [isUnnecessary, setIsUnnecessary] = useState(false);
  const [isFixed, setIsFixed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiBusy, setAiBusy] = useState<'voice' | 'ocr' | null>(null);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const methodOptions = Array.from(
    new Set([
      ...PAYMENT_METHOD_TYPES,
      ...paymentMethods.map((pm) => pm.name),
    ])
  );

  useEffect(() => {
    if (!open) return;
    setError(null);
    setStatusMsg(null);
    if (editingExpense) {
      setName(editingExpense.name);
      setAmount(String(editingExpense.amount));
      setCategory(editingExpense.category);
      setDate(editingExpense.date);
      setPaymentMethod(editingExpense.paymentMethod);
      setDescription(editingExpense.description || '');
      setIsUnnecessary(editingExpense.isUnnecessary);
      setIsFixed(editingExpense.isFixed);
    } else {
      setName('');
      setAmount('');
      setCategory('Food');
      setDate(todayISO());
      setPaymentMethod(paymentMethods.find((p) => p.isDefault)?.type || 'UPI');
      setDescription('');
      setIsUnnecessary(false);
      setIsFixed(false);
    }
  }, [open, editingExpense, paymentMethods]);

  if (!open) return null;

  const handleVoiceEntry = () => {
    setError(null);
    setStatusMsg(null);
    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRec) {
      setError('Speech recognition is not supported in this browser. Try Chrome or Edge, or type the expense below.');
      return;
    }

    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }

    const rec = new SpeechRec();
    recognitionRef.current = rec;
    rec.lang = 'en-IN';
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onresult = async (ev) => {
      const transcript = ev.results?.[0]?.[0]?.transcript || '';
      setListening(false);
      if (!transcript.trim()) return;
      setStatusMsg(`Heard: "${transcript}" — parsing...`);
      setAiBusy('voice');
      try {
        const res = await fetch('/api/ai/voice-parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript, today: todayISO() }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Voice parsing failed');
        const p = data.parsed;
        if (p.name) setName(p.name);
        if (p.amount) setAmount(String(p.amount));
        if (EXPENSE_CATEGORIES.includes(p.category)) setCategory(p.category);
        if (p.date && /^\d{4}-\d{2}-\d{2}$/.test(p.date)) setDate(p.date);
        if (p.paymentMethod) setPaymentMethod(p.paymentMethod);
        if (p.description) setDescription(p.description);
        if (typeof p.isUnnecessary === 'boolean') setIsUnnecessary(p.isUnnecessary);
        setStatusMsg(`Filled from voice: "${transcript}"`);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to parse voice input.');
      } finally {
        setAiBusy(null);
      }
    };

    rec.onerror = (ev) => {
      setListening(false);
      setError(`Voice capture error: ${ev.error || 'microphone permission denied'}`);
    };

    rec.onend = () => setListening(false);
    setListening(true);
    setStatusMsg('Listening... e.g. "Spent 450 rupees on lunch at Swiggy via UPI"');
    rec.start();
  };

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setStatusMsg('Scanning receipt with AI OCR...');
    setAiBusy('ocr');

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Could not read file.'));
        reader.readAsDataURL(file);
      });

      const res = await fetch('/api/ai/receipt-ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType: file.type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Receipt OCR failed');
      const ext = data.extracted;
      if (ext.name) setName(ext.name);
      if (ext.amount) setAmount(String(ext.amount));
      if (EXPENSE_CATEGORIES.includes(ext.category)) setCategory(ext.category);
      if (ext.date && /^\d{4}-\d{2}-\d{2}$/.test(ext.date)) setDate(ext.date);
      if (ext.paymentMethod) setPaymentMethod(ext.paymentMethod);
      if (ext.description) setDescription(ext.description);
      if (typeof ext.isUnnecessary === 'boolean') setIsUnnecessary(ext.isUnnecessary);
      setStatusMsg('Receipt scanned. Review fields and save.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to scan receipt.');
      setStatusMsg(null);
    } finally {
      setAiBusy(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const numAmount = Number(amount);
    if (!name.trim()) {
      setError('Expense name is required.');
      return;
    }
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      setError('Enter a valid amount greater than ₹0.');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        amount: numAmount,
        category,
        date,
        paymentMethod,
        description: description.trim(),
        isUnnecessary,
        isFixed,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save expense.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-[#141022] border border-violet-500/25 rounded-2xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-violet-500/15">
          <div>
            <h2 className="text-lg font-semibold text-white">
              {editingExpense ? 'Edit Expense' : 'Record New Expense'}
            </h2>
            <p className="text-xs text-slate-400">Log manually, speak an expense, or scan a receipt</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-violet-500/15 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 pt-4 flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={handleVoiceEntry}
            disabled={aiBusy !== null}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
              listening
                ? 'bg-rose-500/20 border-rose-500/40 text-rose-200'
                : 'bg-[#1c1630] border-violet-500/25 text-violet-200 hover:bg-violet-500/20'
            }`}
          >
            {aiBusy === 'voice' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : listening ? (
              <MicOff className="w-3.5 h-3.5" />
            ) : (
              <Mic className="w-3.5 h-3.5" />
            )}
            {listening ? 'Stop Listening' : 'Voice Entry'}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleReceiptUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={aiBusy !== null}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium bg-[#1c1630] border border-violet-500/25 text-violet-200 hover:bg-violet-500/20 transition-colors cursor-pointer whitespace-nowrap"
          >
            {aiBusy === 'ocr' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
            Scan Receipt (OCR)
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-200">
              {error}
            </div>
          )}
          {statusMsg && !error && (
            <div className="p-3 rounded-lg bg-violet-500/10 border border-violet-500/30 text-xs text-violet-200">
              {statusMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Expense Name</label>
              <input
                type="text"
                required
                maxLength={140}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. BigBasket Groceries"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0b0914] border border-violet-500/20 text-sm text-white focus:outline-none focus:border-violet-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Amount (₹)</label>
              <input
                type="number"
                required
                min="1"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 1250"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0b0914] border border-violet-500/20 text-sm font-mono text-white focus:outline-none focus:border-violet-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-[#0b0914] border border-violet-500/20 text-sm text-white focus:outline-none focus:border-violet-400"
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Date</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-[#0b0914] border border-violet-500/20 text-sm font-mono text-white focus:outline-none focus:border-violet-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-[#0b0914] border border-violet-500/20 text-sm text-white focus:outline-none focus:border-violet-400"
              >
                {methodOptions.map((pm) => (
                  <option key={pm} value={pm}>
                    {pm}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Description</label>
            <input
              type="text"
              maxLength={400}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes or merchant details"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0b0914] border border-violet-500/20 text-sm text-white focus:outline-none focus:border-violet-400"
            />
          </div>

          <div className="flex flex-wrap items-center gap-6 pt-1">
            <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={isFixed}
                onChange={(e) => setIsFixed(e.target.checked)}
                className="rounded border-violet-500/40 bg-[#0b0914] text-violet-600 focus:ring-violet-500"
              />
              Fixed / Essential Obligation
            </label>

            <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={isUnnecessary}
                onChange={(e) => setIsUnnecessary(e.target.checked)}
                className="rounded border-violet-500/40 bg-[#0b0914] text-rose-500 focus:ring-rose-500"
              />
              Discretionary / Avoidable Spend
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-violet-500/15">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:bg-white/5 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white transition-colors cursor-pointer disabled:opacity-60"
            >
              {saving ? 'Saving...' : editingExpense ? 'Update Expense' : 'Save Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
