import { useNavigate } from 'react-router-dom';
import TagChip from '../ui/TagChip';
import type { Task, IssueType } from '../../types';
import { useTasksStore } from '../../store/tasksStore';
import { formatDisplayDate, isOverdue, isDueSoon } from '../../utils/dateUtils';

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

const ISSUE_CONFIG: Record<IssueType, { label: string; icon: string; cls: string }> = {
  epic:    { label: 'Epic',    icon: 'bolt',                        cls: 'bg-purple-100 text-purple-700' },
  story:   { label: 'Story',   icon: 'bookmark',                   cls: 'bg-blue-100 text-blue-700' },
  task:    { label: 'Task',    icon: 'task_alt',                   cls: 'bg-surface-container text-on-surface-variant' },
  bug:     { label: 'Bug',     icon: 'bug_report',                 cls: 'bg-red-100 text-red-700' },
  subtask: { label: 'Subtask', icon: 'subdirectory_arrow_right',   cls: 'bg-gray-100 text-gray-600' },
};

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  isDone?: boolean;
}

export default function TaskCard({ task, onEdit, isDone = false }: TaskCardProps) {
  const navigate = useNavigate();
  const getSubtasks = useTasksStore((s) => s.getSubtasks);
  const moveTask = useTasksStore((s) => s.moveTask);
  const columns = useTasksStore((s) => s.columns);

  const subtaskCount = getSubtasks(task.id).length;
  const doneSubtasks = getSubtasks(task.id).filter((s) => s.status === 'done').length;

  const overdue = isOverdue(task.dueDate);
  const dueSoon = isDueSoon(task.dueDate);

  const sortedCols = [...columns].sort((a, b) => a.order - b.order);
  const currentIdx = sortedCols.findIndex((c) => c.id === task.status);
  const nextCol = currentIdx >= 0 && currentIdx < sortedCols.length - 1 ? sortedCols[currentIdx + 1] : null;

  const issueType = task.issueType ?? 'task';
  const ic = ISSUE_CONFIG[issueType];

  return (
    <div
      className={`bg-surface-container-lowest rounded-xl p-4 shadow-card border border-transparent hover:border-primary-fixed-dim transition-all duration-200 cursor-pointer group relative ${
        isDone ? 'opacity-60' : ''
      } ${task.status === 'in_progress' ? 'border-l-4 border-l-primary' : ''}`}
      onClick={() => navigate(`/tasks/${task.id}`)}
    >
      {/* Top row: issue type badge + priority icon */}
      <div className="flex justify-between items-start mb-2">
        <span className={`flex items-center gap-1 px-2 py-0.5 rounded font-inter font-semibold text-[10px] uppercase tracking-wide ${ic.cls}`}>
          <span className="material-symbols-outlined text-[12px]">{ic.icon}</span>
          {ic.label}
        </span>
        <span className={`material-symbols-outlined text-[20px] ${PRIORITY_COLOR[task.priority]}`}>
          {PRIORITY_ICON[task.priority]}
        </span>
      </div>

      <h4 className={`font-inter font-medium text-sm text-on-surface mb-3 ${isDone ? 'line-through' : ''}`}>
        {task.title}
      </h4>

      {/* Bottom row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {task.dueDate && (
            <span className={`font-inter text-[10px] flex items-center gap-0.5 ${overdue ? 'text-error' : dueSoon ? 'text-amber-500' : 'text-outline'}`}>
              <span className="material-symbols-outlined text-[12px]">event</span>
              {formatDisplayDate(task.dueDate)}
            </span>
          )}
          {task.storyPoints && (
            <span className="font-inter text-[10px] text-outline bg-surface-container px-1.5 py-0.5 rounded font-bold">
              {task.storyPoints}pt
            </span>
          )}
          {task.recurring && (
            <span className="font-inter text-[10px] text-secondary flex items-center gap-0.5">
              <span className="material-symbols-outlined text-[12px]">repeat</span>
              {task.recurring.frequency}
            </span>
          )}
          {task.tags[0] && <TagChip tag={task.tags[0]} size="sm" />}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {subtaskCount > 0 && (
            <span className="text-outline text-[11px] font-inter flex items-center gap-0.5">
              <span className="material-symbols-outlined text-[13px]">account_tree</span>
              {doneSubtasks}/{subtaskCount}
            </span>
          )}
          {nextCol && !isDone && (
            <button
              onClick={(e) => { e.stopPropagation(); moveTask(task.id, nextCol.id); }}
              className="flex items-center gap-0.5 px-2 py-0.5 bg-primary/10 text-primary rounded font-inter text-[10px] font-semibold hover:bg-primary/20 transition-colors"
              title={`Move to ${nextCol.name}`}
            >
              {nextCol.name} <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
            </button>
          )}
        </div>
      </div>

      {/* Edit button on hover */}
      <button
        onClick={(e) => { e.stopPropagation(); onEdit(task); }}
        className="absolute top-3 right-8 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-surface-container text-on-surface-variant"
      >
        <span className="material-symbols-outlined text-[16px]">edit</span>
      </button>
    </div>
  );
}
