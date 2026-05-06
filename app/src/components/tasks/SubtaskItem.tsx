import { useState } from 'react';
import TagChip from '../ui/TagChip';
import type { Task } from '../../types';
import { useTasksStore } from '../../store/tasksStore';

interface SubtaskItemProps {
  task: Task;
  depth?: number;
  onAddSubtask: (parentId: string) => void;
  onEditTask: (task: Task) => void;
}

export default function SubtaskItem({ task, depth = 0, onAddSubtask, onEditTask }: SubtaskItemProps) {
  const [expanded, setExpanded] = useState(true);
  const { getSubtasks, updateTask } = useTasksStore();
  const children = getSubtasks(task.id);
  const isDone = task.status === 'done';

  const STATUS_BG: Record<string, string> = {
    done: 'bg-tertiary-container text-on-tertiary-container',
    in_progress: 'bg-primary-container/20 text-primary',
    review: 'bg-secondary/10 text-secondary',
    todo: 'bg-surface-container text-on-surface-variant',
  };

  const toggleDone = () => {
    updateTask(task.id, { status: isDone ? 'todo' : 'done' });
  };

  const checkboxSize = depth === 0 ? 'w-5 h-5' : depth === 1 ? 'w-4 h-4' : 'w-3.5 h-3.5';
  const indent = depth * 24 + (depth > 0 ? 12 : 0);

  return (
    <div>
      <div
        className="flex items-center gap-3 p-2.5 hover:bg-surface-container-low rounded-lg transition-colors group"
        style={{ paddingLeft: `${12 + indent}px` }}
      >
        {/* Toggle expand */}
        {children.length > 0 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-outline hover:text-primary transition-colors shrink-0"
          >
            <span className={`material-symbols-outlined text-[16px] transition-transform ${expanded ? 'rotate-90' : ''}`}>
              chevron_right
            </span>
          </button>
        )}
        {children.length === 0 && depth > 0 && <div className="w-4 shrink-0" />}

        {/* Checkbox */}
        <button
          onClick={toggleDone}
          className={`${checkboxSize} rounded border-2 flex items-center justify-center shrink-0 transition-all ${
            isDone
              ? 'border-tertiary bg-tertiary'
              : 'border-outline-variant hover:border-primary'
          }`}
        >
          {isDone && <span className={`material-symbols-outlined text-on-tertiary icon-fill`} style={{ fontSize: '11px' }}>check</span>}
        </button>

        <div className="flex-1 flex items-center justify-between min-w-0 gap-2">
          <span
            className={`font-work-sans text-sm ${
              isDone ? 'line-through text-outline' : depth === 0 ? 'font-semibold text-on-surface' : 'text-on-surface-variant'
            }`}
          >
            {task.title}
          </span>

          <div className="flex items-center gap-1.5 shrink-0">
            {task.status !== 'todo' && (
              <span className={`font-inter text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase ${STATUS_BG[task.status] ?? STATUS_BG.todo}`}>
                {task.status.replace('_', ' ')}
              </span>
            )}
            {task.tags[0] && <TagChip tag={task.tags[0]} size="sm" />}
          </div>
        </div>

        {/* Hover actions */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
          <button
            onClick={() => onAddSubtask(task.id)}
            className="p-1 rounded hover:bg-surface-container text-on-surface-variant hover:text-primary transition-colors"
            title="Add subtask"
          >
            <span className="material-symbols-outlined text-[14px]">add</span>
          </button>
          <button
            onClick={() => onEditTask(task)}
            className="p-1 rounded hover:bg-surface-container text-on-surface-variant hover:text-primary transition-colors"
            title="Edit"
          >
            <span className="material-symbols-outlined text-[14px]">edit</span>
          </button>
        </div>
      </div>

      {/* Nested children */}
      {expanded && children.length > 0 && (
        <div className="border-l border-surface-container ml-6">
          {children.map((child) => (
            <SubtaskItem
              key={child.id}
              task={child}
              depth={depth + 1}
              onAddSubtask={onAddSubtask}
              onEditTask={onEditTask}
            />
          ))}
        </div>
      )}
    </div>
  );
}
