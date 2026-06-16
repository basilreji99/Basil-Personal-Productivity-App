import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useThemeStore } from '../store/themeStore';
import { format, parseISO } from 'date-fns';
import TopBar from '../components/layout/TopBar';
import FocusTimer from '../components/timer/FocusTimer';
import TaskModal from '../components/tasks/TaskModal';
import { useTasksStore } from '../store/tasksStore';
import { useNotesStore } from '../store/notesStore';
import { useSyncStore } from '../store/syncStore';
import { useCalendarStore } from '../store/calendarStore';
import { getTodayString, localDateString, isOverdue, isDueSoon, formatDisplayDate } from '../utils/dateUtils';
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

const PRIORITY_WEIGHT: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1, none: 0 };

const CALENDAR_COLORS: Record<string, string> = {
  '1': 'bg-blue-400', '2': 'bg-teal-400', '3': 'bg-indigo-400',
  '4': 'bg-red-400', '5': 'bg-yellow-400', '6': 'bg-orange-400',
  '7': 'bg-blue-600', '8': 'bg-gray-400', '9': 'bg-blue-300',
  '10': 'bg-green-400', '11': 'bg-red-600',
};

const MINI_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MINI_DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function getGreeting(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  if (hour >= 17 && hour < 21) return 'Good evening';
  return 'Good night';
}

function EventTime({ event }: { event: CalendarEvent }) {
  if (event.isAllDay) return <span className="font-inter text-[10px] text-outline">All day</span>;
  try {
    const start = parseISO(event.start);
    return <span className="font-inter text-[10px] text-outline tabular-nums">{format(start, 'h:mm a')}</span>;
  } catch {
    return null;
  }
}

