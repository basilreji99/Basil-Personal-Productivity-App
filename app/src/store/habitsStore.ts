import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Habit, HabitEntry, HabitColor, HabitFrequency } from '../types';
import { nanoid } from '../utils/nanoid';
import { formatDate, getWeekStart } from '../utils/dateUtils';

const NOW = new Date().toISOString();

const DEFAULT_HABITS: Habit[] = [
  // ── Daily ──────────────────────────────────────────────────────────────────
  {
    id: 'h-meditate',
    name: 'Meditate',
    description: 'Daily mindfulness session',
    frequency: 'daily',
    color: 'teal',
    icon: 'self_improvement',
    targetDays: 7,
    hasNotes: false,
    createdAt: NOW,
    archivedAt: null,
  },
  {
    id: 'h-journal',
    name: 'Journal',
    description: 'Write in your journal',
    frequency: 'daily',
    color: 'purple',
    icon: 'edit_note',
    targetDays: 7,
    hasNotes: true,
    notesPrompt: "What's on your mind today?",
    createdAt: NOW,
    archivedAt: null,
  },
  // ── Weekly ─────────────────────────────────────────────────────────────────
  {
    id: 'h-gym',
    name: 'Gym Workout',
    description: '3–5 times per week',
    frequency: 'weekly',
    color: 'blue',
    icon: 'fitness_center',
    targetDays: 3,
    hasNotes: true,
    notesPrompt: 'Which workout? (e.g. Chest, Legs, Pull)',
    createdAt: NOW,
    archivedAt: null,
  },
  {
    id: 'h-vocal',
    name: 'Vocal Training',
    description: '2–3 times per week',
    frequency: 'weekly',
    color: 'orange',
    icon: 'mic',
    targetDays: 2,
    hasNotes: false,
    createdAt: NOW,
    archivedAt: null,
  },
  {
    id: 'h-sport',
    name: 'Play a Sport',
    description: 'Any sport, any day',
    frequency: 'weekly',
    color: 'green',
    icon: 'sports_soccer',
    targetDays: 1,
    hasNotes: true,
    notesPrompt: 'Which sport did you play?',
    createdAt: NOW,
    archivedAt: null,
  },
  // ── Monthly ────────────────────────────────────────────────────────────────
  {
    id: 'h-book',
    name: 'Read a Book',
    description: 'Finish one book this month',
    frequency: 'monthly',
    color: 'purple',
    icon: 'menu_book',
    targetDays: 1,
    hasNotes: true,
    notesPrompt: 'Which book did you finish?',
    createdAt: NOW,
    archivedAt: null,
  },
  {
    id: 'h-silence',
    name: 'Silence Day',
    description: 'A day of nothing — offline, no plans',
    frequency: 'monthly',
    color: 'teal',
    icon: 'do_not_disturb',
    targetDays: 1,
    hasNotes: false,
    createdAt: NOW,
    archivedAt: null,
  },
  {
    id: 'h-treat',
    name: 'Buy Yourself Something Nice',
    description: 'Monthly self-treat',
    frequency: 'monthly',
    color: 'pink',
    icon: 'shopping_bag',
    targetDays: 1,
    hasNotes: true,
    notesPrompt: 'What did you get?',
    createdAt: NOW,
    archivedAt: null,
  },
  {
    id: 'h-photoshoot',
    name: 'Self Photoshoot',
    description: 'Monthly photos of yourself',
    frequency: 'monthly',
    color: 'orange',
    icon: 'camera_alt',
    targetDays: 1,
    hasNotes: false,
    createdAt: NOW,
    archivedAt: null,
  },
];

interface HabitsState {
  habits: Habit[];
  entries: HabitEntry[];

  addHabit: (partial: Partial<Omit<Habit, 'id' | 'createdAt' | 'archivedAt'>>) => void;
  updateHabit: (id: string, updates: Partial<Habit>) => void;
  deleteHabit: (id: string) => void;
  archiveHabit: (id: string) => void;

  toggleEntry: (habitId: string, date: string, notes?: string) => void;
  setEntryNotes: (habitId: string, date: string, notes: string) => void;
  getEntryNotes: (habitId: string, date: string) => string | undefined;
  isCompleted: (habitId: string, date: string) => boolean;

