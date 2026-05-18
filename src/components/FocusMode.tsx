import { useEffect } from 'react';
import { useTimerStore } from '../store/timerStore';
import { useTasksStore } from '../store/tasksStore';
import { sanitizeHtml } from '../utils/sanitizeHtml';
import FocusTimer from './timer/FocusTimer';

export default function FocusMode() {
  const { focusTaskId, closeFocus } = useTimerStore();
  const { tasks, updateTask } = useTasksStore();

  const task = focusTaskId ? tasks.find((t) => t.id === focusTaskId) : null;
  const subtasks = focusTaskId ? tasks.filter((t) => t.parentId === focusTaskId) : [];

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeFocus(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [closeFocus]);

  if (!focusTaskId || !task) return null;

  const done = subtasks.filter((t) => t.status === 'done').length;
  const total = subtasks.length;

  return (
    <div className="fixed inset-0 z-[200] bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-safe pt-4 pb-3 border-b border-outline-variant/20">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-primary">center_focus_strong</span>
          <span className="font-inter text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Focus Mode</span>
        </div>
        <button
          onClick={closeFocus}
          className="p-2 rounded-xl text-on-surface-variant hover:bg-surface-container transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6 max-w-lg mx-auto w-full">
        {/* Task title */}
        <div>
          <p className="font-inter text-xs text-on-surface-variant uppercase tracking-wider mb-1">Current task</p>
          <h1 className="font-manrope font-bold text-2xl text-on-surface leading-snug">{task.title}</h1>
          {task.description && (
            <div
              className="mt-2 font-work-sans text-sm text-on-surface-variant leading-relaxed line-clamp-3"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(task.description) }}
            />
          )}
        </div>

        {/* Subtasks */}
        {subtasks.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="font-inter text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                Subtasks
              </p>
              <span className="font-inter text-xs text-outline">{done}/{total}</span>
            </div>
            {total > 0 && (
              <div className="h-1 bg-surface-container rounded-full mb-3 overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${(done / total) * 100}%` }}
                />
              </div>
            )}
            <div className="space-y-2">
              {subtasks.map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => updateTask(sub.id, { status: sub.status === 'done' ? 'todo' : 'done' })}
                  className="flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high transition-colors"
                >
                  <span
                    className={`material-symbols-outlined text-[20px] shrink-0 transition-colors ${
                      sub.status === 'done' ? 'text-primary icon-fill' : 'text-outline'
                    }`}
                  >
                    {sub.status === 'done' ? 'check_circle' : 'radio_button_unchecked'}
                  </span>
                  <span
                    className={`font-inter text-sm flex-1 ${
                      sub.status === 'done' ? 'line-through text-outline' : 'text-on-surface'
                    }`}
                  >
                    {sub.title}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Timer */}
        <FocusTimer />
      </div>
    </div>
  );
}