function MiniDatePicker({ value, onChange, onClose }: {
  value: string; onChange: (v: string) => void; onClose: () => void;
}) {
  const todayStr = localDateString();
  const [viewYear, setViewYear] = useState(() => parseInt(value.slice(0, 4)));
  const [viewMonth, setViewMonth] = useState(() => parseInt(value.slice(5, 7)) - 1);

  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const prevMonth = () => viewMonth === 0 ? (setViewYear(y => y - 1), setViewMonth(11)) : setViewMonth(m => m - 1);
  const nextMonth = () => viewMonth === 11 ? (setViewYear(y => y + 1), setViewMonth(0)) : setViewMonth(m => m + 1);

  const pick = (day: number) => {
    const ds = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    onChange(ds);
    onClose();
  };

  return (
    <div className="absolute top-7 left-0 z-50 bg-surface-container-lowest border border-outline-variant/20 rounded-xl shadow-modal overflow-hidden w-72">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-outline-variant/15">
        <button type="button" onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container transition-colors">
          <span className="material-symbols-outlined text-[20px] text-on-surface-variant">chevron_left</span>
        </button>
        <span className="font-inter font-semibold text-sm text-on-surface">{MINI_MONTHS[viewMonth]} {viewYear}</span>
        <button type="button" onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container transition-colors">
          <span className="material-symbols-outlined text-[20px] text-on-surface-variant">chevron_right</span>
        </button>
      </div>
      <div className="p-2">
        <div className="grid grid-cols-7 mb-1">
          {MINI_DAYS.map(d => (
            <span key={d} className="text-center font-inter text-[10px] text-outline font-semibold py-1">{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {Array.from({ length: firstDow }, (_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
            const ds = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const sel = ds === value;
            const tdy = ds === todayStr;
            return (
              <button key={day} type="button" onClick={() => pick(day)}
                className={`h-8 w-full rounded-lg font-inter text-sm font-medium transition-colors ${
                  sel ? 'bg-primary text-on-primary' :
                  tdy ? 'bg-primary/15 text-primary font-semibold' :
                  'hover:bg-surface-container text-on-surface'
                }`}>
                {day}
              </button>
            );
          })}
        </div>
      </div>
      {value !== todayStr && (
        <div className="px-3 pb-3 pt-1">
          <button type="button" onClick={() => { onChange(todayStr); onClose(); }}
            className="w-full py-1.5 rounded-lg bg-primary/10 text-primary font-inter text-xs font-semibold hover:bg-primary/20 transition-colors">
            Back to Today
          </button>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [showTimer, setShowTimer] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => getTodayString());
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [quickNoteTitle, setQuickNoteTitle] = useState('');
  const [quickNoteContent, setQuickNoteContent] = useState('');
  const quickNoteTitleRef = useRef<HTMLInputElement>(null);

  const allTasks = useTasksStore((s) => s.tasks);
  const updateTask = useTasksStore((s) => s.updateTask);
  const addNote = useNotesStore((s) => s.addNote);
  const { calendarEvents, isTokenValid, syncStatus, syncNow, accessToken } = useSyncStore();
  const calendarAccounts = useCalendarStore((s) => s.accounts);

  const tasks = useMemo(
    () => allTasks.filter((t) => !t.parentId).sort((a, b) => a.order - b.order),
    [allTasks],
  );

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const today = getTodayString();
  const isToday = selectedDate === today;

  const selectedDayTasks = useMemo(() => {
    if (isToday) {
      return tasks
        .filter((t) => t.status !== 'done' && t.dueDate && (isOverdue(t.dueDate) || isDueSoon(t.dueDate, 0)))
        .sort((a, b) => (PRIORITY_WEIGHT[b.priority] ?? 0) - (PRIORITY_WEIGHT[a.priority] ?? 0))
        .slice(0, 5);
    }
    return tasks
      .filter((t) => t.dueDate === selectedDate)
      .sort((a, b) => (PRIORITY_WEIGHT[b.priority] ?? 0) - (PRIORITY_WEIGHT[a.priority] ?? 0));
  }, [tasks, selectedDate, isToday]);

  const comingUpTasks = useMemo(() => {
    const shownIds = new Set(selectedDayTasks.map((t) => t.id));
    const in30Days = new Date();
    in30Days.setDate(in30Days.getDate() + 30);
    const in30Str = localDateString(in30Days);

    return tasks
      .filter((t) => {
        if (t.status === 'done' || !t.dueDate || shownIds.has(t.id)) return false;
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
  }, [tasks, selectedDayTasks, today]);

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
  // Only show "session expired" after syncNow has actually tried and failed (not just on token age check)
  const driveExpired = hasDriveToken && !tokenValid && syncStatus === 'error';

  const { mode, setMode, resolvedDark } = useThemeStore();
  const isDark = resolvedDark();
  function cycleTheme() {
    setMode(mode === 'light' ? 'dark' : mode === 'dark' ? 'system' : 'light');
  }

  const sectionEmpty = isToday
    ? calendarEvents.length === 0 && selectedDayTasks.length === 0
    : selectedDayTasks.length === 0;

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

      {/* Backdrop to close date picker when clicking outside */}
      {showPicker && (
        <div className="fixed inset-0 z-40" onClick={() => setShowPicker(false)} />
      )}

      <main className="max-w-screen-xl mx-auto px-4 pt-5 pb-4 space-y-6">

        {/* Hero — date/day prominent, clock secondary */}
        <section className="pt-1">
          <p className="font-inter text-sm text-on-surface-variant">{getGreeting(now.getHours())}, Basil</p>
          <p className="font-manrope font-bold text-2xl text-on-surface leading-tight mt-0.5">
            {format(now, 'EEEE')}
          </p>
          <div className="flex items-baseline justify-between mt-0.5">
            <p className="font-inter font-semibold text-base text-primary">
              {format(now, 'MMMM d, yyyy')}
            </p>
            <p className="font-inter tabular-nums text-sm text-on-surface-variant">
              {format(now, 'h:mm')}
              <span className="text-xs opacity-70">{format(now, ':ss')}</span>
              <span className="ml-1 text-xs">{format(now, 'a')}</span>
            </p>
          </div>
        </section>

        {/* Quick actions */}
        <section className="flex gap-3">
          <button
            onClick={() => setShowTaskModal(true)}
            className="flex-1 flex items-center gap-2 px-4 py-3 rounded-2xl bg-primary/10 text-primary hover:bg-primary/15 active:scale-[0.98] transition-all font-inter font-semibold text-sm"
          >
            <span className="material-symbols-outlined text-[20px]">add_task</span>
            New Task
          </button>
          <button
            onClick={() => { setShowNoteModal(true); setTimeout(() => quickNoteTitleRef.current?.focus(), 50); }}
            className="flex-1 flex items-center gap-2 px-4 py-3 rounded-2xl bg-secondary/10 text-secondary hover:bg-secondary/15 active:scale-[0.98] transition-all font-inter font-semibold text-sm"
          >
            <span className="material-symbols-outlined text-[20px]">edit_note</span>
            New Note
          </button>
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

        {/* Today / Selected Date — unified events + tasks */}
        <section className="space-y-2">
          <div className="flex justify-between items-center">
            <h3 className="font-h3 text-h3 text-on-surface flex items-center gap-2 relative">
              <button
                onClick={() => setShowPicker(v => !v)}
                className="flex items-center justify-center text-primary hover:opacity-70 transition-opacity"
                title="Pick a date"
              >
                <span className="material-symbols-outlined text-[18px]">today</span>
              </button>
              {isToday ? 'Today' : format(new Date(selectedDate + 'T12:00:00'), 'MMM d, yyyy')}
              {showPicker && (
                <MiniDatePicker
                  value={selectedDate}
                  onChange={setSelectedDate}
                  onClose={() => setShowPicker(false)}
                />
              )}
            </h3>
            <div className="flex items-center gap-3">
              {!isToday && (
                <button
                  onClick={() => { setSelectedDate(today); setShowPicker(false); }}
                  className="font-inter text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[13px]">today</span>
                  Today
                </button>
              )}
              {isToday && !sectionEmpty && (
                <button onClick={() => navigate('/today')} className="font-inter text-xs font-semibold text-primary hover:underline flex items-center gap-0.5">
                  View all
                  <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
                </button>
              )}
            </div>
          </div>

          {/* Calendar events (today only) */}
          {isToday && connected && calendarEvents.map((ev) => (
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

          {/* Tasks for today (top 5) or selected day */}
          {selectedDayTasks.map((task) => (
            <div
              key={task.id}
              className={`bg-surface-container-lowest rounded-xl p-4 shadow-card cursor-pointer hover:shadow-card-hover transition-shadow ${
                isToday && isOverdue(task.dueDate) ? 'border-l-4 border-l-error' :
                isToday ? 'border-l-4 border-l-primary/50' :
                task.status === 'done' ? 'opacity-70' : 'border-l-4 border-l-outline-variant'
              }`}
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
                  <p className={`font-inter text-xs ${isToday && isOverdue(task.dueDate) ? 'text-error font-semibold' : 'text-on-surface-variant'}`}>
                    {isToday
                      ? (isOverdue(task.dueDate) ? '⚠ Overdue' : 'Due today')
                      : (task.status === 'done' ? 'Completed' : 'Due this day')}
                  </p>
                </div>
                <span className={`material-symbols-outlined text-[18px] ${PRIORITY_COLOR[task.priority]}`}>
                  {PRIORITY_ICON[task.priority]}
                </span>
              </div>
            </div>
          ))}

          {/* Empty state */}
          {sectionEmpty && (
            <div className="bg-surface-container-lowest rounded-xl px-4 py-5 flex items-center gap-4 shadow-card">
              <span className="material-symbols-outlined text-[32px] text-tertiary">
                {isToday ? 'check_circle' : 'event_busy'}
              </span>
              <div>
                <p className="font-inter font-semibold text-sm text-on-surface">
                  {isToday ? 'All clear for today!' : 'No tasks this day'}
                </p>
                <p className="font-inter text-xs text-on-surface-variant">
                  {isToday
                    ? 'No events or deadlines due today'
                    : `Nothing scheduled for ${format(new Date(selectedDate + 'T12:00:00'), 'MMMM d, yyyy')}`}
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Coming Up — today only, when today has no deadlines */}
        {isToday && selectedDayTasks.length === 0 && comingUpTasks.length > 0 && (
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

        {/* Focus — high priority tasks with no deadline (today only) */}
        {isToday && focusTasks.length > 0 && (
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

        {/* Quick Access */}
        <section className="space-y-3 pb-4">
          <h3 className="font-h3 text-h3 text-on-surface">Quick Access</h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => navigate('/finance')}
              className="flex flex-col items-start gap-2 p-4 rounded-2xl bg-tertiary/10 border border-tertiary/15 hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-card text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-tertiary/15 flex items-center justify-center">
                <span className="material-symbols-outlined text-[22px] text-tertiary">payments</span>
              </div>
              <div>
                <p className="font-manrope font-bold text-sm text-on-surface">Finance</p>
                <p className="font-inter text-[10px] text-on-surface-variant">Budget & transactions</p>
              </div>
            </button>
            <button
              onClick={() => navigate('/hobbies')}
              className="flex flex-col items-start gap-2 p-4 rounded-2xl bg-secondary/10 border border-secondary/15 hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-card text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-secondary/15 flex items-center justify-center">
                <span className="material-symbols-outlined text-[22px] text-secondary">local_library</span>
              </div>
              <div>
                <p className="font-manrope font-bold text-sm text-on-surface">Hobbies</p>
                <p className="font-inter text-[10px] text-on-surface-variant">Books, movies & more</p>
              </div>
            </button>
            <button
              onClick={() => navigate('/digest')}
              className="flex flex-col items-start gap-2 p-4 rounded-2xl bg-primary/10 border border-primary/15 hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-card text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                <span className="material-symbols-outlined text-[22px] text-primary">summarize</span>
              </div>
              <div>
                <p className="font-manrope font-bold text-sm text-on-surface">Digest</p>
                <p className="font-inter text-[10px] text-on-surface-variant">Weekly, monthly & yearly</p>
              </div>
            </button>
            <button
              onClick={() => navigate('/yearly')}
              className="flex flex-col items-start gap-2 p-4 rounded-2xl bg-primary/5 border border-primary/10 hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-card text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-[22px] text-primary">calendar_today</span>
              </div>
              <div>
                <p className="font-manrope font-bold text-sm text-on-surface">Yearly Review</p>
                <p className="font-inter text-[10px] text-on-surface-variant">Full year stats</p>
              </div>
            </button>
            <button
              onClick={() => navigate('/goals')}
              className="flex flex-col items-start gap-2 p-4 rounded-2xl bg-secondary/5 border border-secondary/10 hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-card text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-[22px] text-secondary">target</span>
              </div>
              <div>
                <p className="font-manrope font-bold text-sm text-on-surface">Goals & OKRs</p>
                <p className="font-inter text-[10px] text-on-surface-variant">Quarterly objectives</p>
              </div>
            </button>
          </div>
        </section>

      </main>

      {/* New Task modal */}
      <TaskModal
        open={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        defaultStatus="todo"
      />

      {/* Quick Note modal */}
      {showNoteModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setShowNoteModal(false)}>
          <div className="absolute inset-0 bg-scrim/40 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-modal p-5 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-manrope font-bold text-base text-on-surface">New Note</p>
            <input
              ref={quickNoteTitleRef}
              type="text"
              value={quickNoteTitle}
              onChange={(e) => setQuickNoteTitle(e.target.value)}
              placeholder="Title"
              className="w-full bg-surface-container rounded-lg px-3 py-2 font-inter font-semibold text-sm text-on-surface outline-none border border-transparent focus:border-primary/40 placeholder:text-outline/50"
            />
            <textarea
              value={quickNoteContent}
              onChange={(e) => setQuickNoteContent(e.target.value)}
              placeholder="Start writing..."
              rows={4}
              className="w-full bg-surface-container rounded-lg px-3 py-2 font-work-sans text-sm text-on-surface outline-none border border-transparent focus:border-primary/40 placeholder:text-outline/50 resize-none"
            />
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => { setShowNoteModal(false); setQuickNoteTitle(''); setQuickNoteContent(''); }}
                className="px-4 py-2 rounded-lg text-on-surface-variant font-inter font-medium text-sm hover:bg-surface-container transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!quickNoteTitle.trim() && !quickNoteContent.trim()) return;
                  const created = addNote({ title: quickNoteTitle.trim() || 'Untitled', content: quickNoteContent.trim() });
                  setShowNoteModal(false);
                  setQuickNoteTitle('');
                  setQuickNoteContent('');
                  navigate('/notes', { state: { openNoteId: created.id } });
                }}
                disabled={!quickNoteTitle.trim() && !quickNoteContent.trim()}
                className="px-4 py-2 rounded-lg bg-primary text-on-primary font-inter font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
