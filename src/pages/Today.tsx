import { useState, useMemo, useRef } from 'react';
import { format } from 'date-fns';
import TopBar from '../components/layout/TopBar';
import { useTasksStore } from '../store/tasksStore';
import { getTodayString, isOverdue } from '../utils/dateUtils';
import type { Task } from '../types';

const PRIORITY_ICON: Record<string, string> = {
  critical: 'keyboard_double_arrow_up',
  high: 'arrow_upward',
  medium: 'drag_handle',
  low: 'arrow_downward',
  none: 'remove',
};
const PRIORITY_COLOR: Record<string, string> = {
  critical: 'text-red-500',
  high: 'text-orange-400',
  medium: 'text-amber-400',
  low: 'text-blue-400',
  none: 'text-outline',
};
const PRIORITY_WEIGHT: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1, none: 0 };

export default function Today() {
  const { tasks, addTask, updateTask, deleteTask } = useTasksStore();
  const today = getTodayString();
  const [quickTitle, setQuickTitle] = useState('');
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  const todayTasks = useMemo(() => {
    const byPriority = (a: Task, b: Task) =>
      (PRIORITY_WEIGHT[b.priority] ?? 0) - (PRIORITY_WEIGHT[a.priority] ?? 0);
    const active = tasks.filter(
      (t) => t.status !== 'done' && t.dueDate && !deletingIds.has(t.id) && (
        t.dueDate === today || isOverdue(t.dueDate)
      )
    );
    const overdue = active.filter((t) => isOverdue(t.dueDate)).sort(byPriority);
    const dueToday = active.filter((t) => t.dueDate === today).sort(byPriority);
    return { overdue, dueToday };
  }, [tasks, today, deletingIds]);

  const isQuickTask = (task: Task) =>
    !task.sprintId && !task.parentId && !(task.tags?.length) && !task.description;

  const handleCheck = (task: Task) => {
    updateTask(task.id, { status: 'done' });
    if (isQuickTask(task)) {
      setDeletingIds((prev) => new Set([...prev, task.id]));
      setTimeout(() => {
        deleteTask(task.id);
        setDeletingIds((prev) => { const n = new Set(prev); n.delete(task.id); return n; });
      }, 1400);
    }
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim()) return;
    addTask({
      title: quickTitle.trim(),
      dueDate: today,
      status: 'todo',
      issueType: 'task',
      priority: 'none',
      tags: [],
      description: '',
    });
    setQuickTitle('');
    inputRef.current?.focus();
  };

  const totalCount = todayTasks.overdue.length + todayTasks.dueToday.length;

  return (
    <div className="bg-background min-h-screen">
      <TopBar
        title="Today"
        rightSlot={
          <div className="flex items-center gap-1 px-1">
            <span className="font-inter text-xs text-on-surface-variant">
              {format(new Date(), 'MMM d')}
            </span>
          </div>
        }
      />

      <main className="max-w-screen-xl mx-auto px-4 pt-4 pb-36 space-y-5">

        {/* Quick add */}
        <form onSubmit={handleAdd} className="flex items-center gap-3 bg-surface-container-lowest rounded-2xl px-4 py-3 shadow-card border border-outline-variant/20 focus-within:border-primary/30 transition-colors">
          <span className="material-symbols-outlined text-[20px] text-primary shrink-0">add_task</span>
          <input
            ref={inputRef}
            type="text"
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            placeholder="Add a task for today…"
            className="flex-1 bg-transparent font-inter text-sm text-on-surface placeholder:text-outline/60 outline-none"
          />
          {quickTitle.trim() && (
            <button
              type="submit"
              className="shrink-0 w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center hover:opacity-90 active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
            </button>
          )}
        </form>

        {/* Empty state */}
        {totalCount === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <span className="material-symbols-outlined text-[48px] text-tertiary mb-3">check_circle</span>
            <p className="font-manrope font-bold text-on-surface mb-1">All clear!</p>
            <p className="font-inter text-sm text-on-surface-variant">Nothing due today. Add something above.</p>
          </div>
        )}

        {/* Overdue */}
        {todayTasks.overdue.length > 0 && (
          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[13px] text-error">warning</span>
              <p className="font-inter text-[10px] font-semibold uppercase tracking-wider text-error">Overdue</p>
              <div className="flex-1 h-px bg-error/20" />
            </div>
            {todayTasks.overdue.map((task) => (
              <TaskRow key={task.id} task={task} onCheck={handleCheck} isDeleting={deletingIds.has(task.id)} />
            ))}
          </section>
        )}

        {/* Due today */}
        {todayTasks.dueToday.length > 0 && (
          <section className="space-y-2">
            {todayTasks.overdue.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[13px] text-primary">today</span>
                <p className="font-inter text-[10px] font-semibold uppercase tracking-wider text-outline">Due Today</p>
                <div className="flex-1 h-px bg-outline-variant/30" />
              </div>
            )}
            {todayTasks.dueToday.map((task) => (
              <TaskRow key={task.id} task={task} onCheck={handleCheck} isDeleting={deletingIds.has(task.id)} />
            ))}
          </section>
        )}

      </main>
    </div>
  );
}

function TaskRow({ task, onCheck, isDeleting }: { task: Task; onCheck: (t: Task) => void; isDeleting: boolean }) {
  return (
    <div
      className={`flex items-center gap-3 bg-surface-container-lowest rounded-xl px-4 py-3 shadow-card border border-transparent transition-all duration-500 ${
        isDeleting ? 'opacity-0 scale-95 translate-x-4' : 'opacity-100'
      }`}
    >
      <button
        onClick={() => onCheck(task)}
        className="w-5 h-5 rounded-full border-2 border-outline-variant hover:border-primary flex items-center justify-center shrink-0 transition-colors"
      >
        {isDeleting && (
          <span className="material-symbols-outlined text-[12px] text-tertiary icon-fill">check</span>
        )}
      </button>
      <p className="flex-1 font-inter font-medium text-sm text-on-surface truncate">{task.title}</p>
      <span className={`material-symbols-outlined text-[18px] shrink-0 ${PRIORITY_COLOR[task.priority]}`}>
        {PRIORITY_ICON[task.priority]}
      </span>
    </div>
  );
}
