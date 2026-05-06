import { useState, useEffect } from 'react';
import TopBar from '../components/layout/TopBar';
import HabitModal from '../components/habits/HabitModal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useHabitsStore } from '../store/habitsStore';
import { scheduleHabitReminders } from '../services/habitNotifications';
import { getTodayString, getWeekStart, formatDate } from '../utils/dateUtils';
import type { Habit } from '../types';

const HABIT_BG: Record<string, string> = {
  blue: 'bg-blue-500', green: 'bg-green-500', purple: 'bg-purple-500',
  orange: 'bg-orange-500', pink: 'bg-pink-500', teal: 'bg-teal-500',
};
const HABIT_LIGHT: Record<string, string> = {
  blue: 'bg-blue-50', green: 'bg-green-50', purple: 'bg-purple-50',
  orange: 'bg-orange-50', pink: 'bg-pink-50', teal: 'bg-teal-50',
};
const HABIT_TEXT: Record<string, string> = {
  blue: 'text-blue-600', green: 'text-green-600', purple: 'text-purple-600',
  orange: 'text-orange-600', pink: 'text-pink-600', teal: 'text-teal-600',
};
const HABIT_BORDER: Record<string, string> = {
  blue: '#3b82f6', green: '#22c55e', purple: '#a855f7',
  orange: '#f97316', pink: '#ec4899', teal: '#14b8a6',
};

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
const DAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${DAYS_FULL[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()} ${d.getFullYear()}`;
}

// ── Notes modal ──────────────────────────────────────────────────────────────

interface NotesModalProps {
  habit: Habit;
  date: string;
  existing?: string;
  onSave: (notes: string) => void;
  onClose: () => void;
}

function NotesModal({ habit, date, existing, onSave, onClose }: NotesModalProps) {
  const [text, setText] = useState(existing ?? '');
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
      <div
        className="w-full bg-surface-container-lowest rounded-t-2xl p-5 space-y-4"
        style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl ${HABIT_BG[habit.color]} flex items-center justify-center`}>
            <span className="material-symbols-outlined text-[18px] text-white">{habit.icon}</span>
          </div>
          <div>
            <p className="font-inter font-semibold text-sm text-on-surface">{habit.name}</p>
            <p className="font-inter text-xs text-on-surface-variant">{habit.notesPrompt ?? 'Add a note'}</p>
          </div>
        </div>
        <textarea
          autoFocus
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={habit.notesPrompt ?? 'Write a note…'}
          rows={3}
          className="w-full bg-surface-container rounded-xl px-4 py-3 font-inter text-sm text-on-surface placeholder:text-on-surface-variant outline-none resize-none border border-outline-variant focus:border-primary"
        />
        <p className="font-inter text-xs text-outline text-center">{date}</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-outline-variant font-inter text-sm text-on-surface-variant">
            Skip
          </button>
          <button
            onClick={() => { onSave(text.trim()); onClose(); }}
            className="flex-1 py-3 rounded-xl bg-primary text-on-primary font-inter font-semibold text-sm"
          >
            Done ✓
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Day detail sheet ─────────────────────────────────────────────────────────

interface DayDetailSheetProps {
  habit: Habit;
  date: string;
  notes: string | undefined;
  onClose: () => void;
  onRemove: () => void;
  onEditNotes: () => void;
}

