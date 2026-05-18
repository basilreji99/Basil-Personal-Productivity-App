import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Sprint, SprintStatus } from '../types';
import { nanoid } from '../utils/nanoid';
import { useTasksStore } from './tasksStore';

interface SprintState {
  sprints: Sprint[];
  addSprint: (partial: Partial<Omit<Sprint, 'id' | 'createdAt'>>) => Sprint;
  updateSprint: (id: string, updates: Partial<Sprint>) => void;
  deleteSprint: (id: string) => void;
  activeSprint: () => Sprint | null;
  autoActivateSprints: () => void;
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
          capacity: partial.capacity,
          createdAt: now.toISOString(),
        };
        set((s) => ({ sprints: [...s.sprints, sprint] }));
        return sprint;
      },

      updateSprint: (id, updates) => {
        // When activating a sprint, snapshot the current task count + story points
        let enrichedUpdates = { ...updates };
        if ('status' in updates && updates.status === 'active') {
          const existing = get().sprints.find((sp) => sp.id === id);
          if (existing && existing.status !== 'active') {
            const { tasks } = useTasksStore.getState();
            const sprintTasks = tasks.filter((t) => t.sprintId === id);
            enrichedUpdates = {
              ...enrichedUpdates,
              totalTasksAtStart: sprintTasks.length,
              totalPointsAtStart: sprintTasks.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0),
            };
          }
        }
        set((s) => ({
          sprints: s.sprints.map((sp) => (sp.id === id ? { ...sp, ...enrichedUpdates } : sp)),
        }));
        // Re-evaluate tasks assigned to this sprint when dates change
        if ('startDate' in updates || 'endDate' in updates) {
          const updatedSprint = get().sprints.find((sp) => sp.id === id);
          if (!updatedSprint) return;
          const allSprints = get().sprints;
          const { tasks, updateTask } = useTasksStore.getState();
          tasks
            .filter((t) => t.sprintId === id && t.dueDate)
            .forEach((t) => {
              const inRange = t.dueDate! >= updatedSprint.startDate && t.dueDate! <= updatedSprint.endDate;
              if (!inRange) {
                const better = allSprints.find((sp) =>
                  sp.id !== id && sp.status !== 'completed' &&
                  t.dueDate! >= sp.startDate && t.dueDate! <= sp.endDate,
                );
                if (better) {
                  updateTask(t.id, { sprintId: better.id });
                } else {
                  updateTask(t.id, { sprintId: null, status: 'backlog' });
                }
              }
            });
        }
      },

      deleteSprint: (id) =>
        set((s) => ({ sprints: s.sprints.filter((sp) => sp.id !== id) })),

      activeSprint: () =>
        get().sprints.find((sp) => sp.status === 'active') ?? null,

      autoActivateSprints: () => {
        const today = new Date().toISOString().slice(0, 10);
        set((s) => {
          // First: complete any active sprints that have ended
          const withCompleted = s.sprints.map((sp) =>
            sp.status === 'active' && sp.endDate < today
              ? { ...sp, status: 'completed' as SprintStatus }
              : sp,
          );
          // If one is already active, don't activate another
          if (withCompleted.some((sp) => sp.status === 'active')) return { sprints: withCompleted };
          // Activate the earliest-starting planned sprint that covers today
          let activated = false;
          return {
            sprints: withCompleted.map((sp) => {
              if (!activated && sp.status === 'planned' && sp.startDate <= today && sp.endDate >= today) {
                activated = true;
                return { ...sp, status: 'active' as SprintStatus };
              }
              return sp;
            }),
          };
        });
      },
    }),
    { name: 'productivity-sprints' },
  ),
);
