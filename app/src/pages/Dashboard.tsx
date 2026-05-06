import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import TopBar from '../components/layout/TopBar';
import FocusTimer from '../components/timer/FocusTimer';
import { useTasksStore } from '../store/tasksStore';
import { useNotesStore } from '../store/notesStore';
import { useFinanceStore } from '../store/financeStore';
import { useHabitsStore } from '../store/habitsStore';
import { useSyncStore } from '../store/syncStore';
import { useCalendarStore } from '../store/calendarStore';
import { formatCurrency, getTodayString, isOverdue, isDueSoon } from '../utils/dateUtils';
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
  const recentNotes = useNotesStore((s) => s.notes).slice(0, 4);
  const { getMonthlyStats } = useFinanceStore();
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
  const year = now.getFullYear();
  const month = now.getMonth();
  const monthStats = useMemo(
    () => getMonthlyStats(year, month + 1),
    [year, month, getMonthlyStats],
  );

  // Today's deadline tasks: overdue + due today, sorted by priority weight
  const PRIORITY_WEIGHT: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1, none: 0 };
  const todayDeadlineTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.status !== 'done' && t.dueDate && (isOverdue(t.dueDate) || isDueSoon(t.dueDate, 0)))
        .sort((a, b) => (PRIORITY_WEIGHT[b.priority] ?? 0) - (PRIORITY_WEIGHT[a.priority] ?? 0))
        .slice(0, 5),
    [tasks],
  );

  // Focus tasks: high/critical + no-deadline tasks
  const focusTasks = useMemo(
    () =>
      tasks
        .filter(
          (t) =>
            t.status !== 'done' &&
            (t.priority === 'critical' || t.priority === 'high') &&
            !todayDeadlineTasks.find((d) => d.id === t.id),
        )
        .slice(0, Math.max(0, 3 - todayDeadlineTasks.length)),
    [tasks, todayDeadlineTasks],
  );

  const priorityTaskCount = tasks.filter(
    (t) => t.status !== 'done' && (t.priority === 'high' || t.priority === 'critical'),
  ).length;

  const tokenValid = isTokenValid();
  const hasDriveToken = !!accessToken; // had a token at some point
  const connected = tokenValid || calendarAccounts.length > 0;
  const driveExpired = hasDriveToken && !tokenValid; // was connected, now expired

  return (
    <div className="bg-background min-h-screen">
      <TopBar
        title="Basil Reji"
        rightSlot={
          <div className="flex items-center gap-1">
            {connected && (
              <button
                onClick={() => syncNow()}
                disabled={syncStatus === 'syncing'}
                className="w-9 h-9 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors disabled:opacity-50"
                title={syncStatus === 'syncing' ? 'Syncing…' : syncStatus === 'success' ? 'Synced — tap to sync now' : syncStatus === 'error' ? 'Sync failed — tap to retry' : 'Tap to sync'}
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
        {/* Hero — live clock */}
        <section className="pt-1">
          <p className="font-inter text-xs font-semibold uppercase tracking-widest text-outline mb-1">
            {format(now, 'EEEE, MMMM d')}
          </p>
          <p className="font-manrope font-bold text-on-background tabular-nums" style={{ fontSize: '2.8rem', lineHeight: 1.1 }}>
            {format(now, 'h:mm')}
            <span className="text-2xl text-on-surface-variant">{format(now, ':ss')}</span>
            <span className="font-inter font-medium text-xl text-on-surface-variant ml-2">{format(now, 'a')}</span>
          </p>
          {priorityTaskCount > 0 && (
            <p className="font-work-sans text-sm text-on-surface-variant mt-1.5">
              {priorityTaskCount} high-priority task{priorityTaskCount !== 1 ? 's' : ''} need attention
            </p>
          )}
        </section>

        {/* Drive session expired banner */}
        {driveExpired && (
          <section
            className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3 cursor-pointer"
            onClick={() => navigate('/calendar')}
          >
            <span className="material-symbols-outlined text-[22px] text-amber-600 shrink-0">sync_problem</span>
            <div className="flex-1">
              <p className="font-inter font-semibold text-sm text-amber-800">Sync paused — session expired</p>
              <p className="font-inter text-xs text-amber-700">Tap to reconnect Google and resume syncing</p>
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

        {/* Today's Calendar Events */}
        {connected && calendarEvents.length > 0 && (
          <section className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-h3 text-h3 text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-primary">event</span>
                Today's Events
              </h3>
              <button onClick={() => navigate('/calendar')} className="font-inter text-xs font-semibold text-primary hover:underline">
                View all
              </button>
            </div>
            <div className="space-y-2">
              {calendarEvents.map((ev) => (
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

        {/* Today's Deadlines */}
        {todayDeadlineTasks.length > 0 && (
          <section className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-h3 text-h3 text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-error">warning</span>
                Due Today
              </h3>
              <button onClick={() => navigate('/tasks')} className="font-inter text-xs font-semibold text-primary hover:underline">
                View all
              </button>
            </div>
            <div className="space-y-2">
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
            </div>
          </section>
        )}

        {/* Today's Focus (high priority, no deadline) */}
        {focusTasks.length > 0 && (
          <section className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-h3 text-h3 text-on-surface">Today's Focus</h3>
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

        {/* Recent Notes */}
        <section className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-h3 text-h3 text-on-surface">Recent Notes</h3>
            <button onClick={() => navigate('/notes')} className="font-inter text-xs font-semibold text-primary hover:underline">
              View all
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {recentNotes.slice(0, 2).map((note) => (
              <div
                key={note.id}
                onClick={() => navigate('/notes')}
                className="bg-surface-container-low rounded-xl p-4 aspect-square flex flex-col justify-between cursor-pointer hover:shadow-card-hover transition-shadow"
              >
                <span className="material-symbols-outlined text-[22px] text-pink-500">sticky_note_2</span>
                <div>
                  <p className="font-inter font-semibold text-sm text-on-background leading-tight">{note.title}</p>
                  <p className="font-inter text-xs text-on-surface-variant mt-1 truncate">{note.content.slice(0, 40)}</p>
                </div>
              </div>
            ))}
            {recentNotes.slice(2, 4).map((note) => (
              <div
                key={note.id}
                onClick={() => navigate('/notes')}
                className="col-span-1 bg-surface-container-lowest rounded-xl p-3 flex items-center gap-3 cursor-pointer hover:shadow-card-hover transition-shadow shadow-card"
              >
                <div className="w-9 h-9 bg-surface-container rounded-lg flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[18px] text-tertiary">sticky_note_2</span>
                </div>
                <div className="min-w-0">
                  <p className="font-inter font-medium text-xs text-on-background truncate">{note.title}</p>
                  <p className="font-inter text-[10px] text-on-surface-variant">Note</p>
                </div>
              </div>
            ))}
          </div>
        </section>

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

        {/* Finance Snapshot */}
        <section
          className="bg-surface-container-lowest rounded-xl p-4 shadow-card cursor-pointer hover:shadow-card-hover transition-shadow"
          onClick={() => navigate('/finance')}
        >
          <div className="flex justify-between items-center mb-3">
            <span className="font-inter text-xs font-semibold uppercase tracking-widest text-outline">
              {format(now, 'MMMM')} Outflow
            </span>
            <span className="font-manrope font-bold text-xl text-on-surface">
              {formatCurrency(monthStats.expenses)}
            </span>
          </div>
          <div className="h-16 flex items-end gap-1">
            {Array.from({ length: 7 }, (_, i) => {
              const d = new Date();
              d.setDate(d.getDate() - (6 - i));
              const day = d.getDate();
              const amount = monthStats.byDay.find((b) => b.day === day)?.amount ?? 0;
              const max = Math.max(...monthStats.byDay.map((b) => b.amount), 1);
              const height = Math.max((amount / max) * 100, 4);
              const isToday = i === 6;
              return (
                <div key={i} className="flex flex-col items-center gap-1 flex-1">
                  <div
                    className={`w-full rounded-t-sm transition-all ${isToday ? 'bg-primary' : 'bg-primary/20'}`}
                    style={{ height: `${height}%` }}
                  />
                  <span className="font-inter text-[9px] text-outline">{format(d, 'EEE').slice(0, 1)}</span>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
