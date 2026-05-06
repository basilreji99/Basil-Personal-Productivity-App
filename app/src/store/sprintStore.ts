import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Sprint, SprintStatus } from '../types';
import { nanoid } from '../utils/nanoid';

interface SprintState {
  sprints: Sprint[];
  addSprint: (partial: Partial<Omit<Sprint, 'id' | 'createdAt'>>) => Sprint;
  updateSprint: (id: string, updates: Partial<Sprint>) => void;
  deleteSprint: (id: string) => void;
  activeSprint: () => Sprint | null;
}

export const useSprintStore = create<SprintState>()(
  persist(
    (set, get) => ({
      sprints: [],

      addSprint: (partial) => {
        const now = new Date();
        const twoWeeks = new Date(now);
        twoWeeks.setDate(twoWeeks.getDate() + 14);
        const sprint: Sprint = {
          id: nanoid(),
          name: partial.name ?? 'New Sprint',
          goal: partial.goal,
          startDate: partial.startDate ?? now.toISOString().slice(0, 10),
          endDate: partial.endDate ?? twoWeeks.toISOString().slice(0, 10),
          status: (partial.status as SprintStatus) ?? 'planned',
          createdAt: now.toISOString(),
        };
        set((s) => ({ sprints: [...s.sprints, sprint] }));
        return sprint;
      },

      updateSprint: (id, updates) =>
        set((s) => ({
          sprints: s.sprints.map((sp) => (sp.id === id ? { ...sp, ...updates } : sp)),
        })),

      deleteSprint: (id) =>
        set((s) => ({ sprints: s.sprints.filter((sp) => sp.id !== id) })),

      activeSprint: () =>
        get().sprints.find((sp) => sp.status === 'active') ?? null,
    }),
    { name: 'productivity-sprints' },
  ),
);
