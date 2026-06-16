import { useMemo, useState } from 'react';
import TopBar from '../components/layout/TopBar';
import { useHabitsStore } from '../store/habitsStore';
import { useFitnessStore } from '../store/fitnessStore';
import { useTasksStore } from '../store/tasksStore';
import { useFinanceStore } from '../store/financeStore';
import { useBooksStore } from '../store/booksStore';
import { useGoalsStore } from '../store/goalsStore';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function MonthBar({ values, color, maxVal }: { values: number[]; color: string; maxVal: number }) {
  return (
    <div className="flex items-end gap-0.5 h-16">
      {values.map((v, i) => (
        <div key={i} className="flex flex-col items-center gap-0.5 flex-1">
          <div
            className="w-full rounded-sm transition-all"
            style={{
              height: maxVal > 0 ? `${Math.round((v / maxVal) * 52)}px` : '0px',
              background: v > 0 ? color : 'var(--color-surface-container)',
              minHeight: v > 0 ? '4px' : '0',
            }}
          />
          {v > 0 && <span className="font-inter text-[7px] text-outline">{v}</span>}
        </div>
      ))}
    </div>
  );
}

function SectionHeader({ icon, title }: { icon: string; title: string }) {
  return (
    <h3 className="font-h3 text-h3 text-on-surface flex items-center gap-2">
      <span className="material-symbols-outlined text-[18px] text-secondary">{icon}</span>
      {title}
    </h3>
  );
}