function DayDetailSheet({ habit, date, notes, onClose, onRemove, onEditNotes }: DayDetailSheetProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
      <div
        className="w-full bg-surface-container-lowest rounded-t-2xl p-5 space-y-4"
        style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl ${HABIT_BG[habit.color]} flex items-center justify-center shrink-0`}>
            <span className="material-symbols-outlined text-[20px] text-white icon-fill">{habit.icon}</span>
          </div>
          <div className="flex-1">
            <p className="font-inter font-semibold text-sm text-on-surface">{habit.name}</p>
            <p className="font-inter text-xs text-on-surface-variant">{formatDayLabel(date)}</p>
          </div>
          <button onClick={onClose} className="text-on-surface-variant p-1">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${HABIT_LIGHT[habit.color]}`}>
          <span className="material-symbols-outlined text-[16px] text-green-600 icon-fill">check_circle</span>
          <span className={`font-inter text-sm font-semibold ${HABIT_TEXT[habit.color]}`}>Completed</span>
        </div>

        {notes ? (
          <div className="bg-surface-container rounded-xl px-4 py-3">
            <p className="font-inter text-[10px] text-on-surface-variant uppercase tracking-wide mb-1">Notes</p>
            <p className="font-inter text-sm text-on-surface">{notes}</p>
          </div>
        ) : (
          <p className="font-inter text-sm text-on-surface-variant text-center py-1">No notes recorded</p>
        )}

        <div className="flex gap-3">
          {habit.hasNotes && (
            <button
              onClick={onEditNotes}
              className="flex-1 py-3 rounded-xl border border-outline-variant font-inter text-sm text-on-surface flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">edit_note</span>
              {notes ? 'Edit Note' : 'Add Note'}
            </button>
          )}
          <button
            onClick={onRemove}
            className="flex-1 py-3 rounded-xl bg-error/10 text-error font-inter font-semibold text-sm flex items-center justify-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">remove_circle</span>
            Remove Entry
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Streak badge ─────────────────────────────────────────────────────────────

