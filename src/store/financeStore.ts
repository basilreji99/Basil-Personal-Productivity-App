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
  getTransactionsByMonth: (year: number, month: number) => Transaction[];
}


export const useFinanceStore = create<FinanceState>()(
  persist(
    (set, get) => ({
      transactions: [],

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

      getTransactionsByMonth: (year, month) => {
        return [...get().transactions]
          .filter((t) => {
            const d = new Date(t.date);
            return d.getFullYear() === year && d.getMonth() + 1 === month;
          })
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      },
    }),
    { name: 'productivity-finance' },
  ),
);
