import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { nanoid } from '../utils/nanoid';

export interface KRHistoryPoint {
  date: string; // 'YYYY-MM-DD'
  value: number;
}

export interface KeyResult {
  id: string;
  title: string;
  current: number;
  target: number;
  unit: string;
  history?: KRHistoryPoint[];
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  quarter: string; // "Q2 2026"
  keyResults: KeyResult[];
  status: 'active' | 'completed' | 'abandoned';
  createdAt: string;
}

interface GoalsState {
  goals: Goal[];
  addGoal: (partial: Partial<Omit<Goal, 'id' | 'createdAt'>>) => Goal;
  updateGoal: (id: string, updates: Partial<Goal>) => void;
  deleteGoal: (id: string) => void;
  addKeyResult: (goalId: string, kr: Omit<KeyResult, 'id'>) => void;
  updateKeyResult: (goalId: string, krId: string, updates: Partial<KeyResult>) => void;
  deleteKeyResult: (goalId: string, krId: string) => void;
}

export const useGoalsStore = create<GoalsState>()(
  persist(
    (set, get) => ({
      goals: [],

      addGoal: (partial) => {
        const goal: Goal = {
          id: nanoid(),
          title: partial.title ?? 'New Goal',
          description: partial.description ?? '',
          quarter: partial.quarter ?? currentQuarter(),
          keyResults: partial.keyResults ?? [],
          status: partial.status ?? 'active',
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ goals: [...s.goals, goal] }));
        return goal;
      },

      updateGoal: (id, updates) =>
        set((s) => ({
          goals: s.goals.map((g) => (g.id === id ? { ...g, ...updates } : g)),
        })),

      deleteGoal: (id) =>
        set((s) => ({ goals: s.goals.filter((g) => g.id !== id) })),

      addKeyResult: (goalId, kr) => {
        const newKr: KeyResult = { id: nanoid(), ...kr };
        set((s) => ({
          goals: s.goals.map((g) =>
            g.id === goalId ? { ...g, keyResults: [...g.keyResults, newKr] } : g,
          ),
        }));
      },

      updateKeyResult: (goalId, krId, updates) => {
        set((s) => ({
          goals: s.goals.map((g) =>
            g.id === goalId
              ? {
                  ...g,
                  keyResults: g.keyResults.map((kr) => {
                    if (kr.id !== krId) return kr;
                    const updated = { ...kr, ...updates };
                    if (updates.current !== undefined && updates.current !== kr.current) {
                      const today = new Date().toISOString().slice(0, 10);
                      const hist = kr.history ?? [];
                      const last = hist[hist.length - 1];
                      updated.history = last?.date === today
                        ? [...hist.slice(0, -1), { date: today, value: updates.current }]
                        : [...hist, { date: today, value: updates.current }];
                    }
                    return updated;
                  }),
                }
              : g,
          ),
        }));
        // Auto-complete goal if all KRs at 100%
        const goal = get().goals.find((g) => g.id === goalId);
        if (goal && goal.keyResults.length > 0) {
          const allDone = goal.keyResults.every((kr) => kr.current >= kr.target);
          if (allDone && goal.status === 'active') {
            set((s) => ({
              goals: s.goals.map((g) =>
                g.id === goalId ? { ...g, status: 'completed' } : g,
              ),
            }));
          }
        }
      },

      deleteKeyResult: (goalId, krId) =>
        set((s) => ({
          goals: s.goals.map((g) =>
            g.id === goalId
              ? { ...g, keyResults: g.keyResults.filter((kr) => kr.id !== krId) }
              : g,
          ),
        })),
    }),
    { name: 'basil-goals' },
  ),
);

export function currentQuarter(): string {
  const now = new Date();
  const q = Math.ceil((now.getMonth() + 1) / 3);
  return `Q${q} ${now.getFullYear()}`;
}

export function goalProgress(goal: Goal): number {
  if (!goal.keyResults.length) return 0;
  const total = goal.keyResults.reduce(
    (sum, kr) => sum + Math.min(kr.current / Math.max(kr.target, 1), 1),
    0,
  );
  return Math.round((total / goal.keyResults.length) * 100);
}
