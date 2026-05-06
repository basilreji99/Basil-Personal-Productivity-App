import { useState } from 'react';
import Modal from '../ui/Modal';
import type { TransactionCategory, TransactionType } from '../../types';
import { useFinanceStore } from '../../store/financeStore';
import { getTodayString } from '../../utils/dateUtils';

const CATEGORIES: { value: TransactionCategory; label: string; icon: string }[] = [
  { value: 'food', label: 'Food', icon: 'restaurant' },
  { value: 'transport', label: 'Transport', icon: 'directions_car' },
  { value: 'entertainment', label: 'Entertainment', icon: 'movie' },
  { value: 'bills', label: 'Bills', icon: 'receipt_long' },
  { value: 'shopping', label: 'Shopping', icon: 'shopping_bag' },
  { value: 'health', label: 'Health', icon: 'favorite' },
  { value: 'rent', label: 'Rent', icon: 'home' },
  { value: 'salary', label: 'Salary', icon: 'work' },
  { value: 'freelance', label: 'Freelance', icon: 'laptop' },
  { value: 'investment', label: 'Investment', icon: 'trending_up' },
  { value: 'other', label: 'Other', icon: 'more_horiz' },
];

interface AddTransactionModalProps {
  open: boolean;
  onClose: () => void;
}

export default function AddTransactionModal({ open, onClose }: AddTransactionModalProps) {
  const addTransaction = useFinanceStore((s) => s.addTransaction);
  const [type, setType] = useState<TransactionType>('expense');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<TransactionCategory>('food');
  const [date, setDate] = useState(getTodayString());
  const [notes, setNotes] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);

  const handleSave = () => {
    const amt = parseFloat(amount);
    if (!description.trim() || isNaN(amt) || amt <= 0) return;
    addTransaction({
      description: description.trim(),
      amount: amt,
      type,
      category,
      date,
      notes: notes.trim() || undefined,
      isRecurring,
      recurringFrequency: isRecurring ? 'monthly' : undefined,
    });
    setDescription('');
    setAmount('');
    setCategory('food');
    setDate(getTodayString());
    setNotes('');
    setIsRecurring(false);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Transaction" size="md">
      <div className="p-5 space-y-4">
        {/* Type toggle */}
        <div className="flex bg-surface-container rounded-xl p-1 gap-1">
          <button
            onClick={() => setType('expense')}
            className={`flex-1 py-2 rounded-lg font-inter font-semibold text-sm transition-all ${
              type === 'expense' ? 'bg-error text-on-error shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Expense
          </button>
          <button
            onClick={() => setType('income')}
            className={`flex-1 py-2 rounded-lg font-inter font-semibold text-sm transition-all ${
              type === 'income' ? 'bg-tertiary text-on-tertiary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Income
          </button>
        </div>

        {/* Amount */}
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 font-manrope font-bold text-2xl text-on-surface-variant">$</span>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            step="0.01"
            min="0"
            className="w-full pl-10 pr-4 py-3 bg-surface-container rounded-xl font-manrope font-bold text-2xl text-on-surface outline-none border border-outline-variant/30 focus:border-primary/40 transition-colors"
          />
        </div>

        {/* Description */}
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description"
          className="w-full px-4 py-2.5 bg-surface-container rounded-lg font-work-sans text-base text-on-surface outline-none border border-outline-variant/30 focus:border-primary/40 placeholder:text-outline/50"
        />

        {/* Category grid */}
        <div className="space-y-1.5">
          <label className="font-inter text-xs font-semibold uppercase tracking-wider text-outline">Category</label>
          <div className="grid grid-cols-4 gap-1.5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setCategory(cat.value)}
                className={`flex flex-col items-center gap-1 py-2 px-1 rounded-lg border transition-all ${
                  category === cat.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-outline-variant/30 text-on-surface-variant hover:border-outline'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">{cat.icon}</span>
                <span className="font-inter text-[9px] font-medium leading-none">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Date */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="font-inter text-xs font-semibold uppercase tracking-wider text-outline">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 bg-surface-container rounded-lg font-inter text-sm text-on-surface outline-none border border-outline-variant/30 focus:border-primary/40"
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <div
                onClick={() => setIsRecurring((v) => !v)}
                className={`w-10 h-5 rounded-full transition-colors ${isRecurring ? 'bg-primary' : 'bg-outline-variant'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full shadow-sm mt-0.5 transition-transform ${isRecurring ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </div>
              <span className="font-inter text-sm text-on-surface-variant">Recurring</span>
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-on-surface-variant font-inter font-medium text-sm hover:bg-surface-container transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!description.trim() || !amount || parseFloat(amount) <= 0}
            className="px-4 py-2 rounded-lg bg-primary text-on-primary font-inter font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            Add
          </button>
        </div>
      </div>
    </Modal>
  );
}
