import { useState, useMemo, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import TopBar from '../components/layout/TopBar';
import { useThemeStore } from '../store/themeStore';
import { useFinanceStore } from '../store/financeStore';
import { useSyncStore } from '../store/syncStore';
import AddTransactionModal from '../components/finance/AddTransactionModal';
import { getMonthName } from '../utils/dateUtils';
import type { SheetTransaction } from '../types';

const PALETTE = [
  '#3b82f6','#f59e0b','#8b5cf6','#ef4444','#10b981',
  '#ec4899','#06b6d4','#84cc16','#f97316','#6366f1','#9ca3af',
];
const catColor = (i: number) => PALETTE[i % PALETTE.length];

function fmtUSD(n: number) { return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function fmtINR(n: number) { return `₹${Math.round(n).toLocaleString('en-IN')}`; }
function pct(a: number, b: number) { if (b === 0) return null; return Math.round(((a - b) / b) * 100); }

// ─── Sync hook ────────────────────────────────────────────────────────────────

function useFinanceSync() {
  const { fetchFromSheet, flushPendingWrites, isSyncing, syncError, clearSyncError, pendingWrites, lastSyncedAt } = useFinanceStore();
  const { accessToken, isTokenValid, silentRefresh } = useSyncStore();

  const getToken = useCallback(async (): Promise<string | null> => {
    if (isTokenValid()) return accessToken;
    const ok = await silentRefresh();
    return ok ? useSyncStore.getState().accessToken : null;
  }, [accessToken, isTokenValid, silentRefresh]);

  const sync = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      useFinanceStore.getState().clearSyncError();
      useFinanceStore.setState({ syncError: 'Sign in with Google (Calendar tab) to load your finance data.' });
      return;
    }
    if (pendingWrites.length > 0) await flushPendingWrites(token);
    else await fetchFromSheet(token);
  }, [getToken, pendingWrites.length, flushPendingWrites, fetchFromSheet]);

  return { sync, isSyncing, syncError, clearSyncError, pendingCount: pendingWrites.length, lastSyncedAt };
}

// ─── Transaction row ──────────────────────────────────────────────────────────

function TxnRow({ txn, currency, catIndex }: { txn: SheetTransaction; currency: 'USD' | 'INR'; catIndex: Record<string, number> }) {
  const isPending = txn.rowIndex === 0;
  const amount = currency === 'USD' ? fmtUSD(txn.amountUSD) : fmtINR(txn.amountINR);
  const idx = catIndex[txn.expenseClassII] ?? catIndex[txn.expenseClassI] ?? 10;

  return (
    <div className={`flex items-center gap-3 bg-surface-container-lowest rounded-xl px-3.5 py-3 shadow-card ${isPending ? 'opacity-60' : ''}`}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: txn.type === 'income' ? '#06b6d415' : `${catColor(idx)}20` }}>
        <span className="material-symbols-outlined text-[18px]"
          style={{ color: txn.type === 'income' ? '#06b6d4' : catColor(idx) }}>
          {txn.type === 'income' ? 'payments' : 'shopping_bag'}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="font-inter font-medium text-sm text-on-surface truncate">{txn.name}</p>
          {isPending && <span className="font-inter text-[9px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded-full shrink-0">pending</span>}
        </div>
        <p className="font-inter text-xs text-on-surface-variant truncate">
          {txn.day} {getMonthName(txn.month)} {txn.year}
          {txn.expenseClassII && ` · ${txn.expenseClassII}`}
          {txn.tripName && ` · ✈ ${txn.tripName}`}
        </p>
      </div>
      <span className={`font-manrope font-bold text-sm shrink-0 ${txn.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-on-surface'}`}>
        {txn.type === 'income' ? '+' : '-'}{amount}
      </span>
    </div>
  );
}

// ─── Delta chip ───────────────────────────────────────────────────────────────

