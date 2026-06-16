import { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import { useFinanceStore } from '../../store/financeStore';
import { useSyncStore } from '../../store/syncStore';
import type { SheetNewRow } from '../../types';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function AddTransactionModal({ open, onClose }: Props) {
  const { addTransaction, getAllClassI, getAllClassII, getAllTags } = useFinanceStore();
  const { isTokenValid, silentRefresh } = useSyncStore();

  const today = new Date();
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [name, setName] = useState('');
  const [amountUSD, setAmountUSD] = useState('');
  const [usdRate, setUsdRate] = useState('');
  const [day, setDay] = useState(String(today.getDate()));
  const [month, setMonth] = useState(String(today.getMonth() + 1));
  const [year, setYear] = useState(String(today.getFullYear()));
  const [classI, setClassI] = useState('');
  const [classII, setClassII] = useState('');
  const [tags, setTags] = useState('');
  const [tripName, setTripName] = useState('');
  const [tripState, setTripState] = useState('');
  const [note, setNote] = useState('');
  const [showTrip, setShowTrip] = useState(false);
  const [saving, setSaving] = useState(false);

  const classISuggestions = getAllClassI();
  const classIISuggestions = getAllClassII();
  const tagSuggestions = getAllTags();

  useEffect(() => {
    if (open) {
      const t = new Date();
      setType('expense');
      setName('');
      setAmountUSD('');
      setUsdRate('');
      setDay(String(t.getDate()));
      setMonth(String(t.getMonth() + 1));
      setYear(String(t.getFullYear()));
      setClassI('');
      setClassII('');
      setTags('');
      setTripName('');
      setTripState('');
      setNote('');
      setShowTrip(false);
    }
  }, [open]);

  const inINR = amountUSD && usdRate ? (parseFloat(amountUSD) * parseFloat(usdRate)).toFixed(2) : '';
  const canSave = name.trim() && parseFloat(amountUSD) > 0 && parseInt(day) > 0 && parseInt(month) > 0 && parseInt(year) > 0;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      let token: string | null = null;
      if (!isTokenValid()) await silentRefresh();
      token = useSyncStore.getState().accessToken;

      const row: SheetNewRow = {
        day: parseInt(day),
        month: parseInt(month),
        year: parseInt(year),
        name: name.trim(),
        expenseUSD: type === 'expense' ? parseFloat(amountUSD) : 0,
        incomeUSD: type === 'income' ? parseFloat(amountUSD) : 0,
        usdRate: parseFloat(usdRate) || 0,
        expenseClassI: classI.trim(),
        expenseClassII: classII.trim(),
        tags: tags.trim(),
        tripName: tripName.trim(),
        tripState: tripState.trim(),
        note: note.trim(),
      };
      await addTransaction(token, row);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return (
    <Modal open={open} onClose={onClose} title="Add Transaction" size="md">
      <div className="p-5 space-y-4 overflow-y-auto max-h-[80dvh]">
        {/* Type toggle */}
        <div className="flex bg-surface-container rounded-xl p-1 gap-1">
          <button onClick={() => setType('expense')} className={`flex-1 py-2 rounded-lg font-inter font-semibold text-sm transition-all ${type === 'expense' ? 'bg-error text-on-error shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}>
            Expense
          </button>
          <button onClick={() => setType('income')} className={`flex-1 py-2 rounded-lg font-inter font-semibold text-sm transition-all ${type === 'income' ? 'bg-tertiary text-on-tertiary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}>
            Income
          </button>
        </div>

        {/* Name */}
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Description (e.g. Grocery run, Salary)"
          autoFocus
          className="w-full px-4 py-2.5 bg-surface-container rounded-lg font-work-sans text-base text-on-surface outline-none border border-outline-variant/30 focus:border-primary/40 placeholder:text-outline/50"
        />

        {/* Amount + USD Rate */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="font-inter text-xs font-semibold uppercase tracking-wider text-outline">Amount (USD)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-inter text-sm text-on-surface-variant">$</span>
              <input
                type="number"
                value={amountUSD}
                onChange={e => setAmountUSD(e.target.value)}
                placeholder="0.00"
                step="0.01" min="0"
                className="w-full pl-7 pr-3 py-2.5 bg-surface-container rounded-lg font-manrope font-bold text-base text-on-surface outline-none border border-outline-variant/30 focus:border-primary/40"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="font-inter text-xs font-semibold uppercase tracking-wider text-outline">USD Rate (₹)</label>
            <input
              type="number"
              value={usdRate}
              onChange={e => setUsdRate(e.target.value)}
              placeholder="e.g. 84.5"
              step="0.01" min="0"
              className="w-full px-3 py-2.5 bg-surface-container rounded-lg font-inter text-sm text-on-surface outline-none border border-outline-variant/30 focus:border-primary/40"
            />
          </div>
        </div>
        {inINR && (
          <p className="font-inter text-xs text-on-surface-variant -mt-2">
            ≈ <span className="font-semibold text-primary">₹{Number(inINR).toLocaleString('en-IN')}</span>
          </p>
        )}

        {/* Date */}
        <div className="space-y-1">
          <label className="font-inter text-xs font-semibold uppercase tracking-wider text-outline">Date</label>
          <div className="grid grid-cols-3 gap-2">
            <input type="number" value={day} onChange={e => setDay(e.target.value)} placeholder="Day" min="1" max="31"
              className="w-full px-3 py-2.5 bg-surface-container rounded-lg font-inter text-sm text-on-surface outline-none border border-outline-variant/30 focus:border-primary/40" />
            <select value={month} onChange={e => setMonth(e.target.value)}
              className="w-full px-3 py-2.5 bg-surface-container rounded-lg font-inter text-sm text-on-surface outline-none border border-outline-variant/30 focus:border-primary/40">
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <input type="number" value={year} onChange={e => setYear(e.target.value)} placeholder="Year" min="2020"
              className="w-full px-3 py-2.5 bg-surface-container rounded-lg font-inter text-sm text-on-surface outline-none border border-outline-variant/30 focus:border-primary/40" />
          </div>
        </div>

        {/* Classification */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="font-inter text-xs font-semibold uppercase tracking-wider text-outline">Category</label>
            <input
              type="text" list="classI-list"
              value={classI} onChange={e => setClassI(e.target.value)}
              placeholder="e.g. Eating Out"
              className="w-full px-3 py-2.5 bg-surface-container rounded-lg font-inter text-sm text-on-surface outline-none border border-outline-variant/30 focus:border-primary/40 placeholder:text-outline/50"
            />
            <datalist id="classI-list">{classISuggestions.map(s => <option key={s} value={s} />)}</datalist>
          </div>
          <div className="space-y-1">
            <label className="font-inter text-xs font-semibold uppercase tracking-wider text-outline">Broad Category</label>
            <input
              type="text" list="classII-list"
              value={classII} onChange={e => setClassII(e.target.value)}
              placeholder="e.g. Entertainment"
              className="w-full px-3 py-2.5 bg-surface-container rounded-lg font-inter text-sm text-on-surface outline-none border border-outline-variant/30 focus:border-primary/40 placeholder:text-outline/50"
            />
            <datalist id="classII-list">{classIISuggestions.map(s => <option key={s} value={s} />)}</datalist>
          </div>
        </div>

        {/* Tags */}
        <div className="space-y-1">
          <label className="font-inter text-xs font-semibold uppercase tracking-wider text-outline">Tags</label>
          <input
            type="text" list="tags-list"
            value={tags} onChange={e => setTags(e.target.value)}
            placeholder="comma-separated, e.g. Boston, Utilities"
            className="w-full px-3 py-2.5 bg-surface-container rounded-lg font-inter text-sm text-on-surface outline-none border border-outline-variant/30 focus:border-primary/40 placeholder:text-outline/50"
          />
          <datalist id="tags-list">{tagSuggestions.map(s => <option key={s} value={s} />)}</datalist>
        </div>

        {/* Trip (collapsible) */}
        <button
          type="button"
          onClick={() => setShowTrip(v => !v)}
          className="flex items-center gap-1.5 font-inter text-xs font-semibold text-primary"
        >
          <span className="material-symbols-outlined text-[15px]">{showTrip ? 'expand_less' : 'expand_more'}</span>
          Trip details {tripName ? `· ${tripName}` : '(optional)'}
        </button>
        {showTrip && (
          <div className="grid grid-cols-2 gap-3 -mt-2">
            <input
              type="text" value={tripName} onChange={e => setTripName(e.target.value)}
              placeholder="Trip name"
              className="w-full px-3 py-2.5 bg-surface-container rounded-lg font-inter text-sm text-on-surface outline-none border border-outline-variant/30 focus:border-primary/40 placeholder:text-outline/50"
            />
            <input
              type="text" value={tripState} onChange={e => setTripState(e.target.value)}
              placeholder="State / Country"
              className="w-full px-3 py-2.5 bg-surface-container rounded-lg font-inter text-sm text-on-surface outline-none border border-outline-variant/30 focus:border-primary/40 placeholder:text-outline/50"
            />
          </div>
        )}

        {/* Note */}
        <textarea
          value={note} onChange={e => setNote(e.target.value)}
          placeholder="Note (optional)"
          rows={2}
          className="w-full px-3 py-2.5 bg-surface-container rounded-lg font-work-sans text-sm text-on-surface outline-none border border-outline-variant/30 focus:border-primary/40 placeholder:text-outline/50 resize-none"
        />

        {/* Actions */}
        <div className="flex gap-2 justify-end pt-1">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-on-surface-variant font-inter font-medium text-sm hover:bg-surface-container">Cancel</button>
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="px-5 py-2 rounded-lg bg-primary text-on-primary font-inter font-medium text-sm hover:opacity-90 disabled:opacity-40 flex items-center gap-1.5"
          >
            {saving && <span className="w-3 h-3 border-2 border-on-primary/40 border-t-on-primary rounded-full animate-spin" />}
            {!navigator.onLine ? 'Queue' : 'Add'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
