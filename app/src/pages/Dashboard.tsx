import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useThemeStore } from '../store/themeStore';
import { format, parseISO } from 'date-fns';
import TopBar from '../components/layout/TopBar';
import FocusTimer from '../components/timer/FocusTimer';
import { useTasksStore } from '../store/tasksStore';
import { useHabitsStore } from '../store/habitsStore';
import { useSyncStore } from '../store/syncStore';
import { useCalendarStore } from '../store/calendarStore';
import { getTodayString, isOverdue, isDueSoon, formatDisplayDate } from '../utils/dateUtils';
import type { CalendarEvent } from '../services/calendarApi';

const PRIORITY_ICON: Record<string, string> = {
  critical: 'keyboard_double_arrow_up',
  high: 'arrow_upward',
  medium: 'drag_handle',
  low: 'arrow_downward',
  none: 'remove',
};

const PRIORITY_COLOR: Record<string, string> = {
  critical: 'text-red-500',
  high: 'text-orange-400',
  medium: 'text-amber-400',
  low: 'text-blue-400',
  none: 'text-outline',
};

const CALENDAR_COLORS: Record<string, string> = {
  '1': 'bg-blue-400', '2': 'bg-teal-400', '3': 'bg-indigo-400',
  '4': 'bg-red-400', '5': 'bg-yellow-400', '6': 'bg-orange-400',
  '7': 'bg-blue-600', '8': 'bg-gray-400', '9': 'bg-blue-300',
  '10': 'bg-green-400', '11': 'bg-red-600',
};