function StreakBadge({ count, color, unit }: { count: number; color: string; unit: string }) {
  if (count === 0) return null;
  return (
    <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${HABIT_LIGHT[color]}`}>
      <span className="material-symbols-outlined text-[14px] text-orange-500">local_fire_department</span>
      <span className={`font-inter font-bold text-xs ${HABIT_TEXT[color]}`}>{count}</span>
      <span className={`font-inter text-[10px] ${HABIT_TEXT[color]}`}>{unit}</span>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Habits() {
  const store = useHabitsStore();
  const {
    habits, toggleEntry, setEntryNotes, getEntryNotes,
    getLongestStreak, getCompletionRate,
    isCompleted, getStreak, getWeekEntries, getWeekCompletionCount, getMonthCompletionCount,
    addHabit, updateHabit, deleteHabit,
  } = store;


  const [modalOpen, setModalOpen] = useState(false);
  const [editHabit, setEditHabit] = useState<Habit | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [notesTarget, setNotesTarget] = useState<{ habit: Habit; date: string } | null>(null);
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
  const [dayDetail, setDayDetail] = useState<{ habit: Habit; date: string } | null>(null);

  const today = getTodayString();
  const weekStart = getWeekStart();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const active = habits.filter(h => !h.archivedAt);
  const daily = active.filter(h => h.frequency === 'daily' || h.frequency === 'weekdays');
  const weekly = active.filter(h => h.frequency === 'weekly');
  const monthly = active.filter(h => h.frequency === 'monthly');

  const todayDone = daily.filter(h => isCompleted(h.id, today)).length;

  // Schedule streak reminder notifications when habits change
  useEffect(() => {
    scheduleHabitReminders(active, {
      isCompleted,
      getWeekCompletionCount: (id, ws) => getWeekCompletionCount(id, ws),
      getMonthCompletionCount: (id, y, m) => getMonthCompletionCount(id, y, m),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habits.length]);

  function handleCheck(habit: Habit, date: string) {
    const done = isCompleted(habit.id, date);
    if (done) {
      // Tap completed → show detail sheet (prevents accidental removal)
      setDayDetail({ habit, date });
    } else {
      // Tap empty → fast log
      toggleEntry(habit.id, date);
      if (habit.hasNotes) setNotesTarget({ habit, date });
    }
  }

  function handleSave(data: Partial<Habit>) {
    if (editHabit) updateHabit(editHabit.id, data);
    else addHabit(data);
    setEditHabit(null);
  }

  // Daily history: 12 weeks of day-level completion data
  function getDailyHistory(habitId: string) {
    const now = new Date();
    return Array.from({ length: 12 }, (_, wi) => {
      const ws = new Date(weekStart);
      ws.setDate(ws.getDate() - (11 - wi) * 7);
      return {
        weekStart: ws,
        days: Array.from({ length: 7 }, (_, di) => {
          const d = new Date(ws);
          d.setDate(d.getDate() + di);
          const dateStr = formatDate(d);
          return {
            date: dateStr,
            completed: isCompleted(habitId, dateStr),
            notes: getEntryNotes(habitId, dateStr),
            isFuture: d > now,
          };
        }),
      };
    });
  }

  // Weekly history: 12 weeks of week-level completion data
  function getWeeklyHistory(habitId: string, targetDays: number) {
    return Array.from({ length: 12 }, (_, wi) => {
      const ws = new Date(weekStart);
      ws.setDate(ws.getDate() - (11 - wi) * 7);
      const we = new Date(ws);
      we.setDate(we.getDate() + 6);
      const count = getWeekCompletionCount(habitId, ws);
      return { weekStart: ws, weekEnd: we, count, met: count >= targetDays };
    });
  }

  // Monthly history: show last 3 months of entries for a monthly habit
  function getMonthHistory(habitId: string) {
    const history: { label: string; count: number; notes?: string }[] = [];
    for (let i = 0; i < 4; i++) {
      let m = month - i;
      let y = year;
      if (m < 0) { m += 12; y--; }
      const count = getMonthCompletionCount(habitId, y, m);
      // Find notes from any entry in that month
      const prefix = `${y}-${String(m + 1).padStart(2, '0')}`;
      const entry = store.entries.find(e => e.habitId === habitId && e.date.startsWith(prefix) && e.completed);
      history.push({ label: `${MONTHS[m]} ${y}`, count, notes: entry?.notes });
    }
    return history;
  }

  return (
    <div className="bg-background min-h-screen">
      <TopBar title="Habits" />

      <main className="max-w-screen-xl mx-auto px-4 py-4 space-y-5">

        {/* ── Today progress card ─────────────────────────────────────────── */}
        {daily.length > 0 && (
          <div className="bg-surface-container-lowest rounded-xl p-4 shadow-card">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-manrope font-bold text-lg text-on-surface">Today</p>
                <p className="font-inter text-xs text-on-surface-variant">
                  {todayDone}/{daily.length} daily habits completed
                </p>
              </div>
              <div className="relative w-14 h-14">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 48 48">
                  <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="4" className="text-surface-container" />
                  <circle
                    cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="4"
                    className="text-primary"
                    strokeDasharray={2 * Math.PI * 20}
                    strokeDashoffset={2 * Math.PI * 20 * (1 - (daily.length > 0 ? todayDone / daily.length : 0))}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="font-manrope font-bold text-sm text-primary">
                    {daily.length > 0 ? Math.round((todayDone / daily.length) * 100) : 0}%
                  </span>
                </div>
              </div>
            </div>
            {/* Week header row */}
            <div className="grid grid-cols-7 gap-1">
              {DAY_LABELS.map((d, i) => {
                const date = new Date(weekStart);
                date.setDate(date.getDate() + i);
                const isToday = formatDate(date) === today;
                return (
                  <div key={i} className={`text-center py-1 rounded-lg ${isToday ? 'bg-primary/10' : ''}`}>
                    <p className={`font-inter text-[10px] font-semibold ${isToday ? 'text-primary' : 'text-outline'}`}>{d}</p>
                    <p className={`font-inter text-xs font-bold ${isToday ? 'text-primary' : 'text-on-surface-variant'}`}>{date.getDate()}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Daily / Weekday habits ──────────────────────────────────────── */}
        {daily.length > 0 && (
          <section>
            <h2 className="font-inter font-semibold text-xs text-on-surface-variant uppercase tracking-wider mb-2 px-1">Daily</h2>
            <div className="space-y-3">
              {daily.map(habit => {
                const done = isCompleted(habit.id, today);
                const streak = getStreak(habit.id);
                const weekEntries = getWeekEntries(habit.id, weekStart);
                const notes = getEntryNotes(habit.id, today);
                const isExpanded = expandedHistory === habit.id;

                return (
                  <div
                    key={habit.id}
                    className="bg-surface-container-lowest rounded-xl shadow-card border-l-4 group"
                    style={{ borderLeftColor: done ? HABIT_BORDER[habit.color] : '#c3c6d7' }}
                  >
                    <div className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`w-10 h-10 rounded-xl ${done ? HABIT_BG[habit.color] : HABIT_LIGHT[habit.color]} flex items-center justify-center shrink-0 transition-colors`}>
                          <span className={`material-symbols-outlined text-[20px] ${done ? 'text-white icon-fill' : HABIT_TEXT[habit.color]}`}>{habit.icon}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`font-inter font-semibold text-sm ${done ? 'text-on-surface-variant line-through' : 'text-on-surface'}`}>
                            {habit.name}
                          </p>
                          {notes ? (
                            <p className="font-inter text-xs text-primary truncate mt-0.5">📝 {notes}</p>
                          ) : habit.description ? (
                            <p className="font-inter text-xs text-on-surface-variant truncate">{habit.description}</p>
                          ) : null}
                        </div>
                        <StreakBadge count={streak} color={habit.color} unit="d" />
                        <button
                          onClick={() => handleCheck(habit, today)}
                          className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${
                            done ? `${HABIT_BG[habit.color]} border-transparent` : 'border-outline-variant hover:border-primary'
                          }`}
                        >
                          {done && <span className="material-symbols-outlined text-[16px] text-white icon-fill">check</span>}
                        </button>
                      </div>
                      {/* Week grid */}
                      <div className="grid grid-cols-7 gap-1">
                        {weekEntries.map((completed, i) => {
                          const d = new Date(weekStart);
                          d.setDate(d.getDate() + i);
                          const isToday = formatDate(d) === today;
                          const isFuture = d > new Date();
                          return (
                            <button
                              key={i}
                              onClick={() => !isFuture && handleCheck(habit, formatDate(d))}
                              disabled={isFuture}
                              className={`h-8 rounded-md transition-all flex flex-col items-center justify-center gap-0 ${
                                completed ? `${HABIT_BG[habit.color]} opacity-90` :
                                isToday ? 'bg-surface-container ring-1 ring-primary/30' :
                                isFuture ? 'bg-surface-container opacity-30' :
                                'bg-surface-container hover:bg-surface-container-high'
                              }`}
                            >
                              <span className={`font-inter text-[9px] font-bold leading-none ${completed ? 'text-white' : isToday ? 'text-primary' : 'text-on-surface-variant'}`}>
                                {DAY_LABELS[i]}
                              </span>
                              <span className={`font-inter text-[10px] font-semibold leading-none ${completed ? 'text-white' : isToday ? 'text-primary' : 'text-on-surface-variant'}`}>
                                {d.getDate()}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Heatmap toggle */}
                      <button
                        onClick={() => setExpandedHistory(isExpanded ? null : habit.id)}
                        className="mt-3 w-full flex items-center justify-between font-inter text-xs text-on-surface-variant"
                      >
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]">grid_view</span>
                          Streak heatmap
                        </span>
                        <span className="material-symbols-outlined text-[16px]">
                          {isExpanded ? 'expand_less' : 'expand_more'}
                        </span>
                      </button>

                      {isExpanded && (() => {
                        const dailyRows = getDailyHistory(habit.id);
                        const rate = Math.round(getCompletionRate(habit.id, 84) * 100);
                        const longest = getLongestStreak(habit.id);
                        return (
                          <div className="mt-2">
                            {/* Stats row */}
                            <div className="flex gap-3 mb-3">
                              {[
                                { label: 'Current', value: `${getStreak(habit.id)}d` },
                                { label: 'Longest', value: `${longest}d` },
                                { label: '12-wk rate', value: `${rate}%` },
                              ].map((s) => (
                                <div key={s.label} className={`flex-1 text-center py-1.5 rounded-lg ${HABIT_LIGHT[habit.color]}`}>
                                  <p className={`font-inter font-bold text-sm ${HABIT_TEXT[habit.color]}`}>{s.value}</p>
                                  <p className="font-inter text-[9px] text-on-surface-variant uppercase tracking-wide">{s.label}</p>
                                </div>
                              ))}
                            </div>
                            {/* Day-of-week header */}
                            <div className="grid gap-0.5 mb-0.5" style={{ gridTemplateColumns: '22px repeat(7, minmax(0, 1fr))' }}>
                              <div />
                              {DAY_LABELS.map((d, i) => (
                                <div key={i} className="font-inter text-[8px] text-outline text-center">{d}</div>
                              ))}
                            </div>
                            {/* Week rows */}
                            {dailyRows.map((week, wi) => {
                              const prevWeek = dailyRows[wi - 1];
                              const newMonth = !prevWeek || prevWeek.weekStart.getMonth() !== week.weekStart.getMonth();
                              return (
                                <div key={wi}>
                                  {newMonth && (
                                    <p className="font-inter text-[9px] font-semibold text-outline uppercase tracking-wide mt-1.5 mb-0.5" style={{ paddingLeft: '26px' }}>
                                      {MONTHS[week.weekStart.getMonth()]}
                                    </p>
                                  )}
                                  <div className="grid gap-0.5 mb-0.5 items-center" style={{ gridTemplateColumns: '22px repeat(7, minmax(0, 1fr))' }}>
                                    <span className="font-inter text-[8px] text-outline text-right pr-0.5 whitespace-nowrap leading-none">
                                      {week.weekStart.getDate()}
                                    </span>
                                    {week.days.map((day, di) => (
                                      <button
                                        key={di}
                                        onClick={() => day.completed && !day.isFuture && setDayDetail({ habit, date: day.date })}
                                        disabled={!day.completed || day.isFuture}
                                        title={day.notes ? `${day.date}: ${day.notes}` : day.date}
                                        className={`aspect-square w-full rounded-sm transition-opacity ${
                                          day.isFuture ? 'bg-surface-container opacity-20' :
                                          day.completed ? `${HABIT_BG[habit.color]} opacity-90 hover:opacity-100` :
                                          'bg-surface-container-high opacity-60'
                                        }`}
                                      >
                                        {day.completed && day.notes && (
                                          <span className="block w-1 h-1 rounded-full bg-amber-300 mx-auto" />
                                        )}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                            {/* Legend */}
                            <div className="flex items-center gap-1 mt-2 justify-end">
                              <span className="font-inter text-[9px] text-outline">Less</span>
                              <div className="bg-surface-container-high opacity-60 w-3 h-3 rounded-sm" />
                              <div className={`${HABIT_BG[habit.color]} opacity-50 w-3 h-3 rounded-sm`} />
                              <div className={`${HABIT_BG[habit.color]} opacity-90 w-3 h-3 rounded-sm`} />
                              <span className="font-inter text-[9px] text-outline">More</span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                    {/* Actions */}
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-3 px-4 pb-3">
                      {done && habit.hasNotes && (
                        <button onClick={() => setNotesTarget({ habit, date: today })} className="font-inter text-xs text-primary flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">edit_note</span>
                          {notes ? 'Edit note' : 'Add note'}
                        </button>
                      )}
                      <button onClick={() => { setEditHabit(habit); setModalOpen(true); }} className="font-inter text-xs text-on-surface-variant flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">edit</span>Edit
                      </button>
                      <button onClick={() => setDeleteId(habit.id)} className="font-inter text-xs text-on-surface-variant flex items-center gap-1 ml-auto">
                        <span className="material-symbols-outlined text-[14px]">delete</span>Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Weekly habits ───────────────────────────────────────────────── */}
        {weekly.length > 0 && (
          <section>
            <h2 className="font-inter font-semibold text-xs text-on-surface-variant uppercase tracking-wider mb-2 px-1">This Week</h2>
            <div className="space-y-3">
              {weekly.map(habit => {
                const weekDone = getWeekCompletionCount(habit.id, weekStart);
                const metTarget = weekDone >= habit.targetDays;
                const streak = getStreak(habit.id);
                const weekEntries = getWeekEntries(habit.id, weekStart);
                const isExpanded = expandedHistory === habit.id;

                return (
                  <div
                    key={habit.id}
                    className="bg-surface-container-lowest rounded-xl shadow-card border-l-4 group"
                    style={{ borderLeftColor: metTarget ? HABIT_BORDER[habit.color] : '#c3c6d7' }}
                  >
                    <div className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`w-10 h-10 rounded-xl ${metTarget ? HABIT_BG[habit.color] : HABIT_LIGHT[habit.color]} flex items-center justify-center shrink-0`}>
                          <span className={`material-symbols-outlined text-[20px] ${metTarget ? 'text-white icon-fill' : HABIT_TEXT[habit.color]}`}>{habit.icon}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-inter font-semibold text-sm text-on-surface">{habit.name}</p>
                          <p className={`font-inter text-xs font-medium ${metTarget ? HABIT_TEXT[habit.color] : 'text-on-surface-variant'}`}>
                            {weekDone}/{habit.targetDays} this week
                            {metTarget && ' ✓'}
                          </p>
                        </div>
                        <StreakBadge count={streak} color={habit.color} unit="wk" />
                        <button
                          onClick={() => handleCheck(habit, today)}
                          className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${
                            isCompleted(habit.id, today)
                              ? `${HABIT_BG[habit.color]} border-transparent`
                              : 'border-outline-variant hover:border-primary'
                          }`}
                        >
                          {isCompleted(habit.id, today) && <span className="material-symbols-outlined text-[16px] text-white icon-fill">check</span>}
                        </button>
                      </div>

                      {/* Week dots */}
                      <div className="grid grid-cols-7 gap-1">
                        {weekEntries.map((completed, i) => {
                          const d = new Date(weekStart);
                          d.setDate(d.getDate() + i);
                          const isToday = formatDate(d) === today;
                          const isFuture = d > new Date();
                          const notes = getEntryNotes(habit.id, formatDate(d));
                          return (
                            <button
                              key={i}
                              onClick={() => !isFuture && handleCheck(habit, formatDate(d))}
                              disabled={isFuture}
                              title={notes ?? DAY_LABELS[i]}
                              className={`h-8 rounded-md transition-all flex flex-col items-center justify-center gap-0 relative ${
                                completed ? `${HABIT_BG[habit.color]} opacity-90` :
                                isToday ? 'bg-surface-container ring-1 ring-primary/30' :
                                isFuture ? 'bg-surface-container opacity-30' :
                                'bg-surface-container hover:bg-surface-container-high'
                              }`}
                            >
                              <span className={`font-inter text-[9px] font-bold leading-none ${completed ? 'text-white' : isToday ? 'text-primary' : 'text-on-surface-variant'}`}>
                                {DAY_LABELS[i]}
                              </span>
                              <span className={`font-inter text-[10px] font-semibold leading-none ${completed ? 'text-white' : isToday ? 'text-primary' : 'text-on-surface-variant'}`}>
                                {d.getDate()}
                              </span>
                              {completed && notes && (
                                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400" />
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Progress bar */}
                      <div className="mt-3 h-1.5 bg-surface-container rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${HABIT_BG[habit.color]}`}
                          style={{ width: `${Math.min(100, (weekDone / habit.targetDays) * 100)}%` }}
                        />
                      </div>

                      {/* History toggle */}
                      <button
                        onClick={() => setExpandedHistory(isExpanded ? null : habit.id)}
                        className="mt-3 w-full flex items-center justify-between font-inter text-xs text-on-surface-variant"
                      >
                        <span>History (12 weeks)</span>
                        <span className="material-symbols-outlined text-[16px]">
                          {isExpanded ? 'expand_less' : 'expand_more'}
                        </span>
                      </button>

                      {isExpanded && (
                        <div className="mt-2 space-y-1.5">
                          {getWeeklyHistory(habit.id, habit.targetDays).map((week, wi) => {
                            const sm = week.weekStart.getMonth();
                            const em = week.weekEnd.getMonth();
                            const sy = week.weekStart.getFullYear();
                            const ey = week.weekEnd.getFullYear();
                            const yearSuffix = sy !== new Date().getFullYear() ? ` '${String(sy).slice(2)}` : '';
                            const label = sm === em
                              ? `${MONTHS[sm]} ${week.weekStart.getDate()}–${week.weekEnd.getDate()}${yearSuffix}`
                              : sy === ey
                                ? `${MONTHS[sm]} ${week.weekStart.getDate()} – ${MONTHS[em]} ${week.weekEnd.getDate()}${yearSuffix}`
                                : `${MONTHS[sm]} ${week.weekStart.getDate()} '${String(sy).slice(2)} – ${MONTHS[em]} ${week.weekEnd.getDate()} '${String(ey).slice(2)}`;
                            return (
                              <div key={wi} className="flex items-center gap-3 px-2 py-1.5 bg-surface-container rounded-lg">
                                <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${week.met ? HABIT_BG[habit.color] : 'bg-outline-variant'}`}>
                                  {week.met && <span className="material-symbols-outlined text-[12px] text-white">check</span>}
                                </span>
                                <span className="font-inter text-xs text-on-surface font-medium flex-1">{label}</span>
                                <span className={`font-inter text-xs font-semibold ${week.met ? HABIT_TEXT[habit.color] : 'text-outline'}`}>
                                  {week.count}/{habit.targetDays}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-3 px-4 pb-3">
                      <button onClick={() => { setEditHabit(habit); setModalOpen(true); }} className="font-inter text-xs text-on-surface-variant flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">edit</span>Edit
                      </button>
                      <button onClick={() => setDeleteId(habit.id)} className="font-inter text-xs text-on-surface-variant flex items-center gap-1 ml-auto">
                        <span className="material-symbols-outlined text-[14px]">delete</span>Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Monthly habits ──────────────────────────────────────────────── */}
        {monthly.length > 0 && (
          <section>
            <h2 className="font-inter font-semibold text-xs text-on-surface-variant uppercase tracking-wider mb-2 px-1">
              This Month — {MONTHS[month]} {year}
            </h2>
            <div className="space-y-3">
              {monthly.map(habit => {
                const monthDone = getMonthCompletionCount(habit.id, year, month);
                const completed = monthDone >= habit.targetDays;
                const streak = getStreak(habit.id);
                const history = getMonthHistory(habit.id);
                const todayNotes = getEntryNotes(habit.id, today);
                const isExpanded = expandedHistory === habit.id;

                return (
                  <div
                    key={habit.id}
                    className="bg-surface-container-lowest rounded-xl shadow-card border-l-4 group"
                    style={{ borderLeftColor: completed ? HABIT_BORDER[habit.color] : '#c3c6d7' }}
                  >
                    <div className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-xl ${completed ? HABIT_BG[habit.color] : HABIT_LIGHT[habit.color]} flex items-center justify-center shrink-0`}>
                          <span className={`material-symbols-outlined text-[24px] ${completed ? 'text-white icon-fill' : HABIT_TEXT[habit.color]}`}>{habit.icon}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-inter font-semibold text-sm text-on-surface">{habit.name}</p>
                          {completed ? (
                            <p className={`font-inter text-xs font-medium ${HABIT_TEXT[habit.color]}`}>
                              ✓ Done this month{todayNotes ? ` — ${todayNotes}` : ''}
                            </p>
                          ) : (
                            <p className="font-inter text-xs text-on-surface-variant">{habit.description}</p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <StreakBadge count={streak} color={habit.color} unit="mo" />
                          <button
                            onClick={() => handleCheck(habit, today)}
                            className={`w-9 h-9 rounded-full border-2 flex items-center justify-center transition-all ${
                              completed
                                ? `${HABIT_BG[habit.color]} border-transparent`
                                : 'border-outline-variant hover:border-primary'
                            }`}
                          >
                            {completed
                              ? <span className="material-symbols-outlined text-[18px] text-white icon-fill">check</span>
                              : <span className={`material-symbols-outlined text-[18px] ${HABIT_TEXT[habit.color]}`}>add</span>
                            }
                          </button>
                        </div>
                      </div>

                      {/* History toggle */}
                      <button
                        onClick={() => setExpandedHistory(isExpanded ? null : habit.id)}
                        className="mt-3 w-full flex items-center justify-between font-inter text-xs text-on-surface-variant"
                      >
                        <span>History</span>
                        <span className="material-symbols-outlined text-[16px]">
                          {isExpanded ? 'expand_less' : 'expand_more'}
                        </span>
                      </button>

                      {isExpanded && (
                        <div className="mt-2 space-y-1.5">
                          {history.map((h, i) => (
                            <div key={i} className="flex items-center gap-3 px-2 py-1.5 bg-surface-container rounded-lg">
                              <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${h.count >= habit.targetDays ? HABIT_BG[habit.color] : 'bg-outline-variant'}`}>
                                {h.count >= habit.targetDays && <span className="material-symbols-outlined text-[12px] text-white">check</span>}
                              </span>
                              <span className="font-inter text-xs text-on-surface font-medium w-16">{h.label}</span>
                              {h.notes && <span className="font-inter text-xs text-on-surface-variant truncate flex-1">📝 {h.notes}</span>}
                              {!h.notes && h.count === 0 && <span className="font-inter text-xs text-outline">Not done</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-3 px-4 pb-3">
                      {completed && habit.hasNotes && (
                        <button onClick={() => setNotesTarget({ habit, date: today })} className="font-inter text-xs text-primary flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">edit_note</span>
                          {todayNotes ? 'Edit note' : 'Add note'}
                        </button>
                      )}
                      <button onClick={() => { setEditHabit(habit); setModalOpen(true); }} className="font-inter text-xs text-on-surface-variant flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">edit</span>Edit
                      </button>
                      <button onClick={() => setDeleteId(habit.id)} className="font-inter text-xs text-on-surface-variant flex items-center gap-1 ml-auto">
                        <span className="material-symbols-outlined text-[14px]">delete</span>Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Empty state */}
        {active.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <span className="material-symbols-outlined text-[48px] text-outline mb-3">track_changes</span>
            <p className="font-manrope font-semibold text-on-surface mb-1">No habits yet</p>
            <p className="font-work-sans text-sm text-on-surface-variant">Build streaks that stick</p>
          </div>
        )}
      </main>

      {/* FAB */}
      <button
        onClick={() => { setEditHabit(null); setModalOpen(true); }}
        className="fixed right-4 bg-primary text-on-primary rounded-full w-14 h-14 flex items-center justify-center shadow-fab z-40"
        style={{ bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))' }}
      >
        <span className="material-symbols-outlined text-[28px]">add</span>
      </button>

      <HabitModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditHabit(null); }}
        onSave={handleSave}
        habit={editHabit}
      />

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteHabit(deleteId)}
        title="Delete Habit"
        message="This habit and all its history will be permanently deleted."
        confirmLabel="Delete"
        danger
      />

      {/* Notes modal */}
      {notesTarget && (
        <NotesModal
          habit={notesTarget.habit}
          date={notesTarget.date}
          existing={getEntryNotes(notesTarget.habit.id, notesTarget.date)}
          onSave={(notes) => setEntryNotes(notesTarget.habit.id, notesTarget.date, notes)}
          onClose={() => setNotesTarget(null)}
        />
      )}

      {/* Day detail sheet */}
      {dayDetail && (
        <DayDetailSheet
          habit={dayDetail.habit}
          date={dayDetail.date}
          notes={getEntryNotes(dayDetail.habit.id, dayDetail.date)}
          onClose={() => setDayDetail(null)}
          onRemove={() => {
            toggleEntry(dayDetail.habit.id, dayDetail.date);
            setDayDetail(null);
          }}
          onEditNotes={() => {
            setNotesTarget({ habit: dayDetail.habit, date: dayDetail.date });
            setDayDetail(null);
          }}
        />
      )}
    </div>
  );
}
