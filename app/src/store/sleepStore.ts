import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import type { SleepSession, SleepStage } from '../types';

interface SleepState {
  sessions: SleepSession[];
  lastSyncAt: string | null;

  addManualSession: (session: Omit<SleepSession, 'id' | 'source'>) => void;
  importHCSessions: (sessions: Omit<SleepSession, 'source'>[]) => void;
  deleteSession: (id: string) => void;
  setLastSyncAt: (iso: string) => void;

  // Derived helpers
  getRecentSessions: (n?: number) => SleepSession[];
  getAverageDuration: (days?: number) => number;
  getStageMinutes: (session: SleepSession) => {
    light: number; deep: number; rem: number; awake: number;
  };
}

export const useSleepStore = create<SleepState>()(
  persist(
    (set, get) => ({
      sessions: [],
      lastSyncAt: null,

      addManualSession: (session) =>
        set((s) => ({
          sessions: [
            { id: nanoid(), ...session, source: 'manual' },
            ...s.sessions,
          ],
        })),

      importHCSessions: (incoming) =>
        set((s) => {
          const existingIds = new Set(s.sessions.map((x) => x.id));
          const fresh = incoming
            .filter((x) => !existingIds.has(x.id))
            .map((x) => ({ ...x, source: 'health_connect' as const }));
          return { sessions: [...fresh, ...s.sessions] };
        }),

      deleteSession: (id) =>
        set((s) => ({ sessions: s.sessions.filter((x) => x.id !== id) })),

      setLastSyncAt: (iso) => set({ lastSyncAt: iso }),

      getRecentSessions: (n = 30) => {
        const sorted = [...get().sessions].sort(
          (a, b) => new Date(b.start).getTime() - new Date(a.start).getTime()
        );
        return sorted.slice(0, n);
      },

      getAverageDuration: (days = 14) => {
        const cutoff = Date.now() - days * 86400_000;
        const recent = get().sessions.filter(
          (s) => new Date(s.start).getTime() > cutoff
        );
        if (recent.length === 0) return 0;
        const total = recent.reduce((acc, s) => acc + s.durationMinutes, 0);
        return Math.round(total / recent.length);
      },

      getStageMinutes: (session) => {
        const result = { light: 0, deep: 0, rem: 0, awake: 0 };
        session.stages.forEach((stage: SleepStage) => {
          const start = new Date(stage.start).getTime();
          const end = new Date(stage.end).getTime();
          const mins = (end - start) / 60000;
          if (stage.stage === 4) result.light += mins;
          else if (stage.stage === 5) result.deep += mins;
          else if (stage.stage === 6) result.rem += mins;
          else if (stage.stage === 1) result.awake += mins;
        });
        return {
          light: Math.round(result.light),
          deep: Math.round(result.deep),
          rem: Math.round(result.rem),
          awake: Math.round(result.awake),
        };
      },
    }),
    { name: 'sleep-store' }
  )
);
