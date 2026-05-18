import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TopBar from '../components/layout/TopBar';
import SubtaskItem from '../components/tasks/SubtaskItem';
import TaskModal from '../components/tasks/TaskModal';
import FocusTimer from '../components/timer/FocusTimer';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import TagChip from '../components/ui/TagChip';
import { useTasksStore } from '../store/tasksStore';
import { useTimerStore } from '../store/timerStore';
import { sanitizeHtml } from '../utils/sanitizeHtml';
import { useNotesStore } from '../store/notesStore';
import type { Task } from '../types';
import { formatDisplayDate, formatRelative, formatTime12, isOverdue } from '../utils/dateUtils';
import { cancelTaskNotifications } from '../services/taskNotifications';

const PRIORITY_LABEL: Record<string, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  none: 'No priority',
};

const PRIORITY_COLOR: Record<string, string> = {
  critical: 'text-red-500 bg-red-50',
  high: 'text-orange-500 bg-orange-50',
  medium: 'text-amber-500 bg-amber-50',
  low: 'text-blue-400 bg-blue-50',
  none: 'text-outline bg-surface-container',
};

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getTaskById, updateTask, deleteTask, addSubtask, getSubtasks, columns, addEvent, deleteEvent } = useTasksStore();
  const setTimerTask = useTimerStore((s) => s.setTask);
  const notes = useNotesStore((s) => s.notes);

  const task = getTaskById(id!);

  // Modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingSubtask, setEditingSubtask] = useState<Task | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // UI state
  const [showTimer, setShowTimer] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [addingSubtaskFor, setAddingSubtaskFor] = useState<string | null>(null);

  // Event form state
  const [showEventForm, setShowEventForm] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');

  if (!task) {
    return (
      <div className="bg-background min-h-screen flex items-center justify-center">
        <div className="text-center">
          <span className="material-symbols-outlined text-[48px] text-outline mb-3 block">task_alt</span>
          <p className="font-manrope font-semibold text-on-surface mb-2">Task not found</p>
          <button onClick={() => navigate('/tasks')} className="font-inter text-sm text-primary hover:underline">
            Back to Tasks
          </button>
        </div>
      </div>
    );
  }

  const topLevelSubtasks = getSubtasks(task.id);

  const countAllDescendants = (parentId: string): number => {
    const children = getSubtasks(parentId);
    return children.reduce((acc, c) => acc + 1 + countAllDescendants(c.id), 0);
  };
  const totalSubtasks = countAllDescendants(task.id);

  const countDoneDescendants = (parentId: string): number => {
    const children = getSubtasks(parentId);
    return children.reduce((acc, c) => {
      const done = c.status === 'done' ? 1 : 0;
      return acc + done + countDoneDescendants(c.id);
    }, 0);
  };
  const doneSubtasks = countDoneDescendants(task.id);
  const progress = totalSubtasks > 0 ? Math.round((doneSubtasks / totalSubtasks) * 100) : 0;

  const column = columns.find((c) => c.id === task.status);

  const handleAddSubtask = (parentId: string) => {
    setAddingSubtaskFor(parentId);
    setNewSubtaskTitle('');
  };

  const submitQuickSubtask = (parentId: string) => {
    if (newSubtaskTitle.trim()) {
      addSubtask(parentId, newSubtaskTitle.trim());
    }
    setAddingSubtaskFor(null);
    setNewSubtaskTitle('');
  };

  const handleAddEvent = () => {
    if (!eventTitle.trim() || !eventDate) return;
    addEvent(task.id, { title: eventTitle.trim(), date: eventDate, time: eventTime || undefined });
    setEventTitle('');
    setEventDate('');
    setEventTime('');
    setShowEventForm(false);
  };

  const startTimer = () => {
    setTimerTask(task.id, task.title);
    setShowTimer(true);
  };

  return (
    <div className="bg-background min-h-screen">
      <TopBar
        title="Productivity"
        showBack
        rightSlot={
          <div className="flex items-center gap-1">
            <button
              onClick={startTimer}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors"
              title="Start Focus Timer"
            >
              <span className="material-symbols-outlined text-[22px]">timer</span>
            </button>
            <button
              onClick={() => setEditModalOpen(true)}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors"
            >
              <span className="material-symbols-outlined text-[22px]">edit</span>
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors"
            >
              <span className="material-symbols-outlined text-[22px]">delete</span>
            </button>
          </div>
        }
      />

      <main className="max-w-screen-xl mx-auto px-4 py-5 pb-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Main content */}
        <div className="lg:col-span-2 space-y-5">
          {/* Hero Card */}
          <section className="bg-surface-container-lowest rounded-xl shadow-card p-5 border border-surface-container">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className={`px-3 py-1 rounded-full font-inter font-semibold text-xs uppercase tracking-wide ${
                task.status === 'in_progress' ? 'bg-primary-container/20 text-primary' :
                task.status === 'done' ? 'bg-tertiary-container/30 text-tertiary' :
                task.status === 'review' ? 'bg-secondary/10 text-secondary' :
                'bg-surface-container text-on-surface-variant'
              }`}>
                {column?.name ?? task.status.replace('_', ' ')}
              </span>
              <span className={`px-3 py-1 rounded-full font-inter font-semibold text-xs uppercase tracking-wide ${PRIORITY_COLOR[task.priority]}`}>
                {PRIORITY_LABEL[task.priority]}
              </span>
              {task.recurring && (
                <span className="px-3 py-1 rounded-full font-inter font-semibold text-xs uppercase tracking-wide bg-secondary/10 text-secondary flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px]">repeat</span>
                  {task.recurring.frequency}
                </span>
              )}
            </div>

            <h2 className="font-h2 text-h2 text-on-background mb-3">{task.title}</h2>

            {task.description && (
              task.description.startsWith('<') ? (
                <div
                  className="tiptap-content font-work-sans text-sm text-on-surface-variant leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(task.description) }}
                />
              ) : (
                <p className="font-work-sans text-sm text-on-surface-variant leading-relaxed whitespace-pre-wrap">
                  {task.description}
                </p>
              )
            )}

            {task.linkedNoteIds && task.linkedNoteIds.length > 0 && (
              <div className="mt-4 pt-4 border-t border-surface-container">
                <p className="font-inter text-[10px] font-semibold uppercase tracking-wider text-outline mb-2">
                  Linked Notes
                </p>
                <div className="flex flex-wrap gap-2">
                  {task.linkedNoteIds.map((noteId) => {
                    const note = notes.find((n) => n.id === noteId);
                    if (!note) return null;
                    return (
                      <div key={noteId} className="flex items-center gap-1.5 bg-surface-container rounded-lg px-3 py-1.5">
                        <span className="material-symbols-outlined text-[14px] text-primary">sticky_note_2</span>
                        <span className="font-inter text-xs text-on-surface">{note.title || 'Untitled Note'}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-5 pt-5 border-t border-surface-container flex flex-wrap gap-5">
              {task.dueDate && (
                <div className="flex flex-col gap-1">
                  <span className="font-inter text-[10px] font-semibold uppercase tracking-wider text-outline">Due Date</span>
                  <div className={`flex items-center gap-1.5 font-inter font-medium text-sm ${isOverdue(task.dueDate) ? 'text-error' : 'text-on-surface'}`}>
                    <span className="material-symbols-outlined text-[16px] text-primary">event</span>
                    {formatDisplayDate(task.dueDate)}
                    {isOverdue(task.dueDate) && <span className="text-error text-[10px] font-bold">OVERDUE</span>}
                  </div>
                </div>
              )}
              {task.dueDate && task.startTime && (
                <div className="flex flex-col gap-1">
                  <span className="font-inter text-[10px] font-semibold uppercase tracking-wider text-outline">Start Time</span>
                  <div className="flex items-center gap-1.5 font-inter font-medium text-sm text-on-surface">
                    <span className="material-symbols-outlined text-[16px] text-primary">schedule</span>
                    {formatTime12(task.startTime)}
                  </div>
                </div>
              )}
              {task.dueDate && task.deadlineTime && (
                <div className="flex flex-col gap-1">
                  <span className="font-inter text-[10px] font-semibold uppercase tracking-wider text-outline">Deadline</span>
                  <div className="flex items-center gap-1.5 font-inter font-medium text-sm text-on-surface">
                    <span className="material-symbols-outlined text-[16px] text-primary">timer</span>
                    {formatTime12(task.deadlineTime)}
                  </div>
                </div>
              )}
              {task.tags.length > 0 && (
                <div className="flex flex-col gap-1">
                  <span className="font-inter text-[10px] font-semibold uppercase tracking-wider text-outline">Tags</span>
                  <div className="flex gap-1 flex-wrap">
                    {task.tags.map((tag) => <TagChip key={tag} tag={tag} size="sm" />)}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Timer (collapsible) */}
          {showTimer && (
            <section className="animate-scale-in">
              <FocusTimer />
            </section>
          )}

          {/* Subtasks */}
          <section className="bg-surface-container-lowest rounded-xl shadow-card border border-surface-container">
            <div className="flex items-center justify-between p-5 pb-3">
              <div className="flex items-center gap-3">
                <h3 className="font-h3 text-h3 text-on-surface">Subtasks</h3>
                {totalSubtasks > 0 && (
                  <span className="font-inter font-bold text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                    {progress}% complete
                  </span>
                )}
              </div>
              <button
                onClick={() => handleAddSubtask(task.id)}
                className="flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary rounded-lg font-inter font-medium text-xs hover:bg-primary/20 transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                Add
              </button>
            </div>

            {totalSubtasks > 0 && (
              <div className="mx-5 mb-3 h-1.5 bg-surface-container rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}

            <div className="pb-3">
              {topLevelSubtasks.length === 0 && addingSubtaskFor !== task.id ? (
                <p className="text-center font-inter text-xs text-outline py-4">No subtasks yet</p>
              ) : (
                topLevelSubtasks.map((subtask) => (
                  <div key={subtask.id}>
                    <SubtaskItem
                      task={subtask}
                      depth={0}
                      onAddSubtask={handleAddSubtask}
                      onEditTask={setEditingSubtask}
                    />
                    {addingSubtaskFor === subtask.id && (
                      <QuickSubtaskInput
                        value={newSubtaskTitle}
                        onChange={setNewSubtaskTitle}
                        onSubmit={() => submitQuickSubtask(subtask.id)}
                        onCancel={() => setAddingSubtaskFor(null)}
                        indent={36}
                      />
                    )}
                  </div>
                ))
              )}

              {addingSubtaskFor === task.id && (
                <QuickSubtaskInput
                  value={newSubtaskTitle}
                  onChange={setNewSubtaskTitle}
                  onSubmit={() => submitQuickSubtask(task.id)}
                  onCancel={() => setAddingSubtaskFor(null)}
                  indent={12}
                />
              )}

              {topLevelSubtasks.length > 0 && addingSubtaskFor !== task.id && (
                <button
                  onClick={() => handleAddSubtask(task.id)}
                  className="flex items-center gap-2 text-outline hover:text-primary transition-colors py-2 px-4 border border-dashed border-outline-variant/40 rounded-lg w-[calc(100%-24px)] mx-3 justify-center mt-2"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  <span className="font-inter font-medium text-xs">Add new subtask...</span>
                </button>
              )}
            </div>
          </section>

          {/* Events */}
          <section className="bg-surface-container-lowest rounded-xl shadow-card border border-surface-container p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-h3 text-h3 text-on-surface">Events</h3>
              <button
                onClick={() => setShowEventForm((v) => !v)}
                className="flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary rounded-lg font-inter font-medium text-xs hover:bg-primary/20 transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">{showEventForm ? 'close' : 'add'}</span>
                {showEventForm ? 'Cancel' : 'Add Event'}
              </button>
            </div>

            {showEventForm && (
              <div className="bg-surface-container rounded-xl p-4 mb-4 space-y-3 animate-scale-in">
                <input
                  type="text"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  placeholder="Event title"
                  className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-3 py-2 font-inter text-sm text-on-surface outline-none focus:border-primary/40"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-3 py-2 font-inter text-sm text-on-surface outline-none focus:border-primary/40"
                  />
                  <input
                    type="time"
                    value={eventTime}
                    onChange={(e) => setEventTime(e.target.value)}
                    className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-3 py-2 font-inter text-sm text-on-surface outline-none focus:border-primary/40"
                  />
                </div>
                <button
                  onClick={handleAddEvent}
                  disabled={!eventTitle.trim() || !eventDate}
                  className="w-full py-2 bg-primary text-on-primary rounded-lg font-inter font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  Add Event
                </button>
              </div>
            )}

            {task.events.length === 0 ? (
              <p className="text-center font-inter text-xs text-outline py-4">No events linked to this task</p>
            ) : (
              <div className="space-y-2">
                {task.events.map((event) => (
                  <div key={event.id} className="flex items-center gap-3 p-3 bg-surface-container-low rounded-lg group">
                    <span className="material-symbols-outlined text-[18px] text-primary">event</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-inter font-medium text-sm text-on-surface">{event.title}</p>
                      <p className="font-inter text-xs text-on-surface-variant">
                        {formatDisplayDate(event.date)}{event.time ? ` · ${event.time}` : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => deleteEvent(task.id, event.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-error-container/20 text-on-surface-variant hover:text-error"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right: Metadata sidebar */}
        <aside className="space-y-4">
          <div className="bg-surface-container-lowest rounded-xl shadow-card border border-surface-container p-4">
            <h4 className="font-inter font-semibold text-xs uppercase tracking-wider text-outline mb-3">Move to</h4>
            <div className="flex flex-col gap-1">
              {columns.map((col) => (
                <button
                  key={col.id}
                  onClick={() => updateTask(task.id, { status: col.id })}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg font-inter font-medium text-sm transition-all ${
                    task.status === col.id
                      ? 'bg-primary/10 text-primary'
                      : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                  }`}
                >
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: col.color }} />
                  {col.name}
                  {task.status === col.id && <span className="ml-auto material-symbols-outlined text-[16px] text-primary">check</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-surface-container-high/30 rounded-xl border border-surface-container p-4">
            <h4 className="font-inter font-semibold text-xs uppercase tracking-wider text-outline mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-primary">history</span>
              Activity
            </h4>
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-blue-600 text-[14px]">add_circle</span>
                </div>
                <div>
                  <p className="font-inter text-xs text-on-surface">Task created</p>
                  <span className="font-inter text-[10px] text-outline uppercase">{formatRelative(task.createdAt)}</span>
                </div>
              </div>
              {task.updatedAt !== task.createdAt && (
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-purple-600 text-[14px]">update</span>
                  </div>
                  <div>
                    <p className="font-inter text-xs text-on-surface">Last updated</p>
                    <span className="font-inter text-[10px] text-outline uppercase">{formatRelative(task.updatedAt)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>
      </main>

      {/* Edit task modal */}
      <TaskModal open={editModalOpen} onClose={() => setEditModalOpen(false)} task={task} />

      {/* Edit subtask modal */}
      <TaskModal
        open={editingSubtask !== null}
        onClose={() => setEditingSubtask(null)}
        task={editingSubtask}
      />

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => { cancelTaskNotifications(task.id); deleteTask(task.id); navigate('/tasks'); }}
        title="Delete Task"
        message={`"${task.title}" and all its subtasks will be permanently deleted.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}

function QuickSubtaskInput({ value, onChange, onSubmit, onCancel, indent }: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  indent: number;
}) {
  return (
    <div className="flex items-center gap-2 py-2" style={{ paddingLeft: `${indent}px`, paddingRight: '12px' }}>
      <div className="w-4 h-4 rounded border-2 border-outline-variant shrink-0" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit();
          if (e.key === 'Escape') onCancel();
        }}
        autoFocus
        placeholder="Subtask title..."
        className="flex-1 bg-surface-container rounded-lg px-3 py-1.5 font-inter text-sm text-on-surface outline-none border border-primary/30 placeholder:text-outline/50"
      />
      <button onClick={onSubmit} className="p-1 text-primary hover:opacity-80">
        <span className="material-symbols-outlined text-[18px]">check</span>
      </button>
      <button onClick={onCancel} className="p-1 text-outline hover:text-on-surface">
        <span className="material-symbols-outlined text-[18px]">close</span>
      </button>
    </div>
  );
}
