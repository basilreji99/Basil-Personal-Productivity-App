import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TimerMode, TimerSession } from '../types';
import { nanoid } from '../utils/nanoid';

const DURATIONS: Record<TimerMode, number> = {
  work: 25 * 60,
  short_break: 5 * 60,
  long_break: 15 * 60,
};

interface TimerState {
  mode: TimerMode;
  timeLeft: number;
  isRunning: boolean;
  currentTaskId: string | null;
  currentTaskTitle: string | null;
  pomodoroCount: number;
  sessions: TimerSession[];
  customDurations: Record<TimerMode, number>;
  focusTaskId: string | null;

  setMode: (mode: TimerMode) => void;
  start: () => void;
  pause: () => void;
  reset: () => void;
  tick: () => void;
  setTask: (taskId: string | null, taskTitle: string | null) => void;
  setCustomDuration: (mode: TimerMode, seconds: number) => void;
  recordSession: () => void;
  openFocus: (taskId: string, taskTitle: string) => void;
  closeFocus: () => void;
}

export const useTimerStore = create<TimerState>()(
  persist(
    (set, get) => ({
      mode: 'work',
      timeLeft: DURATIONS.work,
      isRunning: false,
      currentTaskId: null,
      currentTaskTitle: null,
      pomodoroCount: 0,
      sessions: [],
      customDurations: { ...DURATIONS },
      focusTaskId: null,

      setMode: (mode) =>
        set({ mode, timeLeft: get().customDurations[mode], isRunning: false }),

      start: () => set({ isRunning: true }),
      pause: () => set({ isRunning: false }),

      reset: () =>
        set((s) => ({
          timeLeft: s.customDurations[s.mode],
          isRunning: false,
        })),

      tick: () => {
        const { timeLeft, mode, pomodoroCount } = get();
        if (timeLeft <= 0) {
          get().recordSession();
          const newCount = mode === 'work' ? pomodoroCount + 1 : pomodoroCount;
          const nextMode: TimerMode =
            mode === 'work'
              ? newCount % 4 === 0
                ? 'long_break'
                : 'short_break'
              : 'work';
          set({
            isRunning: false,
            pomodoroCount: newCount,
            mode: nextMode,
            timeLeft: get().customDurations[nextMode],
          });
          return;
        }
        set({ timeLeft: timeLeft - 1 });
      },

      setTask: (taskId, taskTitle) =>
        set({ currentTaskId: taskId, currentTaskTitle: taskTitle }),

      openFocus: (taskId, taskTitle) =>
        set({ focusTaskId: taskId, currentTaskId: taskId, currentTaskTitle: taskTitle }),

      closeFocus: () => set({ focusTaskId: null }),

      setCustomDuration: (mode, seconds) =>
        set((s) => ({
          customDurations: { ...s.customDurations, [mode]: seconds },
          timeLeft: s.mode === mode ? seconds : s.timeLeft,
        })),

      recordSession: () => {
        const { mode, currentTaskId, currentTaskTitle, customDurations } = get();
        const session: TimerSession = {
          id: nanoid(),
          taskId: currentTaskId,
          taskTitle: currentTaskTitle,
          mode,
          duration: customDurations[mode],
          completedAt: new Date().toISOString(),
        };
        set((s) => ({ sessions: [...s.sessions, session].slice(-100) }));
      },
    }),
    {
      name: 'productivity-timer',
      partialize: (s) => ({
        customDurations: s.customDurations,
        sessions: s.sessions,
        pomodoroCount: s.pomodoroCount,
      }),
    },
  ),
);
