import { useState, useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import {
  DndContext, closestCenter, PointerSensor, TouchSensor,
  useSensor, useSensors, useDraggable, useDroppable, DragOverlay,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import TopBar from '../components/layout/TopBar';
import { formatDisplayDate, localDateString, isOverdue, isDueSoon } from '../utils/dateUtils';
import TaskModal from '../components/tasks/TaskModal';
import TagManager from '../components/ui/TagManager';
import Modal from '../components/ui/Modal';
import { useTasksStore } from '../store/tasksStore';
import { useSprintStore } from '../store/sprintStore';
import { useTagStore } from '../store/tagStore';
import type { Task, IssueType, Sprint } from '../types';

// ─── Config ───────────────────────────────────────────────────────────────────

const ISSUE_CONFIG: Record<IssueType, { label: string; icon: string; color: string; bg: string }> = {
  epic:    { label: 'Epic',    icon: 'bolt',                     color: 'text-purple-700 dark:text-purple-300', bg: 'bg-purple-100 dark:bg-purple-950/40' },
  story:   { label: 'Story',   icon: 'bookmark',                 color: 'text-blue-700 dark:text-blue-300',     bg: 'bg-blue-100 dark:bg-blue-950/40'     },
  task:    { label: 'Task',    icon: 'task_alt',                 color: 'text-on-surface-variant',              bg: 'bg-surface-container'                 },
  bug:     { label: 'Bug',     icon: 'bug_report',               color: 'text-red-700 dark:text-red-300',       bg: 'bg-red-100 dark:bg-red-950/40'       },
  subtask: { label: 'Subtask', icon: 'subdirectory_arrow_right', color: 'text-on-surface-variant',              bg: 'bg-surface-container-low'             },
};

// ─── Epic colour palette (8 hues, light+dark safe) ───────────────────────────

const EPIC_COLORS = [
  { // 0 purple
    wrap:        'border-purple-200  dark:border-purple-900/60  bg-purple-50  dark:bg-purple-950/20',
    drag:        'text-purple-300    dark:text-purple-700',
    chevron:     'text-purple-500    dark:text-purple-400',
    icon:        'text-purple-600    dark:text-purple-400',
    title:       'text-purple-900    dark:text-purple-200',
    count:       'text-purple-600    dark:text-purple-400  bg-purple-100  dark:bg-purple-950/40',
    status:      'text-purple-700    dark:text-purple-300  bg-purple-100  dark:bg-purple-950/50  border-purple-300  dark:border-purple-800',
    checkBorder: 'border-purple-400  dark:border-purple-600',
    divider:     'border-purple-200  dark:border-purple-900/50',
    progBg:      'bg-purple-100      dark:bg-purple-900/40',
    progFill:    'bg-purple-500      dark:bg-purple-400',
    addBtn:      'text-purple-600    dark:text-purple-400  hover:bg-purple-100  dark:hover:bg-purple-900/30',
    itemCount:   'text-purple-400    dark:text-purple-600',
  },
  { // 1 blue
    wrap:        'border-blue-200    dark:border-blue-900/60    bg-blue-50    dark:bg-blue-950/20',
    drag:        'text-blue-300      dark:text-blue-700',
    chevron:     'text-blue-500      dark:text-blue-400',
    icon:        'text-blue-600      dark:text-blue-400',
    title:       'text-blue-900      dark:text-blue-200',
    count:       'text-blue-600      dark:text-blue-400    bg-blue-100    dark:bg-blue-950/40',
    status:      'text-blue-700      dark:text-blue-300    bg-blue-100    dark:bg-blue-950/50    border-blue-300    dark:border-blue-800',
    checkBorder: 'border-blue-400    dark:border-blue-600',
    divider:     'border-blue-200    dark:border-blue-900/50',
    progBg:      'bg-blue-100        dark:bg-blue-900/40',
    progFill:    'bg-blue-500        dark:bg-blue-400',
    addBtn:      'text-blue-600      dark:text-blue-400    hover:bg-blue-100    dark:hover:bg-blue-900/30',
    itemCount:   'text-blue-400      dark:text-blue-600',
  },
  { // 2 emerald
    wrap:        'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/20',
    drag:        'text-emerald-300   dark:text-emerald-700',
    chevron:     'text-emerald-500   dark:text-emerald-400',
    icon:        'text-emerald-600   dark:text-emerald-400',
    title:       'text-emerald-900   dark:text-emerald-200',
    count:       'text-emerald-600   dark:text-emerald-400  bg-emerald-100 dark:bg-emerald-950/40',
    status:      'text-emerald-700   dark:text-emerald-300  bg-emerald-100 dark:bg-emerald-950/50  border-emerald-300 dark:border-emerald-800',
    checkBorder: 'border-emerald-400 dark:border-emerald-600',
    divider:     'border-emerald-200 dark:border-emerald-900/50',
    progBg:      'bg-emerald-100     dark:bg-emerald-900/40',
    progFill:    'bg-emerald-500     dark:bg-emerald-400',
    addBtn:      'text-emerald-600   dark:text-emerald-400  hover:bg-emerald-100 dark:hover:bg-emerald-900/30',
    itemCount:   'text-emerald-400   dark:text-emerald-600',
  },
  { // 3 amber
    wrap:        'border-amber-200   dark:border-amber-900/60   bg-amber-50   dark:bg-amber-950/20',
    drag:        'text-amber-300     dark:text-amber-700',
    chevron:     'text-amber-500     dark:text-amber-400',
    icon:        'text-amber-600     dark:text-amber-400',
    title:       'text-amber-900     dark:text-amber-200',
    count:       'text-amber-700     dark:text-amber-300    bg-amber-100   dark:bg-amber-950/40',
    status:      'text-amber-700     dark:text-amber-300    bg-amber-100   dark:bg-amber-950/50    border-amber-300   dark:border-amber-800',
    checkBorder: 'border-amber-400   dark:border-amber-600',
    divider:     'border-amber-200   dark:border-amber-900/50',
    progBg:      'bg-amber-100       dark:bg-amber-900/40',
    progFill:    'bg-amber-500       dark:bg-amber-400',
    addBtn:      'text-amber-600     dark:text-amber-400    hover:bg-amber-100    dark:hover:bg-amber-900/30',
    itemCount:   'text-amber-400     dark:text-amber-600',
  },
  { // 4 rose
    wrap:        'border-rose-200    dark:border-rose-900/60    bg-rose-50    dark:bg-rose-950/20',
    drag:        'text-rose-300      dark:text-rose-700',
    chevron:     'text-rose-500      dark:text-rose-400',
    icon:        'text-rose-600      dark:text-rose-400',
    title:       'text-rose-900      dark:text-rose-200',
    count:       'text-rose-600      dark:text-rose-400    bg-rose-100    dark:bg-rose-950/40',
    status:      'text-rose-700      dark:text-rose-300    bg-rose-100    dark:bg-rose-950/50    border-rose-300    dark:border-rose-800',
    checkBorder: 'border-rose-400    dark:border-rose-600',
    divider:     'border-rose-200    dark:border-rose-900/50',
    progBg:      'bg-rose-100        dark:bg-rose-900/40',
    progFill:    'bg-rose-500        dark:bg-rose-400',
    addBtn:      'text-rose-600      dark:text-rose-400    hover:bg-rose-100    dark:hover:bg-rose-900/30',
    itemCount:   'text-rose-400      dark:text-rose-600',
  },
  { // 5 cyan
    wrap:        'border-cyan-200    dark:border-cyan-900/60    bg-cyan-50    dark:bg-cyan-950/20',
    drag:        'text-cyan-300      dark:text-cyan-700',
    chevron:     'text-cyan-500      dark:text-cyan-400',
    icon:        'text-cyan-600      dark:text-cyan-400',
    title:       'text-cyan-900      dark:text-cyan-200',
    count:       'text-cyan-600      dark:text-cyan-400    bg-cyan-100    dark:bg-cyan-950/40',
    status:      'text-cyan-700      dark:text-cyan-300    bg-cyan-100    dark:bg-cyan-950/50    border-cyan-300    dark:border-cyan-800',
    checkBorder: 'border-cyan-400    dark:border-cyan-600',
    divider:     'border-cyan-200    dark:border-cyan-900/50',
    progBg:      'bg-cyan-100        dark:bg-cyan-900/40',
    progFill:    'bg-cyan-500        dark:bg-cyan-400',
    addBtn:      'text-cyan-600      dark:text-cyan-400    hover:bg-cyan-100    dark:hover:bg-cyan-900/30',
    itemCount:   'text-cyan-400      dark:text-cyan-600',
  },
  { // 6 indigo
    wrap:        'border-indigo-200  dark:border-indigo-900/60  bg-indigo-50  dark:bg-indigo-950/20',
    drag:        'text-indigo-300    dark:text-indigo-700',
    chevron:     'text-indigo-500    dark:text-indigo-400',
    icon:        'text-indigo-600    dark:text-indigo-400',
    title:       'text-indigo-900    dark:text-indigo-200',
    count:       'text-indigo-600    dark:text-indigo-400  bg-indigo-100  dark:bg-indigo-950/40',
    status:      'text-indigo-700    dark:text-indigo-300  bg-indigo-100  dark:bg-indigo-950/50  border-indigo-300  dark:border-indigo-800',
    checkBorder: 'border-indigo-400  dark:border-indigo-600',
    divider:     'border-indigo-200  dark:border-indigo-900/50',
    progBg:      'bg-indigo-100      dark:bg-indigo-900/40',
    progFill:    'bg-indigo-500      dark:bg-indigo-400',
    addBtn:      'text-indigo-600    dark:text-indigo-400  hover:bg-indigo-100  dark:hover:bg-indigo-900/30',
    itemCount:   'text-indigo-400    dark:text-indigo-600',
  },
  { // 7 fuchsia
    wrap:        'border-fuchsia-200 dark:border-fuchsia-900/60 bg-fuchsia-50 dark:bg-fuchsia-950/20',
    drag:        'text-fuchsia-300   dark:text-fuchsia-700',
    chevron:     'text-fuchsia-500   dark:text-fuchsia-400',
    icon:        'text-fuchsia-600   dark:text-fuchsia-400',
    title:       'text-fuchsia-900   dark:text-fuchsia-200',
    count:       'text-fuchsia-600   dark:text-fuchsia-400  bg-fuchsia-100 dark:bg-fuchsia-950/40',
    status:      'text-fuchsia-700   dark:text-fuchsia-300  bg-fuchsia-100 dark:bg-fuchsia-950/50  border-fuchsia-300 dark:border-fuchsia-800',
    checkBorder: 'border-fuchsia-400 dark:border-fuchsia-600',
    divider:     'border-fuchsia-200 dark:border-fuchsia-900/50',
    progBg:      'bg-fuchsia-100     dark:bg-fuchsia-900/40',
    progFill:    'bg-fuchsia-500     dark:bg-fuchsia-400',
    addBtn:      'text-fuchsia-600   dark:text-fuchsia-400  hover:bg-fuchsia-100 dark:hover:bg-fuchsia-900/30',
    itemCount:   'text-fuchsia-400   dark:text-fuchsia-600',
  },
] as const;

function epicColorIndex(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffffffff;
  return Math.abs(h) % EPIC_COLORS.length;
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  critical: { label: 'Emergency', color: 'text-red-600' },
  high:     { label: 'High',      color: 'text-orange-500' },
  medium:   { label: 'Medium',    color: 'text-amber-500' },
  low:      { label: 'Low',       color: 'text-blue-500' },
  none:     { label: '',          color: '' },
};

type BoardSort = 'manual' | 'priority' | 'due_date' | 'deadline';

const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, none: 4 };

const BOARD_SORT_MODES: BoardSort[] = ['manual', 'priority', 'due_date', 'deadline'];

const BOARD_SORT_CONFIG: Record<BoardSort, { icon: string; label: string }> = {
  manual:   { icon: 'sort',          label: 'Manual order' },
  priority: { icon: 'priority_high', label: 'Priority' },
  due_date: { icon: 'event',         label: 'Due date' },
  deadline: { icon: 'alarm',         label: 'Deadline time' },
};

function sortBoardTasks(taskList: Task[], mode: BoardSort): Task[] {
  if (mode === 'manual') return taskList;
  return [...taskList].sort((a, b) => {
    if (mode === 'priority') return (PRIORITY_ORDER[a.priority] ?? 4) - (PRIORITY_ORDER[b.priority] ?? 4);
    if (mode === 'due_date') {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    }
    if (mode === 'deadline') {
      if (!a.deadlineTime && !b.deadlineTime) return 0;
      if (!a.deadlineTime) return 1;
      if (!b.deadlineTime) return -1;
      return a.deadlineTime.localeCompare(b.deadlineTime);
    }
    return 0;
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timelineDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  if (date.getTime() === today.getTime()) return 'Today';
  if (date.getTime() === tomorrow.getTime()) return 'Tomorrow';
  const currentYear = new Date().getFullYear();
  return date.getFullYear() === currentYear
    ? format(date, 'EEE, MMM d')
    : format(date, 'EEE, MMM d, yyyy');
}

function compactDate(dueDate: string): string {
  const d = formatDisplayDate(dueDate);
  if (['Today', 'Tomorrow', 'Yesterday'].includes(d)) return d;
  return d.replace(/,\s*\d{4}$/, ''); // "May 6, 2026" → "May 6"
}

function fmtSprintDate(d: string): string {
  const [y, m, day] = d.split('-').map(Number);
  return format(new Date(y, m - 1, day), 'MMM d');
}

function DueBadge({ dueDate }: { dueDate: string | null }) {
  if (!dueDate) return null;
  const overdue = isOverdue(dueDate);
  const soon = isDueSoon(dueDate);
  return (
    <span className={`font-inter text-[10px] font-semibold shrink-0 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${
      overdue ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30' :
      soon    ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30' :
                'text-outline bg-surface-container'
    }`}>
      <span className="material-symbols-outlined text-[10px]">event</span>
      {compactDate(dueDate)}
    </span>
  );
}

function getDescendants(taskId: string, allTasks: Task[]): Task[] {
  const children = allTasks.filter((t) => t.parentId === taskId);
  return children.flatMap((c) => [c, ...getDescendants(c.id, allTasks)]);
}

// ─── TaskRow ──────────────────────────────────────────────────────────────────

function TaskRow({
  task, depth = 0, tasks, onEdit, onAddChild, dragHandleProps,
}: {
  task: Task; depth?: number; tasks: Task[]; onEdit: (t: Task) => void;
  onAddChild: (parentId: string, type: IssueType, scopeEpicId?: string) => void;
  dragHandleProps?: React.HTMLAttributes<HTMLElement>;
}) {
  const { updateTask } = useTasksStore();
  const [expanded, setExpanded] = useState(true);
  const children = tasks
    .filter((t) => t.parentId === task.id)
    .sort((a, b) => {
      const aDone = a.status === 'done' ? 1 : 0;
      const bDone = b.status === 'done' ? 1 : 0;
      return aDone !== bDone ? aDone - bDone : a.order - b.order;
    });
  const cfg = ISSUE_CONFIG[task.issueType] ?? ISSUE_CONFIG.task;
  const pri = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.none;
  const doneChildren = children.filter((c) => c.status === 'done').length;

  const childTypes: IssueType[] = task.issueType === 'story'
    ? ['task', 'subtask', 'bug']
    : task.issueType === 'task' || task.issueType === 'bug'
    ? ['subtask']
    : [];

  const scopeEpic = task.issueType === 'story'
    ? (task.parentId ?? undefined)
    : task.issueType === 'task' || task.issueType === 'bug'
    ? (tasks.find((t) => t.id === task.parentId)?.parentId ?? undefined)
    : undefined;

  return (
    <div>
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-surface-container group transition-colors ${
          depth === 0 ? 'border border-outline-variant/30' : ''
        }`}
        style={{ marginLeft: depth * 20 }}
      >
        {/* Drag handle */}
        {dragHandleProps && (
          <span
            {...dragHandleProps}
            className="material-symbols-outlined text-[14px] text-outline/50 cursor-grab shrink-0 touch-none"
          >
            drag_indicator
          </span>
        )}

        {/* Expand toggle */}
        {children.length > 0 ? (
          <button onClick={() => setExpanded((v) => !v)} className="shrink-0 text-outline">
            <span className={`material-symbols-outlined text-[14px] transition-transform ${expanded ? 'rotate-90' : ''}`}>
              chevron_right
            </span>
          </button>
        ) : (
          <div className="w-3.5 shrink-0" />
        )}

        {/* Issue badge */}
        <span className={`font-inter text-[10px] font-bold px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color} shrink-0`}>
          {cfg.label.toUpperCase()}
        </span>

        {/* Story completion count */}
        {task.issueType === 'story' && children.length > 0 && (
          <span className="font-inter text-[10px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 px-1.5 py-0.5 rounded-full shrink-0">
            {doneChildren}/{children.length}
          </span>
        )}

        {/* Title */}
        <span
          className="flex-1 font-work-sans text-sm text-on-surface truncate cursor-pointer min-w-0"
          onClick={() => onEdit(task)}
        >
          {task.title}
        </span>

        {/* Due date */}
        {task.status !== 'done' && <DueBadge dueDate={task.dueDate} />}

        {/* Priority */}
        {task.priority !== 'none' && (
          <span className={`font-inter text-[10px] font-semibold shrink-0 ${pri.color}`}>{pri.label}</span>
        )}

        {/* Status pill */}
        <span className="font-inter text-[10px] text-outline shrink-0 bg-surface-container px-1.5 py-0.5 rounded-full">
          {task.status.replace('_', ' ')}
        </span>

        {/* Quick done toggle */}
        <button
          onClick={() => updateTask(task.id, { status: task.status === 'done' ? 'todo' : 'done' })}
          className={`shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
            task.status === 'done' ? 'border-tertiary bg-tertiary' : 'border-outline-variant hover:border-primary'
          }`}
        >
          {task.status === 'done' && <span className="material-symbols-outlined text-[9px] text-on-tertiary icon-fill">check</span>}
        </button>

        {childTypes.length > 0 && (
          <button
            onClick={() => onAddChild(task.id, childTypes[0], scopeEpic)}
            className="opacity-40 hover:opacity-100 active:opacity-100 transition-opacity p-1 text-outline hover:text-primary"
            title={`Add ${childTypes[0]}`}
          >
            <span className="material-symbols-outlined text-[14px]">add</span>
          </button>
        )}
      </div>

      {/* Children */}
      {expanded && children.map((child) => (
        <TaskRow key={child.id} task={child} depth={depth + 1} tasks={tasks} onEdit={onEdit} onAddChild={onAddChild} />
      ))}
    </div>
  );
}

// ─── SortableTaskRow ──────────────────────────────────────────────────────────

function SortableTaskRow(props: React.ComponentProps<typeof TaskRow>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: props.task.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style}>
      <TaskRow {...props} dragHandleProps={{ ...attributes, ...listeners } as React.HTMLAttributes<HTMLElement>} />
    </div>
  );
}

// ─── EpicSection ─────────────────────────────────────────────────────────────

function EpicSection({
  epic, tasks, onEdit, onAddChild, dragHandleProps, colorIdx,
}: {
  epic: Task; tasks: Task[]; onEdit: (t: Task) => void;
  onAddChild: (parentId: string, type: IssueType, scopeEpicId?: string) => void;
  dragHandleProps?: React.HTMLAttributes<HTMLElement>;
  colorIdx: number;
}) {
  const c = EPIC_COLORS[colorIdx];
  const { updateTask, reorderItems } = useTasksStore();
  const [expanded, setExpanded] = useState(false);

  const directChildren = useMemo(
    () => tasks
      .filter((t) => t.parentId === epic.id)
      .sort((a, b) => {
        const aDone = a.status === 'done' ? 1 : 0;
        const bDone = b.status === 'done' ? 1 : 0;
        return aDone !== bDone ? aDone - bDone : a.order - b.order;
      }),
    [tasks, epic.id],
  );

  const descendants = useMemo(() => getDescendants(epic.id, tasks), [epic.id, tasks]);
  const total = descendants.length;
  const done = descendants.filter((t) => t.status === 'done').length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const storyCount = directChildren.filter((item) => item.issueType === 'story').length;
  const taskCount = directChildren.filter((item) => item.issueType === 'task' || item.issueType === 'bug').length;

  const childSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  );

  function handleChildDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = directChildren.findIndex((item) => item.id === active.id);
    const newIdx = directChildren.findIndex((item) => item.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    reorderItems(arrayMove(directChildren, oldIdx, newIdx).map((item) => item.id));
  }

  return (
    <div className={`rounded-2xl border ${c.wrap} overflow-hidden`}>
      {/* Epic header */}
      <div className="flex items-center gap-2 px-4 py-3">
        {dragHandleProps && (
          <span
            {...dragHandleProps}
            className={`material-symbols-outlined text-[16px] ${c.drag} cursor-grab shrink-0 touch-none`}
          >
            drag_indicator
          </span>
        )}

        <button onClick={() => setExpanded((v) => !v)} className={`${c.chevron} shrink-0`}>
          <span className={`material-symbols-outlined text-[18px] transition-transform ${expanded ? 'rotate-90' : ''}`}>
            chevron_right
          </span>
        </button>
        <span className={`material-symbols-outlined text-[18px] ${c.icon} shrink-0`}>bolt</span>

        <div className="flex-1 min-w-0 sm:flex sm:items-center sm:gap-2">
          <span
            className={`font-inter font-bold text-sm ${c.title} cursor-pointer truncate block sm:flex-1 sm:min-w-0`}
            onClick={() => onEdit(epic)}
          >
            {epic.title}
          </span>
          <div className="flex items-center gap-1.5 mt-0.5 sm:mt-0 flex-wrap shrink-0">
            {epic.status !== 'done' && <DueBadge dueDate={epic.dueDate} />}
            {(storyCount > 0 || taskCount > 0) && (
              <span className={`font-inter text-[9px] px-1.5 py-0.5 rounded-full ${c.count}`}>
                {[
                  storyCount > 0 && `${storyCount} ${storyCount === 1 ? 'story' : 'stories'}`,
                  taskCount > 0 && `${taskCount} ${taskCount === 1 ? 'task' : 'tasks'}`,
                ].filter(Boolean).join(' · ')}
              </span>
            )}
            {total > 0 && (
              <span className={`font-inter text-[9px] font-bold ${c.icon}`}>{pct}%</span>
            )}
            <span className={`font-inter text-[9px] border ${c.status} px-1.5 py-0.5 rounded-full`}>
              {epic.status.replace('_', ' ')}
            </span>
          </div>
        </div>

        <button
          onClick={() => updateTask(epic.id, { status: epic.status === 'done' ? 'todo' : 'done' })}
          className={`shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
            epic.status === 'done' ? 'border-tertiary bg-tertiary' : c.checkBorder
          }`}
        >
          {epic.status === 'done' && <span className="material-symbols-outlined text-[9px] text-on-tertiary icon-fill">check</span>}
        </button>

      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="mx-4 mb-0.5">
          <div className={`h-1 ${c.progBg} rounded-full overflow-hidden`}>
            <div className={`h-full ${c.progFill} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {/* Children + add buttons inside expanded panel */}
      {expanded && (
        <div className={`border-t ${c.divider}`}>
          {directChildren.length > 0 && (
            <div className="px-4 pt-2 pb-1 space-y-1">
              <DndContext sensors={childSensors} collisionDetection={closestCenter} onDragEnd={handleChildDragEnd}>
                <SortableContext items={directChildren.map((item) => item.id)} strategy={verticalListSortingStrategy}>
                  {directChildren.map((child) => (
                    <SortableTaskRow
                      key={child.id}
                      task={child}
                      depth={0}
                      tasks={tasks}
                      onEdit={onEdit}
                      onAddChild={onAddChild}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>
          )}

          <div className="flex items-center gap-2 px-4 py-2">
            <button
              onClick={() => onAddChild(epic.id, 'story', epic.id)}
              className={`flex items-center gap-1 ${c.addBtn} rounded-lg px-2 py-1 transition-colors font-inter text-xs font-semibold`}
            >
              <span className="material-symbols-outlined text-[14px]">add</span>
              Story
            </button>
            <button
              onClick={() => onAddChild(epic.id, 'task', epic.id)}
              className={`flex items-center gap-1 ${c.addBtn} rounded-lg px-2 py-1 transition-colors font-inter text-xs font-semibold`}
            >
              <span className="material-symbols-outlined text-[14px]">add</span>
              Task
            </button>
            <span className={`font-inter text-xs ${c.itemCount} ml-auto`}>{directChildren.length} items</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SortableEpicSection ──────────────────────────────────────────────────────

function SortableEpicSection(props: React.ComponentProps<typeof EpicSection>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: props.epic.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style}>
      <EpicSection {...props} dragHandleProps={{ ...attributes, ...listeners } as React.HTMLAttributes<HTMLElement>} />
    </div>
  );
}

// ─── Board card ───────────────────────────────────────────────────────────────

function findEpicAncestor(task: Task, allTasks: Task[]): Task | null {
  if (task.issueType === 'epic') return null;
  let current = allTasks.find((t) => t.id === task.parentId);
  while (current) {
    if (current.issueType === 'epic') return current;
    if (!current.parentId) return null;
    current = allTasks.find((t) => t.id === current!.parentId);
  }
  return null;
}

function findNearestStory(task: Task, allTasks: Task[]): Task | null {
  if (task.issueType === 'story') return task;
  let cur: Task | undefined = task.parentId ? allTasks.find((t) => t.id === task.parentId) : undefined;
  while (cur) {
    if (cur.issueType === 'epic') return null;
    if (cur.issueType === 'story') return cur;
    cur = cur.parentId ? allTasks.find((t) => t.id === cur!.parentId) : undefined;
  }
  return null;
}

interface StoryHGroup { story: Task; tasks: Task[] }
interface EpicHGroup { epic: Task | null; stories: StoryHGroup[]; directTasks: Task[] }

function buildHierarchyGroups(filteredTasks: Task[], allTasks: Task[]): EpicHGroup[] {
  const epicMap = new Map<string | null, Task[]>();
  for (const t of filteredTasks) {
    const epicId = findEpicAncestor(t, allTasks)?.id ?? null;
    if (!epicMap.has(epicId)) epicMap.set(epicId, []);
    epicMap.get(epicId)!.push(t);
  }
  return [...epicMap.entries()]
    .map(([epicId, epicTasks]) => {
      const epic = epicId ? allTasks.find((t) => t.id === epicId) ?? null : null;
      const storyMap = new Map<string | null, Task[]>();
      for (const t of epicTasks) {
        const storyId = findNearestStory(t, allTasks)?.id ?? null;
        if (!storyMap.has(storyId)) storyMap.set(storyId, []);
        storyMap.get(storyId)!.push(t);
      }
      const directTasks = storyMap.get(null) ?? [];
      const stories: StoryHGroup[] = [...storyMap.entries()]
        .filter(([id]) => id !== null)
        .map(([storyId, members]) => ({
          story: allTasks.find((t) => t.id === storyId)!,
          tasks: members.filter((t) => t.id !== storyId),
        }))
        .sort((a, b) => a.story.order - b.story.order);
      return { epic, stories, directTasks };
    })
    .sort((a, b) => {
      if (!a.epic && !b.epic) return 0;
      if (!a.epic) return 1;
      if (!b.epic) return -1;
      return a.epic.order - b.epic.order;
    });
}

function BoardCard({ task, tasks, onEdit, inSprint = false, showCheck = false }: { task: Task; tasks: Task[]; onEdit: (t: Task) => void; inSprint?: boolean; showCheck?: boolean }) {
  const { moveTask, columns, updateTask } = useTasksStore();
  const { sprints } = useSprintStore();
  const cfg = ISSUE_CONFIG[task.issueType] ?? ISSUE_CONFIG.task;
  const pri = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.none;
  const parent = task.parentId ? tasks.find((t) => t.id === task.parentId) : null;
  const sprint = task.sprintId ? sprints.find((s) => s.id === task.sprintId) : null;
  const epicAncestor = findEpicAncestor(task, tasks);
  // Story is the immediate parent when it's a story type
  const storyParent = parent?.issueType === 'story' ? parent : null;

  const nonBacklogCols = [...columns].sort((a, b) => a.order - b.order).filter((c) => c.id !== 'backlog' && c.id !== 'review');
  const colIdx = nonBacklogCols.findIndex((c) => c.id === task.status);
  const prevCol = colIdx > 0 ? nonBacklogCols[colIdx - 1] : null;
  const nextCol = colIdx >= 0 && colIdx < nonBacklogCols.length - 1 ? nonBacklogCols[colIdx + 1] : null;

  return (
    <div className="bg-surface-container-lowest rounded-xl p-3 shadow-card border border-outline-variant/10">
      {/* Epic + Story breadcrumb */}
      {(epicAncestor || (parent && parent.issueType !== 'epic')) && (
        <div className="flex items-center gap-1 mb-1.5 flex-wrap">
          {epicAncestor && (
            <span className="inline-flex items-center gap-0.5 font-inter text-[10px] font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30 px-1.5 py-0.5 rounded-md max-w-[100px] truncate">
              <span className="material-symbols-outlined text-[10px]">bolt</span>
              <span className="truncate">{epicAncestor.title}</span>
            </span>
          )}
          {storyParent && (
            <span className="inline-flex items-center gap-0.5 font-inter text-[10px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 px-1.5 py-0.5 rounded-md max-w-[100px] truncate">
              <span className="material-symbols-outlined text-[10px]">bookmark</span>
              <span className="truncate">{storyParent.title}</span>
            </span>
          )}
          {parent && parent.issueType !== 'epic' && parent.issueType !== 'story' && (
            <span className="font-inter text-[10px] text-outline truncate max-w-[120px]">{parent.title}</span>
          )}
        </div>
      )}

      <div className="flex items-start gap-2">
        {showCheck && (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); updateTask(task.id, { status: 'done' }); }}
            className="w-5 h-5 mt-0.5 shrink-0 rounded-full border-2 border-outline-variant hover:border-tertiary hover:bg-tertiary/10 transition-colors flex items-center justify-center"
            title="Mark done"
          />
        )}
        <span className={`font-inter text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5 shrink-0 ${cfg.bg} ${cfg.color}`}>
          {cfg.label.slice(0, 3).toUpperCase()}
        </span>
        <p className="flex-1 font-inter font-medium text-sm text-on-surface leading-tight cursor-pointer" onClick={() => onEdit(task)}>
          {task.title}
        </p>
      </div>

      <div className="flex items-center gap-2 mt-2 flex-wrap">
        {task.priority !== 'none' && (
          <span className={`font-inter text-[10px] font-semibold ${pri.color}`}>{pri.label}</span>
        )}
        {task.isStretchGoal && (
          <span className="font-inter text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded-full shrink-0">★ Stretch</span>
        )}
        {task.deadlineTime && (
          <span className="inline-flex items-center gap-0.5 font-inter text-[10px] text-error bg-error/8 px-1.5 py-0.5 rounded-full">
            <span className="material-symbols-outlined text-[10px]">alarm</span>
            {(() => {
              const [h, m] = task.deadlineTime.split(':').map(Number);
              const ampm = h >= 12 ? 'PM' : 'AM';
              const h12 = h % 12 || 12;
              return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
            })()}
          </span>
        )}
        {/* Sprint badge — only shown in board view (not sprint view, where it's implicit) */}
        {sprint && !inSprint && (
          <span className="font-inter text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded-full truncate max-w-[80px]" title={sprint.name}>
            ⚡ {sprint.name}
          </span>
        )}
        <div className="flex-1" />
        {/* Remove from sprint button (only in sprint view) */}
        {inSprint && task.sprintId && (
          <button
            onClick={() => updateTask(task.id, { sprintId: null, status: 'backlog' })}
            className="font-inter text-[10px] text-outline hover:text-error px-1.5 py-0.5 rounded-full transition-colors"
            title="Remove from sprint"
          >
            ✕
          </button>
        )}
        {prevCol && (
          <button
            onClick={() => moveTask(task.id, prevCol.id)}
            className="font-inter text-[10px] font-semibold text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full"
          >
            ← {prevCol.name}
          </button>
        )}
        {nextCol && (
          <button
            onClick={() => moveTask(task.id, nextCol.id)}
            className="font-inter text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full"
          >
            → {nextCol.name}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Sprint Modal ─────────────────────────────────────────────────────────────

function SprintModal({ open, sprint, onClose }: { open: boolean; sprint: Sprint | null; onClose: () => void }) {
  const { addSprint, updateSprint, sprints } = useSprintStore();
  const { tasks, updateTask: updateTaskItem } = useTasksStore();
  const today = localDateString();
  const twoWeeks = localDateString(new Date(Date.now() + 14 * 86400000));

  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(twoWeeks);
  const [status, setStatus] = useState<'planned' | 'active' | 'completed'>('planned');
  const [capacity, setCapacity] = useState<string>('');
  const [selectedCarryoverIds, setSelectedCarryoverIds] = useState<Set<string>>(new Set());
  const [carryoverExpanded, setCarryoverExpanded] = useState(true);

  useEffect(() => {
    if (sprint) {
      setName(sprint.name);
      setGoal(sprint.goal ?? '');
      setStartDate(sprint.startDate);
      setEndDate(sprint.endDate);
      setStatus(sprint.status);
      setCapacity(sprint.capacity != null ? String(sprint.capacity) : '');
    } else {
      setName('');
      setGoal('');
      setStartDate(today);
      setEndDate(twoWeeks);
      setStatus('planned');
      setCapacity('');
      setSelectedCarryoverIds(new Set());
      setCarryoverExpanded(true);
    }
  }, [sprint, open]);

  // Incomplete tasks from completed sprints + backlog — only shown when creating
  const carryoverGroups = useMemo(() => {
    if (sprint) return [];
    const completedSprintMap = new Map(
      sprints.filter(s => s.status === 'completed').map(s => [s.id, s])
    );
    const candidates = tasks.filter(t =>
      t.status !== 'done' &&
      t.status !== 'cancelled' &&
      !t.parentId &&
      (t.sprintId == null || completedSprintMap.has(t.sprintId))
    );
    if (candidates.length === 0) return [];

    const groups: { label: string; sublabel?: string; tasks: Task[] }[] = [];
    // Tasks from completed sprints (most recent first)
    const completedSprints = [...completedSprintMap.values()].sort((a, b) => b.endDate.localeCompare(a.endDate));
    for (const sp of completedSprints) {
      const spTasks = candidates.filter(t => t.sprintId === sp.id);
      if (spTasks.length > 0) groups.push({ label: sp.name, sublabel: `${fmtSprintDate(sp.startDate)} → ${fmtSprintDate(sp.endDate)}`, tasks: spTasks });
    }
    // Unassigned backlog tasks
    const backlogTasks = candidates.filter(t => t.sprintId === null);
    if (backlogTasks.length > 0) groups.push({ label: 'Backlog', tasks: backlogTasks });
    return groups;
  }, [sprint, tasks, sprints]);

  const totalCarryoverCount = carryoverGroups.reduce((sum, g) => sum + g.tasks.length, 0);

  function toggleCarryoverTask(id: string) {
    setSelectedCarryoverIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleCarryoverGroup(groupTasks: Task[]) {
    const ids = groupTasks.map(t => t.id);
    const allSelected = ids.every(id => selectedCarryoverIds.has(id));
    setSelectedCarryoverIds(prev => {
      const next = new Set(prev);
      if (allSelected) ids.forEach(id => next.delete(id));
      else ids.forEach(id => next.add(id));
      return next;
    });
  }

  function handleSave() {
    if (!name.trim()) return;
    const cap = capacity.trim() !== '' ? Number(capacity) : undefined;
    let savedId: string;
    if (sprint) {
      updateSprint(sprint.id, { name: name.trim(), goal: goal.trim() || undefined, startDate, endDate, status, capacity: cap });
      savedId = sprint.id;
    } else {
      const created = addSprint({ name: name.trim(), goal: goal.trim() || undefined, startDate, endDate, status, capacity: cap });
      savedId = created.id;
    }
    // Auto-assign orphan tasks whose due dates fall within this sprint's range
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    function hasEpicAncestor(task: Task): boolean {
      if (!task.parentId) return false;
      const parent = taskMap.get(task.parentId);
      if (!parent) return false;
      return parent.issueType === 'epic' || hasEpicAncestor(parent);
    }
    tasks.forEach(task => {
      if (task.issueType === 'epic' || task.sprintId || !task.dueDate) return;
      if (task.dueDate < startDate || task.dueDate > endDate) return;
      if (hasEpicAncestor(task)) return;
      updateTaskItem(task.id, { sprintId: savedId, status: task.status === 'backlog' ? 'todo' : task.status });
    });
    // Carry over manually selected tasks
    selectedCarryoverIds.forEach(id => {
      updateTaskItem(id, { sprintId: savedId, status: 'todo' });
    });
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={sprint ? 'Edit Sprint' : 'New Sprint'} size={!sprint && totalCarryoverCount > 0 ? 'md' : 'sm'}>
      <div className="p-5 space-y-4 overflow-y-auto">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Sprint name (e.g. May Week 1)"
          autoFocus
          className="w-full bg-surface-container border-none outline-none font-manrope font-bold text-base text-on-surface rounded-lg px-3 py-2 placeholder:text-outline/50"
        />
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="Sprint goal (optional)"
          rows={2}
          className="w-full border border-outline-variant/30 outline-none resize-none font-work-sans text-sm text-on-surface bg-transparent rounded-lg px-3 py-2 placeholder:text-outline/50 focus:border-primary/40"
        />
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="font-inter text-xs font-semibold uppercase tracking-wider text-outline">Start</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-2 font-inter text-sm text-on-surface outline-none" />
          </div>
          <div className="space-y-1">
            <label className="font-inter text-xs font-semibold uppercase tracking-wider text-outline">End</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-2 font-inter text-sm text-on-surface outline-none" />
          </div>
        </div>
        <div className="space-y-1">
          <label className="font-inter text-xs font-semibold uppercase tracking-wider text-outline">
            Capacity <span className="normal-case font-normal">(story points — optional)</span>
          </label>
          <input
            type="number" min="0" step="1"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            placeholder="e.g. 20"
            className="w-full bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-2 font-inter text-sm text-on-surface outline-none focus:border-primary/40"
          />
        </div>
        <div className="space-y-1">
          <label className="font-inter text-xs font-semibold uppercase tracking-wider text-outline">Status</label>
          <div className="flex gap-2">
            {(['planned', 'active', 'completed'] as const).map((s) => (
              <button key={s} onClick={() => setStatus(s)}
                className={`px-3 py-1.5 rounded-lg border font-inter text-xs font-semibold capitalize transition-all ${
                  status === s ? 'bg-primary text-on-primary border-primary' : 'border-outline-variant text-on-surface-variant'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Carry-over section — only when creating and there are incomplete tasks */}
        {!sprint && totalCarryoverCount > 0 && (
          <div className="border border-outline-variant/30 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setCarryoverExpanded(v => !v)}
              className="w-full flex items-center gap-2 px-3 py-2.5 bg-surface-container hover:bg-surface-container-high transition-colors text-left"
            >
              <span className="material-symbols-outlined text-[16px] text-primary">move_down</span>
              <span className="flex-1 font-inter text-xs font-semibold text-on-surface">Carry over incomplete tasks</span>
              {selectedCarryoverIds.size > 0 && (
                <span className="font-inter text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary text-on-primary">
                  {selectedCarryoverIds.size}
                </span>
              )}
              <span className="font-inter text-[10px] text-outline">{totalCarryoverCount} available</span>
              <span className={`material-symbols-outlined text-[16px] text-outline transition-transform ${carryoverExpanded ? 'rotate-180' : ''}`}>expand_more</span>
            </button>

            {carryoverExpanded && (
              <div className="max-h-56 overflow-y-auto divide-y divide-outline-variant/15">
                {carryoverGroups.map((group) => {
                  const allSelected = group.tasks.every(t => selectedCarryoverIds.has(t.id));
                  const someSelected = group.tasks.some(t => selectedCarryoverIds.has(t.id));
                  return (
                    <div key={group.label}>
                      {/* Group header */}
                      <button
                        type="button"
                        onClick={() => toggleCarryoverGroup(group.tasks)}
                        className="w-full flex items-center gap-2 px-3 py-1.5 bg-surface-container-low hover:bg-surface-container text-left transition-colors"
                      >
                        <span className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                          allSelected ? 'bg-primary border-primary' : someSelected ? 'bg-primary/30 border-primary/60' : 'border-outline-variant'
                        }`}>
                          {(allSelected || someSelected) && <span className="material-symbols-outlined text-[10px] text-on-primary icon-fill">check</span>}
                        </span>
                        <span className="flex-1 font-inter text-[11px] font-semibold text-on-surface truncate">{group.label}</span>
                        {group.sublabel && <span className="font-inter text-[10px] text-outline shrink-0">{group.sublabel}</span>}
                        <span className="font-inter text-[10px] text-outline shrink-0">{group.tasks.length}</span>
                      </button>
                      {/* Tasks */}
                      {group.tasks.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => toggleCarryoverTask(t.id)}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-surface-container/50 active:bg-surface-container text-left transition-colors"
                        >
                          <span className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                            selectedCarryoverIds.has(t.id) ? 'bg-primary border-primary' : 'border-outline-variant'
                          }`}>
                            {selectedCarryoverIds.has(t.id) && <span className="material-symbols-outlined text-[10px] text-on-primary icon-fill">check</span>}
                          </span>
                          <span className={`font-inter text-[9px] font-bold px-1 py-0.5 rounded shrink-0 ${(ISSUE_CONFIG[t.issueType] ?? ISSUE_CONFIG.task).bg} ${(ISSUE_CONFIG[t.issueType] ?? ISSUE_CONFIG.task).color}`}>
                            {(ISSUE_CONFIG[t.issueType] ?? ISSUE_CONFIG.task).label.slice(0, 3).toUpperCase()}
                          </span>
                          <span className="flex-1 font-work-sans text-xs text-on-surface truncate">{t.title}</span>
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-on-surface-variant font-inter font-medium text-sm hover:bg-surface-container">Cancel</button>
          <button onClick={handleSave} disabled={!name.trim()}
            className="px-4 py-2 rounded-lg bg-primary text-on-primary font-inter font-medium text-sm hover:opacity-90 disabled:opacity-40">
            {sprint ? 'Save' : 'Create Sprint'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── CompleteSprintModal ──────────────────────────────────────────────────────

function CompleteSprintModal({ open, sprint, incompleteTasks, nextSprint, onClose }: {
  open: boolean;
  sprint: Sprint | null;
  incompleteTasks: Task[];
  nextSprint: Sprint | null;
  onClose: () => void;
}) {
  const { updateTask } = useTasksStore();
  const { updateSprint } = useSprintStore();
  const [destinations, setDestinations] = useState<Record<string, 'backlog' | 'next'>>({});

  useEffect(() => {
    if (open) {
      const defaults: Record<string, 'backlog' | 'next'> = {};
      incompleteTasks.forEach((t) => { defaults[t.id] = nextSprint ? 'next' : 'backlog'; });
      setDestinations(defaults);
    }
  }, [open, incompleteTasks, nextSprint]);

  const handleConfirm = () => {
    if (!sprint) return;
    incompleteTasks.forEach((t) => {
      const dest = destinations[t.id] ?? 'backlog';
      updateTask(t.id, {
        sprintId: dest === 'next' && nextSprint ? nextSprint.id : null,
        status: dest === 'backlog' ? 'backlog' : t.status,
      });
    });
    updateSprint(sprint.id, { status: 'completed' });
    onClose();
  };

  if (!sprint) return null;

  return (
    <Modal open={open} onClose={onClose} title="Complete Sprint">
      <div className="space-y-4">
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
          <p className="font-inter font-semibold text-sm text-on-surface">{sprint.name}</p>
          <p className="font-inter text-xs text-outline mt-0.5">{fmtSprintDate(sprint.startDate)} → {fmtSprintDate(sprint.endDate)}</p>
        </div>

        {incompleteTasks.length === 0 ? (
          <div className="text-center py-4">
            <span className="material-symbols-outlined text-[32px] text-tertiary block mb-2">check_circle</span>
            <p className="font-inter font-semibold text-sm text-on-surface">All tasks completed!</p>
            <p className="font-inter text-xs text-on-surface-variant mt-1">Great sprint — nothing left to roll over.</p>
          </div>
        ) : (
          <div>
            <p className="font-inter text-xs font-semibold uppercase tracking-wider text-outline mb-2">
              {incompleteTasks.length} incomplete — where should they go?
            </p>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {incompleteTasks.map((t) => (
                <div key={t.id} className="flex items-center gap-2 bg-surface-container rounded-xl px-3 py-2">
                  <span className={`font-inter text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${(ISSUE_CONFIG[t.issueType] ?? ISSUE_CONFIG.task).bg} ${(ISSUE_CONFIG[t.issueType] ?? ISSUE_CONFIG.task).color}`}>
                    {(ISSUE_CONFIG[t.issueType] ?? ISSUE_CONFIG.task).label.slice(0, 3).toUpperCase()}
                  </span>
                  <span className="flex-1 font-work-sans text-sm text-on-surface truncate">{t.title}</span>
                  <div className="flex gap-1 shrink-0">
                    {nextSprint && (
                      <button
                        onClick={() => setDestinations((d) => ({ ...d, [t.id]: 'next' }))}
                        className={`px-2 py-0.5 rounded-lg font-inter text-[10px] font-semibold transition-colors ${
                          destinations[t.id] === 'next'
                            ? 'bg-primary text-on-primary'
                            : 'bg-surface-container-high text-on-surface-variant hover:bg-primary/10'
                        }`}
                      >
                        Next Sprint
                      </button>
                    )}
                    <button
                      onClick={() => setDestinations((d) => ({ ...d, [t.id]: 'backlog' }))}
                      className={`px-2 py-0.5 rounded-lg font-inter text-[10px] font-semibold transition-colors ${
                        destinations[t.id] === 'backlog'
                          ? 'bg-surface-container-high text-on-surface'
                          : 'bg-surface-container text-outline hover:bg-surface-container-high'
                      }`}
                    >
                      Backlog
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose}
            className="flex-1 py-2 rounded-xl border border-outline-variant/30 text-on-surface-variant font-inter text-sm font-medium">
            Cancel
          </button>
          <button onClick={handleConfirm}
            className="flex-1 py-2 rounded-xl bg-primary text-on-primary font-inter text-sm font-semibold">
            {incompleteTasks.length === 0 ? 'Complete Sprint' : 'Confirm & Complete'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Sprint task breakdown (shared between active and history cards) ─────────

// Walk up parentId chain to find the nearest story ancestor within a given epic
function findStoryAncestor(task: Task, allTasks: Task[], epicId: string): Task | null {
  if (!task.parentId) return null;
  const parent = allTasks.find((t) => t.id === task.parentId);
  if (!parent || parent.id === epicId) return null;
  if (parent.issueType === 'story') return parent;
  return findStoryAncestor(parent, allTasks, epicId);
}

function BreakdownTaskRow({ task, accentDone }: { task: Task; accentDone: string }) {
  const isDone = task.status === 'done';
  const cfg = ISSUE_CONFIG[task.issueType] ?? ISSUE_CONFIG.task;
  return (
    <div className={`flex items-center gap-2 px-2 py-1 rounded-lg ${isDone ? '' : 'opacity-55'}`}>
      <span className={`material-symbols-outlined text-[13px] shrink-0 ${isDone ? `${accentDone} icon-fill` : 'text-outline'}`}>
        {isDone ? 'check_circle' : 'radio_button_unchecked'}
      </span>
      <span className={`font-inter text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${cfg.bg} ${cfg.color}`}>
        {cfg.label.slice(0, 3).toUpperCase()}
      </span>
      <span className={`font-inter text-xs truncate flex-1 ${isDone ? 'text-on-surface' : 'text-on-surface-variant line-through'}`}>
        {task.title}
      </span>
      {task.priority !== 'none' && (
        <span className={`font-inter text-[10px] shrink-0 ${(PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.none).color}`}>
          {(PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.none).label}
        </span>
      )}
    </div>
  );
}

function SprintTaskBreakdown({ tasks, allTasks, accentDone = 'text-tertiary' }: {
  tasks: Task[];
  allTasks: Task[];
  accentDone?: string;
}) {
  if (tasks.length === 0) {
    return <p className="font-inter text-xs text-outline text-center py-2">No tasks in this sprint</p>;
  }

  // Build epic groups: collect unique epic ancestors referenced by sprint tasks
  const epicIdSet = new Set<string>();
  for (const t of tasks) {
    if (t.issueType === 'epic') { epicIdSet.add(t.id); continue; }
    const epic = findEpicAncestor(t, allTasks);
    if (epic) epicIdSet.add(epic.id);
  }

  type StoryGroup = { story: Task; self: Task | undefined; children: Task[] };
  type EpicGroup  = { epic: Task; self: Task | undefined; storyGroups: StoryGroup[]; direct: Task[] };

  const epicGroups: EpicGroup[] = [...epicIdSet].map((epicId) => {
    const epic = allTasks.find((t) => t.id === epicId)!;
    const self = tasks.find((t) => t.id === epicId);

    // Sprint tasks under this epic (excluding the epic itself)
    const children = tasks.filter((t) => {
      if (t.id === epicId || t.issueType === 'epic') return false;
      return findEpicAncestor(t, allTasks)?.id === epicId;
    });

    // Sub-group by story
    const storyIdSet = new Set<string>();
    const direct: Task[] = [];
    for (const child of children) {
      if (child.issueType === 'story') { storyIdSet.add(child.id); continue; }
      const story = findStoryAncestor(child, allTasks, epicId);
      if (story) storyIdSet.add(story.id);
      else direct.push(child);
    }

    const storyGroups: StoryGroup[] = [...storyIdSet].map((storyId) => {
      const story = allTasks.find((t) => t.id === storyId)!;
      const storySelf = tasks.find((t) => t.id === storyId);
      const storyChildren = children.filter((t) =>
        t.id !== storyId && t.issueType !== 'story' && findStoryAncestor(t, allTasks, epicId)?.id === storyId,
      );
      return { story, self: storySelf, children: storyChildren };
    });

    return { epic, self, storyGroups, direct };
  });

  // Orphans: no epic ancestry
  const orphans = tasks.filter((t) => t.issueType !== 'epic' && !findEpicAncestor(t, allTasks));

  // Flat type groups for orphans
  const flatGroups: { label: string; icon: string; types: IssueType[]; colorClass: string }[] = [
    { label: 'Stories', icon: 'bookmark',   types: ['story'],           colorClass: 'text-blue-600 dark:text-blue-400' },
    { label: 'Tasks',   icon: 'task_alt',   types: ['task', 'subtask'], colorClass: 'text-on-surface-variant' },
    { label: 'Bugs',    icon: 'bug_report', types: ['bug'],             colorClass: 'text-red-600 dark:text-red-400' },
  ];

  const epicCfg   = ISSUE_CONFIG.epic;
  const storyCfg  = ISSUE_CONFIG.story;

  return (
    <div className="space-y-3">
      {/* Hierarchical epic groups */}
      {epicGroups.map(({ epic, self: epicSelf, storyGroups, direct }) => {
        const epicDone = epicSelf?.status === 'done';
        return (
          <div key={epic.id}>
            {/* Epic row */}
            <div className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${epicSelf ? (epicDone ? '' : 'opacity-60') : ''}`}>
              <span className={`material-symbols-outlined text-[13px] shrink-0 ${
                epicSelf ? (epicDone ? `${accentDone} icon-fill` : 'text-outline') : 'text-purple-500'
              }`}>
                {epicSelf ? (epicDone ? 'check_circle' : 'radio_button_unchecked') : 'bolt'}
              </span>
              <span className={`font-inter text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${epicCfg.bg} ${epicCfg.color}`}>
                EPC
              </span>
              <span className={`font-inter text-xs font-semibold truncate flex-1 ${
                epicSelf ? (epicDone ? 'text-on-surface' : 'text-on-surface-variant line-through') : 'text-on-surface'
              }`}>
                {epic.title}
              </span>
            </div>

            {/* Story groups under this epic */}
            {storyGroups.map(({ story, self: storySelf, children }) => {
              const storyDone = storySelf?.status === 'done';
              return (
                <div key={story.id} className="ml-5">
                  {/* Story row */}
                  <div className={`flex items-center gap-2 px-2 py-1 rounded-lg ${storySelf ? (storyDone ? '' : 'opacity-60') : ''}`}>
                    <span className={`material-symbols-outlined text-[13px] shrink-0 ${
                      storySelf ? (storyDone ? `${accentDone} icon-fill` : 'text-outline') : 'text-blue-400'
                    }`}>
                      {storySelf ? (storyDone ? 'check_circle' : 'radio_button_unchecked') : 'bookmark'}
                    </span>
                    <span className={`font-inter text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${storyCfg.bg} ${storyCfg.color}`}>
                      STR
                    </span>
                    <span className={`font-inter text-xs truncate flex-1 ${
                      storySelf ? (storyDone ? 'text-on-surface' : 'text-on-surface-variant line-through') : 'text-on-surface'
                    }`}>
                      {story.title}
                    </span>
                  </div>
                  {/* Tasks under this story */}
                  {children.length > 0 && (
                    <div className="ml-5 space-y-0.5">
                      {children.map((t) => <BreakdownTaskRow key={t.id} task={t} accentDone={accentDone} />)}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Tasks directly under epic (no story) */}
            {direct.length > 0 && (
              <div className="ml-5 space-y-0.5">
                {direct.map((t) => <BreakdownTaskRow key={t.id} task={t} accentDone={accentDone} />)}
              </div>
            )}
          </div>
        );
      })}

      {/* Flat section for orphan tasks */}
      {orphans.length > 0 && (
        <div className={epicGroups.length > 0 ? 'border-t border-outline-variant/15 pt-3' : ''}>
          {flatGroups.map(({ label, icon, types, colorClass }) => {
            const group = orphans.filter((t) => types.includes(t.issueType));
            if (group.length === 0) return null;
            const done = group.filter((t) => t.status === 'done');
            return (
              <div key={label} className="mb-2 last:mb-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`material-symbols-outlined text-[13px] ${colorClass}`}>{icon}</span>
                  <span className={`font-inter text-[10px] font-semibold uppercase tracking-wider ${colorClass}`}>{label}</span>
                  <span className="font-inter text-[10px] text-outline ml-1">{done.length}/{group.length}</span>
                  <div className="flex-1 h-px bg-outline-variant/20 ml-1" />
                </div>
                <div className="space-y-0.5">
                  {group.map((t) => <BreakdownTaskRow key={t.id} task={t} accentDone={accentDone} />)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── SprintHistoryCard ───────────────────────────────────────────────────────

function SprintHistoryCard({
  sprint, tasks, allTasks, doneTasks, pct, onEdit, onDelete,
}: {
  sprint: Sprint;
  tasks: Task[];
  allTasks: Task[];
  doneTasks: Task[];
  pct: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const epicCount  = tasks.filter((t) => t.issueType === 'epic').length;
  const storyCount = tasks.filter((t) => t.issueType === 'story').length;
  const taskCount  = tasks.filter((t) => t.issueType !== 'epic' && t.issueType !== 'story').length;

  return (
    <div className="bg-surface-container-lowest rounded-2xl overflow-hidden border border-outline-variant/20">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-container/60 transition-colors"
      >
        <span className="material-symbols-outlined text-[18px] text-tertiary shrink-0">history</span>
        <div className="flex-1 min-w-0 text-left">
          <p className="font-inter font-semibold text-sm text-on-surface truncate">{sprint.name}</p>
          <p className="font-inter text-xs text-outline">{fmtSprintDate(sprint.startDate)} → {fmtSprintDate(sprint.endDate)}</p>
        </div>
        <span className="font-inter text-[10px] font-bold text-tertiary bg-tertiary/10 px-2 py-0.5 rounded-full shrink-0">
          {doneTasks.length}/{tasks.length} · {pct}%
        </span>
        <span className={`material-symbols-outlined text-[18px] text-outline transition-transform ${expanded ? 'rotate-180' : ''}`}>expand_more</span>
      </button>

      {expanded && (
        <div className="border-t border-outline-variant/20 px-4 pb-4 pt-3 space-y-4">
          {/* Progress bar */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-inter text-xs text-on-surface-variant">{doneTasks.length}/{tasks.length} completed</span>
              <span className="font-inter text-xs font-bold text-tertiary">{pct}%</span>
            </div>
            <div className="h-2 bg-tertiary/10 rounded-full overflow-hidden">
              <div className="h-full bg-tertiary rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>

          {/* Summary chips */}
          {tasks.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {epicCount  > 0 && <span className="font-inter text-[10px] px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300">{epicCount} epic{epicCount !== 1 ? 's' : ''}</span>}
              {storyCount > 0 && <span className="font-inter text-[10px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300">{storyCount} stor{storyCount !== 1 ? 'ies' : 'y'}</span>}
              {taskCount  > 0 && <span className="font-inter text-[10px] px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant">{taskCount} task{taskCount !== 1 ? 's' : ''}</span>}
            </div>
          )}

          {/* Goal */}
          {sprint.goal && (
            <div className="flex items-start gap-2 bg-surface-container rounded-xl px-3 py-2">
              <span className="material-symbols-outlined text-[14px] text-primary shrink-0 mt-0.5">flag</span>
              <p className="font-work-sans text-xs text-on-surface-variant">{sprint.goal}</p>
            </div>
          )}

          {/* Grouped task breakdown */}
          <SprintTaskBreakdown tasks={tasks} allTasks={allTasks} accentDone="text-tertiary" />

          {/* Actions */}
          <div className="flex gap-2 pt-1 border-t border-outline-variant/10">
            <button onClick={onEdit} className="flex items-center gap-1 text-outline hover:text-primary font-inter text-xs">
              <span className="material-symbols-outlined text-[14px]">edit</span>
              Edit
            </button>
            <button onClick={onDelete} className="flex items-center gap-1 text-outline hover:text-error font-inter text-xs ml-auto">
              <span className="material-symbols-outlined text-[14px]">delete</span>
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sprint Backlog row ───────────────────────────────────────────────────────

function SprintBacklogRow({
  task, tasks, isStretch = false, onEdit, onToggleStretch, onRemove,
}: {
  task: Task; tasks: Task[]; isStretch?: boolean; onEdit: (t: Task) => void;
  onToggleStretch: (id: string) => void; onRemove: (id: string) => void;
}) {
  const cfg = ISSUE_CONFIG[task.issueType] ?? ISSUE_CONFIG.task;
  const pri = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.none;
  const parent = task.parentId ? tasks.find((t) => t.id === task.parentId) : null;
  const epicAncestor = findEpicAncestor(task, tasks);
  const storyParent = parent?.issueType === 'story' ? parent : null;
  const hasBreadcrumb = !!(epicAncestor || storyParent || (parent && parent.issueType !== 'epic' && parent.issueType !== 'story'));

  return (
    <div className={hasBreadcrumb ? 'flex flex-col gap-0.5' : ''}>
      {/* Epic + Story breadcrumb — same pills as BoardCard */}
      {hasBreadcrumb && (
        <div className="flex items-center gap-1 px-1 flex-wrap">
          {epicAncestor && (
            <span className="inline-flex items-center gap-0.5 font-inter text-[10px] font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30 px-1.5 py-0.5 rounded-md max-w-[130px] truncate">
              <span className="material-symbols-outlined text-[10px]">bolt</span>
              <span className="truncate">{epicAncestor.title}</span>
            </span>
          )}
          {storyParent && (
            <span className="inline-flex items-center gap-0.5 font-inter text-[10px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 px-1.5 py-0.5 rounded-md max-w-[130px] truncate">
              <span className="material-symbols-outlined text-[10px]">bookmark</span>
              <span className="truncate">{storyParent.title}</span>
            </span>
          )}
          {parent && parent.issueType !== 'epic' && parent.issueType !== 'story' && (
            <span className="font-inter text-[10px] text-outline truncate max-w-[130px]">{parent.title}</span>
          )}
        </div>
      )}

      {/* Main row — same layout/style as normal backlog rows */}
      <div className="flex items-center gap-2 py-1.5 px-1 rounded-lg hover:bg-surface-container group transition-colors">
        <span className={`font-inter text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${cfg.bg} ${cfg.color}`}>
          {cfg.label.slice(0, 3).toUpperCase()}
        </span>
        {isStretch && (
          <span className="font-inter text-[10px] text-amber-500 dark:text-amber-400 shrink-0" title="Stretch goal">★</span>
        )}
        <span
          className="flex-1 font-work-sans text-sm text-on-surface truncate cursor-pointer min-w-0"
          onClick={() => onEdit(task)}
        >
          {task.title}
        </span>
        <DueBadge dueDate={task.dueDate} />
        {task.storyPoints != null && (
          <span className="font-inter text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded-full shrink-0">
            {task.storyPoints}pt
          </span>
        )}
        {task.priority !== 'none' && (
          <span className={`font-inter text-[10px] font-semibold shrink-0 ${pri.color}`}>{pri.label}</span>
        )}
        <button
          onClick={() => onToggleStretch(task.id)}
          className={`shrink-0 p-1 rounded-lg transition-colors opacity-50 group-hover:opacity-100 active:opacity-100 ${
            isStretch
              ? 'text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-950/30'
              : 'text-outline hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/20'
          }`}
          title={isStretch ? 'Move to committed' : 'Mark as stretch goal'}
        >
          <span className="material-symbols-outlined text-[16px]">{isStretch ? 'commit' : 'stars'}</span>
        </button>
        <button
          onClick={() => onRemove(task.id)}
          className="shrink-0 p-1 rounded-lg text-outline hover:text-error hover:bg-error/5 transition-colors opacity-50 group-hover:opacity-100 active:opacity-100"
          title="Remove from sprint"
        >
          <span className="material-symbols-outlined text-[16px]">remove_circle_outline</span>
        </button>
      </div>
    </div>
  );
}

// ─── Burndown chart ───────────────────────────────────────────────────────────

function BurndownChart({ sprint, sprintTasks }: { sprint: Sprint; sprintTasks: Task[] }) {
  const data = useMemo(() => {
    const [sy, sm, sd] = sprint.startDate.split('-').map(Number);
    const [ey, em, ed] = sprint.endDate.split('-').map(Number);
    const start = new Date(sy, sm - 1, sd);
    const end   = new Date(ey, em - 1, ed);
    const todayStr = localDateString();
    const total = sprint.totalTasksAtStart ?? sprintTasks.length;
    const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000));
    const result: { date: string; ideal: number; actual?: number }[] = [];

    for (let i = 0; i <= totalDays; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const dateStr = localDateString(d);
      const label = format(d, 'MMM d');
      const ideal = Math.max(0, Math.round(total * (1 - i / totalDays)));
      let actual: number | undefined;
      if (dateStr <= todayStr) {
        const completed = sprintTasks.filter(
          (t) => t.completedAt && t.completedAt.slice(0, 10) <= dateStr,
        ).length;
        actual = Math.max(0, total - completed);
      }
      result.push({ date: label, ideal, actual });
    }
    return result;
  }, [sprint, sprintTasks]);

  const hasActual = data.some((d) => d.actual !== undefined && d.actual !== data[0]?.ideal);

  return (
    <div>
      <div className="flex items-center gap-3 mb-2 flex-wrap">
        <span className="font-inter text-xs font-semibold text-on-surface-variant">Burndown</span>
        <div className="flex items-center gap-3 ml-auto">
          <span className="flex items-center gap-1 font-inter text-[10px] text-outline">
            <span className="inline-block w-5 border-t border-dashed border-outline/60" />
            Ideal
          </span>
          {hasActual && (
            <span className="flex items-center gap-1 font-inter text-[10px] text-primary">
              <span className="inline-block w-5 border-t-2 border-primary" />
              Actual
            </span>
          )}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#888" strokeOpacity={0.08} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 9, fontFamily: 'Inter, sans-serif' }}
            tickLine={false} axisLine={false}
            interval={Math.max(0, Math.floor(data.length / 5) - 1)}
          />
          <YAxis
            tick={{ fontSize: 9, fontFamily: 'Inter, sans-serif' }}
            tickLine={false} axisLine={false} allowDecimals={false}
          />
          <Tooltip
            contentStyle={{ fontSize: 11, fontFamily: 'Inter, sans-serif', borderRadius: 8, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,.15)' }}
            cursor={{ strokeDasharray: '3 3' }}
          />
          <Line
            type="linear" dataKey="ideal" stroke="#9e9e9e"
            strokeDasharray="5 3" strokeWidth={1.5} dot={false} name="Ideal"
          />
          {hasActual && (
            <Line
              type="monotone" dataKey="actual" stroke="#004ac6"
              strokeWidth={2} dot={{ r: 2.5, fill: '#004ac6' }}
              name="Actual" connectNulls={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
      {!hasActual && (
        <p className="font-inter text-[10px] text-outline text-center mt-1">
          Chart fills in as tasks are completed
        </p>
      )}
    </div>
  );
}

// ─── Velocity chart ───────────────────────────────────────────────────────────

function VelocityChart({ sprints, tasks }: { sprints: Sprint[]; tasks: Task[] }) {
  const data = useMemo(() =>
    sprints
      .filter((s) => s.status === 'completed')
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .map((s) => {
        const sp = tasks.filter((t) => t.sprintId === s.id);
        const done = sp.filter((t) => t.status === 'done');
        const points = done.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0);
        const name = s.name.length > 13 ? s.name.slice(0, 12) + '…' : s.name;
        return { name, tasks: done.length, points, total: sp.length };
      }),
  [sprints, tasks]);

  if (data.length === 0) return null;

  const hasPoints = data.some((d) => d.points > 0);

  return (
    <div>
      <div className="flex items-center gap-3 mb-2 flex-wrap">
        <span className="font-inter text-xs font-semibold uppercase tracking-wider text-outline">Velocity</span>
        <div className="flex items-center gap-3 ml-auto">
          <span className="flex items-center gap-1.5 font-inter text-[10px] text-outline">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: '#006243', opacity: 0.75 }} />
            Tasks done
          </span>
          {hasPoints && (
            <span className="flex items-center gap-1.5 font-inter text-[10px] text-outline">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: '#004ac6', opacity: 0.65 }} />
              Story pts
            </span>
          )}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -24 }} barGap={3}>
          <CartesianGrid strokeDasharray="3 3" stroke="#888" strokeOpacity={0.08} vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 9, fontFamily: 'Inter, sans-serif' }}
            tickLine={false} axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 9, fontFamily: 'Inter, sans-serif' }}
            tickLine={false} axisLine={false} allowDecimals={false}
          />
          <Tooltip
            contentStyle={{ fontSize: 11, fontFamily: 'Inter, sans-serif', borderRadius: 8, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,.15)' }}
            formatter={(v, name) => [v, name === 'tasks' ? 'Tasks completed' : 'Story points']}
          />
          <Bar dataKey="tasks" name="tasks" fill="#006243" fillOpacity={0.75} radius={[3, 3, 0, 0]} />
          {hasPoints && (
            <Bar dataKey="points" name="points" fill="#004ac6" fillOpacity={0.65} radius={[3, 3, 0, 0]} />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Draggable board card ─────────────────────────────────────────────────────

function DraggableBoardCard({ task, tasks: allTasks, onEdit, showCheck = false }: { task: Task; tasks: Task[]; onEdit: (t: Task) => void; showCheck?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  return (
    <div ref={setNodeRef} style={{ opacity: isDragging ? 0.35 : 1 }} {...attributes} {...listeners} className="touch-none cursor-grab active:cursor-grabbing">
      <BoardCard task={task} tasks={allTasks} onEdit={onEdit} showCheck={showCheck} />
    </div>
  );
}

// ─── Droppable column body ────────────────────────────────────────────────────

function DroppableColumnBody({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`min-h-[60px] space-y-2 rounded-xl transition-colors ${isOver ? 'bg-primary/5 ring-1 ring-primary/20' : ''}`}>
      {children}
    </div>
  );
}

// ─── Move-task picker ─────────────────────────────────────────────────────────

function MoveTaskPicker({ open, onClose, tasks, title, onPick }: {
  open: boolean;
  onClose: () => void;
  tasks: Task[];
  title: string;
  onPick: (task: Task) => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="max-h-[60vh] overflow-y-auto divide-y divide-outline-variant/10">
        {tasks.length === 0 ? (
          <p className="text-center py-10 font-inter text-sm text-outline">No tasks available to move</p>
        ) : (
          tasks.map((t) => {
            const cfg = ISSUE_CONFIG[t.issueType] ?? ISSUE_CONFIG.task;
            return (
              <button
                key={t.id}
                onClick={() => { onPick(t); onClose(); }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-container text-left transition-colors"
              >
                <span className={`font-inter text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${cfg.bg} ${cfg.color}`}>
                  {cfg.label.slice(0, 3).toUpperCase()}
                </span>
                <span className="flex-1 font-inter text-sm text-on-surface truncate">{t.title}</span>
                <span className="material-symbols-outlined text-[16px] text-outline">arrow_forward</span>
              </button>
            );
          })
        )}
      </div>
    </Modal>
  );
}

// ─── Main Tasks page ──────────────────────────────────────────────────────────

export default function Tasks() {
  const { tasks, columns, addTask, updateTask, reorderItems } = useTasksStore();
  const { sprints, activeSprint, deleteSprint, updateSprint } = useSprintStore();
  const pinnedTags = useTagStore((s) => s.pinned);
  const tagUsage = useTagStore((s) => s.usage);
  const filterTags = useMemo(() => {
    if (pinnedTags.length > 0) return pinnedTags;
    return Object.entries(tagUsage).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t]) => t);
  }, [pinnedTags, tagUsage]);

  // Reactively fix tasks that should be in the active sprint but aren't.
  // Runs on mount and whenever sprints change — reads latest tasks directly from store to avoid stale closure.
  useEffect(() => {
    const { tasks: latestTasks, updateTask: doUpdate } = useTasksStore.getState();
    const active = sprints.find(s => s.status === 'active');
    latestTasks.forEach(task => {
      if (task.issueType === 'epic') return;
      // Promote sprint-assigned tasks stuck in backlog status
      if (task.sprintId && task.status === 'backlog') {
        doUpdate(task.id, { status: 'todo' });
        return;
      }
      // Auto-assign tasks whose due date falls within the active sprint
      if (!task.sprintId && task.dueDate && active
          && task.dueDate >= active.startDate && task.dueDate <= active.endDate) {
        doUpdate(task.id, { sprintId: active.id, status: task.status === 'backlog' ? 'todo' : task.status });
      }
    });
  }, [sprints]);

  const [view, setView] = useState<'backlog' | 'sprint_backlog' | 'board' | 'sprint' | 'timeline'>('board');
  const [searchQuery, setSearchQuery] = useState('');
  const [timelineDateFilter, setTimelineDateFilter] = useState<'week' | 'month' | 'all'>('month');
  const [activeTag, setActiveTag] = useState('All');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterDue, setFilterDue] = useState<'all' | 'overdue' | 'week'>('all');
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [tagManagerOpen, setTagManagerOpen] = useState(false);
  const [sprintModalOpen, setSprintModalOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [editSprint, setEditSprint] = useState<Sprint | null>(null);
  const [defaultStatus, setDefaultStatus] = useState('backlog');
  const [defaultParentId, setDefaultParentId] = useState<string | null>(null);
  const [defaultIssueType, setDefaultIssueType] = useState<IssueType>('task');
  const [scopeEpicId, setScopeEpicId] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set(['done']));
  const [dumpInput, setDumpInput] = useState('');
  const [dumpExpanded, setDumpExpanded] = useState(true);
  const [completeSprintOpen, setCompleteSprintOpen] = useState(false);
  const [showSprintTaskBreakdown, setShowSprintTaskBreakdown] = useState(false);
  const [defaultSprintId, setDefaultSprintId] = useState<string | null>(null);
  const [boardSort, setBoardSort] = useState<Record<string, BoardSort>>({});
  const [sortDropdownOpen, setSortDropdownOpen] = useState<string | null>(null);
  const [draggingId, setDraggingId]       = useState<string | null>(null);
  const [pickerOpen, setPickerOpen]       = useState(false);
  const [pickerSource, setPickerSource]   = useState<string>('todo');
  const [pickerTarget, setPickerTarget]   = useState<string>('in_progress');

  const epicSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  );

  const boardSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const filteredTasks = useMemo(() => {
    let list = activeTag === 'All' ? tasks : tasks.filter((t) => t.tags.includes(activeTag));
    if (filterPriority !== 'all') list = list.filter((t) => t.priority === filterPriority);
    if (filterDue === 'overdue') list = list.filter((t) => t.dueDate && isOverdue(t.dueDate) && t.status !== 'done');
    if (filterDue === 'week') {
      const inSevenDays = new Date(); inSevenDays.setDate(inSevenDays.getDate() + 7);
      const todayStr = localDateString();
      list = list.filter((t) => t.dueDate && t.dueDate >= todayStr && t.dueDate <= localDateString(inSevenDays) && t.status !== 'done');
    }
    return list;
  }, [tasks, activeTag, filterPriority, filterDue]);

  const allEpics = useMemo(
    () => tasks.filter((t) => t.issueType === 'epic' && !t.parentId),
    [tasks],
  );
  const epics = useMemo(
    () => filteredTasks.filter((t) => t.issueType === 'epic' && !t.parentId).sort((a, b) => a.order - b.order),
    [filteredTasks],
  );
  const backlogItems = useMemo(
    () => filteredTasks.filter((t) => t.status === 'backlog' && t.issueType !== 'epic'),
    [filteredTasks],
  );
  const orphans = useMemo(
    () => filteredTasks
      .filter((t) => !t.parentId && t.issueType !== 'epic' && t.status !== 'backlog')
      .sort((a, b) => {
        const aDone = a.status === 'done' ? 1 : 0;
        const bDone = b.status === 'done' ? 1 : 0;
        return aDone !== bDone ? aDone - bDone : a.order - b.order;
      }),
    [filteredTasks],
  );


  // Timeline: all tasks with due dates (uses tag + priority filters, own date filter)
  const timelineTasks = useMemo(() => {
    let list = tasks.filter((t) => !!t.dueDate && t.status !== 'done');
    if (activeTag !== 'All') list = list.filter((t) => t.tags.includes(activeTag));
    if (filterPriority !== 'all') list = list.filter((t) => t.priority === filterPriority);
    if (timelineDateFilter === 'week') {
      const end = new Date(); end.setDate(end.getDate() + 7);
      list = list.filter((t) => isOverdue(t.dueDate) || t.dueDate! <= localDateString(end));
    } else if (timelineDateFilter === 'month') {
      const end = new Date(); end.setDate(end.getDate() + 30);
      list = list.filter((t) => isOverdue(t.dueDate) || t.dueDate! <= localDateString(end));
    }
    return list.sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
  }, [tasks, activeTag, filterPriority, timelineDateFilter]);

  const timelineGroups = useMemo(() => {
    const todayStr = localDateString();
    const overdueTasks: typeof tasks = [];
    const futureMap = new Map<string, typeof tasks>();
    for (const task of timelineTasks) {
      if (task.dueDate! < todayStr) {
        overdueTasks.push(task);
      } else {
        if (!futureMap.has(task.dueDate!)) futureMap.set(task.dueDate!, []);
        futureMap.get(task.dueDate!)!.push(task);
      }
    }
    const result: { dateKey: string; label: string; isOverdueGroup: boolean; tasks: typeof tasks }[] = [];
    if (overdueTasks.length > 0) {
      result.push({ dateKey: '__overdue', label: 'Overdue', isOverdueGroup: true, tasks: overdueTasks });
    }
    for (const [key, groupTasks] of [...futureMap.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      result.push({ dateKey: key, label: timelineDateLabel(key), isOverdueGroup: false, tasks: groupTasks });
    }
    return result;
  }, [timelineTasks]);

  // Sprint data
  const currentSprint = activeSprint();

  // Board view: active sprint tasks + pending tasks from completed sprints + planned sprint tasks due before the sprint starts
  const boardSprintItems = useMemo(() => {
    return tasks
      .filter((t) => {
        if (t.issueType === 'epic' || !t.sprintId) return false;
        const sp = sprints.find((s) => s.id === t.sprintId);
        if (!sp) return false;
        if (sp.status === 'active') return true;
        if (sp.status === 'completed') return t.status !== 'done';
        if (sp.status === 'planned') return !!(t.dueDate && t.dueDate < sp.startDate);
        return false;
      })
      .sort((a, b) => a.order - b.order);
  }, [tasks, sprints]);

  const pickerTasks = useMemo(() => {
    if (!currentSprint) return [];
    return tasks.filter((t) => t.sprintId === currentSprint.id && t.status === pickerSource);
  }, [tasks, currentSprint, pickerSource]);

  const sprintTasks = useMemo(
    () => (currentSprint ? tasks.filter((t) => t.sprintId === currentSprint.id) : []),
    [tasks, currentSprint],
  );
  // Sprint completion % counts only committed tasks (not stretch goals)
  const committedSprintTasks = useMemo(
    () => sprintTasks.filter((t) => !t.isStretchGoal),
    [sprintTasks],
  );
  const sprintDone = committedSprintTasks.filter((t) => t.status === 'done').length;
  const sprintPct  = committedSprintTasks.length > 0
    ? Math.round((sprintDone / committedSprintTasks.length) * 100) : 0;

  // Sprint backlog: unfinished sprint tasks split by committed / stretch
  const sprintBacklogCommitted = useMemo(
    () => (currentSprint ? tasks.filter((t) => t.sprintId === currentSprint.id && t.status !== 'done' && !t.isStretchGoal) : []),
    [tasks, currentSprint],
  );
  const sprintBacklogStretch = useMemo(
    () => (currentSprint ? tasks.filter((t) => t.sprintId === currentSprint.id && t.status !== 'done' && t.isStretchGoal) : []),
    [tasks, currentSprint],
  );
  const committedPoints = useMemo(
    () => sprintBacklogCommitted.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0),
    [sprintBacklogCommitted],
  );

  // Velocity data from completed sprints
  const velocityData = useMemo(() =>
    sprints
      .filter((s) => s.status === 'completed')
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .map((s) => {
        const sp = tasks.filter((t) => t.sprintId === s.id);
        const done = sp.filter((t) => t.status === 'done');
        const points = done.reduce((acc, t) => acc + (t.storyPoints ?? 0), 0);
        const name = s.name.length > 13 ? s.name.slice(0, 12) + '…' : s.name;
        return { name, tasks: done.length, points, total: sp.length };
      }),
  [sprints, tasks]);
  const incompleteSprintTasks = useMemo(
    () => (currentSprint ? sprintTasks.filter((t) => t.status !== 'done') : []),
    [currentSprint, sprintTasks],
  );
  const nextSprint = useMemo(
    () => sprints.filter((s) => s.status === 'planned').sort((a, b) => a.startDate.localeCompare(b.startDate))[0] ?? null,
    [sprints],
  );

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return tasks.filter((t) => t.title.toLowerCase().includes(q) || (t.description ?? '').toLowerCase().includes(q));
  }, [tasks, searchQuery]);

  const sortedColumns = [...columns].sort((a, b) => a.order - b.order);
  const boardColumns = sortedColumns.filter((c) => c.id !== 'backlog' && c.id !== 'review');

  // ── Open helpers ──────────────────────────────────────────────────────────

  const openNew = (status = 'backlog', pid: string | null = null, issueType: IssueType = 'task', sprintId: string | null = null) => {
    setEditTask(null);
    setDefaultStatus(status);
    setDefaultParentId(pid);
    setDefaultIssueType(issueType);
    setScopeEpicId(null);
    setDefaultSprintId(sprintId);
    setTaskModalOpen(true);
  };

  const openEdit = (task: Task) => {
    setEditTask(task);
    setDefaultStatus(task.status);
    setDefaultParentId(task.parentId);
    setDefaultIssueType(task.issueType);
    setScopeEpicId(null);
    setTaskModalOpen(true);
  };

  const handleAddChild = (parentId: string, issueType: IssueType, scope?: string) => {
    setScopeEpicId(scope ?? null);
    setEditTask(null);
    setDefaultStatus('todo');
    setDefaultParentId(parentId);
    setDefaultIssueType(issueType);
    setTaskModalOpen(true);
  };

  // Global Enter key → open create-task modal (when no input/textarea is focused)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || taskModalOpen) return;
      const tag = (document.activeElement?.tagName ?? '').toLowerCase();
      if (['input', 'textarea'].includes(tag)) return;
      if ((document.activeElement as HTMLElement)?.isContentEditable) return;
      setEditTask(null);
      setDefaultStatus('backlog');
      setDefaultParentId(null);
      setDefaultIssueType('task');
      setScopeEpicId(null);
      setTaskModalOpen(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [taskModalOpen]);

  useEffect(() => {
    if (!sortDropdownOpen) return;
    const close = () => setSortDropdownOpen(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [sortDropdownOpen]);

  const toggleSection = (colId: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      next.has(colId) ? next.delete(colId) : next.add(colId);
      return next;
    });
  };

  const handleDumpSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && dumpInput.trim()) {
      addTask({ title: dumpInput.trim(), status: 'backlog', issueType: 'task' });
      setDumpInput('');
    }
  };

  // ── Epic drag reorder ─────────────────────────────────────────────────────

  function handleEpicDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = epics.findIndex((e) => e.id === active.id);
    const newIdx = epics.findIndex((e) => e.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    reorderItems(arrayMove(epics, oldIdx, newIdx).map((e) => e.id));
  }

  function handleBoardDragStart({ active }: DragStartEvent) {
    setDraggingId(active.id as string);
  }

  function handleBoardDragEnd({ active, over }: DragEndEvent) {
    setDraggingId(null);
    if (!over) return;
    const task = tasks.find((t) => t.id === active.id);
    if (!task) return;
    const targetColId = over.id as string;
    if (boardColumns.some((c) => c.id === targetColId) && task.status !== targetColId) {
      updateTask(task.id, { status: targetColId });
    }
  }

  return (
    <div className="bg-background min-h-screen flex flex-col">
      <TopBar title="Tasks" />

      {/* Sub-header */}
      <div
        className="sticky top-14 z-30 bg-background/90 backdrop-blur-sm border-b border-outline-variant/20"
        style={{ top: 'calc(56px + env(safe-area-inset-top, 0px))' }}
      >
        <div className="px-4 pt-2.5 pb-1 flex items-center justify-between gap-3">
          {/* View toggle */}
          <div className="flex bg-surface-container rounded-xl p-0.5 gap-0.5 overflow-x-auto no-scrollbar">
            {([
              { id: 'backlog',        label: 'Backlog'   },
              { id: 'sprint_backlog', label: '⚡ Backlog'  },
              { id: 'board',          label: 'Board'     },
              { id: 'sprint',         label: 'Sprints'   },
              { id: 'timeline',       label: '📅'        },
            ] as const).map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setView(id)}
                className={`px-2 py-1.5 rounded-lg font-inter text-xs font-semibold whitespace-nowrap transition-all ${
                  view === id ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex gap-1.5">
            <button
              onClick={() => openNew('backlog', null, 'epic')}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-purple-100 text-purple-700 border border-purple-300 rounded-lg font-inter font-semibold text-xs"
            >
              <span className="material-symbols-outlined text-[14px]">bolt</span>
              Epic
            </button>
            <button
              onClick={() => openNew()}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-primary text-on-primary rounded-lg font-inter font-medium text-xs"
            >
              <span className="material-symbols-outlined text-[14px]">add</span>
              Task
            </button>
          </div>
        </div>

        {/* Active sprint compact card — visible across all views */}
        {currentSprint && (
          <div className="mx-4 mb-1 flex items-center gap-2.5 bg-primary/5 border border-primary/15 rounded-xl px-3 py-2">
            <span className="material-symbols-outlined text-[15px] text-primary shrink-0">sprint</span>
            <div className="flex-1 min-w-0">
              <p className="font-inter text-xs font-bold text-primary truncate">{currentSprint.name}</p>
              <p className="font-inter text-[10px] text-outline">{fmtSprintDate(currentSprint.startDate)} → {fmtSprintDate(currentSprint.endDate)}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-20 h-1.5 bg-primary/15 rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${sprintPct}%` }} />
              </div>
              <span className="font-inter text-[10px] font-bold text-primary">{sprintPct}%</span>
            </div>
          </div>
        )}

        {/* Search bar */}
        <div className="px-4 pb-1">
          <div className="flex items-center gap-2 bg-surface-container rounded-xl px-3 h-8 border border-outline-variant/20">
            <span className="material-symbols-outlined text-[14px] text-outline shrink-0">search</span>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search tasks..."
              className="flex-1 bg-transparent font-inter text-xs text-on-surface placeholder:text-outline outline-none"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="shrink-0">
                <span className="material-symbols-outlined text-[14px] text-outline">close</span>
              </button>
            )}
          </div>
        </div>

        {/* Tag filters */}
        <div className="flex gap-2 px-4 pb-1 overflow-x-auto no-scrollbar">
          {['All', ...filterTags].map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(activeTag === tag && tag !== 'All' ? 'All' : tag)}
              className={`flex-shrink-0 flex items-center gap-1 px-3 py-1 rounded-full border font-inter font-semibold text-xs uppercase tracking-wide transition-all ${
                activeTag === tag
                  ? 'bg-primary text-on-primary border-primary'
                  : 'border-outline-variant text-on-surface-variant hover:border-primary/40'
              }`}
            >
              {tag === 'All' && <span className="material-symbols-outlined text-[12px]">filter_list</span>}
              {tag}
            </button>
          ))}
          <button
            onClick={() => setTagManagerOpen(true)}
            className="flex-shrink-0 flex items-center px-2 py-1 rounded-full border border-outline-variant text-on-surface-variant hover:border-primary/40 transition-all"
          >
            <span className="material-symbols-outlined text-[14px]">settings</span>
          </button>
        </div>

        {/* Priority + due date / timeline filters */}
        <div className="flex gap-2 px-4 pb-2.5 overflow-x-auto no-scrollbar">
          {/* Priority chips (shown in all views) */}
          {[
            { value: 'all',      label: 'All',          color: '' },
            { value: 'critical', label: '🔴 Emergency', color: 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800' },
            { value: 'high',     label: '🟠 High',      color: 'text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30 border-orange-300 dark:border-orange-800' },
            { value: 'medium',   label: '🟡 Medium',    color: 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800' },
            { value: 'low',      label: '🔵 Low',       color: 'text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-800' },
          ].map(({ value, label, color }) => (
            <button
              key={value}
              onClick={() => setFilterPriority(filterPriority === value && value !== 'all' ? 'all' : value)}
              className={`flex-shrink-0 px-2.5 py-1 rounded-full border font-inter text-[11px] font-semibold transition-all ${
                filterPriority === value
                  ? value === 'all' ? 'bg-on-surface text-surface border-on-surface' : color + ' ring-1 ring-current/30'
                  : 'border-outline-variant text-on-surface-variant hover:border-outline'
              }`}
            >
              {label}
            </button>
          ))}
          <div className="w-px bg-outline-variant/40 self-stretch shrink-0" />
          {view === 'timeline' ? (
            /* Timeline date range filter */
            <>
              {[
                { value: 'week' as const, label: '📅 This week' },
                { value: 'month' as const, label: '🗓 This month' },
                { value: 'all' as const, label: 'All dates' },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setTimelineDateFilter(value)}
                  className={`flex-shrink-0 px-2.5 py-1 rounded-full border font-inter text-[11px] font-semibold transition-all ${
                    timelineDateFilter === value
                      ? 'bg-primary text-on-primary border-primary'
                      : 'border-outline-variant text-on-surface-variant hover:border-outline'
                  }`}
                >
                  {label}
                </button>
              ))}
            </>
          ) : (
            /* Due date chips for non-timeline views */
            <>
              {[
                { value: 'all' as const, label: 'Any date' },
                { value: 'overdue' as const, label: '⚠ Overdue' },
                { value: 'week' as const, label: '📅 This week' },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setFilterDue(filterDue === value && value !== 'all' ? 'all' : value)}
                  className={`flex-shrink-0 px-2.5 py-1 rounded-full border font-inter text-[11px] font-semibold transition-all ${
                    filterDue === value
                      ? value === 'overdue' ? 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-300 dark:border-red-800' : value === 'week' ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800' : 'bg-on-surface text-surface border-on-surface'
                      : 'border-outline-variant text-on-surface-variant hover:border-outline'
                  }`}
                >
                  {label}
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      <main className="flex-1 max-w-screen-xl mx-auto w-full px-4 py-4 space-y-3">

        {/* ── SEARCH RESULTS ───────────────────────────────────────────────── */}
        {searchQuery.trim() ? (
          <div className="space-y-1">
            <p className="font-inter text-xs text-outline px-1 mb-2">{searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for "{searchQuery}"</p>
            {searchResults.length === 0 ? (
              <div className="text-center py-12">
                <span className="material-symbols-outlined text-[40px] text-outline block mb-2">search_off</span>
                <p className="font-inter text-sm text-on-surface-variant">No tasks match your search</p>
              </div>
            ) : searchResults.map((task) => {
              const cfg = ISSUE_CONFIG[task.issueType] ?? ISSUE_CONFIG.task;
              return (
                <button key={task.id} onClick={() => openEdit(task)}
                  className="w-full flex items-center gap-3 bg-surface-container-lowest rounded-xl px-4 py-3 text-left hover:bg-surface-container active:scale-[0.99] transition-all shadow-sm">
                  <span className={`font-inter text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${cfg.bg} ${cfg.color}`}>
                    {cfg.label.slice(0, 3).toUpperCase()}
                  </span>
                  <span className="flex-1 font-inter text-sm text-on-surface truncate">{task.title}</span>
                  <span className="font-inter text-[10px] text-outline shrink-0 capitalize">{task.status.replace('-', ' ')}</span>
                </button>
              );
            })}
          </div>
        ) : null}

        {/* ── BACKLOG VIEW ─────────────────────────────────────────────────── */}
        {!searchQuery.trim() && view === 'backlog' && (
          <>
            {/* Brain Dump */}
            <div className="bg-surface-container-low rounded-2xl overflow-hidden">
              <button
                onClick={() => setDumpExpanded((v) => !v)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-container transition-colors"
              >
                <span className="material-symbols-outlined text-[20px] text-outline">inbox</span>
                <span className="font-inter font-semibold text-sm text-on-surface flex-1 text-left">Brain Dump</span>
                <span className="font-inter text-xs text-outline font-bold bg-surface-container px-2 py-0.5 rounded-full">{backlogItems.length}</span>
                <span className={`material-symbols-outlined text-[18px] text-outline transition-transform ${dumpExpanded ? 'rotate-180' : ''}`}>expand_more</span>
              </button>

              {dumpExpanded && (
                <div className="px-4 pb-3 border-t border-outline-variant/20">
                  <div className="flex items-center gap-2 py-2">
                    <span className="material-symbols-outlined text-[16px] text-outline">add</span>
                    <input
                      type="text"
                      value={dumpInput}
                      onChange={(e) => setDumpInput(e.target.value)}
                      onKeyDown={handleDumpSubmit}
                      placeholder="Dump a task idea and press Enter..."
                      className="flex-1 bg-transparent border-none outline-none font-work-sans text-sm text-on-surface placeholder:text-outline/50"
                    />
                  </div>
                  {backlogItems.map((task) => {
                    const taskSprint = task.sprintId ? sprints.find((s) => s.id === task.sprintId) : null;
                    return (
                      <div key={task.id} className="flex items-center gap-2 py-1.5 px-1 rounded-lg hover:bg-surface-container group">
                        <span className={`font-inter text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${(ISSUE_CONFIG[task.issueType] ?? ISSUE_CONFIG.task).bg} ${(ISSUE_CONFIG[task.issueType] ?? ISSUE_CONFIG.task).color}`}>
                          {(ISSUE_CONFIG[task.issueType] ?? ISSUE_CONFIG.task).label.slice(0, 3).toUpperCase()}
                        </span>
                        <span className="flex-1 font-work-sans text-sm text-on-surface cursor-pointer truncate" onClick={() => openEdit(task)}>
                          {task.title}
                        </span>
                        <DueBadge dueDate={task.dueDate} />
                        {taskSprint && (
                          <span className="font-inter text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded-full truncate max-w-[80px] shrink-0" title={taskSprint.name}>
                            ⚡ {taskSprint.name}
                          </span>
                        )}
                        {currentSprint && !task.sprintId && (
                          <>
                            <button
                              onClick={() => updateTask(task.id, { sprintId: currentSprint.id, status: 'todo', isStretchGoal: false })}
                              className="flex items-center gap-0.5 px-2 py-0.5 bg-primary/10 text-primary rounded font-inter text-[10px] font-semibold shrink-0 opacity-50 group-hover:opacity-100 active:opacity-100"
                              title="Add to sprint as committed task"
                            >
                              ⚡ Sprint
                            </button>
                            <button
                              onClick={() => updateTask(task.id, { sprintId: currentSprint.id, status: 'todo', isStretchGoal: true })}
                              className="flex items-center gap-0.5 px-2 py-0.5 bg-amber-100 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 rounded font-inter text-[10px] font-semibold shrink-0 opacity-50 group-hover:opacity-100 active:opacity-100"
                              title="Add to sprint as stretch goal"
                            >
                              ★ Stretch
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => updateTask(task.id, { status: 'todo' })}
                          className="flex items-center gap-1 px-2 py-0.5 bg-surface-container text-on-surface-variant rounded font-inter text-[10px] font-semibold shrink-0 opacity-50 group-hover:opacity-100 active:opacity-100"
                        >
                          Plan <span className="material-symbols-outlined text-[11px]">arrow_forward</span>
                        </button>
                      </div>
                    );
                  })}
                  {backlogItems.length === 0 && (
                    <p className="text-center font-inter text-xs text-outline py-2">Dump anything here — sort later</p>
                  )}
                </div>
              )}
            </div>

            {/* Epics with drag-to-reorder */}
            <DndContext sensors={epicSensors} collisionDetection={closestCenter} onDragEnd={handleEpicDragEnd}>
              <SortableContext items={epics.map((e) => e.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {epics.map((epic) => (
                    <SortableEpicSection
                      key={epic.id}
                      epic={epic}
                      tasks={filteredTasks}
                      onEdit={openEdit}
                      onAddChild={handleAddChild}
                      colorIdx={epicColorIndex(epic.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            {epics.length === 0 && allEpics.length === 0 && (
              <div className="text-center py-4">
                <p className="font-inter text-sm text-on-surface-variant mb-2">No Epics yet</p>
                <button
                  onClick={() => openNew('backlog', null, 'epic')}
                  className="px-4 py-2 bg-purple-100 text-purple-700 border border-purple-300 rounded-xl font-inter text-sm font-semibold"
                >
                  + Create your first Epic
                </button>
              </div>
            )}
            {epics.length === 0 && allEpics.length > 0 && (
              <div className="text-center py-4 space-y-2">
                <p className="font-inter text-sm text-on-surface-variant">No epics match this filter</p>
                <button
                  onClick={() => { setActiveTag('All'); setFilterPriority('all'); setFilterDue('all'); }}
                  className="px-4 py-1.5 rounded-lg border border-outline-variant text-on-surface-variant font-inter text-xs font-semibold hover:border-primary/40"
                >
                  Clear filters
                </button>
              </div>
            )}

            {/* Standalone items (not in any epic) */}
            {orphans.length > 0 && (
              <div className="bg-surface-container-lowest rounded-2xl overflow-hidden border border-outline-variant/30">
                <div className="px-4 py-3 flex items-center gap-2 border-b border-outline-variant/20">
                  <span className="material-symbols-outlined text-[18px] text-outline">folder_open</span>
                  <span className="font-inter font-semibold text-sm text-on-surface flex-1">No Epic</span>
                  <span className="font-inter text-xs text-outline">{orphans.length}</span>
                </div>
                <div className="px-4 py-3 space-y-1">
                  {orphans.map((task) => (
                    <TaskRow key={task.id} task={task} depth={0} tasks={filteredTasks} onEdit={openEdit} onAddChild={handleAddChild} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── SPRINT BACKLOG VIEW ──────────────────────────────────────────── */}
        {!searchQuery.trim() && view === 'sprint_backlog' && (
          <>
            {!currentSprint ? (
              <div className="bg-surface-container rounded-2xl p-5 text-center space-y-3">
                <span className="material-symbols-outlined text-[40px] text-outline block">⚡</span>
                <p className="font-inter font-semibold text-on-surface">No active sprint</p>
                <p className="font-work-sans text-sm text-on-surface-variant">Activate a sprint in the Sprints tab to manage your sprint backlog.</p>
                <button
                  onClick={() => setView('sprint')}
                  className="px-4 py-2 rounded-xl bg-primary text-on-primary font-inter text-sm font-semibold"
                >
                  Go to Sprints
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Sprint label */}
                <div className="flex items-center gap-2 px-1">
                  <span className="material-symbols-outlined text-[16px] text-primary">sprint</span>
                  <span className="font-inter font-bold text-sm text-primary">{currentSprint.name}</span>
                  <span className="font-inter text-xs text-outline">{fmtSprintDate(currentSprint.startDate)} → {fmtSprintDate(currentSprint.endDate)}</span>
                </div>

                {/* Capacity bar */}
                {currentSprint.capacity != null && (
                  <div className="bg-surface-container-low rounded-xl px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-inter text-xs font-semibold text-on-surface-variant">Sprint Capacity</span>
                      <span className={`font-inter text-xs font-bold ${committedPoints > currentSprint.capacity ? 'text-error' : 'text-primary'}`}>
                        {committedPoints} / {currentSprint.capacity} pts
                      </span>
                    </div>
                    <div className="h-2 bg-primary/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${committedPoints > currentSprint.capacity ? 'bg-error' : 'bg-primary'}`}
                        style={{ width: `${Math.min(100, Math.round((committedPoints / currentSprint.capacity) * 100))}%` }}
                      />
                    </div>
                    {committedPoints > currentSprint.capacity && (
                      <p className="font-inter text-[10px] text-error mt-1">Over capacity by {committedPoints - currentSprint.capacity} pts</p>
                    )}
                  </div>
                )}

                {/* Committed tasks */}
                <div>
                  <p className="font-inter text-xs font-semibold uppercase tracking-wider text-outline mb-2">
                    Committed · {sprintBacklogCommitted.length}
                    {committedPoints > 0 && <span className="ml-1 font-normal normal-case text-on-surface-variant">({committedPoints} pts)</span>}
                  </p>
                  {sprintBacklogCommitted.length === 0 ? (
                    <div className="text-center py-6 border-2 border-dashed border-outline-variant/30 rounded-xl">
                      <p className="font-inter text-xs text-outline">No committed tasks yet</p>
                      <p className="font-inter text-[10px] text-outline/60 mt-1">Use ⚡ Sprint on Brain Dump items (in Backlog) to add them</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {buildHierarchyGroups(sprintBacklogCommitted, tasks).map(({ epic, stories, directTasks }) => {
                        const c = epic ? EPIC_COLORS[epicColorIndex(epic.id)] : null;
                        const allDesc = epic ? getDescendants(epic.id, tasks) : [];
                        const totalDesc = allDesc.length;
                        const doneDesc = allDesc.filter((t) => t.status === 'done').length;
                        const pct = totalDesc > 0 ? Math.round((doneDesc / totalDesc) * 100) : 0;
                        const countDisplayed = stories.reduce((n, s) => n + s.tasks.length, 0) + directTasks.length;

                        const storyContent = stories.map(({ story, tasks: storyTasks }) => {
                          const sPri = PRIORITY_CONFIG[story.priority] ?? PRIORITY_CONFIG.none;
                          return (
                            <div key={story.id} className="space-y-1">
                              <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-outline-variant/30 hover:bg-surface-container group transition-colors">
                                <div className="w-3.5 shrink-0" />
                                <span className={`font-inter text-[10px] font-bold px-1.5 py-0.5 rounded ${ISSUE_CONFIG.story.bg} ${ISSUE_CONFIG.story.color} shrink-0`}>STORY</span>
                                {storyTasks.length > 0 && (
                                  <span className="font-inter text-[10px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 px-1.5 py-0.5 rounded-full shrink-0">
                                    {storyTasks.filter((t) => t.status === 'done').length}/{storyTasks.length}
                                  </span>
                                )}
                                <span className="flex-1 font-work-sans text-sm text-on-surface truncate cursor-pointer" onClick={() => openEdit(story)}>{story.title}</span>
                                {story.status !== 'done' && <DueBadge dueDate={story.dueDate} />}
                                {story.priority !== 'none' && <span className={`font-inter text-[10px] font-semibold shrink-0 ${sPri.color}`}>{sPri.label}</span>}
                                <span className="font-inter text-[10px] text-outline shrink-0 bg-surface-container px-1.5 py-0.5 rounded-full">{story.status.replace('_', ' ')}</span>
                              </div>
                              {storyTasks.map((task) => (
                                <div key={task.id} style={{ marginLeft: 20 }}>
                                  <SprintBacklogRow task={task} tasks={tasks} isStretch={false} onEdit={openEdit}
                                    onToggleStretch={(id) => updateTask(id, { isStretchGoal: true })}
                                    onRemove={(id) => updateTask(id, { sprintId: null, status: 'backlog' })} />
                                </div>
                              ))}
                            </div>
                          );
                        });

                        const directContent = directTasks.map((task) => (
                          <SprintBacklogRow key={task.id} task={task} tasks={tasks} isStretch={false} onEdit={openEdit}
                            onToggleStretch={(id) => updateTask(id, { isStretchGoal: true })}
                            onRemove={(id) => updateTask(id, { sprintId: null, status: 'backlog' })} />
                        ));

                        if (epic && c) {
                          return (
                            <div key={epic.id} className={`rounded-2xl border ${c.wrap} overflow-hidden`}>
                              <div className="flex items-center gap-2 px-4 py-3">
                                <span className={`material-symbols-outlined text-[18px] ${c.icon} shrink-0`}>bolt</span>
                                <div className="flex-1 min-w-0">
                                  <span className={`font-inter font-bold text-sm ${c.title} cursor-pointer truncate block`} onClick={() => openEdit(epic)}>{epic.title}</span>
                                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                    {epic.status !== 'done' && <DueBadge dueDate={epic.dueDate} />}
                                    {countDisplayed > 0 && <span className={`font-inter text-[9px] px-1.5 py-0.5 rounded-full ${c.count}`}>{countDisplayed} tasks</span>}
                                    {totalDesc > 0 && <span className={`font-inter text-[9px] font-bold ${c.icon}`}>{pct}%</span>}
                                    <span className={`font-inter text-[9px] border ${c.status} px-1.5 py-0.5 rounded-full`}>{epic.status.replace('_', ' ')}</span>
                                  </div>
                                </div>
                              </div>
                              {totalDesc > 0 && (
                                <div className="mx-4 mb-0.5">
                                  <div className={`h-1 ${c.progBg} rounded-full overflow-hidden`}>
                                    <div className={`h-full ${c.progFill} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                                  </div>
                                </div>
                              )}
                              <div className={`border-t ${c.divider} px-4 pt-2 pb-3 space-y-1`}>
                                {storyContent}
                                {directContent}
                              </div>
                            </div>
                          );
                        }
                        return <div key="__no_epic" className="space-y-1">{storyContent}{directContent}</div>;
                      })}
                    </div>
                  )}
                </div>

                {/* Stretch goals */}
                <div>
                  <p className="font-inter text-xs font-semibold uppercase tracking-wider text-outline mb-2">
                    Stretch Goals · {sprintBacklogStretch.length}
                  </p>
                  {sprintBacklogStretch.length === 0 ? (
                    <p className="font-inter text-xs text-outline text-center py-3">
                      Mark committed tasks with ★ to move them here
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {buildHierarchyGroups(sprintBacklogStretch, tasks).map(({ epic, stories, directTasks }) => {
                        const c = epic ? EPIC_COLORS[epicColorIndex(epic.id)] : null;
                        const allDesc = epic ? getDescendants(epic.id, tasks) : [];
                        const totalDesc = allDesc.length;
                        const doneDesc = allDesc.filter((t) => t.status === 'done').length;
                        const pct = totalDesc > 0 ? Math.round((doneDesc / totalDesc) * 100) : 0;
                        const countDisplayed = stories.reduce((n, s) => n + s.tasks.length, 0) + directTasks.length;

                        const storyContent = stories.map(({ story, tasks: storyTasks }) => {
                          const sPri = PRIORITY_CONFIG[story.priority] ?? PRIORITY_CONFIG.none;
                          return (
                            <div key={story.id} className="space-y-1">
                              <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-outline-variant/30 hover:bg-surface-container group transition-colors">
                                <div className="w-3.5 shrink-0" />
                                <span className={`font-inter text-[10px] font-bold px-1.5 py-0.5 rounded ${ISSUE_CONFIG.story.bg} ${ISSUE_CONFIG.story.color} shrink-0`}>STORY</span>
                                {storyTasks.length > 0 && (
                                  <span className="font-inter text-[10px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 px-1.5 py-0.5 rounded-full shrink-0">
                                    {storyTasks.filter((t) => t.status === 'done').length}/{storyTasks.length}
                                  </span>
                                )}
                                <span className="flex-1 font-work-sans text-sm text-on-surface truncate cursor-pointer" onClick={() => openEdit(story)}>{story.title}</span>
                                {story.status !== 'done' && <DueBadge dueDate={story.dueDate} />}
                                {story.priority !== 'none' && <span className={`font-inter text-[10px] font-semibold shrink-0 ${sPri.color}`}>{sPri.label}</span>}
                                <span className="font-inter text-[10px] text-outline shrink-0 bg-surface-container px-1.5 py-0.5 rounded-full">{story.status.replace('_', ' ')}</span>
                              </div>
                              {storyTasks.map((task) => (
                                <div key={task.id} style={{ marginLeft: 20 }}>
                                  <SprintBacklogRow task={task} tasks={tasks} isStretch={true} onEdit={openEdit}
                                    onToggleStretch={(id) => updateTask(id, { isStretchGoal: false })}
                                    onRemove={(id) => updateTask(id, { sprintId: null, status: 'backlog' })} />
                                </div>
                              ))}
                            </div>
                          );
                        });

                        const directContent = directTasks.map((task) => (
                          <SprintBacklogRow key={task.id} task={task} tasks={tasks} isStretch={true} onEdit={openEdit}
                            onToggleStretch={(id) => updateTask(id, { isStretchGoal: false })}
                            onRemove={(id) => updateTask(id, { sprintId: null, status: 'backlog' })} />
                        ));

                        if (epic && c) {
                          return (
                            <div key={epic.id} className={`rounded-2xl border ${c.wrap} overflow-hidden`}>
                              <div className="flex items-center gap-2 px-4 py-3">
                                <span className={`material-symbols-outlined text-[18px] ${c.icon} shrink-0`}>bolt</span>
                                <div className="flex-1 min-w-0">
                                  <span className={`font-inter font-bold text-sm ${c.title} cursor-pointer truncate block`} onClick={() => openEdit(epic)}>{epic.title}</span>
                                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                    {epic.status !== 'done' && <DueBadge dueDate={epic.dueDate} />}
                                    {countDisplayed > 0 && <span className={`font-inter text-[9px] px-1.5 py-0.5 rounded-full ${c.count}`}>{countDisplayed} tasks</span>}
                                    {totalDesc > 0 && <span className={`font-inter text-[9px] font-bold ${c.icon}`}>{pct}%</span>}
                                    <span className={`font-inter text-[9px] border ${c.status} px-1.5 py-0.5 rounded-full`}>{epic.status.replace('_', ' ')}</span>
                                  </div>
                                </div>
                              </div>
                              {totalDesc > 0 && (
                                <div className="mx-4 mb-0.5">
                                  <div className={`h-1 ${c.progBg} rounded-full overflow-hidden`}>
                                    <div className={`h-full ${c.progFill} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                                  </div>
                                </div>
                              )}
                              <div className={`border-t ${c.divider} px-4 pt-2 pb-3 space-y-1`}>
                                {storyContent}
                                {directContent}
                              </div>
                            </div>
                          );
                        }
                        return <div key="__no_epic" className="space-y-1">{storyContent}{directContent}</div>;
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── SPRINT VIEW ──────────────────────────────────────────────────── */}
        {!searchQuery.trim() && view === 'sprint' && (
          <div className="space-y-4">
            {/* Current sprint header */}
            {currentSprint ? (
              <div className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-2xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-primary">sprint</span>
                      <h2 className="font-inter font-bold text-base text-on-surface truncate">{currentSprint.name}</h2>
                    </div>
                    {currentSprint.goal && (
                      <p className="font-work-sans text-sm text-on-surface-variant mt-1">{currentSprint.goal}</p>
                    )}
                    <p className="font-inter text-xs text-outline mt-1">
                      {fmtSprintDate(currentSprint.startDate)} → {fmtSprintDate(currentSprint.endDate)}
                    </p>
                  </div>
                  <button
                    onClick={() => { setEditSprint(currentSprint); setSprintModalOpen(true); }}
                    className="p-1.5 text-on-surface-variant hover:bg-primary/10 rounded-lg transition-colors shrink-0"
                  >
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                  </button>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-inter text-xs text-on-surface-variant">{sprintDone}/{sprintTasks.length} tasks done</span>
                    <span className="font-inter text-xs font-bold text-primary">{sprintPct}%</span>
                  </div>
                  <div className="h-2 bg-primary/10 rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${sprintPct}%` }} />
                  </div>
                </div>

                {/* Burndown chart */}
                <div className="bg-surface-container-low rounded-xl px-3 py-3">
                  <BurndownChart sprint={currentSprint} sprintTasks={sprintTasks} />
                </div>

                {/* Task breakdown */}
                <button
                  onClick={() => setShowSprintTaskBreakdown((v) => !v)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-primary/5 hover:bg-primary/10 transition-colors"
                >
                  <span className="font-inter text-xs font-semibold text-primary">Task breakdown</span>
                  <span className={`material-symbols-outlined text-[16px] text-primary transition-transform ${showSprintTaskBreakdown ? 'rotate-180' : ''}`}>expand_more</span>
                </button>
                {showSprintTaskBreakdown && (
                  <div className="bg-surface-container-low rounded-xl px-3 py-3">
                    <SprintTaskBreakdown tasks={sprintTasks} allTasks={tasks} accentDone="text-primary" />
                  </div>
                )}

                <button
                  onClick={() => setCompleteSprintOpen(true)}
                  className="w-full py-2 rounded-xl border border-primary/30 text-primary font-inter text-sm font-semibold hover:bg-primary/10 transition-colors"
                >
                  Complete Sprint →
                </button>
              </div>
            ) : (
              <div className="bg-surface-container rounded-2xl p-5 text-center space-y-3">
                <span className="material-symbols-outlined text-[40px] text-outline block">sprint</span>
                <p className="font-inter font-semibold text-on-surface">No active sprint</p>
                <p className="font-work-sans text-sm text-on-surface-variant">Create a sprint and mark it active to start tracking work.</p>
              </div>
            )}

            {/* Planned sprints */}
            {sprints.filter((sp) => sp.status === 'planned').length > 0 && (
              <div className="bg-surface-container-low rounded-2xl overflow-hidden">
                <p className="font-inter text-xs font-semibold uppercase tracking-wider text-outline px-4 py-3 border-b border-outline-variant/20">Planned</p>
                {sprints.filter((sp) => sp.status === 'planned').map((sp) => (
                  <div key={sp.id} className="flex items-center gap-3 px-4 py-3 border-b border-outline-variant/10 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="font-inter font-medium text-sm text-on-surface truncate">{sp.name}</p>
                      <p className="font-inter text-xs text-outline">{fmtSprintDate(sp.startDate)} → {fmtSprintDate(sp.endDate)}</p>
                    </div>
                    {!currentSprint && (
                      <button
                        onClick={() => updateSprint(sp.id, { status: 'active' })}
                        className="px-2.5 py-1 rounded-lg bg-primary text-on-primary font-inter text-xs font-semibold shrink-0"
                      >
                        Activate
                      </button>
                    )}
                    <button onClick={() => { setEditSprint(sp); setSprintModalOpen(true); }} className="p-1 text-outline hover:text-primary">
                      <span className="material-symbols-outlined text-[16px]">edit</span>
                    </button>
                    <button onClick={() => deleteSprint(sp.id)} className="p-1 text-outline hover:text-error">
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Sprint history */}
            {sprints.filter((sp) => sp.status === 'completed').length > 0 && (
              <div className="space-y-3">
                <p className="font-inter text-xs font-semibold uppercase tracking-wider text-outline px-1">History</p>
                {sprints
                  .filter((sp) => sp.status === 'completed')
                  .sort((a, b) => b.endDate.localeCompare(a.endDate))
                  .map((sp) => {
                    const spTasks = tasks.filter((t) => t.sprintId === sp.id);
                    const spDone = spTasks.filter((t) => t.status === 'done');
                    const spPct = spTasks.length > 0 ? Math.round((spDone.length / spTasks.length) * 100) : 0;
                    return (
                      <SprintHistoryCard
                        key={sp.id}
                        sprint={sp}
                        tasks={spTasks}
                        allTasks={tasks}
                        doneTasks={spDone}
                        pct={spPct}
                        onEdit={() => { setEditSprint(sp); setSprintModalOpen(true); }}
                        onDelete={() => deleteSprint(sp.id)}
                      />
                    );
                  })}
              </div>
            )}

            {/* Velocity chart — shown when there are completed sprints */}
            {velocityData.length > 0 && (
              <div className="bg-surface-container-low rounded-2xl px-4 py-4">
                <VelocityChart sprints={sprints} tasks={tasks} />
              </div>
            )}

            {/* New / Plan next sprint button */}
            <button
              onClick={() => { setEditSprint(null); setSprintModalOpen(true); }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-surface-container text-on-surface-variant font-inter text-sm"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              {currentSprint ? 'Plan next sprint' : 'New Sprint'}
            </button>
          </div>
        )}

        {/* ── BOARD VIEW ───────────────────────────────────────────────────── */}
        {!searchQuery.trim() && view === 'board' && (
          <div className="space-y-4">
            {/* No-sprint warning */}
            {!currentSprint && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-outline-variant/30 bg-surface-container-low">
                <span className="material-symbols-outlined text-[20px] text-outline">sprint</span>
                <div className="flex-1">
                  <p className="font-inter text-sm font-semibold text-on-surface">No active sprint</p>
                  <p className="font-inter text-xs text-outline mt-0.5">Go to Sprint tab → Activate a sprint to see tasks here.</p>
                </div>
                <button onClick={() => setView('sprint')} className="shrink-0 px-3 py-1.5 rounded-xl bg-primary text-on-primary font-inter text-xs font-semibold">
                  Go
                </button>
              </div>
            )}

            {/* Sprint banner */}
            {currentSprint && (
              <div className="bg-gradient-to-r from-primary/8 to-secondary/8 border border-primary/20 rounded-2xl px-4 py-3 flex items-center gap-3">
                <span className="material-symbols-outlined text-[18px] text-primary shrink-0">sprint</span>
                <div className="flex-1 min-w-0">
                  <p className="font-inter font-bold text-sm text-on-surface truncate">{currentSprint.name}</p>
                  <p className="font-inter text-[10px] text-outline">{fmtSprintDate(currentSprint.startDate)} → {fmtSprintDate(currentSprint.endDate)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-16 h-1.5 bg-primary/10 rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${sprintPct}%` }} />
                  </div>
                  <span className="font-inter text-xs font-bold text-primary">{sprintPct}%</span>
                </div>
                <button
                  onClick={() => setCompleteSprintOpen(true)}
                  className="shrink-0 px-3 py-1.5 rounded-xl border border-primary/30 text-primary font-inter text-xs font-semibold hover:bg-primary/10 transition-colors"
                >
                  Complete →
                </button>
              </div>
            )}

            {/* Kanban board */}
            <DndContext
              sensors={boardSensors}
              collisionDetection={closestCenter}
              onDragStart={handleBoardDragStart}
              onDragEnd={handleBoardDragEnd}
            >
              <div className="lg:grid lg:grid-cols-3 lg:gap-3 lg:items-start space-y-3 lg:space-y-0">
                {boardColumns.map((col) => {
                  const colTasks = boardSprintItems.filter((t) => t.status === col.id);
                  const collapsed = collapsedSections.has(col.id);
                  const isDone = col.id === 'done';
                  const sortMode = boardSort[col.id] ?? 'manual';
                  const sortedColTasks = sortBoardTasks(colTasks, sortMode);

                  return (
                    <div key={col.id} className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-card">
                      <button
                        onClick={() => toggleSection(col.id)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-container/60 transition-colors"
                      >
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: col.color }} />
                        <span className="font-inter font-semibold text-sm text-on-surface flex-1 text-left uppercase tracking-wide">{col.name}</span>
                        <span className="font-inter text-xs text-outline font-bold bg-surface-container px-2 py-0.5 rounded-full">{colTasks.length}</span>
                        {/* + button: todo creates new task, in_progress picks from prev column */}
                        {col.id === 'todo' && currentSprint && (
                          <button
                            onClick={(e) => { e.stopPropagation(); openNew('todo', null, 'task', currentSprint.id); }}
                            className="p-1 rounded-lg text-outline hover:text-primary hover:bg-primary/10 transition-colors"
                          >
                            <span className="material-symbols-outlined text-[18px]">add</span>
                          </button>
                        )}
                        {col.id === 'in_progress' && currentSprint && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setPickerSource('todo'); setPickerTarget('in_progress'); setPickerOpen(true); }}
                            className="p-1 rounded-lg text-outline hover:text-primary hover:bg-primary/10 transition-colors"
                          >
                            <span className="material-symbols-outlined text-[18px]">arrow_downward</span>
                          </button>
                        )}
                        {/* Sort dropdown — only on active columns */}
                        {!isDone && (
                          <div className="relative" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSortDropdownOpen((prev) => (prev === col.id ? null : col.id));
                              }}
                              className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-colors ${
                                sortMode !== 'manual'
                                  ? 'text-primary bg-primary/10'
                                  : 'text-outline hover:text-primary hover:bg-primary/10'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[16px]">{BOARD_SORT_CONFIG[sortMode].icon}</span>
                              {sortMode !== 'manual' && (
                                <span className="font-inter text-[10px] font-semibold leading-none">{BOARD_SORT_CONFIG[sortMode].label}</span>
                              )}
                            </button>
                            {sortDropdownOpen === col.id && (
                              <div className="absolute right-0 top-full mt-1 w-44 bg-surface-container-high rounded-xl shadow-xl border border-outline-variant/20 overflow-hidden z-50">
                                {BOARD_SORT_MODES.map((mode) => (
                                  <button
                                    key={mode}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setBoardSort((prev) => ({ ...prev, [col.id]: mode }));
                                      setSortDropdownOpen(null);
                                    }}
                                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-surface-container transition-colors ${
                                      sortMode === mode ? 'text-primary' : 'text-on-surface'
                                    }`}
                                  >
                                    <span className="material-symbols-outlined text-[16px] shrink-0">{BOARD_SORT_CONFIG[mode].icon}</span>
                                    <span className="font-inter text-xs font-medium flex-1 text-left">{BOARD_SORT_CONFIG[mode].label}</span>
                                    {sortMode === mode && (
                                      <span className="material-symbols-outlined text-[14px] text-primary shrink-0">check</span>
                                    )}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        <span className={`material-symbols-outlined text-[18px] text-outline transition-transform ${collapsed ? '' : 'rotate-180'}`}>expand_more</span>
                      </button>

                      {!collapsed && (
                        <div className={`px-3 pb-3 border-t border-outline-variant/20 pt-2 ${isDone ? 'opacity-70' : ''}`}>
                          <DroppableColumnBody id={col.id}>
                            {sortedColTasks.length === 0 && !currentSprint && (
                              <p className="text-center font-inter text-xs text-outline py-4">No tasks</p>
                            )}
                            {sortedColTasks.length === 0 && currentSprint && (
                              <div className="flex items-center justify-center py-4 rounded-xl border-2 border-dashed border-outline-variant/30 text-outline">
                                <span className="font-inter text-xs">Drop here</span>
                              </div>
                            )}
                            {buildHierarchyGroups(sortedColTasks, tasks).map(({ epic, stories, directTasks }) => {
                              const c = epic ? EPIC_COLORS[epicColorIndex(epic.id)] : null;
                              const allDesc = epic ? getDescendants(epic.id, tasks) : [];
                              const totalDesc = allDesc.length;
                              const doneDesc = allDesc.filter((t) => t.status === 'done').length;
                              const pct = totalDesc > 0 ? Math.round((doneDesc / totalDesc) * 100) : 0;

                              const storyContent = stories.map(({ story, tasks: storyTasks }) => (
                                <div key={story.id} className="space-y-1">
                                  <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-outline-variant/30 hover:bg-surface-container group transition-colors">
                                    <div className="w-3 shrink-0" />
                                    <span className={`font-inter text-[10px] font-bold px-1.5 py-0.5 rounded ${ISSUE_CONFIG.story.bg} ${ISSUE_CONFIG.story.color} shrink-0`}>STORY</span>
                                    {storyTasks.length > 0 && (
                                      <span className="font-inter text-[10px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 px-1.5 py-0.5 rounded-full shrink-0">
                                        {storyTasks.filter((t) => t.status === 'done').length}/{storyTasks.length}
                                      </span>
                                    )}
                                    <span className="flex-1 font-work-sans text-xs text-on-surface truncate cursor-pointer" onClick={() => openEdit(story)}>{story.title}</span>
                                  </div>
                                  {storyTasks.map((task) => (
                                    <div key={task.id} style={{ marginLeft: 16 }}>
                                      <DraggableBoardCard task={task} tasks={tasks} onEdit={openEdit} showCheck={col.id === 'todo'} />
                                    </div>
                                  ))}
                                </div>
                              ));

                              const directContent = directTasks.map((task) => (
                                <DraggableBoardCard key={task.id} task={task} tasks={tasks} onEdit={openEdit} showCheck={col.id === 'todo'} />
                              ));

                              if (epic && c) {
                                return (
                                  <div key={epic.id} className={`rounded-2xl border ${c.wrap} overflow-hidden mb-1`}>
                                    <div className="flex items-center gap-2 px-3 py-2">
                                      <span className={`material-symbols-outlined text-[15px] ${c.icon} shrink-0`}>bolt</span>
                                      <div className="flex-1 min-w-0">
                                        <span className={`font-inter font-bold text-xs ${c.title} truncate block cursor-pointer`} onClick={() => openEdit(epic)}>{epic.title}</span>
                                        <div className="flex items-center gap-1 mt-0.5">
                                          {totalDesc > 0 && <span className={`font-inter text-[9px] font-bold ${c.icon}`}>{pct}%</span>}
                                          <span className={`font-inter text-[9px] border ${c.status} px-1 py-0.5 rounded-full`}>{epic.status.replace('_', ' ')}</span>
                                        </div>
                                      </div>
                                    </div>
                                    {totalDesc > 0 && (
                                      <div className="mx-3 mb-0.5">
                                        <div className={`h-0.5 ${c.progBg} rounded-full overflow-hidden`}>
                                          <div className={`h-full ${c.progFill} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                                        </div>
                                      </div>
                                    )}
                                    <div className={`border-t ${c.divider} px-2 pt-1.5 pb-2 space-y-1`}>
                                      {storyContent}
                                      {directContent}
                                    </div>
                                  </div>
                                );
                              }
                              return <div key="__no_epic" className="space-y-1 mb-1">{storyContent}{directContent}</div>;
                            })}
                          </DroppableColumnBody>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Drag overlay */}
              <DragOverlay>
                {draggingId ? (
                  <div className="opacity-90 shadow-xl rotate-1">
                    <BoardCard task={tasks.find((t) => t.id === draggingId)!} tasks={tasks} onEdit={() => {}} />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </div>
        )}

        {/* ── TIMELINE VIEW ────────────────────────────────────────────────── */}
        {!searchQuery.trim() && view === 'timeline' && (
          <div className="space-y-5">
            {timelineGroups.length === 0 ? (
              <div className="text-center py-14">
                <span className="material-symbols-outlined text-[48px] text-outline block mb-3">calendar_today</span>
                <p className="font-inter font-semibold text-on-surface">No scheduled tasks</p>
                <p className="font-work-sans text-sm text-on-surface-variant mt-1">
                  {timelineDateFilter === 'week'
                    ? 'No tasks due this week'
                    : timelineDateFilter === 'month'
                    ? 'No tasks due this month'
                    : 'No tasks with due dates'}
                </p>
              </div>
            ) : (
              timelineGroups.map((group) => (
                <div key={group.dateKey}>
                  {/* Date group header */}
                  <div className="flex items-center gap-3 mb-2.5">
                    <span className={`font-inter text-xs font-bold uppercase tracking-wider shrink-0 ${group.isOverdueGroup ? 'text-red-600' : 'text-outline'}`}>
                      {group.label}
                    </span>
                    <div className={`flex-1 h-px ${group.isOverdueGroup ? 'bg-red-200 dark:bg-red-900/40' : 'bg-outline-variant/30'}`} />
                    <span className="font-inter text-[10px] text-outline shrink-0">{group.tasks.length}</span>
                  </div>

                  {/* Tasks in group */}
                  <div className={`space-y-1.5 pl-3 ml-1 border-l-2 ${group.isOverdueGroup ? 'border-red-300 dark:border-red-800' : 'border-outline-variant/25'}`}>
                    {group.tasks.map((task) => {
                      const cfg = ISSUE_CONFIG[task.issueType] ?? ISSUE_CONFIG.task;
                      const pri = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.none;
                      return (
                        <div
                          key={task.id}
                          className="bg-surface-container-lowest rounded-xl px-3 py-2.5 flex items-center gap-2.5 shadow-card cursor-pointer hover:shadow-card-hover transition-shadow"
                          onClick={() => openEdit(task)}
                        >
                          <span className={`font-inter text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${cfg.bg} ${cfg.color}`}>
                            {cfg.label.slice(0, 3).toUpperCase()}
                          </span>
                          <span className="flex-1 font-inter text-sm text-on-surface truncate min-w-0">{task.title}</span>
                          {task.priority !== 'none' && (
                            <span className={`font-inter text-[10px] font-semibold shrink-0 ${pri.color}`}>
                              {pri.label}
                            </span>
                          )}
                          <span className="font-inter text-[10px] text-outline shrink-0 bg-surface-container px-1.5 py-0.5 rounded-full">
                            {task.status.replace('_', ' ')}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updateTask(task.id, { status: task.status === 'done' ? 'todo' : 'done' });
                            }}
                            className={`shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                              task.status === 'done' ? 'border-tertiary bg-tertiary' : 'border-outline-variant hover:border-primary'
                            }`}
                          >
                            {task.status === 'done' && (
                              <span className="material-symbols-outlined text-[9px] text-on-tertiary icon-fill">check</span>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {/* FAB */}
      <button
        onClick={() => openNew()}
        className="fixed bottom-28 right-4 w-14 h-14 bg-primary text-on-primary rounded-full shadow-fab flex items-center justify-center hover:scale-105 active:scale-95 transition-transform z-40"
        style={{ bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))' }}
      >
        <span className="material-symbols-outlined text-[28px]">add</span>
      </button>

      <TaskModal
        open={taskModalOpen}
        onClose={() => { setTaskModalOpen(false); setEditTask(null); setScopeEpicId(null); setDefaultSprintId(null); }}
        task={editTask}
        defaultStatus={defaultStatus}
        parentId={defaultParentId}
        defaultIssueType={defaultIssueType}
        scopeEpicId={scopeEpicId}
        defaultSprintId={defaultSprintId}
      />
      <TagManager open={tagManagerOpen} onClose={() => setTagManagerOpen(false)} />
      <SprintModal
        open={sprintModalOpen}
        sprint={editSprint}
        onClose={() => { setSprintModalOpen(false); setEditSprint(null); }}
      />
      <CompleteSprintModal
        open={completeSprintOpen}
        sprint={currentSprint ?? null}
        incompleteTasks={incompleteSprintTasks}
        nextSprint={nextSprint}
        onClose={() => setCompleteSprintOpen(false)}
      />
      <MoveTaskPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        tasks={pickerTasks}
        title={pickerTarget === 'in_progress' ? 'Move to In Progress' : 'Move to Review'}
        onPick={(t) => updateTask(t.id, { status: pickerTarget })}
      />
    </div>
  );
}
