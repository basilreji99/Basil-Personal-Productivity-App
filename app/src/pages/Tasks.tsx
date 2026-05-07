import { useState, useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import {
  DndContext, closestCenter, PointerSensor, TouchSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import TopBar from '../components/layout/TopBar';
import { formatDisplayDate, isOverdue, isDueSoon } from '../utils/dateUtils';
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

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  critical: { label: 'Emergency', color: 'text-red-600' },
  high:     { label: 'High',      color: 'text-orange-500' },
  medium:   { label: 'Medium',    color: 'text-amber-500' },
  low:      { label: 'Low',       color: 'text-blue-500' },
  none:     { label: '',          color: '' },
};

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
  const children = tasks.filter((t) => t.parentId === task.id);
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
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-outline hover:text-primary"
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
  epic, tasks, onEdit, onAddChild, dragHandleProps,
}: {
  epic: Task; tasks: Task[]; onEdit: (t: Task) => void;
  onAddChild: (parentId: string, type: IssueType, scopeEpicId?: string) => void;
  dragHandleProps?: React.HTMLAttributes<HTMLElement>;
}) {
  const { updateTask, reorderItems } = useTasksStore();
  const [expanded, setExpanded] = useState(false);

  const directChildren = useMemo(
    () => tasks.filter((t) => t.parentId === epic.id).sort((a, b) => a.order - b.order),
    [tasks, epic.id],
  );

  // Progress across ALL descendants
  const descendants = useMemo(() => getDescendants(epic.id, tasks), [epic.id, tasks]);
  const total = descendants.length;
  const done = descendants.filter((t) => t.status === 'done').length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const childSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  );

  function handleChildDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = directChildren.findIndex((c) => c.id === active.id);
    const newIdx = directChildren.findIndex((c) => c.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    reorderItems(arrayMove(directChildren, oldIdx, newIdx).map((c) => c.id));
  }

  return (
    <div className="rounded-2xl border border-purple-200 dark:border-purple-900/60 bg-purple-50 dark:bg-purple-950/20 overflow-hidden">
      {/* Epic header */}
      <div className="flex items-center gap-2 px-4 py-3">
        {/* Drag handle for the whole epic */}
        {dragHandleProps && (
          <span
            {...dragHandleProps}
            className="material-symbols-outlined text-[16px] text-purple-300 dark:text-purple-700 cursor-grab shrink-0 touch-none"
          >
            drag_indicator
          </span>
        )}

        <button onClick={() => setExpanded((v) => !v)} className="text-purple-500 dark:text-purple-400 shrink-0">
          <span className={`material-symbols-outlined text-[18px] transition-transform ${expanded ? 'rotate-90' : ''}`}>
            chevron_right
          </span>
        </button>
        <span className="material-symbols-outlined text-[18px] text-purple-600 dark:text-purple-400 shrink-0">bolt</span>
        <span
          className="flex-1 font-inter font-bold text-sm text-purple-900 dark:text-purple-200 cursor-pointer truncate min-w-0"
          onClick={() => onEdit(epic)}
        >
          {epic.title}
        </span>

        {/* Epic due date */}
        {epic.status !== 'done' && <DueBadge dueDate={epic.dueDate} />}

        {/* Progress badge */}
        {total > 0 && (
          <span className="font-inter text-xs font-bold text-purple-600 dark:text-purple-400 shrink-0">{pct}%</span>
        )}

        {/* Status */}
        <span className="font-inter text-xs text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950/50 border border-purple-300 dark:border-purple-800 px-2 py-0.5 rounded-full shrink-0">
          {epic.status.replace('_', ' ')}
        </span>

        {/* Quick done */}
        <button
          onClick={() => updateTask(epic.id, { status: epic.status === 'done' ? 'todo' : 'done' })}
          className={`shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
            epic.status === 'done' ? 'border-tertiary bg-tertiary' : 'border-purple-400 dark:border-purple-600'
          }`}
        >
          {epic.status === 'done' && <span className="material-symbols-outlined text-[9px] text-on-tertiary icon-fill">check</span>}
        </button>

      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="mx-4 mb-0.5">
          <div className="h-1 bg-purple-100 dark:bg-purple-900/40 rounded-full overflow-hidden">
            <div className="h-full bg-purple-500 dark:bg-purple-400 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {/* Children + add buttons inside expanded panel */}
      {expanded && (
        <div className="border-t border-purple-200 dark:border-purple-900/50">
          {directChildren.length > 0 && (
            <div className="px-4 pt-2 pb-1 space-y-1">
              <DndContext sensors={childSensors} collisionDetection={closestCenter} onDragEnd={handleChildDragEnd}>
                <SortableContext items={directChildren.map((c) => c.id)} strategy={verticalListSortingStrategy}>
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
              className="flex items-center gap-1 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-lg px-2 py-1 transition-colors font-inter text-xs font-semibold"
            >
              <span className="material-symbols-outlined text-[14px]">add</span>
              Story
            </button>
            <button
              onClick={() => onAddChild(epic.id, 'task', epic.id)}
              className="flex items-center gap-1 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-lg px-2 py-1 transition-colors font-inter text-xs font-semibold"
            >
              <span className="material-symbols-outlined text-[14px]">add</span>
              Task
            </button>
            <span className="font-inter text-xs text-purple-400 dark:text-purple-600 ml-auto">{directChildren.length} items</span>
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

function BoardCard({ task, tasks, onEdit }: { task: Task; tasks: Task[]; onEdit: (t: Task) => void }) {
  const { moveTask, columns } = useTasksStore();
  const cfg = ISSUE_CONFIG[task.issueType] ?? ISSUE_CONFIG.task;
  const pri = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.none;
  const parent = task.parentId ? tasks.find((t) => t.id === task.parentId) : null;
  const sortedCols = [...columns].sort((a, b) => a.order - b.order);
  const curIdx = sortedCols.findIndex((c) => c.id === task.status);
  const nextCol = curIdx >= 0 && curIdx < sortedCols.length - 1 ? sortedCols[curIdx + 1] : null;

  return (
    <div className="bg-surface-container-lowest rounded-xl p-3 shadow-card border border-outline-variant/10">
      {parent && (
        <p className="font-inter text-[10px] text-outline mb-1 truncate">
          <span className={`font-bold ${ISSUE_CONFIG[parent.issueType].color}`}>{parent.issueType.toUpperCase()}</span>
          {' '}{parent.title}
        </p>
      )}
      <div className="flex items-start gap-2">
        <span className={`font-inter text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5 shrink-0 ${cfg.bg} ${cfg.color}`}>
          {cfg.label.slice(0, 3).toUpperCase()}
        </span>
        <p className="flex-1 font-inter font-medium text-sm text-on-surface leading-tight cursor-pointer" onClick={() => onEdit(task)}>
          {task.title}
        </p>
      </div>
      <div className="flex items-center gap-2 mt-2">
        {task.priority !== 'none' && (
          <span className={`font-inter text-[10px] font-semibold ${pri.color}`}>{pri.label}</span>
        )}
        {task.storyPoints !== undefined && (
          <span className="font-inter text-[10px] text-outline bg-surface-container px-1.5 py-0.5 rounded-full">
            {task.storyPoints}pt
          </span>
        )}
        <div className="flex-1" />
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
  const { addSprint, updateSprint } = useSprintStore();
  const today = new Date().toISOString().slice(0, 10);
  const twoWeeks = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);

  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(twoWeeks);
  const [status, setStatus] = useState<'planned' | 'active' | 'completed'>('planned');

  useEffect(() => {
    if (sprint) {
      setName(sprint.name);
      setGoal(sprint.goal ?? '');
      setStartDate(sprint.startDate);
      setEndDate(sprint.endDate);
      setStatus(sprint.status);
    } else {
      setName('');
      setGoal('');
      setStartDate(today);
      setEndDate(twoWeeks);
      setStatus('planned');
    }
  }, [sprint, open]);

  function handleSave() {
    if (!name.trim()) return;
    if (sprint) {
      updateSprint(sprint.id, { name: name.trim(), goal: goal.trim() || undefined, startDate, endDate, status });
    } else {
      addSprint({ name: name.trim(), goal: goal.trim() || undefined, startDate, endDate, status });
    }
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={sprint ? 'Edit Sprint' : 'New Sprint'} size="sm">
      <div className="p-5 space-y-4">
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

  const [view, setView] = useState<'backlog' | 'board' | 'sprint' | 'timeline'>('backlog');
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
  const [showSprintTaskPicker, setShowSprintTaskPicker] = useState(false);

  const epicSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  );

  const filteredTasks = useMemo(() => {
    let list = activeTag === 'All' ? tasks : tasks.filter((t) => t.tags.includes(activeTag));
    if (filterPriority !== 'all') list = list.filter((t) => t.priority === filterPriority);
    if (filterDue === 'overdue') list = list.filter((t) => t.dueDate && isOverdue(t.dueDate) && t.status !== 'done');
    if (filterDue === 'week') {
      const inSevenDays = new Date(); inSevenDays.setDate(inSevenDays.getDate() + 7);
      const todayStr = new Date().toISOString().slice(0, 10);
      list = list.filter((t) => t.dueDate && t.dueDate >= todayStr && t.dueDate <= inSevenDays.toISOString().slice(0, 10) && t.status !== 'done');
    }
    return list;
  }, [tasks, activeTag, filterPriority, filterDue]);

  const epics = useMemo(
    () => filteredTasks.filter((t) => t.issueType === 'epic' && !t.parentId).sort((a, b) => a.order - b.order),
    [filteredTasks],
  );
  const backlogItems = useMemo(
    () => filteredTasks.filter((t) => t.status === 'backlog' && t.issueType !== 'epic'),
    [filteredTasks],
  );
  const orphans = useMemo(
    () => filteredTasks.filter((t) => !t.parentId && t.issueType !== 'epic' && t.status !== 'backlog').sort((a, b) => a.order - b.order),
    [filteredTasks],
  );
  const boardItems = useMemo(
    () => filteredTasks.filter((t) => t.issueType !== 'epic').sort((a, b) => a.order - b.order),
    [filteredTasks],
  );

  // Timeline: all tasks with due dates (uses tag + priority filters, own date filter)
  const timelineTasks = useMemo(() => {
    let list = tasks.filter((t) => !!t.dueDate && t.status !== 'done');
    if (activeTag !== 'All') list = list.filter((t) => t.tags.includes(activeTag));
    if (filterPriority !== 'all') list = list.filter((t) => t.priority === filterPriority);
    if (timelineDateFilter === 'week') {
      const end = new Date(); end.setDate(end.getDate() + 7);
      const endStr = end.toISOString().slice(0, 10);
      list = list.filter((t) => isOverdue(t.dueDate) || t.dueDate! <= endStr);
    } else if (timelineDateFilter === 'month') {
      const end = new Date(); end.setDate(end.getDate() + 30);
      const endStr = end.toISOString().slice(0, 10);
      list = list.filter((t) => isOverdue(t.dueDate) || t.dueDate! <= endStr);
    }
    return list.sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
  }, [tasks, activeTag, filterPriority, timelineDateFilter]);

  const timelineGroups = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
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
  const sprintTasks = useMemo(
    () => (currentSprint ? tasks.filter((t) => t.sprintId === currentSprint.id) : []),
    [tasks, currentSprint],
  );
  const sprintDone = sprintTasks.filter((t) => t.status === 'done').length;
  const sprintPct = sprintTasks.length > 0 ? Math.round((sprintDone / sprintTasks.length) * 100) : 0;
  const unassignedTasks = useMemo(
    () => tasks.filter((t) => !t.sprintId && t.issueType !== 'epic' && t.status !== 'done'),
    [tasks],
  );

  const sortedColumns = [...columns].sort((a, b) => a.order - b.order);
  const boardColumns = sortedColumns.filter((c) => c.id !== 'backlog');

  // ── Open helpers ──────────────────────────────────────────────────────────

  const openNew = (status = 'backlog', pid: string | null = null, issueType: IssueType = 'task') => {
    setEditTask(null);
    setDefaultStatus(status);
    setDefaultParentId(pid);
    setDefaultIssueType(issueType);
    setScopeEpicId(null);
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
          <div className="flex bg-surface-container rounded-xl p-0.5 gap-0.5">
            {(['backlog', 'board', 'sprint', 'timeline'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-2.5 py-1.5 rounded-lg font-inter text-xs font-semibold capitalize transition-all ${
                  view === v ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {v === 'sprint' && currentSprint ? '⚡' : v === 'timeline' ? '📅' : v.charAt(0).toUpperCase() + v.slice(1)}
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

        {/* Tag filters */}
        <div className="flex gap-2 px-4 pb-1 overflow-x-auto no-scrollbar">
          {['All', ...filterTags].map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(tag)}
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
              onClick={() => setFilterPriority(value)}
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
                  onClick={() => setFilterDue(value)}
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

        {/* ── BACKLOG VIEW ─────────────────────────────────────────────────── */}
        {view === 'backlog' && (
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
                  {backlogItems.map((task) => (
                    <div key={task.id} className="flex items-center gap-2 py-1.5 px-1 rounded-lg hover:bg-surface-container group">
                      <span className={`font-inter text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${(ISSUE_CONFIG[task.issueType] ?? ISSUE_CONFIG.task).bg} ${(ISSUE_CONFIG[task.issueType] ?? ISSUE_CONFIG.task).color}`}>
                        {(ISSUE_CONFIG[task.issueType] ?? ISSUE_CONFIG.task).label.slice(0, 3).toUpperCase()}
                      </span>
                      <span className="flex-1 font-work-sans text-sm text-on-surface cursor-pointer truncate" onClick={() => openEdit(task)}>
                        {task.title}
                      </span>
                      <DueBadge dueDate={task.dueDate} />
                      <button
                        onClick={() => updateTask(task.id, { status: 'todo' })}
                        className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded font-inter text-[10px] font-semibold shrink-0"
                      >
                        Plan <span className="material-symbols-outlined text-[11px]">arrow_forward</span>
                      </button>
                    </div>
                  ))}
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
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            {epics.length === 0 && (
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

        {/* ── SPRINT VIEW ──────────────────────────────────────────────────── */}
        {view === 'sprint' && (
          <div className="space-y-4">
            {/* Sprint header */}
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
                      {currentSprint.startDate} → {currentSprint.endDate}
                    </p>
                  </div>
                  <button
                    onClick={() => { setEditSprint(currentSprint); setSprintModalOpen(true); }}
                    className="p-1.5 text-on-surface-variant hover:bg-primary/10 rounded-lg transition-colors shrink-0"
                  >
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                  </button>
                </div>

                {/* Progress bar */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-inter text-xs text-on-surface-variant">{sprintDone}/{sprintTasks.length} tasks done</span>
                    <span className="font-inter text-xs font-bold text-primary">{sprintPct}%</span>
                  </div>
                  <div className="h-2 bg-primary/10 rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${sprintPct}%` }} />
                  </div>
                </div>

                {/* Complete sprint button */}
                <button
                  onClick={() => updateSprint(currentSprint.id, { status: 'completed' })}
                  className="w-full py-2 rounded-xl border border-primary/30 text-primary font-inter text-sm font-semibold hover:bg-primary/10 transition-colors"
                >
                  Complete Sprint
                </button>
              </div>
            ) : (
              <div className="bg-surface-container rounded-2xl p-5 text-center space-y-3">
                <span className="material-symbols-outlined text-[40px] text-outline block">sprint</span>
                <p className="font-inter font-semibold text-on-surface">No active sprint</p>
                <p className="font-work-sans text-sm text-on-surface-variant">Create a sprint and mark it active to start tracking work.</p>
                <button
                  onClick={() => { setEditSprint(null); setSprintModalOpen(true); }}
                  className="px-4 py-2 bg-primary text-on-primary rounded-xl font-inter text-sm font-semibold"
                >
                  + New Sprint
                </button>
              </div>
            )}

            {/* All sprints list */}
            {sprints.filter((sp) => sp.id !== currentSprint?.id).length > 0 && (
              <div className="bg-surface-container-low rounded-2xl overflow-hidden">
                <p className="font-inter text-xs font-semibold uppercase tracking-wider text-outline px-4 py-3 border-b border-outline-variant/20">Other Sprints</p>
                {sprints.filter((sp) => sp.id !== currentSprint?.id).map((sp) => (
                  <div key={sp.id} className="flex items-center gap-3 px-4 py-3 border-b border-outline-variant/10 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="font-inter font-medium text-sm text-on-surface truncate">{sp.name}</p>
                      <p className="font-inter text-xs text-outline">{sp.startDate} → {sp.endDate}</p>
                    </div>
                    <span className={`font-inter text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${
                      sp.status === 'completed' ? 'bg-tertiary/10 text-tertiary' : 'bg-surface-container text-outline'
                    }`}>
                      {sp.status}
                    </span>
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

            {/* Sprint tasks */}
            {currentSprint && sprintTasks.length > 0 && (
              <div className="space-y-1">
                <p className="font-inter text-xs font-semibold uppercase tracking-wider text-outline px-1">Sprint Tasks</p>
                {sprintTasks.sort((a, b) => a.order - b.order).map((task) => (
                  <TaskRow key={task.id} task={task} depth={0} tasks={tasks} onEdit={openEdit} onAddChild={handleAddChild} />
                ))}
              </div>
            )}

            {/* Add tasks from backlog */}
            {currentSprint && (
              <div>
                <button
                  onClick={() => setShowSprintTaskPicker((v) => !v)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-outline-variant text-on-surface-variant font-inter text-sm"
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  {showSprintTaskPicker ? 'Hide' : 'Add tasks to sprint'}
                </button>
                {showSprintTaskPicker && unassignedTasks.length > 0 && (
                  <div className="mt-2 bg-surface-container rounded-2xl overflow-hidden">
                    {unassignedTasks.slice(0, 20).map((t) => (
                      <div key={t.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-outline-variant/10 last:border-0">
                        <span className={`font-inter text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${(ISSUE_CONFIG[t.issueType] ?? ISSUE_CONFIG.task).bg} ${(ISSUE_CONFIG[t.issueType] ?? ISSUE_CONFIG.task).color}`}>
                          {(ISSUE_CONFIG[t.issueType] ?? ISSUE_CONFIG.task).label.slice(0, 3).toUpperCase()}
                        </span>
                        <span className="flex-1 font-work-sans text-sm text-on-surface truncate">{t.title}</span>
                        <button
                          onClick={() => updateTask(t.id, { sprintId: currentSprint.id })}
                          className="shrink-0 px-2.5 py-1 bg-primary/10 text-primary rounded-lg font-inter text-xs font-semibold"
                        >
                          Add
                        </button>
                      </div>
                    ))}
                    {unassignedTasks.length === 0 && (
                      <p className="text-center font-inter text-xs text-outline py-4">All tasks are in a sprint</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Create sprint button (when there is an active sprint) */}
            {currentSprint && (
              <button
                onClick={() => { setEditSprint(null); setSprintModalOpen(true); }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-surface-container text-on-surface-variant font-inter text-sm"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                Plan next sprint
              </button>
            )}
          </div>
        )}

        {/* ── BOARD VIEW ───────────────────────────────────────────────────── */}
        {view === 'board' && (
          <div className="lg:grid lg:grid-cols-4 lg:gap-3 lg:items-start space-y-3 lg:space-y-0">
            {boardColumns.map((col) => {
              const colTasks = boardItems.filter((t) => t.status === col.id);
              const isDone = col.id === 'done';
              const collapsed = collapsedSections.has(col.id);

              return (
                <div key={col.id} className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-card">
                  <button
                    onClick={() => toggleSection(col.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-container/60 transition-colors"
                  >
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: col.color }} />
                    <span className="font-inter font-semibold text-sm text-on-surface flex-1 text-left uppercase tracking-wide">{col.name}</span>
                    <span className="font-inter text-xs text-outline font-bold bg-surface-container px-2 py-0.5 rounded-full">{colTasks.length}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); openNew(col.id); }}
                      className="p-1 rounded-lg text-outline hover:text-primary hover:bg-primary/10 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">add</span>
                    </button>
                    <span className={`material-symbols-outlined text-[18px] text-outline transition-transform ${collapsed ? '' : 'rotate-180'}`}>expand_more</span>
                  </button>

                  {!collapsed && (
                    <div className={`px-4 pb-4 space-y-2 border-t border-outline-variant/20 pt-2 ${isDone ? 'opacity-70' : ''}`}>
                      {colTasks.map((task) => (
                        <BoardCard key={task.id} task={task} tasks={tasks} onEdit={openEdit} />
                      ))}
                      {colTasks.length === 0 && (
                        <button
                          onClick={() => openNew(col.id)}
                          className="w-full border-2 border-dashed border-outline-variant/40 rounded-xl p-3 flex items-center justify-center gap-2 hover:border-primary/30 hover:bg-primary/5 transition-all"
                        >
                          <span className="material-symbols-outlined text-[16px] text-outline">add</span>
                          <span className="font-inter text-xs text-outline">Add task</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── TIMELINE VIEW ────────────────────────────────────────────────── */}
        {view === 'timeline' && (
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
        onClose={() => { setTaskModalOpen(false); setEditTask(null); setScopeEpicId(null); }}
        task={editTask}
        defaultStatus={defaultStatus}
        parentId={defaultParentId}
        defaultIssueType={defaultIssueType}
        scopeEpicId={scopeEpicId}
      />
      <TagManager open={tagManagerOpen} onClose={() => setTagManagerOpen(false)} />
      <SprintModal
        open={sprintModalOpen}
        sprint={editSprint}
        onClose={() => { setSprintModalOpen(false); setEditSprint(null); }}
      />
    </div>
  );
}
