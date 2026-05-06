import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie } from 'recharts';
import TopBar from '../components/layout/TopBar';
import AddTransactionModal from '../components/finance/AddTransactionModal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useFinanceStore } from '../store/financeStore';
import { formatCurrency, formatDisplayDate, getMonthName } from '../utils/dateUtils';
import type { Transaction } from '../types';

const CATEGORY_ICONS: Record<string, string> = {
  food: 'restaurant',
  transport: 'directions_car',
  entertainment: 'movie',
  bills: 'receipt_long',
  shopping: 'shopping_bag',
  health: 'favorite',
  rent: 'home',
  salary: 'work',
  freelance: 'laptop',
  investment: 'trending_up',
  other: 'more_horiz',
};

const CATEGORY_COLORS: Record<string, string> = {
  food: '#f59e0b',
  transport: '#3b82f6',
  entertainment: '#8b5cf6',
  bills: '#ef4444',
  shopping: '#ec4899',
  health: '#10b981',
  rent: '#6366f1',
  salary: '#06b6d4',
  freelance: '#14b8a6',
  investment: '#84cc16',
  other: '#9ca3af',
};

export default function Finance() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'overview' | 'transactions'>('overview');

  const { deleteTransaction, getMonthlyStats, getTotalBalance, getRecentTransactions } = useFinanceStore();
  const stats = getMonthlyStats(year, month);
  const recent = getRecentTransactions(20);
  const totalBalance = getTotalBalance();

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(year - 1); }
    else setMonth(month - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(year + 1); }
    else setMonth(month + 1);
  };

  const categoryChartData = Object.entries(stats.byCategory)
    .map(([cat, amount]) => ({ name: cat, amount, icon: CATEGORY_ICONS[cat] }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 6);

  const dayChartData = stats.byDay.map((d) => ({ day: `${d.day}`, amount: d.amount }));

  return (
    <div className="bg-background min-h-screen">
      <TopBar title="Finance" />

      <main className="max-w-screen-xl mx-auto pb-4">
        {/* Hero balance */}
        <div className="bg-primary px-4 py-6 text-center">
          <p className="font-inter text-xs font-semibold uppercase tracking-widest text-on-primary/60 mb-1">Total Balance</p>
          <p className="font-manrope font-bold text-4xl text-on-primary">{formatCurrency(totalBalance)}</p>
          <p className={`font-inter text-sm mt-1 ${stats.balance >= 0 ? 'text-tertiary-fixed' : 'text-error-container'}`}>
            {stats.balance >= 0 ? '+' : ''}{formatCurrency(stats.balance)} this month
          </p>
        </div>

        {/* Month selector + add */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/20">
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container transition-colors text-on-surface-variant">
              <span className="material-symbols-outlined text-[20px]">chevron_left</span>
            </button>
            <span className="font-inter font-semibold text-sm text-on-surface min-w-[120px] text-center">
              {getMonthName(month)} {year}
            </span>
            <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container transition-colors text-on-surface-variant">
              <span className="material-symbols-outlined text-[20px]">chevron_right</span>
            </button>
          </div>
          <button
            onClick={() => setAddModalOpen(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-primary text-on-primary rounded-lg font-inter font-medium text-xs"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            Add
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3 px-4 py-4">
          <div className="bg-surface-container-lowest rounded-xl p-4 shadow-card">
            <p className="font-inter text-[10px] font-semibold uppercase tracking-wider text-outline mb-1">Income</p>
            <p className="font-manrope font-bold text-xl text-tertiary">{formatCurrency(stats.income)}</p>
          </div>
          <div className="bg-surface-container-lowest rounded-xl p-4 shadow-card">
            <p className="font-inter text-[10px] font-semibold uppercase tracking-wider text-outline mb-1">Expenses</p>
            <p className="font-manrope font-bold text-xl text-error">{formatCurrency(stats.expenses)}</p>
          </div>
        </div>

        {/* View tabs */}
        <div className="flex gap-1 mx-4 bg-surface-container rounded-xl p-1 mb-4">
          <button onClick={() => setActiveView('overview')} className={`flex-1 py-2 rounded-lg font-inter font-medium text-sm transition-all ${activeView === 'overview' ? 'bg-surface-container-lowest shadow-sm text-on-surface' : 'text-on-surface-variant'}`}>Overview</button>
          <button onClick={() => setActiveView('transactions')} className={`flex-1 py-2 rounded-lg font-inter font-medium text-sm transition-all ${activeView === 'transactions' ? 'bg-surface-container-lowest shadow-sm text-on-surface' : 'text-on-surface-variant'}`}>Transactions</button>
        </div>

        {activeView === 'overview' && (
          <div className="px-4 space-y-4">
            {/* Daily spending chart */}
            {dayChartData.length > 0 && (
              <div className="bg-surface-container-lowest rounded-xl p-4 shadow-card">
                <p className="font-inter font-semibold text-xs uppercase tracking-wider text-outline mb-3">Daily Spending</p>
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart data={dayChartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <XAxis dataKey="day" tick={{ fontFamily: 'Inter', fontSize: 10, fill: '#737686' }} />
                    <YAxis tick={{ fontFamily: 'Inter', fontSize: 10, fill: '#737686' }} />
                    <Tooltip
                      formatter={(v) => [formatCurrency(Number(v ?? 0)), 'Spent']}
                      contentStyle={{ fontFamily: 'Inter', fontSize: 12, borderRadius: '8px', border: '1px solid #c3c6d7' }}
                    />
                    <Bar dataKey="amount" fill="#004ac6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Category breakdown */}
            {categoryChartData.length > 0 && (
              <div className="bg-surface-container-lowest rounded-xl p-4 shadow-card">
                <p className="font-inter font-semibold text-xs uppercase tracking-wider text-outline mb-3">By Category</p>
                <div className="flex gap-4 items-center">
                  <PieChart width={100} height={100}>
                    <Pie
                      data={categoryChartData.map((entry) => ({
                        ...entry,
                        fill: CATEGORY_COLORS[entry.name] ?? '#9ca3af',
                      }))}
                      dataKey="amount"
                      cx="50%"
                      cy="50%"
                      outerRadius={44}
                      paddingAngle={2}
                    />
                  </PieChart>
                  <div className="flex-1 space-y-2">
                    {categoryChartData.map((cat) => (
                      <div key={cat.name} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: CATEGORY_COLORS[cat.name] ?? '#9ca3af' }} />
                        <span className="font-inter text-xs text-on-surface-variant capitalize flex-1">{cat.name}</span>
                        <span className="font-inter font-semibold text-xs text-on-surface">{formatCurrency(cat.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Highlights */}
            <div className="bg-surface-container-lowest rounded-xl p-4 shadow-card space-y-3">
              <p className="font-inter font-semibold text-xs uppercase tracking-wider text-outline">Highlights</p>
              {stats.expenses > stats.income * 0.8 && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-error-container/30 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[16px] text-error">warning</span>
                  </div>
                  <p className="font-inter text-sm text-on-surface">High spending — expenses at {Math.round((stats.expenses / Math.max(stats.income, 1)) * 100)}% of income</p>
                </div>
              )}
              {stats.income > 0 && stats.balance > 0 && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-tertiary/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[16px] text-tertiary">savings</span>
                  </div>
                  <p className="font-inter text-sm text-on-surface">Net savings: {formatCurrency(stats.balance)} this month</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeView === 'transactions' && (
          <div className="px-4 space-y-2">
            {recent.length === 0 ? (
              <div className="text-center py-16">
                <span className="material-symbols-outlined text-[48px] text-outline block mb-2">receipt_long</span>
                <p className="font-manrope font-semibold text-on-surface mb-1">No transactions yet</p>
                <p className="font-work-sans text-sm text-on-surface-variant">Tap + to add your first transaction</p>
              </div>
            ) : (
              recent.map((txn) => (
                <TransactionRow key={txn.id} txn={txn} onDelete={() => setDeleteId(txn.id)} />
              ))
            )}
          </div>
        )}

        {/* FAB */}
        <button
          onClick={() => setAddModalOpen(true)}
          className="fixed bottom-28 right-4 w-14 h-14 bg-primary text-on-primary rounded-full shadow-fab flex items-center justify-center hover:scale-105 active:scale-95 transition-transform z-40"
        >
          <span className="material-symbols-outlined text-[28px]">add</span>
        </button>
      </main>

      <AddTransactionModal open={addModalOpen} onClose={() => setAddModalOpen(false)} />
      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteTransaction(deleteId)}
        title="Delete Transaction"
        message="This transaction will be permanently deleted."
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}

function TransactionRow({ txn, onDelete }: { txn: Transaction; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-3 bg-surface-container-lowest rounded-xl p-3.5 shadow-card group">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${txn.type === 'income' ? 'bg-tertiary/10' : 'bg-surface-container'}`}>
        <span className={`material-symbols-outlined text-[18px] ${txn.type === 'income' ? 'text-tertiary' : 'text-on-surface-variant'}`}>
          {CATEGORY_ICONS[txn.category] ?? 'payments'}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-inter font-medium text-sm text-on-surface truncate">{txn.description}</p>
        <p className="font-inter text-xs text-on-surface-variant">
          {txn.category} · {formatDisplayDate(txn.date)}
          {txn.isRecurring && ' · Recurring'}
        </p>
      </div>
      <div className="text-right flex items-center gap-2">
        <span className={`font-manrope font-bold text-sm ${txn.type === 'income' ? 'text-tertiary' : 'text-on-surface'}`}>
          {txn.type === 'income' ? '+' : '-'}{formatCurrency(txn.amount)}
        </span>
        <button
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-error-container/20 text-on-surface-variant hover:text-error"
        >
          <span className="material-symbols-outlined text-[16px]">delete</span>
        </button>
      </div>
    </div>
  );
}
