import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Transaction } from '../types';
import { nanoid } from '../utils/nanoid';

interface FinanceState {
  transactions: Transaction[];
  addTransaction: (partial: Omit<Transaction, 'id'>) => void;
  updateTransaction: (id: string, updates: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;
  getMonthlyStats: (year: number, month: number) => {
    income: number;
    expenses: number;
    balance: number;
    byCategory: Record<string, number>;
    byDay: { day: number; amount: number }[];
  };
  getTotalBalance: () => number;
  getRecentTransactions: (limit?: number) => Transaction[];
}

const sampleDate = (daysAgo: number) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
};

export const useFinanceStore = create<FinanceState>()(
  persist(
    (set, get) => ({
      transactions: [
        { id: '1', description: 'Whole Foods Market', amount: 87.5, type: 'expense', category: 'food', date: sampleDate(1), isRecurring: false },
        { id: '2', description: 'Netflix Subscription', amount: 15.99, type: 'expense', category: 'entertainment', date: sampleDate(3), isRecurring: true, recurringFrequency: 'monthly' },
        { id: '3', description: 'Freelance Payment', amount: 1200, type: 'income', category: 'freelance', date: sampleDate(5), isRecurring: false },
        { id: '4', description: 'Shell Gas Station', amount: 62.0, type: 'expense', category: 'transport', date: sampleDate(7), isRecurring: false },
        { id: '5', description: 'Monthly Salary', amount: 4500, type: 'income', category: 'salary', date: sampleDate(10), isRecurring: true, recurringFrequency: 'monthly' },
        { id: '6', description: 'Gym Membership', amount: 45, type: 'expense', category: 'health', date: sampleDate(12), isRecurring: true, recurringFrequency: 'monthly' },
        { id: '7', description: 'Electric Bill', amount: 130, type: 'expense', category: 'bills', date: sampleDate(14), isRecurring: true, recurringFrequency: 'monthly' },
        { id: '8', description: 'Amazon Shopping', amount: 95.4, type: 'expense', category: 'shopping', date: sampleDate(2), isRecurring: false },
      ],

      addTransaction: (partial) =>
        set((s) => ({
          transactions: [{ ...partial, id: nanoid() }, ...s.transactions],
        })),

      updateTransaction: (id, updates) =>
        set((s) => ({
          transactions: s.transactions.map((t) =>
            t.id === id ? { ...t, ...updates } : t,
          ),
        })),

      deleteTransaction: (id) =>
        set((s) => ({
          transactions: s.transactions.filter((t) => t.id !== id),
        })),

      getMonthlyStats: (year, month) => {
        const txns = get().transactions.filter((t) => {
          const d = new Date(t.date);
          return d.getFullYear() === year && d.getMonth() + 1 === month;
        });

        const income = txns
          .filter((t) => t.type === 'income')
          .reduce((acc, t) => acc + t.amount, 0);
        const expenses = txns
          .filter((t) => t.type === 'expense')
          .reduce((acc, t) => acc + t.amount, 0);

        const byCategory: Record<string, number> = {};
        txns
          .filter((t) => t.type === 'expense')
          .forEach((t) => {
            byCategory[t.category] = (byCategory[t.category] ?? 0) + t.amount;
          });

        const byDayMap: Record<number, number> = {};
        txns
          .filter((t) => t.type === 'expense')
          .forEach((t) => {
            const day = new Date(t.date).getDate();
            byDayMap[day] = (byDayMap[day] ?? 0) + t.amount;
          });
        const byDay = Object.entries(byDayMap)
          .map(([day, amount]) => ({ day: Number(day), amount }))
          .sort((a, b) => a.day - b.day);

        return { income, expenses, balance: income - expenses, byCategory, byDay };
      },

      getTotalBalance: () => {
        return get().transactions.reduce((acc, t) => {
          return t.type === 'income' ? acc + t.amount : acc - t.amount;
        }, 0);
      },

      getRecentTransactions: (limit = 10) => {
        return [...get().transactions]
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, limit);
      },
    }),
    { name: 'productivity-finance' },
  ),
);
