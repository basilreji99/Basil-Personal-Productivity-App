import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import { BUILTIN_EXERCISES } from '../data/exercises';
import type {
  GymExercise,
  GymExerciseEntry,
  GymSet,
  GymSession,
  WorkoutTemplate,
} from '../types';

interface GymState {
  sessions: GymSession[];
  templates: WorkoutTemplate[];
  customExercises: GymExercise[];
  activeSession: GymSession | null;

  // Exercise library
  getAllExercises: () => GymExercise[];
  addCustomExercise: (ex: Omit<GymExercise, 'id' | 'isCustom'>) => void;
  deleteCustomExercise: (id: string) => void;

  // Active session management
  startSession: (name: string, templateId?: string) => void;
  finishSession: () => void;
  cancelSession: () => void;

  // Within active session
  addExerciseToSession: (exerciseId: string) => void;
  removeExerciseFromSession: (entryId: string) => void;
  addSet: (entryId: string, set?: Partial<GymSet>) => void;
  updateSet: (entryId: string, setId: string, update: Partial<GymSet>) => void;
  deleteSet: (entryId: string, setId: string) => void;
  reorderExercises: (entries: GymExerciseEntry[]) => void;
  updateSessionName: (name: string) => void;
  updateSessionNotes: (notes: string) => void;

  // Session history
  deleteSession: (id: string) => void;
  importHCSession: (session: GymSession) => void;

  // Templates
  saveTemplate: (name: string, entries: GymExerciseEntry[]) => void;
  updateTemplate: (id: string, name: string, entries: GymExerciseEntry[]) => void;
  deleteTemplate: (id: string) => void;
}

export const useGymStore = create<GymState>()(
  persist(
    (set, get) => ({
      sessions: [],
      templates: [],
      customExercises: [],
      activeSession: null,

      getAllExercises: () => [...BUILTIN_EXERCISES, ...get().customExercises],

      addCustomExercise: (ex) =>
        set((s) => ({
          customExercises: [
            ...s.customExercises,
            { id: nanoid(), ...ex, isCustom: true },
          ],
        })),

      deleteCustomExercise: (id) =>
        set((s) => ({
          customExercises: s.customExercises.filter((e) => e.id !== id),
        })),

      startSession: (name, templateId) => {
        let exercises: GymExerciseEntry[] = [];
        if (templateId) {
          const tpl = get().templates.find((t) => t.id === templateId);
          if (tpl) {
            exercises = tpl.exercises.map((e) => ({
              ...e,
              id: nanoid(),
              sets: [],
            }));
          }
        }
        const session: GymSession = {
          id: nanoid(),
          name,
          startedAt: new Date().toISOString(),
          exercises,
          source: 'manual',
        };
        set({ activeSession: session });
      },

      finishSession: () => {
        const active = get().activeSession;
        if (!active) return;
        const finishedAt = new Date().toISOString();
        const start = new Date(active.startedAt).getTime();
        const durationSeconds = Math.round((Date.now() - start) / 1000);

        let totalVolume = 0;
        let totalSets = 0;
        active.exercises.forEach((entry) => {
          entry.sets.forEach((s) => {
            if (!s.isWarmup) {
              totalVolume += (s.weight || 0) * (s.reps || 0);
              totalSets += 1;
            }
          });
        });

        const finished: GymSession = {
          ...active,
          finishedAt,
          durationSeconds,
          totalVolume,
          totalSets,
        };
        set((s) => ({
          sessions: [finished, ...s.sessions],
          activeSession: null,
        }));
      },

      cancelSession: () => set({ activeSession: null }),

      addExerciseToSession: (exerciseId) =>
        set((s) => {
          if (!s.activeSession) return s;
          const entry: GymExerciseEntry = {
            id: nanoid(),
            exerciseId,
            sets: [],
          };
          return {
            activeSession: {
              ...s.activeSession,
              exercises: [...s.activeSession.exercises, entry],
            },
          };
        }),

      removeExerciseFromSession: (entryId) =>
        set((s) => {
          if (!s.activeSession) return s;
          return {
            activeSession: {
              ...s.activeSession,
              exercises: s.activeSession.exercises.filter((e) => e.id !== entryId),
            },
          };
        }),

      addSet: (entryId, partial = {}) =>
        set((s) => {
          if (!s.activeSession) return s;
          const newSet: GymSet = {
            id: nanoid(),
            weight: 0,
            reps: 0,
            ...partial,
          };
          return {
            activeSession: {
              ...s.activeSession,
              exercises: s.activeSession.exercises.map((e) =>
                e.id === entryId ? { ...e, sets: [...e.sets, newSet] } : e
              ),
            },
          };
        }),

      updateSet: (entryId, setId, update) =>
        set((s) => {
          if (!s.activeSession) return s;
          return {
            activeSession: {
              ...s.activeSession,
              exercises: s.activeSession.exercises.map((e) =>
                e.id === entryId
                  ? {
                      ...e,
                      sets: e.sets.map((st) =>
                        st.id === setId ? { ...st, ...update } : st
                      ),
                    }
                  : e
              ),
            },
          };
        }),

      deleteSet: (entryId, setId) =>
        set((s) => {
          if (!s.activeSession) return s;
          return {
            activeSession: {
              ...s.activeSession,
              exercises: s.activeSession.exercises.map((e) =>
                e.id === entryId
                  ? { ...e, sets: e.sets.filter((st) => st.id !== setId) }
                  : e
              ),
            },
          };
        }),

      reorderExercises: (entries) =>
        set((s) => {
          if (!s.activeSession) return s;
          return { activeSession: { ...s.activeSession, exercises: entries } };
        }),

      updateSessionName: (name) =>
        set((s) => {
          if (!s.activeSession) return s;
          return { activeSession: { ...s.activeSession, name } };
        }),

      updateSessionNotes: (notes) =>
        set((s) => {
          if (!s.activeSession) return s;
          return { activeSession: { ...s.activeSession, notes } };
        }),

      deleteSession: (id) =>
        set((s) => ({ sessions: s.sessions.filter((x) => x.id !== id) })),

      importHCSession: (session) =>
        set((s) => {
          const exists = s.sessions.some((x) => x.id === session.id);
          if (exists) return s;
          return { sessions: [session, ...s.sessions] };
        }),

      saveTemplate: (name, entries) => {
        const tpl: WorkoutTemplate = {
          id: nanoid(),
          name,
          exercises: entries,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set((s) => ({ templates: [...s.templates, tpl] }));
      },

      updateTemplate: (id, name, entries) =>
        set((s) => ({
          templates: s.templates.map((t) =>
            t.id === id
              ? { ...t, name, exercises: entries, updatedAt: new Date().toISOString() }
              : t
          ),
        })),

      deleteTemplate: (id) =>
        set((s) => ({ templates: s.templates.filter((t) => t.id !== id) })),
    }),
    { name: 'gym-store' }
  )
);
