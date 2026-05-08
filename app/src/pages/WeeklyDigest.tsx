import { useMemo } from 'react';
import { format, startOfWeek, endOfWeek, addDays, getDaysInMonth } from 'date-fns';
import TopBar from '../components/layout/TopBar';
import { useHabitsStore } from '../store/habitsStore';
import { useFitnessStore } from '../store/fitnessStore';
import { useTasksStore } from '../store/tasksStore';
import { useFinanceStore } from '../store/financeStore';
import { useBooksStore } from '../store/booksStore';
type DigestFreq = 'daily' | 'weekly' | 'monthly';

function StatCard({
  icon, label, value, sub, color,
}: { icon: string; label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-card flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: color + '20' }}>
        <span className="material-symbols-outlined text-[20px]" style={{ color }}>{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-inter text-[10px] font-semibold uppercase tracking-wider text-outline">{label}</p>
        <p className="font-manrope font-bold text-xl text-on-surface leading-tight">{value}</p>
        {sub && <p className="font-inter text-xs text-on-surface-variant mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function WeeklyDigest() {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  const weekEndStr = format(weekEnd, 'yyyy-MM-dd');

  const habits = useHabitsStore(s => s.habits);
  const entries = useHabitsStore(s => s.entries);
  const tasks = useTasksStore(s => s.tasks);
  const { transactions } = useFinanceStore();
  const { gymSessions, sportSessions } = useFitnessStore();
  const { reviews: bookReviews, readingList } = useBooksStore();

  const activeHabits = useMemo(() => habits.filter(h => !h.archivedAt), [habits]);

  type HabitRow = { name: string; icon: string; color: string; done: number; total: number; label: string };

  const habitStats = useMemo(() => {
    const weekDaysSoFar: string[] = [];
    for (let i = 0; i <= 6; i++) {
      const d = addDays(weekStart, i);
      if (d <= now) weekDaysSoFar.push(format(d, 'yyyy-MM-dd'));
    }

    const monthStr = format(now, 'yyyy-MM');
    const daysInMonth = getDaysInMonth(now);
    const dayOfMonth = now.getDate();

    const byFreq: Record<DigestFreq, HabitRow[]> = { daily: [], weekly: [], monthly: [] };
    let trackDone = 0, trackPossible = 0;

    activeHabits.forEach(h => {
      const freq = h.frequency;
      let done = 0, total = 0, label = '';

      if (freq === 'daily' || freq === 'weekdays') {
        done = entries.filter(e => e.habitId === h.id && e.completed && e.date >= weekStartStr && e.date <= weekEndStr).length;
        total = weekDaysSoFar.length;
        label = `${done}/${total} days this week`;
        trackDone += done; trackPossible += total;
      } else if (freq === 'weekly') {
        done = entries.filter(e => e.habitId === h.id && e.completed && e.date >= weekStartStr && e.date <= weekEndStr).length;
        total = h.targetDays;
        label = `${done}/${total} target this week`;
        trackDone += done; trackPossible += total;
      } else {
        done = entries.filter(e => e.habitId === h.id && e.completed && e.date.startsWith(monthStr)).length;
        total = h.targetDays;
        label = `${done}/${total} this month (day ${dayOfMonth}/${daysInMonth})`;
      }

      const bucket: DigestFreq = (freq === 'daily' || freq === 'weekdays') ? 'daily' : freq === 'weekly' ? 'weekly' : 'monthly';
      byFreq[bucket].push({ name: h.name, icon: h.icon, color: h.color, done, total, label });
    });

    const pct = trackPossible > 0 ? Math.round((trackDone / trackPossible) * 100) : 0;
    return { byFreq, trackDone, trackPossible, pct };
  }, [activeHabits, entries, weekStartStr, weekEndStr]);

  const fitnessStats = useMemo(() => {
    const gym = gymSessions.filter(s => s.date >= weekStartStr && s.date <= weekEndStr);
    const sport = sportSessions.filter(s => s.date >= weekStartStr && s.date <= weekEndStr);
    const gymCalories = gym.reduce((acc, s) => acc + (s.calories ?? 0), 0);
    const sportCalories = sport.reduce((acc, s) => acc + (s.calories ?? 0), 0);
    const gymSec = gym.reduce((acc, s) => acc + (s.duration ?? 0), 0);
    const sportSec = sport.reduce((acc, s) => acc + (s.duration ?? 0), 0);
    return {
      gymCount: gym.length,
      sportCount: sport.length,
      totalCalories: gymCalories + sportCalories,
      totalSeconds: gymSec + sportSec,
      gymTypes: [...new Set(gym.map(s => s.type))],
      sportTypes: [...new Set(sport.map(s => s.sport))],
    };
  }, [gymSessions, sportSessions, weekStartStr, weekEndStr]);

  const taskStats = useMemo(() => {
    const done = tasks.filter(t => t.status === 'done' && t.updatedAt >= weekStartStr && t.updatedAt <= weekEndStr + 'T23:59:59');
    const created = tasks.filter(t => t.createdAt >= weekStartStr && t.createdAt <= weekEndStr + 'T23:59:59');
    return { completed: done.length, created: created.length };
  }, [tasks, weekStartStr, weekEndStr]);

  const financeStats = useMemo(() => {
    const weekTxns = transactions.filter(t => t.date >= weekStartStr && t.date <= weekEndStr);
    const spent = weekTxns.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    const income = weekTxns.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const byCategory: Record<string, number> = {};
    weekTxns.filter(t => t.type === 'expense').forEach(t => {
      byCategory[t.category] = (byCategory[t.category] ?? 0) + t.amount;
    });
    const topCategory = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];
    return { spent, income, topCategory };
  }, [transactions, weekStartStr, weekEndStr]);

  const readingStats = useMemo(() => {
    const finishedThisWeek = bookReviews.filter(b => b.dateRead && b.dateRead >= weekStartStr && b.dateRead <= weekEndStr);
    return { toRead: readingList.length, finished: finishedThisWeek.length };
  }, [readingList, bookReviews, weekStartStr, weekEndStr]);

  const HABIT_COLOR_MAP: Record<string, string> = {
    teal: '#14b8a6', purple: '#8b5cf6', blue: '#3b82f6', orange: '#f97316',
    green: '#22c55e', red: '#ef4444', pink: '#ec4899', amber: '#f59e0b',
    indigo: '#6366f1', cyan: '#06b6d4',
  };

  return (
    <div className="bg-background min-h-screen">
      <TopBar title="Weekly Digest" />

      <main className="max-w-screen-xl mx-auto px-4 py-4 pb-28 space-y-5">

        {/* Week range header */}
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-2xl px-4 py-3">
          <p className="font-inter text-xs font-semibold uppercase tracking-wider text-primary/70">This Week</p>
          <p className="font-manrope font-bold text-base text-on-surface mt-0.5">
            {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d, yyyy')}
          </p>
          <p className="font-inter text-xs text-on-surface-variant mt-0.5">Auto-updated · refreshes with your data</p>
        </div>

        {/* Habits */}
        <section className="space-y-3">
          <h3 className="font-h3 text-h3 text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-secondary">track_changes</span>
            Habits
          </h3>

          {/* Weekly % ring — daily + weekly only */}
          {habitStats.trackPossible > 0 && (
            <div className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-card">
              <div className="px-4 py-3 flex items-center gap-3">
                <div className="flex-1">
                  <p className="font-manrope font-bold text-2xl text-on-surface">{habitStats.pct}%</p>
                  <p className="font-inter text-xs text-on-surface-variant">{habitStats.trackDone} of {habitStats.trackPossible} daily/weekly check-ins</p>
                </div>
                <div className="w-16 h-16 relative">
                  <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="3" className="text-surface-container" />
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="3"
                      className="text-primary" strokeDasharray={`${habitStats.pct} 100`} strokeLinecap="round" />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center font-inter font-bold text-xs text-primary">
                    {habitStats.pct}%
                  </span>
                </div>
              </div>
            </div>
          )}

          {(['daily', 'weekly', 'monthly'] as DigestFreq[]).map(freq => {
            const rows = habitStats.byFreq[freq];
            if (rows.length === 0) return null;
            const freqLabel = freq === 'daily' ? 'Daily' : freq === 'weekly' ? 'Weekly' : 'Monthly';
            const freqSub = freq === 'monthly' ? format(now, 'MMMM') : 'This week';
            return (
              <div key={freq} className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-card">
                <div className="px-4 py-2 border-b border-outline-variant/20 flex items-center justify-between">
                  <p className="font-inter text-[10px] font-semibold uppercase tracking-wider text-outline">{freqLabel}</p>
                  <p className="font-inter text-[10px] text-outline">{freqSub}</p>
                </div>
                <div className="divide-y divide-outline-variant/10">
                  {rows.map(h => (
                    <div key={h.name} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="material-symbols-outlined text-[18px]" style={{ color: HABIT_COLOR_MAP[h.color] ?? '#737686' }}>
                        {h.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-inter text-sm text-on-surface">{h.name}</p>
                        <p className="font-inter text-[10px] text-on-surface-variant">{h.label}</p>
                      </div>
                      <span className={`font-inter text-xs font-bold ${h.done >= h.total ? 'text-tertiary' : 'text-on-surface-variant'}`}>
                        {h.done >= h.total ? '✓' : `${h.done}/${h.total}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {activeHabits.length === 0 && (
            <p className="font-inter text-xs text-outline text-center py-2">No active habits</p>
          )}
        </section>

        {/* Fitness */}
        <section className="space-y-3">
          <h3 className="font-h3 text-h3 text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-secondary">fitness_center</span>
            Fitness
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <StatCard icon="fitness_center" label="Gym Sessions" value={fitnessStats.gymCount}
              sub={fitnessStats.gymTypes.join(', ') || 'None this week'} color="#f97316" />
            <StatCard icon="sports_soccer" label="Sports" value={fitnessStats.sportCount}
              sub={fitnessStats.sportTypes.join(', ') || 'None this week'} color="#22c55e" />
            {fitnessStats.totalCalories > 0 && (
              <StatCard icon="local_fire_department" label="Calories Burned" value={`${fitnessStats.totalCalories} kcal`}
                sub={`${fitnessStats.gymCount + fitnessStats.sportCount} sessions`} color="#ef4444" />
            )}
            {fitnessStats.totalSeconds > 0 && (
              <StatCard icon="timer" label="Active Time"
                value={`${Math.floor(fitnessStats.totalSeconds / 3600)}h ${Math.floor((fitnessStats.totalSeconds % 3600) / 60)}m`}
                sub={`${(fitnessStats.totalSeconds / 3600).toFixed(1)}h total`} color="#8b5cf6" />
            )}
          </div>
          {fitnessStats.gymCount === 0 && fitnessStats.sportCount === 0 && (
            <p className="font-inter text-xs text-outline text-center py-2">No fitness logged this week</p>
          )}
        </section>

        {/* Tasks */}
        <section className="space-y-3">
          <h3 className="font-h3 text-h3 text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-secondary">view_kanban</span>
            Tasks
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <StatCard icon="check_circle" label="Completed" value={taskStats.completed}
              sub="tasks closed this week" color="#22c55e" />
            <StatCard icon="add_task" label="Created" value={taskStats.created}
              sub="new tasks this week" color="#3b82f6" />
          </div>
        </section>

        {/* Finance */}
        <section className="space-y-3">
          <h3 className="font-h3 text-h3 text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-secondary">payments</span>
            Finance
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <StatCard icon="shopping_cart" label="Spent" value={`₹${financeStats.spent.toLocaleString()}`}
              sub={financeStats.topCategory ? `Top: ${financeStats.topCategory[0]}` : 'No expenses'} color="#ef4444" />
            {financeStats.income > 0 && (
              <StatCard icon="savings" label="Income" value={`₹${financeStats.income.toLocaleString()}`}
                sub="received this week" color="#22c55e" />
            )}
          </div>
        </section>

        {/* Reading */}
        <section className="space-y-3">
          <h3 className="font-h3 text-h3 text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-secondary">menu_book</span>
            Reading
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <StatCard icon="auto_stories" label="Reading List" value={readingStats.toRead}
              sub="books to read" color="#06b6d4" />
            {readingStats.finished > 0 && (
              <StatCard icon="done_all" label="Finished" value={readingStats.finished}
                sub="books this week" color="#22c55e" />
            )}
          </div>
        </section>

      </main>
    </div>
  );
}