function EventTime({ event }: { event: CalendarEvent }) {
  if (event.isAllDay) return <span className="font-inter text-[10px] text-outline">All day</span>;
  try {
    const start = parseISO(event.start);
    return <span className="font-inter text-[10px] text-outline tabular-nums">{format(start, 'h:mm a')}</span>;
  } catch {
    return null;
  }
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [showTimer, setShowTimer] = useState(false);

  const allTasks = useTasksStore((s) => s.tasks);
  const updateTask = useTasksStore((s) => s.updateTask);
  const allHabits = useHabitsStore((s) => s.habits);
  const isHabitCompleted = useHabitsStore((s) => s.isCompleted);
  const { calendarEvents, isTokenValid, syncStatus, syncNow, accessToken } = useSyncStore();
  const calendarAccounts = useCalendarStore((s) => s.accounts);

  const tasks = useMemo(
    () => allTasks.filter((t) => !t.parentId).sort((a, b) => a.order - b.order),
    [allTasks],
  );
  const habits = useMemo(() => allHabits.filter((h) => !h.archivedAt), [allHabits]);

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const today = getTodayString();

  const PRIORITY_WEIGHT: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1, none: 0 };

  const todayDeadlineTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.status !== 'done' && t.dueDate && (isOverdue(t.dueDate) || isDueSoon(t.dueDate, 0)))
        .sort((a, b) => (PRIORITY_WEIGHT[b.priority] ?? 0) - (PRIORITY_WEIGHT[a.priority] ?? 0))
        .slice(0, 5),
    [tasks],
  );

  // Tasks in the next 30 days with high/critical priority, or overdue tasks not shown in Today
  const comingUpTasks = useMemo(() => {
    const todayIds = new Set(todayDeadlineTasks.map((t) => t.id));
    const in30Days = new Date();
    in30Days.setDate(in30Days.getDate() + 30);
    const in30Str = in30Days.toISOString().slice(0, 10);

    return tasks
      .filter((t) => {
        if (t.status === 'done' || !t.dueDate || todayIds.has(t.id)) return false;
        const overdue = isOverdue(t.dueDate);
        const upcoming = t.dueDate > today && t.dueDate <= in30Str;
        const important = t.priority === 'critical' || t.priority === 'high';
        return overdue || (upcoming && important);
      })
      .sort((a, b) => {
        const aOv = isOverdue(a.dueDate);
        const bOv = isOverdue(b.dueDate);
        if (aOv !== bOv) return aOv ? -1 : 1;
        return (a.dueDate ?? '').localeCompare(b.dueDate ?? '');
      })
      .slice(0, 7);
  }, [tasks, todayDeadlineTasks, today]);

  const focusTasks = useMemo(
    () =>
      tasks
        .filter(
          (t) =>
            t.status !== 'done' &&
            !t.dueDate &&
            (t.priority === 'critical' || t.priority === 'high'),
        )
        .slice(0, 3),
    [tasks],
  );

  const tokenValid = isTokenValid();
  const hasDriveToken = !!accessToken;
  const connected = tokenValid || calendarAccounts.length > 0;
  const driveExpired = hasDriveToken && !tokenValid;

  const { mode, setMode, resolvedDark } = useThemeStore();
  const isDark = resolvedDark();
  function cycleTheme() {
    setMode(mode === 'light' ? 'dark' : mode === 'dark' ? 'system' : 'light');
  }

  const todayIsEmpty = calendarEvents.length === 0 && todayDeadlineTasks.length === 0;

  return (
    <div className="bg-background min-h-screen">
      <TopBar
        title="My Dashboard"
        rightSlot={
          <div className="flex items-center gap-1">
            <button
              onClick={cycleTheme}
              title={`Theme: ${mode} — click to cycle`}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">
                {isDark ? 'dark_mode' : mode === 'system' ? 'brightness_auto' : 'light_mode'}
              </span>
            </button>
            {connected && (
              <button
                onClick={() => syncNow()}
                disabled={syncStatus === 'syncing'}
                className="w-9 h-9 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors disabled:opacity-50"
                title={syncStatus === 'syncing' ? 'Syncing…' : syncStatus === 'error' ? 'Sync failed — tap to retry' : 'Tap to sync'}
              >
                <span className={`material-symbols-outlined text-[20px] ${syncStatus === 'syncing' ? 'text-amber-400 animate-spin' : syncStatus === 'success' ? 'text-tertiary' : syncStatus === 'error' ? 'text-error' : 'text-outline-variant'}`}>
                  sync
                </span>
              </button>
            )}
            <button
              onClick={() => setShowTimer((v) => !v)}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors"
            >
              <span className="material-symbols-outlined text-[22px]">timer</span>
            </button>
          </div>
        }
      />

      <main className="max-w-screen-xl mx-auto px-4 pt-5 pb-4 space-y-6">

        {/* Hero — date/day prominent, clock secondary */}
        <section className="pt-1">
          <p className="font-manrope font-bold text-2xl text-on-surface leading-tight">
            {format(now, 'EEEE')}
          </p>
          <p className="font-inter font-semibold text-base text-primary">
            {format(now, 'MMMM d, yyyy')}
          </p>
          <p className="font-inter tabular-nums text-sm text-on-surface-variant mt-1">
            {format(now, 'h:mm')}
            <span className="text-xs opacity-70">{format(now, ':ss')}</span>
            <span className="ml-1 text-xs">{format(now, 'a')}</span>
          </p>
        </section>

        {/* Drive session expired banner */}
        {driveExpired && (
          <section
            className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 flex items-center gap-3 cursor-pointer"
            onClick={() => navigate('/calendar')}
          >
            <span className="material-symbols-outlined text-[22px] text-amber-600 shrink-0">sync_problem</span>
            <div className="flex-1">
              <p className="font-inter font-semibold text-sm text-amber-800 dark:text-amber-300">Sync paused — session expired</p>
              <p className="font-inter text-xs text-amber-700 dark:text-amber-400">Tap to reconnect Google and resume syncing</p>
            </div>
            <span className="material-symbols-outlined text-[18px] text-amber-500">arrow_forward_ios</span>
          </section>
        )}

        {/* Focus Timer (collapsible) */}
        {showTimer && (
          <section className="animate-scale-in">
            <FocusTimer />
          </section>
        )}

        {/* Today — unified events + deadlines */}
        <section className="space-y-2">
          <div className="flex justify-between items-center">
            <h3 className="font-h3 text-h3 text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-primary">today</span>
              Today
            </h3>
            {!todayIsEmpty && (
              <button onClick={() => navigate('/tasks')} className="font-inter text-xs font-semibold text-primary hover:underline">
                All tasks
              </button>
            )}
          </div>

          {/* Calendar events */}
          {connected && calendarEvents.map((ev) => (
            <div key={ev.id} className="bg-surface-container-lowest rounded-xl px-4 py-3 flex items-center gap-3 shadow-card">
              <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${CALENDAR_COLORS[ev.colorId ?? ''] ?? 'bg-primary'}`} />
              <div className="flex-1 min-w-0">
                <p className="font-inter font-medium text-sm text-on-surface truncate">{ev.summary}</p>
                {ev.location && (
                  <p className="font-inter text-[10px] text-outline truncate">{ev.location}</p>
                )}
              </div>
              <EventTime event={ev} />
            </div>
          ))}

          {/* Tasks due today / overdue */}
          {todayDeadlineTasks.map((task) => (
            <div
              key={task.id}
              className="bg-surface-container-lowest rounded-xl p-4 shadow-card border-l-4 border-l-error cursor-pointer hover:shadow-card-hover transition-shadow"
              onClick={() => navigate(`/tasks/${task.id}`)}
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    updateTask(task.id, { status: task.status === 'done' ? 'todo' : 'done' });
                  }}
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                    task.status === 'done' ? 'border-tertiary bg-tertiary' : 'border-outline-variant hover:border-primary'
                  }`}
                >
                  {task.status === 'done' && (
                    <span className="material-symbols-outlined text-[12px] text-on-tertiary icon-fill">check</span>
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`font-inter font-medium text-sm text-on-surface truncate ${task.status === 'done' ? 'line-through opacity-60' : ''}`}>
                    {task.title}
                  </p>
                  <p className={`font-inter text-xs ${isOverdue(task.dueDate) ? 'text-error font-semibold' : 'text-on-surface-variant'}`}>
                    {isOverdue(task.dueDate) ? '⚠ Overdue' : 'Due today'}
                  </p>
                </div>
                <span className={`material-symbols-outlined text-[18px] ${PRIORITY_COLOR[task.priority]}`}>
                  {PRIORITY_ICON[task.priority]}
                </span>
              </div>
            </div>
          ))}

          {/* Empty state */}
          {todayIsEmpty && (
            <div className="bg-surface-container-lowest rounded-xl px-4 py-5 flex items-center gap-4 shadow-card">
              <span className="material-symbols-outlined text-[32px] text-tertiary">check_circle</span>
              <div>
                <p className="font-inter font-semibold text-sm text-on-surface">All clear for today!</p>
                <p className="font-inter text-xs text-on-surface-variant">No events or deadlines due today</p>
              </div>
            </div>
          )}
        </section>

        {/* Coming Up — important/emergency tasks in the next 30 days + overflow overdue */}
        {comingUpTasks.length > 0 && (
          <section className="space-y-2">
            <div className="flex justify-between items-center">
              <h3 className="font-h3 text-h3 text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-secondary">upcoming</span>
                Coming Up
              </h3>
              <button onClick={() => navigate('/tasks')} className="font-inter text-xs font-semibold text-primary hover:underline">
                View all
              </button>
            </div>
            <div className="space-y-2">
              {comingUpTasks.map((task) => {
                const overdue = isOverdue(task.dueDate);
                return (
                  <div
                    key={task.id}
                    className={`bg-surface-container-lowest rounded-xl px-4 py-3 shadow-card flex items-center gap-3 cursor-pointer hover:shadow-card-hover transition-shadow ${overdue ? 'border-l-4 border-l-error' : ''}`}
                    onClick={() => navigate(`/tasks/${task.id}`)}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateTask(task.id, { status: task.status === 'done' ? 'todo' : 'done' });
                      }}
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                        task.status === 'done' ? 'border-tertiary bg-tertiary' : 'border-outline-variant hover:border-primary'
                      }`}
                    >
                      {task.status === 'done' && (
                        <span className="material-symbols-outlined text-[12px] text-on-tertiary icon-fill">check</span>
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="font-inter font-medium text-sm text-on-surface truncate">{task.title}</p>
                      <p className={`font-inter text-xs ${overdue ? 'text-error font-semibold' : 'text-on-surface-variant'}`}>
                        {overdue ? '⚠ Overdue' : formatDisplayDate(task.dueDate!)}
                      </p>
                    </div>
                    <span className={`material-symbols-outlined text-[18px] ${PRIORITY_COLOR[task.priority]}`}>
                      {PRIORITY_ICON[task.priority]}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Connect Google prompt (if not connected) */}
        {!connected && (
          <section
            className="bg-surface-container-low rounded-xl p-4 flex items-center gap-3 cursor-pointer hover:shadow-card transition-shadow"
            onClick={() => navigate('/calendar')}
          >
            <span className="material-symbols-outlined text-[28px] text-primary">cloud_sync</span>
            <div className="flex-1">
              <p className="font-inter font-semibold text-sm text-on-surface">Connect Google</p>
              <p className="font-inter text-xs text-on-surface-variant">Sync data across devices + see calendar events</p>
            </div>
            <span className="material-symbols-outlined text-[18px] text-outline">arrow_forward_ios</span>
          </section>
        )}

        {/* Focus — high priority tasks with no deadline */}
        {focusTasks.length > 0 && (
          <section className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-h3 text-h3 text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-secondary">bolt</span>
                Focus
              </h3>
              <button onClick={() => navigate('/tasks')} className="font-inter text-xs font-semibold text-primary hover:underline">
                View all
              </button>
            </div>
            <div className="space-y-2">
              {focusTasks.map((task) => (
                <div
                  key={task.id}
                  className="bg-surface-container-lowest rounded-xl p-4 shadow-card border border-transparent hover:border-primary/20 transition-all cursor-pointer"
                  onClick={() => navigate(`/tasks/${task.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateTask(task.id, { status: task.status === 'done' ? 'todo' : 'done' });
                      }}
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                        task.status === 'done' ? 'border-tertiary bg-tertiary' : 'border-outline-variant hover:border-primary'
                      }`}
                    >
                      {task.status === 'done' && (
                        <span className="material-symbols-outlined text-[12px] text-on-tertiary icon-fill">check</span>
                      )}
                    </button>
                    <p className={`font-inter font-medium text-sm text-on-surface flex-1 truncate ${task.status === 'done' ? 'line-through opacity-60' : ''}`}>
                      {task.title}
                    </p>
                    <span className={`material-symbols-outlined text-[18px] ${PRIORITY_COLOR[task.priority]}`}>
                      {PRIORITY_ICON[task.priority]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Habits Today */}
        <section className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-h3 text-h3 text-on-surface">Today's Habits</h3>
            <button onClick={() => navigate('/habits')} className="font-inter text-xs font-semibold text-primary hover:underline">
              View all
            </button>
          </div>
          <div className="space-y-2">
            {habits.slice(0, 3).map((habit) => {
              const done = isHabitCompleted(habit.id, today);
              return (
                <div key={habit.id} className="bg-surface-container-lowest rounded-xl px-4 py-3 flex items-center gap-3 shadow-card">
                  <span className={`material-symbols-outlined text-[22px] ${done ? 'text-tertiary icon-fill' : 'text-on-surface-variant'}`}>
                    {habit.icon}
                  </span>
                  <p className={`font-inter font-medium text-sm flex-1 ${done ? 'line-through text-on-surface-variant' : 'text-on-surface'}`}>
                    {habit.name}
                  </p>
                  <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${done ? 'border-tertiary bg-tertiary' : 'border-outline-variant'}`}>
                    {done && <span className="material-symbols-outlined text-[11px] text-on-tertiary icon-fill">check</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Quick Access */}
        <section className="space-y-3 pb-4">
          <h3 className="font-h3 text-h3 text-on-surface">Quick Access</h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => navigate('/finance')}
              className="flex flex-col items-start gap-2 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50 hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-sm text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                <span className="material-symbols-outlined text-[22px] text-emerald-600">payments</span>
              </div>
              <div>
                <p className="font-manrope font-bold text-sm text-on-surface">Finance</p>
                <p className="font-inter text-[10px] text-on-surface-variant">Budget & transactions</p>
              </div>
            </button>
            <button
              onClick={() => navigate('/hobbies')}
              className="flex flex-col items-start gap-2 p-4 rounded-2xl bg-violet-50 dark:bg-violet-950/30 border border-violet-100 dark:border-violet-900/50 hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-sm text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center">
                <span className="material-symbols-outlined text-[22px] text-violet-600">local_library</span>
              </div>
              <div>
                <p className="font-manrope font-bold text-sm text-on-surface">Library</p>
                <p className="font-inter text-[10px] text-on-surface-variant">Books, movies & more</p>
              </div>
            </button>
            <button
              onClick={() => navigate('/digest')}
              className="flex flex-col items-start gap-2 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50 hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-sm text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                <span className="material-symbols-outlined text-[22px] text-amber-600">summarize</span>
              </div>
              <div>
                <p className="font-manrope font-bold text-sm text-on-surface">Weekly Digest</p>
                <p className="font-inter text-[10px] text-on-surface-variant">This week at a glance</p>
              </div>
            </button>
            <button
              onClick={() => navigate('/yearly')}
              className="flex flex-col items-start gap-2 p-4 rounded-2xl bg-sky-50 dark:bg-sky-950/30 border border-sky-100 dark:border-sky-900/50 hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-sm text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-900/50 flex items-center justify-center">
                <span className="material-symbols-outlined text-[22px] text-sky-600">calendar_today</span>
              </div>
              <div>
                <p className="font-manrope font-bold text-sm text-on-surface">Yearly Review</p>
                <p className="font-inter text-[10px] text-on-surface-variant">Full year stats</p>
              </div>
            </button>
          </div>
        </section>

      </main>
    </div>
  );
}
