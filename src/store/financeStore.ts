import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SheetTransaction, SheetNewRow, OweEntry } from '../types';
import { nanoid } from '../utils/nanoid';
import { readExpenseSheet, appendExpenseRows, readOweSheet } from '../services/sheetsService';

export interface MonthlyStats {
  income: number;
  expenses: number;
  balance: number;
  incomeINR: number;
  expensesINR: number;
  balanceINR: number;
  byClassII: Record<string, number>;
  byClassI: Record<string, number>;
  byDay: { day: number; usd: number; inr: number }[];
}

export interface TripSummary {
  tripName: string;
  tripState: string;
  totalUSD: number;
  totalINR: number;
  count: number;
}

interface FinanceState {
  transactions: SheetTransaction[];
  oweEntries: OweEntry[];
  pendingWrites: (SheetNewRow & { pendingId: string })[];
  lastSyncedAt: string | null;
  isSyncing: boolean;
  syncError: string | null;
  displayCurrency: 'USD' | 'INR';

  fetchFromSheet: (token: string) => Promise<void>;
  addTransaction: (token: string | null, row: SheetNewRow) => Promise<void>;
  flushPendingWrites: (token: string) => Promise<void>;
  setDisplayCurrency: (c: 'USD' | 'INR') => void;
  clearSyncError: () => void;

  getByMonth: (year: number, month: number) => SheetTransaction[];
  getMonthlyStats: (year: number, month: number) => MonthlyStats;
  getTripSummaries: () => TripSummary[];
  getAllClassI: () => string[];
  getAllClassII: () => string[];
  getAllTags: () => string[];
}

function pendingToTransaction(row: SheetNewRow & { pendingId: string }): SheetTransaction {
  const amount = row.expenseUSD || row.incomeUSD;
  const inINR = row.usdRate ? amount * row.usdRate : 0;
  const type: 'income' | 'expense' = row.incomeUSD > 0 && row.expenseUSD === 0 ? 'income' : 'expense';
  return {
    localId: row.pendingId,
    rowIndex: 0,
    day: row.day,
    month: row.month,
    year: row.year,
    date: `${row.year}-${String(row.month).padStart(2, '0')}-${String(row.day).padStart(2, '0')}`,
    name: row.name,
    expenseUSD: row.expenseUSD,
    incomeUSD: row.incomeUSD,
    usdRate: row.usdRate,
    inINR,
    expenseClassI: row.expenseClassI,
    expenseClassII: row.expenseClassII,
    tags: row.tags,
    tripName: row.tripName,
    tripState: row.tripState,
    note: row.note,
    type,
    amountUSD: amount,
    amountINR: inINR,
  };
}

