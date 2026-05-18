import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Task, TaskColumn, TaskEvent, TaskPriority, IssueType, Recurring } from '../types';
import { nanoid } from '../utils/nanoid';
import { useSprintStore } from './sprintStore';

const DEFAULT_COLUMNS: TaskColumn[] = [
  { id: 'backlog', name: 'Backlog', color: '#9e9e9e', order: 0 },
  { id: 'todo', name: 'To Do', color: '#737686', order: 1 },
  { id: 'in_progress', name: 'In Progress', color: '#004ac6', order: 2 },
  { id: 'review', name: 'Review', color: '#712ae2', order: 3 },
  { id: 'done', name: 'Done', color: '#006243', order: 4 },
];

interface TasksState {
  tasks: Task[];
  columns: TaskColumn[];

  addTask: (partial: Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>>) => Task;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  moveTask: (taskId: string, newStatus: string) => void;
  reorderTask: (taskId: string, newOrder: number) => void;
  reorderItems: (orderedIds: string[]) => void;

  addSubtask: (parentId: string, title: string) => Task;
  getSubtasks: (parentId: string) => Task[];
  getTopLevelTasks: () => Task[];
  getTaskById: (id: string) => Task | undefined;
  getTasksByStatus: (status: string) => Task[];

  addColumn: (name: string, color: string) => void;
  updateColumn: (id: string, updates: Partial<TaskColumn>) => void;
  deleteColumn: (id: string) => void;
  reorderColumns: (columns: TaskColumn[]) => void;

  addEvent: (taskId: string, event: Omit<TaskEvent, 'id'>) => void;
  updateEvent: (taskId: string, eventId: string, updates: Partial<TaskEvent>) => void;
  deleteEvent: (taskId: string, eventId: string) => void;

  completeRecurring: (taskId: string) => void;
  allTags: () => string[];
}

