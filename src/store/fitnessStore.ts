import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { nanoid } from '../utils/nanoid';
import { useHabitsStore } from './habitsStore';

export interface GymSession {
  id: string;
  date: string;       // YYYY-MM-DD
  type: string;       // e.g. 'Push, Chest & Triceps'
  notes?: string;
  duration?: number;  // seconds
  calories?: number;  // kcal
  startTime?: string; // ISO datetime (from HC)
  source?: 'manual' | 'health_connect';
}

export interface SportSession {
  id: string;
  date: string;       // YYYY-MM-DD
  sport: string;      // e.g. 'Cricket', 'Swimming', 'Basketball'
  notes?: string;
  duration?: number;  // seconds
  calories?: number;  // kcal
  startTime?: string; // ISO datetime (from HC)
  source?: 'manual' | 'health_connect';
}

const INITIAL_GYM: GymSession[] = [
  { id: 'gym-1',  date: '2026-02-27', type: 'Push, Chest & Triceps', duration: 3540,  calories: 432  },
  { id: 'gym-2',  date: '2026-03-01', type: 'Back & Biceps',          duration: 4500,  calories: 591  },
  { id: 'gym-3',  date: '2026-03-09', type: 'Push, Chest & Triceps', duration: 3720,  calories: 468  },
  { id: 'gym-4',  date: '2026-03-12', type: 'Back & Biceps',          duration: 3000,  calories: 298  },
  { id: 'gym-5',  date: '2026-03-16', type: 'Push, Chest & Triceps', duration: 3300,  calories: 395  },
  { id: 'gym-6',  date: '2026-03-19', type: 'Back & Biceps',          duration: 2640,  calories: 288  },
  { id: 'gym-7',  date: '2026-03-23', type: 'Push, Chest & Triceps', duration: 3720,  calories: 361  },
  { id: 'gym-8',  date: '2026-03-25', type: 'Back & Biceps',          duration: 4320,  calories: 498  },
  { id: 'gym-9',  date: '2026-03-27', type: 'Legs & Core',            duration: 3960,  calories: 468  },
  { id: 'gym-10', date: '2026-03-30', type: 'Push, Chest & Triceps', duration: 4380,  calories: 435  },
  { id: 'gym-11', date: '2026-04-01', type: 'Back & Biceps',          duration: 4380,  calories: 535  },
  { id: 'gym-12', date: '2026-04-03', type: 'Legs & Core',            duration: 3660,  calories: 360  },
  { id: 'gym-13', date: '2026-04-06', type: 'Push, Chest & Triceps', duration: 3540,  calories: 302  },
  { id: 'gym-14', date: '2026-04-08', type: 'Back & Biceps',          duration: 3480,  calories: 313  },
  { id: 'gym-15', date: '2026-04-10', type: 'Legs & Core',            duration: 4320,  calories: 534  },
  { id: 'gym-16', date: '2026-04-15', type: 'Push, Chest & Triceps'                                   },
  { id: 'gym-17', date: '2026-04-16', type: 'Legs & Core',            duration: 3420,  calories: 402  },
];

const INITIAL_SPORTS: SportSession[] = [
  { id: 'sport-1',  date: '2026-01-11', sport: 'Cricket',    duration: 2640,  calories: 387  },
  { id: 'sport-2',  date: '2026-03-13', sport: 'Swimming',   duration: 4860,  calories: 601  },
  { id: 'sport-3',  date: '2026-03-14', sport: 'Cricket',    duration: 15060, calories: 1570 },
  { id: 'sport-4',  date: '2026-03-16', sport: 'Swimming',   duration: 4560,  calories: 521  },
  { id: 'sport-5',  date: '2026-03-17', sport: 'Swimming',   duration: 5220,  calories: 898  },
  { id: 'sport-6',  date: '2026-03-18', sport: 'Swimming',   duration: 2280,  calories: 369  },
  { id: 'sport-7',  date: '2026-03-19', sport: 'Swimming',   duration: 4260,  calories: 536  },
  { id: 'sport-8',  date: '2026-03-21', sport: 'Cricket',    duration: 14700, calories: 2083 },
  { id: 'sport-9',  date: '2026-03-29', sport: 'Cricket',    duration: 16080, calories: 1201 },
  { id: 'sport-10', date: '2026-03-31', sport: 'Basketball', duration: 3840,  calories: 544  },
  { id: 'sport-11', date: '2026-03-31', sport: 'Swimming',   duration: 3720,  calories: 372  },
  { id: 'sport-12', date: '2026-04-03', sport: 'Swimming',   duration: 4680,  calories: 715  },
  { id: 'sport-13', date: '2026-04-09', sport: 'Swimming',   duration: 3840,  calories: 576  },
  { id: 'sport-14', date: '2026-04-11', sport: 'Cricket',    duration: 12000, calories: 1269 },
  { id: 'sport-15', date: '2026-04-16', sport: 'Swimming',   duration: 4200,  calories: 603  },
  { id: 'sport-16', date: '2026-05-05', sport: 'Swimming',   duration: 5580,  calories: 938  },
  { id: 'sport-17', date: '2026-05-06', sport: 'Swimming',   duration: 7620,  calories: 1176 },
];

