import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { nanoid } from '../utils/nanoid';

export interface GymSession {
  id: string;
  date: string;       // YYYY-MM-DD
  type: string;       // e.g. 'Push, Chest & Triceps'
  notes?: string;
  duration?: number;  // minutes
}

export interface SportSession {
  id: string;
  date: string;       // YYYY-MM-DD
  sport: string;      // e.g. 'Cricket', 'Swimming', 'Basketball'
  notes?: string;
  duration?: number;  // minutes
}

const INITIAL_GYM: GymSession[] = [
  { id: 'gym-1',  date: '2026-02-27', type: 'Push, Chest & Triceps' },
  { id: 'gym-2',  date: '2026-03-01', type: 'Back & Biceps' },
  { id: 'gym-3',  date: '2026-03-09', type: 'Push, Chest & Triceps' },
  { id: 'gym-4',  date: '2026-03-12', type: 'Back & Biceps' },
  { id: 'gym-5',  date: '2026-03-16', type: 'Push, Chest & Triceps' },
  { id: 'gym-6',  date: '2026-03-19', type: 'Back & Biceps' },
  { id: 'gym-7',  date: '2026-03-23', type: 'Push, Chest & Triceps' },
  { id: 'gym-8',  date: '2026-03-25', type: 'Back & Biceps' },
  { id: 'gym-9',  date: '2026-03-27', type: 'Legs & Core' },
  { id: 'gym-10', date: '2026-03-30', type: 'Push, Chest & Triceps' },
  { id: 'gym-11', date: '2026-04-01', type: 'Back & Biceps' },
  { id: 'gym-12', date: '2026-04-03', type: 'Legs & Core' },
  { id: 'gym-13', date: '2026-04-06', type: 'Push, Chest & Triceps' },
  { id: 'gym-14', date: '2026-04-08', type: 'Back & Biceps' },
  { id: 'gym-15', date: '2026-04-10', type: 'Legs & Core' },
  { id: 'gym-16', date: '2026-04-15', type: 'Push, Chest & Triceps' },
  { id: 'gym-17', date: '2026-04-16', type: 'Legs & Core' },
];

const INITIAL_SPORTS: SportSession[] = [
  { id: 'sport-1',  date: '2026-01-11', sport: 'Cricket' },
  { id: 'sport-2',  date: '2026-03-13', sport: 'Swimming' },
  { id: 'sport-3',  date: '2026-03-14', sport: 'Cricket' },
  { id: 'sport-4',  date: '2026-03-16', sport: 'Swimming' },
  { id: 'sport-5',  date: '2026-03-17', sport: 'Swimming' },
  { id: 'sport-6',  date: '2026-03-18', sport: 'Swimming' },
  { id: 'sport-7',  date: '2026-03-19', sport: 'Swimming' },
  { id: 'sport-8',  date: '2026-03-21', sport: 'Cricket' },
  { id: 'sport-9',  date: '2026-03-29', sport: 'Cricket' },
  { id: 'sport-10', date: '2026-03-31', sport: 'Swimming' },
  { id: 'sport-11', date: '2026-03-31', sport: 'Basketball' },
  { id: 'sport-12', date: '2026-04-03', sport: 'Swimming' },
  { id: 'sport-13', date: '2026-04-09', sport: 'Swimming' },
  { id: 'sport-14', date: '2026-04-16', sport: 'Swimming' },
  { id: 'sport-15', date: '2026-05-05', sport: 'Swimming' },
];

interface FitnessState {
  gymSessions: GymSession[];
  sportSessions: SportSession[];

  addGymSession: (s: Omit<GymSession, 'id'>) => void;
  updateGymSession: (id: string, updates: Partial<Omit<GymSession, 'id'>>) => void;
  deleteGymSession: (id: string) => void;

  addSportSession: (s: Omit<SportSession, 'id'>) => void;
  updateSportSession: (id: string, updates: Partial<Omit<SportSession, 'id'>>) => void;
  deleteSportSession: (id: string) => void;
}

export const useFitnessStore = create<FitnessState>()(
  persist(
    (set) => ({
      gymSessions: INITIAL_GYM,
      sportSessions: INITIAL_SPORTS,

      addGymSession: (s) =>
        set(st => ({
          gymSessions: [{ ...s, id: nanoid() }, ...st.gymSessions]
            .sort((a, b) => b.date.localeCompare(a.date)),
        })),

      updateGymSession: (id, updates) =>
        set(st => ({
          gymSessions: st.gymSessions.map(s => s.id === id ? { ...s, ...updates } : s),
        })),

      deleteGymSession: (id) =>
        set(st => ({ gymSessions: st.gymSessions.filter(s => s.id !== id) })),

      addSportSession: (s) =>
        set(st => ({
          sportSessions: [{ ...s, id: nanoid() }, ...st.sportSessions]
            .sort((a, b) => b.date.localeCompare(a.date)),
        })),

      updateSportSession: (id, updates) =>
        set(st => ({
          sportSessions: st.sportSessions.map(s => s.id === id ? { ...s, ...updates } : s),
        })),

      deleteSportSession: (id) =>
        set(st => ({ sportSessions: st.sportSessions.filter(s => s.id !== id) })),
    }),
    {
      name: 'basil-fitness',
      version: 1,
      migrate(persisted: unknown, version: number) {
        const s = persisted as { gymSessions?: GymSession[]; sportSessions?: SportSession[] } | null;
        if (version < 1) {
          const hasGym   = (s?.gymSessions ?? []).some(g => g.id === 'gym-1');
          const hasSport = (s?.sportSessions ?? []).some(sp => sp.id === 'sport-1');
          return {
            ...(s ?? {}),
            gymSessions:   hasGym   ? (s?.gymSessions ?? [])   : [...INITIAL_GYM,    ...(s?.gymSessions ?? [])],
            sportSessions: hasSport ? (s?.sportSessions ?? []) : [...INITIAL_SPORTS, ...(s?.sportSessions ?? [])],
          };
        }
        return s;
      },
    },
  ),
);