export const useTasksStore = create<TasksState>()(
  persist(
    (set, get) => ({
      columns: DEFAULT_COLUMNS,
      tasks: [
        {
          id: 'task1',
          title: 'Update Design System Tokens',
          description: 'Refresh all colour tokens and typography scale in Figma and code.',
          status: 'todo',
          priority: 'high',
          issueType: 'story' as IssueType,
          tags: ['Design'],
          parentId: null,
          dueDate: null,
          recurring: null,
          events: [],
          order: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'task2',
          title: 'Q3 Campaign Assets Review',
          description: 'Review all creative assets for the Q3 marketing campaign.',
          status: 'todo',
          priority: 'medium',
          issueType: 'task' as IssueType,
          tags: ['Marketing'],
          parentId: null,
          dueDate: null,
          recurring: null,
          events: [],
          order: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'task3',
          title: 'Refactor API Authentication Layer',
          description: 'Move to JWT-based auth with refresh token rotation.',
          status: 'in_progress',
          priority: 'critical',
          issueType: 'epic' as IssueType,
          tags: ['Dev'],
          parentId: null,
          dueDate: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(),
          recurring: null,
          events: [],
          order: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],

      addTask: (partial) => {
        const tasksInStatus = get().tasks.filter(
          (t) => t.status === (partial.status ?? 'backlog') && !t.parentId,
        );
        const task: Task = {
          id: nanoid(),
          title: partial.title ?? 'Untitled Task',
          description: partial.description ?? '',
          status: partial.status ?? 'backlog',
          priority: (partial.priority as TaskPriority) ?? 'none',
          issueType: (partial.issueType as IssueType) ?? 'task',
          storyPoints: partial.storyPoints,
          tags: partial.tags ?? [],
          parentId: partial.parentId ?? null,
          dueDate: partial.dueDate ?? null,
          startTime: partial.startTime,
          deadlineTime: partial.deadlineTime,
          recurring: partial.recurring ?? null,
          events: partial.events ?? [],
          order: tasksInStatus.length,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set((s) => ({ tasks: [...s.tasks, task] }));
        return task;
      },

      updateTask: (id, updates) =>
        set((s) => ({
          tasks: s.tasks.map((t) => {
            if (t.id !== id) return t;
            const updated = { ...t, ...updates, updatedAt: new Date().toISOString() };
            // Auto-set / clear completedAt when status transitions to or from 'done'
            if ('status' in updates) {
              if (updates.status === 'done' && t.status !== 'done') {
                updated.completedAt = new Date().toISOString();
              } else if (updates.status !== 'done' && t.status === 'done') {
                updated.completedAt = undefined;
              }
            }
            // Re-evaluate sprint assignment when due date changes
            if ('dueDate' in updates && updated.sprintId) {
              const { sprints } = useSprintStore.getState();
              const sprint = sprints.find((sp) => sp.id === updated.sprintId);
              if (sprint) {
                const d = updated.dueDate;
                const inRange = d && d >= sprint.startDate && d <= sprint.endDate;
                if (!inRange) {
                  const better = sprints.find((sp) =>
                    sp.status !== 'completed' && d && d >= sp.startDate && d <= sp.endDate,
                  );
                  if (better) {
                    updated.sprintId = better.id;
                    if (updated.status === 'backlog') updated.status = 'todo';
                  } else {
                    updated.sprintId = null;
                    updated.status = 'backlog';
                  }
                }
              }
            }
            return updated;
          }),
        })),

      deleteTask: (id) => {
        const getAllDescendantIds = (taskId: string, tasks: Task[]): string[] => {
          const children = tasks.filter((t) => t.parentId === taskId);
          return [
            taskId,
            ...children.flatMap((c) => getAllDescendantIds(c.id, tasks)),
          ];
        };
        set((s) => {
          const idsToDelete = getAllDescendantIds(id, s.tasks);
          return { tasks: s.tasks.filter((t) => !idsToDelete.includes(t.id)) };
        });
      },

      moveTask: (taskId, newStatus) =>
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === taskId ? { ...t, status: newStatus, updatedAt: new Date().toISOString() } : t,
          ),
        })),

      reorderTask: (taskId, newOrder) =>
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === taskId ? { ...t, order: newOrder } : t,
          ),
        })),

      reorderItems: (orderedIds) =>
        set((s) => ({
          tasks: s.tasks.map((t) => {
            const idx = orderedIds.indexOf(t.id);
            return idx >= 0 ? { ...t, order: idx } : t;
          }),
        })),

      addSubtask: (parentId, title) => {
        const subtasks = get().tasks.filter((t) => t.parentId === parentId);
        const parent = get().tasks.find((t) => t.id === parentId);
        const task: Task = {
          id: nanoid(),
          title,
          description: '',
          status: parent?.status ?? 'todo',
          priority: 'none',
          issueType: 'subtask',
          tags: [],
          parentId,
          dueDate: null,
          recurring: null,
          events: [],
          order: subtasks.length,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set((s) => ({ tasks: [...s.tasks, task] }));
        return task;
      },

      getSubtasks: (parentId) =>
        get()
          .tasks.filter((t) => t.parentId === parentId)
          .sort((a, b) => a.order - b.order),

      getTopLevelTasks: () =>
        get()
          .tasks.filter((t) => !t.parentId)
          .sort((a, b) => a.order - b.order),

      getTaskById: (id) => get().tasks.find((t) => t.id === id),

      getTasksByStatus: (status) =>
        get()
          .tasks.filter((t) => t.status === status && !t.parentId)
          .sort((a, b) => a.order - b.order),

      addColumn: (name, color) => {
        const col: TaskColumn = {
          id: nanoid(),
          name,
          color,
          order: get().columns.length,
        };
        set((s) => ({ columns: [...s.columns, col] }));
      },

      updateColumn: (id, updates) =>
        set((s) => ({
          columns: s.columns.map((c) => (c.id === id ? { ...c, ...updates } : c)),
        })),

      deleteColumn: (id) =>
        set((s) => ({
          columns: s.columns.filter((c) => c.id !== id),
          tasks: s.tasks.filter((t) => t.status !== id),
        })),

      reorderColumns: (columns) => set({ columns }),

      addEvent: (taskId, event) =>
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === taskId
              ? { ...t, events: [...t.events, { ...event, id: nanoid() }] }
              : t,
          ),
        })),

      updateEvent: (taskId, eventId, updates) =>
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  events: t.events.map((e) =>
                    e.id === eventId ? { ...e, ...updates } : e,
                  ),
                }
              : t,
          ),
        })),

      deleteEvent: (taskId, eventId) =>
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === taskId
              ? { ...t, events: t.events.filter((e) => e.id !== eventId) }
              : t,
          ),
        })),

      completeRecurring: (taskId) => {
        const task = get().tasks.find((t) => t.id === taskId);
        if (!task?.recurring) return;
        const { frequency } = task.recurring;
        const next = new Date();
        if (frequency === 'daily') next.setDate(next.getDate() + 1);
        else if (frequency === 'weekly') next.setDate(next.getDate() + 7);
        else next.setMonth(next.getMonth() + 1);

        const now = new Date().toISOString();
        const newTask: Task = {
          ...task,
          id: nanoid(),
          status: 'todo',
          recurring: { frequency, nextDue: next.toISOString() },
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({
          tasks: s.tasks
            .map((t) => t.id === taskId ? { ...t, status: 'done', completedAt: now, updatedAt: now } : t)
            .concat([newTask]),
        }));
      },

      allTags: () => {
        const tags = new Set<string>();
        get().tasks.forEach((t) => t.tags.forEach((tag) => tags.add(tag)));
        return Array.from(tags).sort();
      },
    }),
    {
      name: 'productivity-tasks',
      version: 2,
      migrate(persisted: unknown, _version: number) {
        const s = persisted as { tasks?: any[]; columns?: TaskColumn[] } | null;
        const tasks = (s?.tasks ?? []).map((t: any) => ({
          ...t,
          issueType:      (t.issueType as IssueType) ?? 'task',
          events:         t.events         ?? [],
          parentId:       t.parentId       ?? null,
          priority:       t.priority       ?? 'none',
          tags:           t.tags           ?? [],
          recurring:      t.recurring      ?? null,
          sprintId:       t.sprintId       ?? null,
          linkedNoteIds:  t.linkedNoteIds  ?? [],
          isStretchGoal:  t.isStretchGoal  ?? false,
        }));
        return { ...s, tasks };
      },
    },
  ),
);