export default function YearlyReview() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  const habits = useHabitsStore(s => s.habits);
  const entries = useHabitsStore(s => s.entries);
  const tasks = useTasksStore(s => s.tasks);
  const { transactions } = useFinanceStore();
  const { gymSessions, sportSessions } = useFitnessStore();
  const { reviews: bookReviews } = useBooksStore();
  const goals = useGoalsStore(s => s.goals);

  const yrStr = String(year);

  const gymByMonth = useMemo(() => {
    const arr = Array(12).fill(0);
    gymSessions.filter(s => s.date.startsWith(yrStr)).forEach(s => {
      arr[parseInt(s.date.slice(5, 7)) - 1]++;
    });
    return arr;
  }, [gymSessions, yrStr]);

  const sportByMonth = useMemo(() => {
    const arr = Array(12).fill(0);
    sportSessions.filter(s => s.date.startsWith(yrStr)).forEach(s => {
      arr[parseInt(s.date.slice(5, 7)) - 1]++;
    });
    return arr;
  }, [sportSessions, yrStr]);

  const gymCaloriesTotal = useMemo(() =>
    gymSessions.filter(s => s.date.startsWith(yrStr)).reduce((a, s) => a + (s.calories ?? 0), 0),
    [gymSessions, yrStr]
  );

  const sportCaloriesTotal = useMemo(() =>
    sportSessions.filter(s => s.date.startsWith(yrStr)).reduce((a, s) => a + (s.calories ?? 0), 0),
    [sportSessions, yrStr]
  );

  const habitStats = useMemo(() => {
    const active = habits.filter(h => !h.archivedAt);
    const yearEntries = entries.filter(e => e.date.startsWith(yrStr));
    const totalCompletions = yearEntries.length;

    const byHabit = active.map(h => {
      const count = yearEntries.filter(e => e.habitId === h.id).length;
      const monthCounts = Array(12).fill(0);
      yearEntries.filter(e => e.habitId === h.id).forEach(e => {
        monthCounts[parseInt(e.date.slice(5, 7)) - 1]++;
      });
      return { name: h.name, icon: h.icon, color: h.color, count, monthCounts };
    });

    return { totalCompletions, byHabit };
  }, [habits, entries, yrStr]);

  const habitsByMonth = useMemo(() => {
    const arr = Array(12).fill(0);
    entries.filter(e => e.date.startsWith(yrStr)).forEach(e => {
      arr[parseInt(e.date.slice(5, 7)) - 1]++;
    });
    return arr;
  }, [entries, yrStr]);

  const taskStats = useMemo(() => {
    const yearTasks = tasks.filter(t => (t.updatedAt ?? '').startsWith(yrStr));
    const completed = yearTasks.filter(t => t.status === 'done').length;
    const byMonth = Array(12).fill(0);
    tasks.filter(t => t.status === 'done' && (t.updatedAt ?? '').startsWith(yrStr)).forEach(t => {
      byMonth[parseInt(t.updatedAt.slice(5, 7)) - 1]++;
    });
    return { completed, byMonth };
  }, [tasks, yrStr]);

  const financeStats = useMemo(() => {
    const yearTxns = transactions.filter(t => t.date.startsWith(yrStr));
    const totalSpent = yearTxns.filter(t => t.type === 'expense').reduce((a, t) => a + t.amountUSD, 0);
    const totalIncome = yearTxns.filter(t => t.type === 'income').reduce((a, t) => a + t.amountUSD, 0);
    const byCategory: Record<string, number> = {};
    yearTxns.filter(t => t.type === 'expense').forEach(t => {
      const cat = t.expenseClassII || t.expenseClassI || 'Other';
      byCategory[cat] = (byCategory[cat] ?? 0) + t.amountUSD;
    });
    const spentByMonth = Array(12).fill(0);
    yearTxns.filter(t => t.type === 'expense').forEach(t => {
      spentByMonth[parseInt(t.date.slice(5, 7)) - 1] += t.amountUSD;
    });
    const sortedCats = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
    return { totalSpent, totalIncome, sortedCats, spentByMonth };
  }, [transactions, yrStr]);

  const booksStats = useMemo(() => {
    const finished = bookReviews.filter(b => b.dateRead && b.dateRead.startsWith(yrStr));
    const avgRating = finished.length > 0
      ? Math.round((finished.reduce((a, b) => a + b.rating, 0) / finished.length) * 10) / 10
      : null;
    const topRated = [...finished].sort((a, b) => b.rating - a.rating).slice(0, 3);
    return { count: finished.length, avgRating, topRated };
  }, [bookReviews, yrStr]);

  const HABIT_COLOR_MAP: Record<string, string> = {
    teal: '#14b8a6', purple: '#8b5cf6', blue: '#3b82f6', orange: '#f97316',
    green: '#22c55e', red: '#ef4444', pink: '#ec4899', amber: '#f59e0b',
    indigo: '#6366f1', cyan: '#06b6d4',
  };

  const goalsByQuarter = useMemo(() => {
    return ['Q1', 'Q2', 'Q3', 'Q4'].map(q => {
      const qGoals = goals.filter(g => g.quarter === `${q} ${year}`);
      const completed = qGoals.filter(g => g.status === 'completed').length;
      const abandoned = qGoals.filter(g => g.status === 'abandoned').length;
      const active = qGoals.filter(g => g.status === 'active').length;
      return {
        q, goals: qGoals, completed, abandoned, active,
        total: qGoals.length,
        completionRate: qGoals.length > 0 ? Math.round((completed / qGoals.length) * 100) : 0,
      };
    }).filter(q => q.total > 0);
  }, [goals, year]);

  const maxGym = Math.max(...gymByMonth, 1);
  const maxSport = Math.max(...sportByMonth, 1);
  const maxHabits = Math.max(...habitsByMonth, 1);
  const maxTasks = Math.max(...taskStats.byMonth, 1);
  const maxSpend = Math.max(...financeStats.spentByMonth, 1);

  return (
    <div className="bg-background min-h-screen">
      <TopBar title="Yearly Review" showBack />

      <main className="max-w-screen-xl mx-auto px-4 py-4 pb-28 space-y-6">

        {/* Year selector */}
        <div className="flex items-center justify-between bg-surface-container-lowest rounded-2xl px-4 py-3 shadow-card">
          <button onClick={() => setYear(y => y - 1)}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-surface-container text-on-surface-variant transition-colors">
            <span className="material-symbols-outlined text-[20px]">chevron_left</span>
          </button>
          <div className="text-center">
            <p className="font-manrope font-bold text-2xl text-on-surface">{year}</p>
            <p className="font-inter text-xs text-on-surface-variant">Auto-updated</p>
          </div>
          <button onClick={() => setYear(y => y + 1)} disabled={year >= currentYear}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-surface-container text-on-surface-variant transition-colors disabled:opacity-30">
            <span className="material-symbols-outlined text-[20px]">chevron_right</span>
          </button>
        </div>

        {/* Fitness */}
        <section className="space-y-3">
          <SectionHeader icon="fitness_center" title="Fitness" />
          <div className="grid grid-cols-2 gap-3 mb-2">
            <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-card text-center">
              <p className="font-manrope font-bold text-2xl text-orange-500">{gymByMonth.reduce((a, b) => a + b, 0)}</p>
              <p className="font-inter text-xs text-outline">Gym Sessions</p>
              {gymCaloriesTotal > 0 && <p className="font-inter text-[10px] text-on-surface-variant mt-0.5">{gymCaloriesTotal} kcal</p>}
            </div>
            <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-card text-center">
              <p className="font-manrope font-bold text-2xl text-green-500">{sportByMonth.reduce((a, b) => a + b, 0)}</p>
              <p className="font-inter text-xs text-outline">Sport Sessions</p>
              {sportCaloriesTotal > 0 && <p className="font-inter text-[10px] text-on-surface-variant mt-0.5">{sportCaloriesTotal} kcal</p>}
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-card space-y-3">
            <p className="font-inter text-xs font-semibold text-on-surface-variant">Gym by month</p>
            <MonthBar values={gymByMonth} color="#f97316" maxVal={maxGym} />
            <div className="flex gap-0.5">
              {MONTHS.map(m => (
                <span key={m} className="flex-1 text-center font-inter text-[7px] text-outline">{m}</span>
              ))}
            </div>
          </div>

          {sportByMonth.some(v => v > 0) && (
            <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-card space-y-3">
              <p className="font-inter text-xs font-semibold text-on-surface-variant">Sport by month</p>
              <MonthBar values={sportByMonth} color="#22c55e" maxVal={maxSport} />
              <div className="flex gap-0.5">
                {MONTHS.map(m => (
                  <span key={m} className="flex-1 text-center font-inter text-[7px] text-outline">{m}</span>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Habits */}
        <section className="space-y-3">
          <SectionHeader icon="track_changes" title="Habits" />
          <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-card text-center mb-2">
            <p className="font-manrope font-bold text-2xl text-primary">{habitStats.totalCompletions}</p>
            <p className="font-inter text-xs text-outline">Total check-ins</p>
          </div>
          <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-card space-y-3">
            <p className="font-inter text-xs font-semibold text-on-surface-variant">All habits by month</p>
            <MonthBar values={habitsByMonth} color="#8b5cf6" maxVal={maxHabits} />
            <div className="flex gap-0.5">
              {MONTHS.map(m => (
                <span key={m} className="flex-1 text-center font-inter text-[7px] text-outline">{m}</span>
              ))}
            </div>
          </div>
          <div className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-card">
            <div className="divide-y divide-outline-variant/10">
              {habitStats.byHabit.filter(h => h.count > 0).sort((a, b) => b.count - a.count).map(h => (
                <div key={h.name} className="flex items-center gap-3 px-4 py-3">
                  <span className="material-symbols-outlined text-[18px]" style={{ color: HABIT_COLOR_MAP[h.color] ?? '#737686' }}>
                    {h.icon}
                  </span>
                  <p className="font-inter text-sm text-on-surface flex-1">{h.name}</p>
                  <span className="font-manrope font-bold text-base" style={{ color: HABIT_COLOR_MAP[h.color] ?? '#737686' }}>
                    {h.count}
                  </span>
                </div>
              ))}
              {habitStats.byHabit.every(h => h.count === 0) && (
                <p className="font-inter text-xs text-outline px-4 py-3">No habit data for {year}</p>
              )}
            </div>
          </div>
        </section>

        {/* Tasks */}
        <section className="space-y-3">
          <SectionHeader icon="view_kanban" title="Tasks" />
          <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-card text-center mb-2">
            <p className="font-manrope font-bold text-2xl text-green-500">{taskStats.completed}</p>
            <p className="font-inter text-xs text-outline">Tasks completed in {year}</p>
          </div>
          {taskStats.completed > 0 && (
            <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-card space-y-3">
              <p className="font-inter text-xs font-semibold text-on-surface-variant">Completed by month</p>
              <MonthBar values={taskStats.byMonth} color="#22c55e" maxVal={maxTasks} />
              <div className="flex gap-0.5">
                {MONTHS.map(m => (
                  <span key={m} className="flex-1 text-center font-inter text-[7px] text-outline">{m}</span>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Finance */}
        <section className="space-y-3">
          <SectionHeader icon="payments" title="Finance" />
          <div className="grid grid-cols-2 gap-3 mb-2">
            <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-card text-center">
              <p className="font-manrope font-bold text-xl text-error">₹{financeStats.totalSpent.toLocaleString()}</p>
              <p className="font-inter text-xs text-outline">Total Spent</p>
            </div>
            {financeStats.totalIncome > 0 && (
              <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-card text-center">
                <p className="font-manrope font-bold text-xl text-green-500">₹{financeStats.totalIncome.toLocaleString()}</p>
                <p className="font-inter text-xs text-outline">Total Income</p>
              </div>
            )}
          </div>
          {financeStats.totalSpent > 0 && (
            <>
              <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-card space-y-3">
                <p className="font-inter text-xs font-semibold text-on-surface-variant">Spending by month</p>
                <MonthBar values={financeStats.spentByMonth} color="#ef4444" maxVal={maxSpend} />
                <div className="flex gap-0.5">
                  {MONTHS.map(m => (
                    <span key={m} className="flex-1 text-center font-inter text-[7px] text-outline">{m}</span>
                  ))}
                </div>
              </div>
              <div className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-card">
                <div className="px-4 py-3 border-b border-outline-variant/20">
                  <p className="font-inter text-xs font-semibold text-on-surface">Top Spending Categories</p>
                </div>
                <div className="divide-y divide-outline-variant/10">
                  {financeStats.sortedCats.slice(0, 5).map(([cat, amt]) => (
                    <div key={cat} className="flex items-center gap-3 px-4 py-2.5">
                      <p className="font-inter text-sm text-on-surface flex-1 capitalize">{cat}</p>
                      <span className="font-inter text-sm font-semibold text-on-surface">₹{amt.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
          {financeStats.totalSpent === 0 && (
            <p className="font-inter text-xs text-outline text-center py-2">No finance data for {year}</p>
          )}
        </section>

        {/* Goals */}
        {goalsByQuarter.length > 0 && (
          <section className="space-y-3">
            <SectionHeader icon="flag" title="Goals" />
            <div className="grid grid-cols-2 gap-3">
              {goalsByQuarter.map(({ q, total, completed, abandoned, active, completionRate }) => (
                <div key={q} className="bg-surface-container-lowest rounded-2xl p-4 shadow-card">
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-inter font-semibold text-sm text-on-surface">{q}</p>
                    <span className="font-inter text-[10px] text-outline">{total} goal{total !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="h-1.5 bg-surface-container rounded-full overflow-hidden mb-3">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${completionRate}%` }} />
                  </div>
                  <div className="flex justify-between text-center">
                    <div>
                      <p className="font-manrope font-bold text-lg text-emerald-600 dark:text-emerald-400">{completed}</p>
                      <p className="font-inter text-[9px] text-outline">Done</p>
                    </div>
                    <div>
                      <p className="font-manrope font-bold text-lg text-amber-500">{active}</p>
                      <p className="font-inter text-[9px] text-outline">Active</p>
                    </div>
                    <div>
                      <p className="font-manrope font-bold text-lg text-outline">{abandoned}</p>
                      <p className="font-inter text-[9px] text-outline">Dropped</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {/* Full goal list collapsed under each quarter */}
            <div className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-card">
              <div className="divide-y divide-outline-variant/10">
                {goalsByQuarter.map(({ q, goals: qGoals }) =>
                  qGoals.map(g => {
                    const progress = g.keyResults.length > 0
                      ? Math.min(100, Math.round(g.keyResults.reduce((s, kr) => s + (kr.current / (kr.target || 1)), 0) / g.keyResults.length * 100))
                      : 0;
                    return (
                      <div key={g.id} className="flex items-center gap-3 px-4 py-3">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${g.status === 'completed' ? 'bg-emerald-500' : g.status === 'abandoned' ? 'bg-outline' : 'bg-primary'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="font-inter text-sm text-on-surface truncate">{g.title}</p>
                          <p className="font-inter text-[10px] text-outline">{q}</p>
                        </div>
                        <span className="font-inter text-xs font-semibold text-on-surface-variant shrink-0">{progress}%</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </section>
        )}

        {/* Books */}
        <section className="space-y-3">
          <SectionHeader icon="menu_book" title="Books" />
          <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-card">
            <div className="flex items-center gap-4 mb-3">
              <div className="text-center flex-1">
                <p className="font-manrope font-bold text-2xl text-cyan-500">{booksStats.count}</p>
                <p className="font-inter text-xs text-outline">Books Read</p>
              </div>
              {booksStats.avgRating !== null && (
                <div className="text-center flex-1">
                  <p className="font-manrope font-bold text-2xl text-amber-500">{booksStats.avgRating}</p>
                  <p className="font-inter text-xs text-outline">Avg Rating</p>
                </div>
              )}
            </div>
            {booksStats.topRated.length > 0 && (
              <div className="space-y-1.5">
                <p className="font-inter text-[10px] font-semibold uppercase tracking-wider text-outline">Top Rated</p>
                {booksStats.topRated.map(b => (
                  <div key={b.id} className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[14px] text-amber-400">star</span>
                    <p className="font-inter text-xs text-on-surface flex-1 truncate">{b.title}</p>
                    <span className="font-inter text-xs font-semibold text-on-surface-variant">{b.rating}/10</span>
                  </div>
                ))}
              </div>
            )}
            {booksStats.count === 0 && (
              <p className="font-inter text-xs text-outline text-center">No books logged in {year}</p>
            )}
          </div>
        </section>

      </main>
    </div>
  );
}