  // Streak — returns days for daily, weeks for weekly, months for monthly
  getStreak: (habitId: string) => number;
  getLongestStreak: (habitId: string) => number;
  getCompletionRate: (habitId: string, days?: number) => number;
  getEntriesForDate: (date: string) => HabitEntry[];
  getWeekEntries: (habitId: string, weekStart: Date) => boolean[];
  getWeekCompletionCount: (habitId: string, weekStart: Date) => number;
  getMonthCompletionCount: (habitId: string, year: number, month: number) => number;
}

export const useHabitsStore = create<HabitsState>()(
  persist(
    (set, get) => ({
      habits: DEFAULT_HABITS,
      entries: [],

      addHabit: (partial) => {
        const habit: Habit = {
          id: nanoid(),
          name: partial.name ?? 'New Habit',
          description: partial.description ?? '',
          frequency: (partial.frequency as HabitFrequency) ?? 'daily',
          color: (partial.color as HabitColor) ?? 'blue',
          icon: partial.icon ?? 'check_circle',
          targetDays: partial.targetDays ?? 7,
          hasNotes: partial.hasNotes ?? false,
          notesPrompt: partial.notesPrompt,
          createdAt: new Date().toISOString(),
          archivedAt: null,
        };
        set((s) => ({ habits: [...s.habits, habit] }));
      },

      updateHabit: (id, updates) =>
        set((s) => ({
          habits: s.habits.map((h) => (h.id === id ? { ...h, ...updates } : h)),
        })),

      deleteHabit: (id) =>
        set((s) => ({
          habits: s.habits.filter((h) => h.id !== id),
          entries: s.entries.filter((e) => e.habitId !== id),
        })),

      archiveHabit: (id) =>
        set((s) => ({
          habits: s.habits.map((h) =>
            h.id === id ? { ...h, archivedAt: new Date().toISOString() } : h,
          ),
        })),

      toggleEntry: (habitId, date, notes) =>
        set((s) => {
          const existing = s.entries.find(e => e.habitId === habitId && e.date === date);
          if (existing) {
            return {
              entries: s.entries.map((e) =>
                e.habitId === habitId && e.date === date
                  ? { ...e, completed: !e.completed, notes: notes ?? e.notes }
                  : e,
              ),
            };
          }
          return {
            entries: [...s.entries, { habitId, date, completed: true, notes }],
          };
        }),

      setEntryNotes: (habitId, date, notes) =>
        set((s) => ({
          entries: s.entries.map((e) =>
            e.habitId === habitId && e.date === date ? { ...e, notes } : e,
          ),
        })),

      getEntryNotes: (habitId, date) =>
        get().entries.find(e => e.habitId === habitId && e.date === date)?.notes,

      isCompleted: (habitId, date) => {
        const entry = get().entries.find(e => e.habitId === habitId && e.date === date);
        return entry?.completed ?? false;
      },

      getWeekEntries: (habitId, weekStart) => {
        return Array.from({ length: 7 }, (_, i) => {
          const d = new Date(weekStart);
          d.setDate(d.getDate() + i);
          return get().isCompleted(habitId, formatDate(d));
        });
      },

      getWeekCompletionCount: (habitId, weekStart) => {
        let count = 0;
        for (let i = 0; i < 7; i++) {
          const d = new Date(weekStart);
          d.setDate(d.getDate() + i);
          if (d > new Date()) break;
          if (get().isCompleted(habitId, formatDate(d))) count++;
        }
        return count;
      },

      getMonthCompletionCount: (habitId, year, month) => {
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        let count = 0;
        for (let d = 1; d <= daysInMonth; d++) {
          const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          if (get().isCompleted(habitId, date)) count++;
        }
        return count;
      },

      getStreak: (habitId) => {
        const habit = get().habits.find(h => h.id === habitId);
        if (!habit) return 0;

        if (habit.frequency === 'weekly') {
          // Count consecutive weeks (going back) where completions >= targetDays
          let streak = 0;
          const today = new Date();
          let weekStart = getWeekStart(today);

          for (let w = 0; w < 52; w++) {
            const count = get().getWeekCompletionCount(habitId, weekStart);
            if (count >= habit.targetDays) {
              streak++;
            } else if (w === 0) {
              // Current week not yet complete — don't count, just move back
            } else {
              break;
            }
            weekStart = new Date(weekStart);
            weekStart.setDate(weekStart.getDate() - 7);
          }
          return streak;
        }

        if (habit.frequency === 'monthly') {
          // Count consecutive months (going back) where completions >= targetDays
          let streak = 0;
          const today = new Date();
          let year = today.getFullYear();
          let month = today.getMonth();

          for (let m = 0; m < 24; m++) {
            const count = get().getMonthCompletionCount(habitId, year, month);
            if (count >= habit.targetDays) {
              streak++;
            } else if (m === 0) {
              // Current month not yet complete
            } else {
              break;
            }
            month--;
            if (month < 0) { month = 11; year--; }
          }
          return streak;
        }

        // Daily / weekdays streak — count consecutive days going back from today
        let streak = 0;
        const cursor = new Date();
        for (let i = 0; i < 365; i++) {
          const dateStr = formatDate(cursor);
          if (!get().isCompleted(habitId, dateStr)) break;
          streak++;
          cursor.setDate(cursor.getDate() - 1);
        }
        return streak;
      },

      getLongestStreak: (habitId) => {
        const entries = get()
          .entries.filter((e) => e.habitId === habitId && e.completed)
          .map((e) => e.date)
          .sort();
        if (entries.length === 0) return 0;
        let longest = 1;
        let current = 1;
        for (let i = 1; i < entries.length; i++) {
          const prev = new Date(entries[i - 1]);
          const curr = new Date(entries[i]);
          const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
          if (diff === 1) { current++; longest = Math.max(longest, current); }
          else { current = 1; }
        }
        return longest;
      },

      getCompletionRate: (habitId, days = 30) => {
        const cursor = new Date();
        let completed = 0;
        for (let i = 0; i < days; i++) {
          if (get().isCompleted(habitId, formatDate(cursor))) completed++;
          cursor.setDate(cursor.getDate() - 1);
        }
        return Math.round((completed / days) * 100);
      },

      getEntriesForDate: (date) =>
        get().entries.filter((e) => e.date === date),
    }),
    {
      name: 'productivity-habits',
      version: 5,
      migrate: (persisted: unknown, version: number) => {
        const s = persisted as { habits?: Habit[]; entries?: HabitEntry[] };
        let habits  = s?.habits  ?? DEFAULT_HABITS;
        let entries = s?.entries ?? [];

        if (version < 2) {
          habits = DEFAULT_HABITS;
        }

        if (version < 3) {
          // Seed historical gym entries (h-gym habit) — fresh install only
          const gymDates = [
            '2026-02-27','2026-03-01','2026-03-09','2026-03-12','2026-03-16',
            '2026-03-19','2026-03-23','2026-03-25','2026-03-27','2026-03-30',
            '2026-04-01','2026-04-03','2026-04-06','2026-04-08','2026-04-10',
            '2026-04-15','2026-04-16',
          ];
          const gymNotes: Record<string, string> = {
            '2026-02-27': 'Push, Chest & Triceps', '2026-03-01': 'Back & Biceps',
            '2026-03-09': 'Push, Chest & Triceps', '2026-03-12': 'Back & Biceps',
            '2026-03-16': 'Push, Chest & Triceps', '2026-03-19': 'Back & Biceps',
            '2026-03-23': 'Push, Chest & Triceps', '2026-03-25': 'Back & Biceps',
            '2026-03-27': 'Legs & Core',           '2026-03-30': 'Push, Chest & Triceps',
            '2026-04-01': 'Back & Biceps',          '2026-04-03': 'Legs & Core',
            '2026-04-06': 'Push, Chest & Triceps',  '2026-04-08': 'Back & Biceps',
            '2026-04-10': 'Legs & Core',            '2026-04-15': 'Push, Chest & Triceps',
            '2026-04-16': 'Legs & Core',
          };
          for (const date of gymDates) {
            if (!entries.some(e => e.habitId === 'h-gym' && e.date === date)) {
              entries = [...entries, { habitId: 'h-gym', date, completed: true, notes: gymNotes[date] }];
            }
          }

          // Seed historical sport entries (h-sport habit)
          const sportEntries: { date: string; notes: string }[] = [
            { date: '2026-01-11', notes: 'Cricket' },
            { date: '2026-03-13', notes: 'Swimming' },
            { date: '2026-03-14', notes: 'Cricket' },
            { date: '2026-03-16', notes: 'Swimming' },
            { date: '2026-03-17', notes: 'Swimming' },
            { date: '2026-03-18', notes: 'Swimming' },
            { date: '2026-03-19', notes: 'Swimming' },
            { date: '2026-03-21', notes: 'Cricket' },
            { date: '2026-03-29', notes: 'Cricket' },
            { date: '2026-03-31', notes: 'Swimming & Basketball' },
            { date: '2026-04-03', notes: 'Swimming' },
            { date: '2026-04-09', notes: 'Swimming' },
            { date: '2026-04-11', notes: 'Cricket' },
            { date: '2026-04-16', notes: 'Swimming' },
            { date: '2026-05-05', notes: 'Swimming' },
            { date: '2026-05-06', notes: 'Swimming' },
          ];
          for (const { date, notes } of sportEntries) {
            if (!entries.some(e => e.habitId === 'h-sport' && e.date === date)) {
              entries = [...entries, { habitId: 'h-sport', date, completed: true, notes }];
            }
          }
        }

        if (version < 4) {
          // Replace gym and sport habit history with corrected dataset
          entries = entries.filter(e => e.habitId !== 'h-gym' && e.habitId !== 'h-sport');

          const gymDates = [
            '2026-02-27','2026-03-01','2026-03-09','2026-03-12','2026-03-16',
            '2026-03-19','2026-03-23','2026-03-25','2026-03-27','2026-03-30',
            '2026-04-01','2026-04-03','2026-04-06','2026-04-08','2026-04-10',
            '2026-04-15','2026-04-16',
          ];
          const gymNotes: Record<string, string> = {
            '2026-02-27': 'Push, Chest & Triceps', '2026-03-01': 'Back & Biceps',
            '2026-03-09': 'Push, Chest & Triceps', '2026-03-12': 'Back & Biceps',
            '2026-03-16': 'Push, Chest & Triceps', '2026-03-19': 'Back & Biceps',
            '2026-03-23': 'Push, Chest & Triceps', '2026-03-25': 'Back & Biceps',
            '2026-03-27': 'Legs & Core',           '2026-03-30': 'Push, Chest & Triceps',
            '2026-04-01': 'Back & Biceps',          '2026-04-03': 'Legs & Core',
            '2026-04-06': 'Push, Chest & Triceps',  '2026-04-08': 'Back & Biceps',
            '2026-04-10': 'Legs & Core',            '2026-04-15': 'Push, Chest & Triceps',
            '2026-04-16': 'Legs & Core',
          };
          for (const date of gymDates) {
            entries = [...entries, { habitId: 'h-gym', date, completed: true, notes: gymNotes[date] }];
          }

          const sportEntries: { date: string; notes: string }[] = [
            { date: '2026-01-11', notes: 'Cricket' },
            { date: '2026-03-13', notes: 'Swimming' },
            { date: '2026-03-14', notes: 'Cricket' },
            { date: '2026-03-16', notes: 'Swimming' },
            { date: '2026-03-17', notes: 'Swimming' },
            { date: '2026-03-18', notes: 'Swimming' },
            { date: '2026-03-19', notes: 'Swimming' },
            { date: '2026-03-21', notes: 'Cricket' },
            { date: '2026-03-29', notes: 'Cricket' },
            { date: '2026-03-31', notes: 'Swimming & Basketball' },
            { date: '2026-04-03', notes: 'Swimming' },
            { date: '2026-04-09', notes: 'Swimming' },
            { date: '2026-04-11', notes: 'Cricket' },
            { date: '2026-04-16', notes: 'Swimming' },
            { date: '2026-05-05', notes: 'Swimming' },
            { date: '2026-05-06', notes: 'Swimming' },
          ];
          for (const { date, notes } of sportEntries) {
            entries = [...entries, { habitId: 'h-sport', date, completed: true, notes }];
          }
        }

        if (version < 5) {
          // Restore h-treat if user accidentally deleted it
          if (!habits.some(h => h.id === 'h-treat')) {
            habits = [...habits, {
              id: 'h-treat',
              name: 'Buy Yourself Something Nice',
              description: 'Monthly self-treat',
              frequency: 'monthly' as HabitFrequency,
              color: 'pink' as HabitColor,
              icon: 'shopping_bag',
              targetDays: 1,
              hasNotes: true,
              notesPrompt: 'What did you get?',
              createdAt: new Date().toISOString(),
              archivedAt: null,
            }];
          }
        }

        return { habits, entries };
      },
    },
  ),
);