interface FitnessState {
  gymSessions: GymSession[];
  sportSessions: SportSession[];

  addGymSession: (s: Omit<GymSession, 'id'>) => void;
  updateGymSession: (id: string, updates: Partial<Omit<GymSession, 'id'>>) => void;
  deleteGymSession: (id: string) => void;
  importHCGymSession: (s: GymSession) => void;

  addSportSession: (s: Omit<SportSession, 'id'>) => void;
  updateSportSession: (id: string, updates: Partial<Omit<SportSession, 'id'>>) => void;
  deleteSportSession: (id: string) => void;
  importHCSportSession: (s: SportSession) => void;
}

export const useFitnessStore = create<FitnessState>()(
  persist(
    (set, get) => ({
      gymSessions: INITIAL_GYM,
      sportSessions: INITIAL_SPORTS,

      addGymSession: (s) => {
        set(st => ({
          gymSessions: [{ ...s, id: nanoid() }, ...st.gymSessions]
            .sort((a, b) => b.date.localeCompare(a.date)),
        }));
        useHabitsStore.getState().markSourceCompleted('gym', s.date);
      },

      updateGymSession: (id, updates) =>
        set(st => ({
          gymSessions: st.gymSessions.map(s => s.id === id ? { ...s, ...updates } : s),
        })),

      deleteGymSession: (id) =>
        set(st => ({ gymSessions: st.gymSessions.filter(s => s.id !== id) })),

      importHCGymSession: (s) => {
        if (get().gymSessions.some(g => g.id === s.id)) return;
        set(st => ({ gymSessions: [s, ...st.gymSessions].sort((a, b) => b.date.localeCompare(a.date)) }));
        useHabitsStore.getState().markSourceCompleted('gym', s.date);
      },

      addSportSession: (s) => {
        set(st => ({
          sportSessions: [{ ...s, id: nanoid() }, ...st.sportSessions]
            .sort((a, b) => b.date.localeCompare(a.date)),
        }));
        useHabitsStore.getState().markSourceCompleted('sports', s.date);
      },

      updateSportSession: (id, updates) =>
        set(st => ({
          sportSessions: st.sportSessions.map(s => s.id === id ? { ...s, ...updates } : s),
        })),

      deleteSportSession: (id) =>
        set(st => ({ sportSessions: st.sportSessions.filter(s => s.id !== id) })),

      importHCSportSession: (s) => {
        if (get().sportSessions.some(g => g.id === s.id)) return;
        set(st => ({ sportSessions: [s, ...st.sportSessions].sort((a, b) => b.date.localeCompare(a.date)) }));
        useHabitsStore.getState().markSourceCompleted('sports', s.date);
      },
    }),
    {
      name: 'basil-fitness',
      version: 3,
      migrate(persisted: unknown, version: number) {
        if (version < 3) {
          // Replace all stored sessions with the updated dataset
          return { gymSessions: INITIAL_GYM, sportSessions: INITIAL_SPORTS };
        }
        return persisted as { gymSessions?: GymSession[]; sportSessions?: SportSession[] };
      },
    },
  ),
);