export const useFinanceStore = create<FinanceState>()(
  persist(
    (set, get) => ({
      transactions: [],
      oweEntries: [],
      pendingWrites: [],
      lastSyncedAt: null,
      isSyncing: false,
      syncError: null,
      displayCurrency: 'USD',

      fetchFromSheet: async (token) => {
        set({ isSyncing: true, syncError: null });
        try {
          const [expenseResult, oweResult] = await Promise.all([
            readExpenseSheet(token),
            readOweSheet(token),
          ]);
          if (expenseResult.error) {
            set({ syncError: expenseResult.error === 'auth' ? 'Sign in with Google to load your finance data.' : expenseResult.error });
            return;
          }
          set({
            transactions: expenseResult.transactions,
            oweEntries: oweResult.entries,
            lastSyncedAt: new Date().toISOString(),
          });
        } finally {
          set({ isSyncing: false });
        }
      },

      addTransaction: async (token, row) => {
        const pending = { ...row, pendingId: nanoid() };
        const optimistic = pendingToTransaction(pending);

        if (token && navigator.onLine) {
          set(s => ({ transactions: [optimistic, ...s.transactions] }));
          const { ok, error } = await appendExpenseRows(token, [row]);
          if (!ok) {
            set(s => ({
              transactions: s.transactions.filter(t => t.localId !== optimistic.localId),
              pendingWrites: [...s.pendingWrites, pending],
              syncError: error === 'auth' ? 'Auth error — transaction queued.' : (error ?? 'Write failed — queued.'),
            }));
            return;
          }
          // Re-fetch to get correct row indices from sheet
          const { transactions: fresh } = await readExpenseSheet(token).catch(() => ({ transactions: null as SheetTransaction[] | null }));
          if (fresh) set({ transactions: fresh, lastSyncedAt: new Date().toISOString() });
        } else {
          set(s => ({
            transactions: [optimistic, ...s.transactions],
            pendingWrites: [...s.pendingWrites, pending],
          }));
        }
      },

      flushPendingWrites: async (token) => {
        const { pendingWrites } = get();
        if (pendingWrites.length === 0) return;
        set({ isSyncing: true, syncError: null });
        try {
          const rows = pendingWrites.map(({ pendingId: _id, ...row }) => row);
          const { ok, error } = await appendExpenseRows(token, rows);
          if (!ok) {
            set({ syncError: error === 'auth' ? 'Auth error — queue retained.' : (error ?? 'Flush failed.') });
            return;
          }
          set({ pendingWrites: [] });
          const { transactions, error: fetchErr } = await readExpenseSheet(token);
          if (!fetchErr) set({ transactions, lastSyncedAt: new Date().toISOString() });
        } finally {
          set({ isSyncing: false });
        }
      },

      setDisplayCurrency: (c) => set({ displayCurrency: c }),
      clearSyncError: () => set({ syncError: null }),

      getByMonth: (year, month) => {
        const { transactions, pendingWrites } = get();
        const pending = pendingWrites.map(pendingToTransaction);
        const synced = transactions.filter(t => t.rowIndex > 0);
        return [...synced, ...pending]
          .filter(t => t.year === year && t.month === month)
          .sort((a, b) => b.day - a.day);
      },

      getMonthlyStats: (year, month) => {
        const txns = get().getByMonth(year, month);
        let income = 0, expenses = 0, incomeINR = 0, expensesINR = 0;
        const byClassII: Record<string, number> = {};
        const byClassI: Record<string, number> = {};
        const byDayMap: Record<number, { usd: number; inr: number }> = {};

        txns.forEach(t => {
          if (t.type === 'income') {
            income += t.amountUSD; incomeINR += t.amountINR;
          } else {
            expenses += t.amountUSD; expensesINR += t.amountINR;
            if (t.expenseClassII) byClassII[t.expenseClassII] = (byClassII[t.expenseClassII] ?? 0) + t.amountUSD;
            if (t.expenseClassI) byClassI[t.expenseClassI] = (byClassI[t.expenseClassI] ?? 0) + t.amountUSD;
            if (!byDayMap[t.day]) byDayMap[t.day] = { usd: 0, inr: 0 };
            byDayMap[t.day].usd += t.amountUSD;
            byDayMap[t.day].inr += t.amountINR;
          }
        });

        const byDay = Object.entries(byDayMap)
          .map(([day, v]) => ({ day: Number(day), ...v }))
          .sort((a, b) => a.day - b.day);

        return {
          income, expenses, balance: income - expenses,
          incomeINR, expensesINR, balanceINR: incomeINR - expensesINR,
          byClassII, byClassI, byDay,
        };
      },

      getTripSummaries: () => {
        const map = new Map<string, TripSummary>();
        get().transactions.forEach(t => {
          if (!t.tripName) return;
          const existing = map.get(t.tripName);
          if (existing) {
            existing.totalUSD += t.amountUSD;
            existing.totalINR += t.amountINR;
            existing.count++;
          } else {
            map.set(t.tripName, { tripName: t.tripName, tripState: t.tripState, totalUSD: t.amountUSD, totalINR: t.amountINR, count: 1 });
          }
        });
        return [...map.values()].sort((a, b) => b.totalUSD - a.totalUSD);
      },

      getAllClassI: () => [...new Set(get().transactions.map(t => t.expenseClassI).filter(Boolean))].sort(),
      getAllClassII: () => [...new Set(get().transactions.map(t => t.expenseClassII).filter(Boolean))].sort(),
      getAllTags: () => {
        const s = new Set<string>();
        get().transactions.forEach(t => {
          if (t.tags) t.tags.split(',').forEach(tag => { const v = tag.trim(); if (v) s.add(v); });
        });
        return [...s].sort();
      },
    }),
    {
      name: 'productivity-finance-v2',
      partialize: (s) => ({
        transactions: s.transactions,
        oweEntries: s.oweEntries,
        pendingWrites: s.pendingWrites,
        lastSyncedAt: s.lastSyncedAt,
        displayCurrency: s.displayCurrency,
      }),
    },
  ),
);