function Delta({ curr, prev, positive = false }: { curr: number; prev: number; positive?: boolean }) {
  const d = pct(curr, prev);
  if (d === null || d === 0) return null;
  const up = d > 0;
  const bad = positive ? !up : up;
  return (
    <span className={`font-inter text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${bad ? 'bg-error/10 text-error' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'}`}>
      {up ? '↑' : '↓'}{Math.abs(d)}%
    </span>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type FilterMode = 'classI' | 'classII' | 'tags';
type BreakdownMode = 'classI' | 'classII' | 'tags';

export default function Finance() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'trips' | 'owe'>('overview');
  const [addOpen, setAddOpen] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'expense' | 'income'>('all');
  const [filterMode, setFilterMode] = useState<FilterMode>('classII');
  const [filterValue, setFilterValue] = useState('');
  const [breakdownMode, setBreakdownMode] = useState<BreakdownMode>('classII');
  const [yearExpanded, setYearExpanded] = useState(false);
  const [allMode, setAllMode] = useState(false);
  const [sortMode, setSortMode] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc' | 'name'>('date-desc');
  const [allSearch, setAllSearch] = useState('');
  const { resolvedDark } = useThemeStore();
  const isDark = resolvedDark();

  const { getMonthlyStats, getByMonth, getTripSummaries, getAllClassI, getAllClassII, getAllTags, displayCurrency, setDisplayCurrency, transactions, oweEntries } = useFinanceStore();
  const { sync, isSyncing, syncError, clearSyncError, pendingCount, lastSyncedAt } = useFinanceSync();
  const isSignedIn = useSyncStore(s => !!s.profile);

  // Always sync on mount when signed in — ensures oweEntries load even when transactions are cached
  useEffect(() => { if (isSignedIn) sync(); }, []);

  const cur = displayCurrency;
  const stats = getMonthlyStats(year, month);
  const monthTxns = getByMonth(year, month);
  const tripSummaries = getTripSummaries();

  // Previous month stats for delta
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevStats = getMonthlyStats(prevYear, prevMonth);

  // Month-specific filter values
  const monthClassI = useMemo(() => [...new Set(monthTxns.filter(t => t.type === 'expense').map(t => t.expenseClassI).filter(Boolean))].sort(), [monthTxns]);
  const monthClassII = useMemo(() => [...new Set(monthTxns.filter(t => t.type === 'expense').map(t => t.expenseClassII).filter(Boolean))].sort(), [monthTxns]);
  const monthTags = useMemo(() => {
    const s = new Set<string>();
    monthTxns.forEach(t => { if (t.tags) t.tags.split(',').forEach(tag => { const v = tag.trim(); if (v) s.add(v); }); });
    return [...s].sort();
  }, [monthTxns]);

  const allClassI = useMemo(() => getAllClassI(), [transactions]);
  const allClassII = useMemo(() => getAllClassII(), [transactions]);
  const allTagsList = useMemo(() => getAllTags(), [transactions]);
  const filterChips = allMode
    ? (filterMode === 'classI' ? allClassI : filterMode === 'classII' ? allClassII : allTagsList)
    : (filterMode === 'classI' ? monthClassI : filterMode === 'classII' ? monthClassII : monthTags);

  // Reset filter value when mode or month changes
  useEffect(() => { setFilterValue(''); }, [filterMode, month, year, allMode]);
  useEffect(() => { setAllSearch(''); setSortMode('date-desc'); }, [allMode]);

  const filteredTxns = useMemo(() => {
    let list = monthTxns;
    if (filterType !== 'all') list = list.filter(t => t.type === filterType);
    if (filterValue) {
      if (filterMode === 'classI') list = list.filter(t => t.expenseClassI === filterValue);
      else if (filterMode === 'classII') list = list.filter(t => t.expenseClassII === filterValue);
      else list = list.filter(t => t.tags.split(',').map(s => s.trim()).includes(filterValue));
    }
    return list;
  }, [monthTxns, filterType, filterValue, filterMode]);

  // Monthly trend for selected filter value across all months of the year
  const filterTrend = useMemo(() => {
    if (!filterValue) return null;
    return Array.from({ length: 12 }, (_, i) => {
      const txns = getByMonth(year, i + 1).filter(t => t.type === 'expense');
      const total = txns
        .filter(t => {
          if (filterMode === 'classI') return t.expenseClassI === filterValue;
          if (filterMode === 'classII') return t.expenseClassII === filterValue;
          return t.tags.split(',').map(s => s.trim()).includes(filterValue);
        })
        .reduce((sum, t) => sum + (cur === 'USD' ? t.amountUSD : t.amountINR), 0);
      return { m: getMonthName(i + 1).slice(0, 3), total, monthNum: i + 1 };
    });
  }, [filterValue, filterMode, year, getByMonth, cur]);

  // All-time filtered and sorted transactions
  const allFilteredTxns = useMemo(() => {
    let list = [...transactions];
    if (filterType !== 'all') list = list.filter(t => t.type === filterType);
    if (filterValue) {
      if (filterMode === 'classI') list = list.filter(t => t.expenseClassI === filterValue);
      else if (filterMode === 'classII') list = list.filter(t => t.expenseClassII === filterValue);
      else list = list.filter(t => t.tags?.split(',').map(s => s.trim()).includes(filterValue));
    }
    if (allSearch) {
      const q = allSearch.toLowerCase();
      list = list.filter(t => t.name.toLowerCase().includes(q));
    }
    if (sortMode === 'date-asc') list.sort((a, b) => a.year !== b.year ? a.year - b.year : a.month !== b.month ? a.month - b.month : a.day - b.day);
    else if (sortMode === 'amount-desc') list.sort((a, b) => b.amountUSD - a.amountUSD);
    else if (sortMode === 'amount-asc') list.sort((a, b) => a.amountUSD - b.amountUSD);
    else if (sortMode === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
    else list.sort((a, b) => b.year !== a.year ? b.year - a.year : b.month !== a.month ? b.month - a.month : b.day - a.day);
    return list;
  }, [transactions, filterType, filterValue, filterMode, allSearch, sortMode]);

  // Yearly totals for selected tag across all years in dataset
  const tagYearlyData = useMemo(() => {
    if (!filterValue || filterMode !== 'tags') return null;
    const yearMap: Record<number, { usd: number; inr: number }> = {};
    transactions.forEach(t => {
      if (t.type === 'expense' && t.tags?.split(',').map(s => s.trim()).includes(filterValue)) {
        if (!yearMap[t.year]) yearMap[t.year] = { usd: 0, inr: 0 };
        yearMap[t.year].usd += t.amountUSD;
        yearMap[t.year].inr += t.amountINR;
      }
    });
    return Object.entries(yearMap)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([yr, { usd, inr }]) => ({ year: yr, total: cur === 'USD' ? usd : inr }));
  }, [filterValue, filterMode, transactions, cur]);

  // Breakdown for overview
  const breakdownData = useMemo(() => {
    const txns = monthTxns.filter(t => t.type === 'expense');
    const map: Record<string, number> = {};
    txns.forEach(t => {
      if (breakdownMode === 'classI') {
        const k = t.expenseClassI || 'Other'; map[k] = (map[k] ?? 0) + t.amountUSD;
      } else if (breakdownMode === 'classII') {
        const k = t.expenseClassII || 'Other'; map[k] = (map[k] ?? 0) + t.amountUSD;
      } else {
        const tags = t.tags ? t.tags.split(',').map(s => s.trim()).filter(Boolean) : [];
        if (tags.length === 0) { map['Untagged'] = (map['Untagged'] ?? 0) + t.amountUSD; }
        else tags.forEach(tag => { map[tag] = (map[tag] ?? 0) + t.amountUSD; });
      }
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [monthTxns, breakdownMode]);

  const pieData = breakdownData.slice(0, 8).map(([name, amount]) => ({ name, amount }));
  const catColorIndex = useMemo(() => {
    const idx: Record<string, number> = {};
    breakdownData.forEach(([name], i) => { idx[name] = i; });
    return idx;
  }, [breakdownData]);

  const barData = stats.byDay.map(d => ({ day: String(d.day), amount: cur === 'USD' ? d.usd : d.inr }));

  // Top 5 transactions
  const topTxns = useMemo(() =>
    [...monthTxns].filter(t => t.type === 'expense').sort((a, b) => b.amountUSD - a.amountUSD).slice(0, 5),
    [monthTxns]);

  // Month-end spend forecast (current month only)
  const forecast = useMemo(() => {
    const now = new Date();
    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
    if (!isCurrentMonth || stats.expenses === 0) return null;
    const daysElapsed = now.getDate();
    const daysInMonth = new Date(year, month, 0).getDate();
    if (daysElapsed < 3) return null;
    const projected = (stats.expenses / daysElapsed) * daysInMonth;
    const projectedINR = (stats.expensesINR / daysElapsed) * daysInMonth;
    const prev3 = [1, 2, 3].map(n => {
      const pm = month - n <= 0 ? month - n + 12 : month - n;
      const py = month - n <= 0 ? year - 1 : year;
      return getMonthlyStats(py, pm).expenses;
    }).filter(v => v > 0);
    const avg3 = prev3.length > 0 ? prev3.reduce((a, b) => a + b, 0) / prev3.length : 0;
    const pct = Math.round((daysElapsed / daysInMonth) * 100);
    return { projected, projectedINR, avg3, daysElapsed, daysInMonth, pct };
  }, [year, month, stats, getMonthlyStats]);

  // Year summary
  const yearTxns = useMemo(() => transactions.filter(t => t.year === year), [transactions, year]);
  const yearIncome = yearTxns.reduce((s, t) => t.type === 'income' ? s + t.amountUSD : s, 0);
  const yearExpenses = yearTxns.reduce((s, t) => t.type === 'expense' ? s + t.amountUSD : s, 0);
  const yearIncomeINR = yearTxns.reduce((s, t) => t.type === 'income' ? s + t.amountINR : s, 0);
  const yearExpensesINR = yearTxns.reduce((s, t) => t.type === 'expense' ? s + t.amountINR : s, 0);

  const goToPrevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const goToNextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const axisColor = isDark ? '#8d90a2' : '#737886';
  const tooltipStyle = { fontFamily: 'Inter', fontSize: 12, borderRadius: '8px', border: `1px solid ${isDark ? '#434655' : '#c3c6d7'}` };
  const fmt = (usd: number, inr: number) => cur === 'USD' ? fmtUSD(usd) : fmtINR(inr);

  const syncLabel = isSyncing ? 'Syncing…'
    : lastSyncedAt ? `Synced ${new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : 'Not synced';

  return (
    <div className="bg-background min-h-screen">
      <TopBar
        title="Finance"
        rightSlot={
          <div className="flex items-center gap-1.5">
            {pendingCount > 0 && (
              <span className="font-inter text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white">{pendingCount} pending</span>
            )}
            <button onClick={() => setDisplayCurrency(cur === 'USD' ? 'INR' : 'USD')}
              className="px-2 py-1 rounded-lg bg-surface-container font-inter text-xs font-semibold text-on-surface-variant hover:bg-surface-container-high">
              {cur === 'USD' ? '$ USD' : '₹ INR'}
            </button>
            <button onClick={sync} disabled={isSyncing} title={syncLabel}
              className="p-1.5 rounded-xl text-on-surface-variant hover:bg-surface-container disabled:opacity-50">
              <span className={`material-symbols-outlined text-[20px] ${isSyncing ? 'animate-spin' : ''}`}>sync</span>
            </button>
          </div>
        }
      />

      {/* Sync error banner */}
      {syncError && (
        <div className="flex items-center gap-2 bg-error-container/30 px-4 py-2 border-b border-error/20">
          <span className="material-symbols-outlined text-[16px] text-error">error</span>
          <p className="flex-1 font-inter text-xs text-error">{syncError}</p>
          <button onClick={clearSyncError}><span className="material-symbols-outlined text-[16px] text-error">close</span></button>
        </div>
      )}

      {/* Year summary — compact collapsible */}
      <button
        onClick={() => setYearExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2 bg-surface-container border-b border-outline-variant/20 text-left"
      >
        <span className="font-inter text-xs text-on-surface-variant">
          {year} · <span className="text-emerald-600 dark:text-emerald-400">{cur === 'USD' ? fmtUSD(yearIncome) : fmtINR(yearIncomeINR)} in</span>
          {' · '}
          <span className="text-error">{cur === 'USD' ? fmtUSD(yearExpenses) : fmtINR(yearExpensesINR)} out</span>
          {' · '}
          <span className={yearIncome >= yearExpenses ? 'text-primary' : 'text-error'}>
            {cur === 'USD' ? fmtUSD(yearIncome - yearExpenses) : fmtINR(yearIncomeINR - yearExpensesINR)} net
          </span>
        </span>
        <span className="material-symbols-outlined text-[16px] text-on-surface-variant">{yearExpanded ? 'expand_less' : 'expand_more'}</span>
      </button>

      {yearExpanded && (
        <div className="px-4 py-3 bg-surface-container/50 border-b border-outline-variant/20">
          <p className="font-inter text-[10px] font-semibold uppercase tracking-wider text-outline mb-2">{year} month-by-month expenses</p>
          <div className="flex gap-1 items-end h-12">
            {Array.from({ length: 12 }, (_, i) => {
              const ms = getMonthlyStats(year, i + 1);
              const maxExp = Math.max(...Array.from({ length: 12 }, (_, j) => getMonthlyStats(year, j + 1).expenses));
              const h = maxExp > 0 ? Math.max(4, Math.round((ms.expenses / maxExp) * 40)) : 0;
              return (
                <button key={i} onClick={() => { setMonth(i + 1); setYearExpanded(false); }}
                  className="flex-1 flex flex-col items-center gap-0.5">
                  <div className="w-full rounded-sm transition-all"
                    style={{ height: `${h}px`, background: i + 1 === month ? 'var(--color-primary)' : 'var(--color-outline-variant)' }} />
                  <span className="font-inter text-[7px] text-outline">{getMonthName(i + 1).slice(0, 1)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <main className="max-w-screen-xl mx-auto pb-32">
        {/* Month navigator */}
        <div className="px-4 py-3 border-b border-outline-variant/20">
          <div className="flex items-center justify-between mb-3">
            <button onClick={goToPrevMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container text-on-surface-variant">
              <span className="material-symbols-outlined text-[20px]">chevron_left</span>
            </button>
            <span className="font-inter font-semibold text-sm text-on-surface">{getMonthName(month)} {year}</span>
            <button onClick={goToNextMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container text-on-surface-variant">
              <span className="material-symbols-outlined text-[20px]">chevron_right</span>
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-surface-container rounded-xl p-3 text-center">
              <p className="font-inter text-[10px] font-semibold uppercase tracking-wider text-outline mb-0.5">Income</p>
              <p className="font-manrope font-bold text-base text-emerald-600 dark:text-emerald-400">{fmt(stats.income, stats.incomeINR)}</p>
              <Delta curr={stats.income} prev={prevStats.income} positive />
            </div>
            <div className="bg-surface-container rounded-xl p-3 text-center">
              <p className="font-inter text-[10px] font-semibold uppercase tracking-wider text-outline mb-0.5">Expenses</p>
              <p className="font-manrope font-bold text-base text-error">{fmt(stats.expenses, stats.expensesINR)}</p>
              <Delta curr={stats.expenses} prev={prevStats.expenses} />
            </div>
            <div className="bg-surface-container rounded-xl p-3 text-center">
              <p className="font-inter text-[10px] font-semibold uppercase tracking-wider text-outline mb-0.5">Balance</p>
              <p className={`font-manrope font-bold text-base ${stats.balance >= 0 ? 'text-primary' : 'text-error'}`}>{fmt(stats.balance, stats.balanceINR)}</p>
              <Delta curr={stats.balance} prev={prevStats.balance} positive />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mx-4 mt-3 bg-surface-container rounded-xl p-1 mb-1">
          {(['overview', 'transactions', 'trips', 'owe'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-lg font-inter font-medium text-xs capitalize transition-all ${activeTab === tab ? 'bg-surface-container-lowest shadow-sm text-on-surface' : 'text-on-surface-variant'}`}>
              {tab === 'owe' ? `Owe${oweEntries.length > 0 ? ` (${oweEntries.length})` : ''}` : tab}
            </button>
          ))}
        </div>

        {/* ── Overview ── */}
        {activeTab === 'overview' && (
          <div className="px-4 mt-3 space-y-4">
            {transactions.length === 0 && isSyncing && (
              <div className="text-center py-12">
                <span className="material-symbols-outlined text-[48px] text-outline animate-spin block mb-3">sync</span>
                <p className="font-inter text-sm text-on-surface-variant">Loading finance data…</p>
              </div>
            )}
            {transactions.length === 0 && !isSyncing && (
              <div className="text-center py-12">
                <span className="material-symbols-outlined text-[48px] text-outline block mb-3">{isSignedIn ? 'cloud_sync' : 'account_circle'}</span>
                <p className="font-manrope font-semibold text-on-surface mb-1">{isSignedIn ? 'No finance data yet' : 'Sign in to view finances'}</p>
                <p className="font-work-sans text-sm text-on-surface-variant mb-3">
                  {isSignedIn ? 'Tap sync to load your spreadsheet data' : 'Go to Calendar tab and sign in with Google'}
                </p>
                {isSignedIn && <button onClick={sync} className="px-4 py-2 rounded-lg bg-primary text-on-primary font-inter font-medium text-sm">Sync now</button>}
              </div>
            )}

            {/* Daily bar chart */}
            {barData.length > 0 && (
              <div className="bg-surface-container-lowest rounded-xl p-4 shadow-card">
                <p className="font-inter font-semibold text-xs uppercase tracking-wider text-outline mb-3">Daily Spending — {getMonthName(month)}</p>
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart data={barData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <XAxis dataKey="day" tick={{ fontFamily: 'Inter', fontSize: 10, fill: axisColor }} />
                    <YAxis tick={{ fontFamily: 'Inter', fontSize: 10, fill: axisColor }} />
                    <Tooltip formatter={(v) => [cur === 'USD' ? fmtUSD(Number(v)) : fmtINR(Number(v)), 'Spent']} contentStyle={tooltipStyle} />
                    <Bar dataKey="amount" fill={isDark ? 'rgb(180 197 255)' : 'rgb(0 74 198)'} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Month-end spend forecast */}
            {forecast && (
              <div className="bg-surface-container-lowest rounded-xl p-4 shadow-card">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-inter font-semibold text-xs uppercase tracking-wider text-outline">Month-end Forecast</p>
                  <span className="font-inter text-[10px] text-on-surface-variant">{forecast.daysElapsed}/{forecast.daysInMonth} days ({forecast.pct}%)</span>
                </div>
                <div className="h-1 bg-surface-container rounded-full overflow-hidden mb-3">
                  <div className="h-full bg-outline/50 rounded-full transition-all" style={{ width: `${forecast.pct}%` }} />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 text-center bg-surface-container rounded-xl py-2.5 px-1">
                    <p className="font-inter text-[9px] text-on-surface-variant mb-1">So far</p>
                    <p className="font-manrope font-bold text-sm text-error">{fmt(stats.expenses, stats.expensesINR)}</p>
                  </div>
                  <div className="flex-1 text-center bg-surface-container rounded-xl py-2.5 px-1">
                    <p className="font-inter text-[9px] text-on-surface-variant mb-1">Projected</p>
                    <p className={`font-manrope font-bold text-sm ${forecast.avg3 > 0 && forecast.projected > forecast.avg3 * 1.1 ? 'text-error' : 'text-on-surface'}`}>
                      {fmt(forecast.projected, forecast.projectedINR)}
                    </p>
                  </div>
                  {forecast.avg3 > 0 && (
                    <div className="flex-1 text-center bg-surface-container rounded-xl py-2.5 px-1">
                      <p className="font-inter text-[9px] text-on-surface-variant mb-1">3-mo avg</p>
                      <p className="font-manrope font-bold text-sm text-outline">{cur === 'USD' ? fmtUSD(forecast.avg3) : fmtINR(forecast.avg3 * (stats.expensesINR / (stats.expenses || 1)))}</p>
                    </div>
                  )}
                </div>
                {forecast.avg3 > 0 && (() => {
                  const diff = Math.round(((forecast.projected - forecast.avg3) / forecast.avg3) * 100);
                  if (Math.abs(diff) < 5) return <p className="font-inter text-[11px] text-on-surface-variant text-center mt-2">On pace with 3-month average</p>;
                  return (
                    <p className={`font-inter text-[11px] font-semibold text-center mt-2 ${diff > 0 ? 'text-error' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {diff > 0 ? `↑ ${diff}% above` : `↓ ${Math.abs(diff)}% below`} 3-month average
                    </p>
                  );
                })()}
              </div>
            )}

            {/* Breakdown with mode toggle */}
            {breakdownData.length > 0 && (
              <div className="bg-surface-container-lowest rounded-xl p-4 shadow-card">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-inter font-semibold text-xs uppercase tracking-wider text-outline">Breakdown</p>
                  <div className="flex gap-1 bg-surface-container rounded-lg p-0.5">
                    {(['classII', 'classI', 'tags'] as BreakdownMode[]).map(m => (
                      <button key={m} onClick={() => setBreakdownMode(m)}
                        className={`px-2 py-1 rounded-md font-inter text-[10px] font-semibold transition-all ${breakdownMode === m ? 'bg-surface-container-lowest shadow-sm text-on-surface' : 'text-on-surface-variant'}`}>
                        {m === 'classI' ? 'Category' : m === 'classII' ? 'Broad' : 'Tags'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-4 items-center">
                  <PieChart width={96} height={96}>
                    <Pie data={pieData} dataKey="amount" cx="50%" cy="50%" outerRadius={44} paddingAngle={2}>
                      {pieData.map((entry, i) => <Cell key={entry.name} fill={catColor(catColorIndex[entry.name] ?? i)} />)}
                    </Pie>
                  </PieChart>
                  <div className="flex-1 space-y-1.5 min-w-0">
                    {breakdownData.slice(0, 6).map(([cat, usd], i) => (
                      <div key={cat} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: catColor(catColorIndex[cat] ?? i) }} />
                        <span className="font-inter text-xs text-on-surface-variant flex-1 truncate">{cat}</span>
                        <span className="font-inter font-semibold text-xs text-on-surface shrink-0">{cur === 'USD' ? fmtUSD(usd) : fmtINR(usd * (stats.expensesINR / (stats.expenses || 1)))}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Full breakdown bars */}
                <div className="mt-3 space-y-2">
                  {breakdownData.map(([cat, usd]) => {
                    const inr = usd * (stats.expensesINR / (stats.expenses || 1));
                    return (
                      <div key={cat} className="space-y-0.5">
                        <div className="flex justify-between">
                          <span className="font-inter text-xs text-on-surface truncate">{cat}</span>
                          <span className="font-inter font-semibold text-xs text-on-surface shrink-0 ml-2">
                            {cur === 'USD' ? fmtUSD(usd) : fmtINR(inr)}
                          </span>
                        </div>
                        <div className="h-1.5 bg-surface-container rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(100, (usd / stats.expenses) * 100)}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Top 5 transactions */}
            {topTxns.length > 0 && (
              <div className="bg-surface-container-lowest rounded-xl p-4 shadow-card">
                <p className="font-inter font-semibold text-xs uppercase tracking-wider text-outline mb-3">Biggest Spends</p>
                <div className="space-y-2">
                  {topTxns.map((txn, i) => (
                    <div key={txn.localId} className="flex items-center gap-2">
                      <span className="font-inter text-xs text-outline w-4 shrink-0">{i + 1}</span>
                      <span className="font-inter text-sm text-on-surface flex-1 truncate">{txn.name}</span>
                      <span className="font-inter text-xs text-on-surface-variant shrink-0">{txn.expenseClassI || txn.expenseClassII}</span>
                      <span className="font-manrope font-bold text-sm text-on-surface shrink-0 ml-1">{cur === 'USD' ? fmtUSD(txn.amountUSD) : fmtINR(txn.amountINR)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {stats.expenses > stats.income * 0.8 && stats.income > 0 && (
              <div className="flex items-center gap-3 bg-error-container/20 rounded-xl p-3">
                <span className="material-symbols-outlined text-[20px] text-error">warning</span>
                <p className="font-inter text-sm text-on-surface">Expenses are {Math.round((stats.expenses / stats.income) * 100)}% of income this month</p>
              </div>
            )}
          </div>
        )}

        {/* ── Transactions ── */}
        {activeTab === 'transactions' && (
          <div className="px-4 mt-3 space-y-3">
            {/* Month / All-time toggle */}
            <div className="flex gap-1 bg-surface-container rounded-xl p-1">
              <button onClick={() => setAllMode(false)}
                className={`flex-1 py-2 rounded-lg font-inter font-medium text-xs transition-all ${!allMode ? 'bg-surface-container-lowest shadow-sm text-on-surface' : 'text-on-surface-variant'}`}>
                This Month
              </button>
              <button onClick={() => setAllMode(true)}
                className={`flex-1 py-2 rounded-lg font-inter font-medium text-xs transition-all ${allMode ? 'bg-surface-container-lowest shadow-sm text-on-surface' : 'text-on-surface-variant'}`}>
                All Time
              </button>
            </div>

            {/* Type filter */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {(['all', 'expense', 'income'] as const).map(f => (
                <button key={f} onClick={() => setFilterType(f)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full font-inter text-xs font-semibold capitalize border transition-all ${filterType === f ? 'bg-primary text-on-primary border-primary' : 'border-outline-variant/60 text-on-surface-variant'}`}>
                  {f}
                </button>
              ))}
            </div>

            {/* Filter mode selector */}
            <div className="flex gap-1 bg-surface-container rounded-xl p-1">
              {(['classII', 'classI', 'tags'] as FilterMode[]).map(m => (
                <button key={m} onClick={() => setFilterMode(m)}
                  className={`flex-1 py-1.5 rounded-lg font-inter text-xs font-semibold transition-all ${filterMode === m ? 'bg-surface-container-lowest shadow-sm text-on-surface' : 'text-on-surface-variant'}`}>
                  {m === 'classI' ? 'Category' : m === 'classII' ? 'Broad' : 'Tags'}
                </button>
              ))}
            </div>

            {/* Filter chips */}
            {filterChips.length > 0 && (
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {filterChips.map(chip => (
                  <button key={chip} onClick={() => setFilterValue(v => v === chip ? '' : chip)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full font-inter text-xs font-semibold border transition-all ${filterValue === chip ? 'bg-secondary text-on-secondary border-secondary' : 'border-outline-variant/60 text-on-surface-variant'}`}>
                    {chip}
                  </button>
                ))}
              </div>
            )}

            {/* All-time: search + sort controls */}
            {allMode && (
              <>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-outline pointer-events-none">search</span>
                  <input
                    type="text"
                    value={allSearch}
                    onChange={e => setAllSearch(e.target.value)}
                    placeholder="Search transactions…"
                    className="w-full pl-9 pr-3 py-2.5 bg-surface-container rounded-xl font-inter text-sm text-on-surface placeholder:text-outline outline-none"
                  />
                </div>
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
                  {([
                    ['date-desc', 'Newest'],
                    ['date-asc', 'Oldest'],
                    ['amount-desc', 'Most $'],
                    ['amount-asc', 'Least $'],
                    ['name', 'Name A–Z'],
                  ] as [typeof sortMode, string][]).map(([val, label]) => (
                    <button key={val} onClick={() => setSortMode(val)}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-full font-inter text-xs font-semibold border transition-all ${sortMode === val ? 'bg-primary text-on-primary border-primary' : 'border-outline-variant/60 text-on-surface-variant'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Yearly tag totals (shown when a tag is selected) */}
            {filterMode === 'tags' && filterValue && tagYearlyData && tagYearlyData.length > 0 && (
              <div className="bg-surface-container-lowest rounded-xl p-4 shadow-card">
                <p className="font-inter font-semibold text-xs uppercase tracking-wider text-outline mb-3">
                  {filterValue} — yearly totals
                </p>
                <ResponsiveContainer width="100%" height={80}>
                  <BarChart data={tagYearlyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <XAxis dataKey="year" tick={{ fontFamily: 'Inter', fontSize: 10, fill: axisColor }} />
                    <YAxis tick={{ fontFamily: 'Inter', fontSize: 10, fill: axisColor }} />
                    <Tooltip formatter={(v) => [cur === 'USD' ? fmtUSD(Number(v)) : fmtINR(Number(v)), 'Total']} contentStyle={tooltipStyle} />
                    <Bar dataKey="total" fill={isDark ? 'rgb(180 197 255)' : 'rgb(0 74 198)'} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Monthly trend for selected filter (month mode only) */}
            {!allMode && filterTrend && (
              <div className="bg-surface-container-lowest rounded-xl p-4 shadow-card">
                <p className="font-inter font-semibold text-xs uppercase tracking-wider text-outline mb-1">
                  {filterValue} — {year} monthly
                </p>
                <p className="font-inter text-[10px] text-on-surface-variant mb-3">Tap a bar to view that month</p>
                <div className="flex items-end gap-1 h-20">
                  {filterTrend.map(({ m, total, monthNum }) => {
                    const maxVal = Math.max(...filterTrend.map(d => d.total));
                    const h = maxVal > 0 ? Math.max(total > 0 ? 6 : 0, Math.round((total / maxVal) * 60)) : 0;
                    const isActive = monthNum === month;
                    return (
                      <button key={monthNum} onClick={() => setMonth(monthNum)}
                        className="flex-1 flex flex-col items-center gap-1 group">
                        {total > 0 && (
                          <span className="font-inter text-[8px] text-outline opacity-0 group-hover:opacity-100 transition-opacity">
                            {cur === 'USD' ? `$${Math.round(total)}` : `₹${Math.round(total)}`}
                          </span>
                        )}
                        <div className="w-full rounded-t-sm transition-all"
                          style={{
                            height: `${h}px`,
                            backgroundColor: isActive ? 'var(--color-secondary)' : total > 0 ? 'var(--color-primary)' : 'var(--color-surface-container)',
                            opacity: isActive ? 1 : 0.6,
                          }} />
                        <span className={`font-inter text-[9px] ${isActive ? 'text-secondary font-semibold' : 'text-outline'}`}>{m}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-2 pt-2 border-t border-outline-variant/20 flex justify-between items-center">
                  <span className="font-inter text-xs text-on-surface-variant">
                    {getMonthName(month)} total
                  </span>
                  <span className="font-manrope font-bold text-sm text-on-surface">
                    {cur === 'USD' ? fmtUSD(filterTrend[month - 1].total) : fmtINR(filterTrend[month - 1].total)}
                  </span>
                </div>
              </div>
            )}

            {/* Transaction list */}
            {(() => {
              const list = allMode ? allFilteredTxns : filteredTxns;
              if (list.length === 0) return (
                <div className="text-center py-12">
                  <span className="material-symbols-outlined text-[40px] text-outline block mb-2">receipt_long</span>
                  <p className="font-work-sans text-sm text-on-surface-variant">
                    {allSearch ? `No results for "${allSearch}"` : filterValue ? `No "${filterValue}" ${filterType !== 'all' ? filterType : ''} transactions${!allMode ? ` in ${getMonthName(month)}` : ''}` : allMode ? 'No transactions' : `No transactions for ${getMonthName(month)} ${year}`}
                  </p>
                </div>
              );
              return (
                <>
                  {allMode && <p className="font-inter text-[10px] text-outline text-right">{list.length} transaction{list.length !== 1 ? 's' : ''}</p>}
                  <div className="space-y-2">
                    {list.map(txn => <TxnRow key={txn.localId} txn={txn} currency={cur} catIndex={catColorIndex} />)}
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* ── Trips ── */}
        {activeTab === 'trips' && (
          <div className="px-4 mt-3">
            {tripSummaries.length === 0 ? (
              <div className="text-center py-12">
                <span className="material-symbols-outlined text-[40px] text-outline block mb-2">flight</span>
                <p className="font-work-sans text-sm text-on-surface-variant">No trip expenses yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tripSummaries.map(trip => (
                  <div key={trip.tripName} className="bg-surface-container-lowest rounded-xl p-4 shadow-card">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[20px] text-primary">flight</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-inter font-semibold text-sm text-on-surface truncate">{trip.tripName}</p>
                        {trip.tripState && <p className="font-inter text-xs text-on-surface-variant">{trip.tripState}</p>}
                        <p className="font-inter text-xs text-outline mt-0.5">{trip.count} transaction{trip.count !== 1 ? 's' : ''}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-manrope font-bold text-base text-on-surface">{cur === 'USD' ? fmtUSD(trip.totalUSD) : fmtINR(trip.totalINR)}</p>
                        <p className="font-inter text-xs text-outline">{cur === 'USD' ? fmtINR(trip.totalINR) : fmtUSD(trip.totalUSD)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {/* ── Owe ── */}
        {activeTab === 'owe' && (
          <div className="px-4 mt-3 space-y-4">
            {oweEntries.length === 0 ? (
              <div className="text-center py-12">
                <span className="material-symbols-outlined text-[40px] text-outline block mb-2">handshake</span>
                <p className="font-work-sans text-sm text-on-surface-variant">
                  {isSignedIn ? 'No owe entries in the spreadsheet' : 'Sign in to view owe data'}
                </p>
              </div>
            ) : (() => {
              // Group by person
              const byPerson = new Map<string, typeof oweEntries>();
              oweEntries.forEach(e => {
                if (!byPerson.has(e.oweTo)) byPerson.set(e.oweTo, []);
                byPerson.get(e.oweTo)!.push(e);
              });

              // Total per currency across all
              const totalByCurrency: Record<string, number> = {};
              oweEntries.forEach(e => {
                totalByCurrency[e.currency] = (totalByCurrency[e.currency] ?? 0) + e.amount;
              });

              return (
                <>
                  {/* Overall summary */}
                  <div className="bg-error/10 rounded-xl p-4">
                    <p className="font-inter text-xs font-semibold uppercase tracking-wider text-error mb-2">Total Owed</p>
                    <div className="flex flex-wrap gap-3">
                      {Object.entries(totalByCurrency).map(([currency, amt]) => (
                        <div key={currency}>
                          <span className="font-manrope font-bold text-xl text-on-surface">{amt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          <span className="font-inter text-xs text-on-surface-variant ml-1">{currency}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Per-person cards */}
                  {[...byPerson.entries()].map(([person, entries]) => {
                    const perCurrency: Record<string, number> = {};
                    entries.forEach(e => { perCurrency[e.currency] = (perCurrency[e.currency] ?? 0) + e.amount; });
                    return (
                      <div key={person} className="bg-surface-container-lowest rounded-xl shadow-card overflow-hidden">
                        <div className="flex items-center gap-3 px-4 py-3 bg-surface-container">
                          <div className="w-9 h-9 rounded-full bg-secondary/20 flex items-center justify-center shrink-0">
                            <span className="font-manrope font-bold text-sm text-secondary">{person.charAt(0).toUpperCase()}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-inter font-semibold text-sm text-on-surface">{person}</p>
                            <p className="font-inter text-xs text-on-surface-variant">{entries.length} item{entries.length !== 1 ? 's' : ''}</p>
                          </div>
                          <div className="text-right">
                            {Object.entries(perCurrency).map(([currency, amt]) => (
                              <p key={currency} className="font-manrope font-bold text-sm text-error">
                                {amt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                              </p>
                            ))}
                          </div>
                        </div>
                        <div className="divide-y divide-outline-variant/20">
                          {entries.map(e => (
                            <div key={e.localId} className="px-4 py-2.5 flex items-start gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="font-inter text-sm text-on-surface">{e.reason}</p>
                                {e.notes && <p className="font-inter text-xs text-on-surface-variant mt-0.5">{e.notes}</p>}
                                <p className="font-inter text-[10px] text-outline mt-0.5">{getMonthName(e.month)} {e.year}</p>
                              </div>
                              <span className="font-manrope font-semibold text-sm text-on-surface shrink-0">
                                {e.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {e.currency}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </>
              );
            })()}
          </div>
        )}
      </main>

      <button
        onClick={() => setAddOpen(true)}
        className="fixed right-4 w-14 h-14 bg-primary text-on-primary rounded-full shadow-fab flex items-center justify-center hover:scale-105 active:scale-95 transition-transform z-40"
        style={{ bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))' }}
      >
        <span className="material-symbols-outlined text-[28px]">add</span>
      </button>

      <AddTransactionModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
