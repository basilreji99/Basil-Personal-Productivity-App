import { useState, useEffect, useMemo, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Modal from '../ui/Modal';
import TagChip from '../ui/TagChip';
import DatePicker from '../ui/DatePicker';
import type { Task, TaskPriority, IssueType, RecurringFrequency } from '../../types';
import { useTasksStore } from '../../store/tasksStore';
import { useSprintStore } from '../../store/sprintStore';
import { useTagStore } from '../../store/tagStore';
import { useNotesStore } from '../../store/notesStore';
import { scheduleTaskNotifications } from '../../services/taskNotifications';
import { useTimerStore } from '../../store/timerStore';

const PRIORITIES: { value: TaskPriority; label: string; color: string; bg: string }[] = [
  { value: 'critical', label: 'Emergency', color: 'text-red-700 dark:text-red-400',    bg: 'bg-red-100 border-red-300 dark:bg-red-950/40 dark:border-red-800' },
  { value: 'high',     label: 'High',      color: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-100 border-orange-300 dark:bg-orange-950/40 dark:border-orange-800' },
  { value: 'medium',   label: 'Medium',    color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-100 border-amber-300 dark:bg-amber-950/40 dark:border-amber-800' },
  { value: 'low',      label: 'Low',       color: 'text-blue-700 dark:text-blue-400',  bg: 'bg-blue-100 border-blue-300 dark:bg-blue-950/40 dark:border-blue-800' },
  { value: 'none',     label: 'None',      color: 'text-outline',                       bg: 'bg-surface-container border-outline-variant' },
];

const ISSUE_TYPES: { value: IssueType; label: string; icon: string; cls: string }[] = [
  { value: 'epic',    label: 'Epic',    icon: 'bolt',                      cls: 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800' },
  { value: 'story',   label: 'Story',   icon: 'bookmark',                  cls: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800' },
  { value: 'task',    label: 'Task',    icon: 'task_alt',                  cls: 'bg-surface-container text-on-surface-variant border-outline-variant' },
  { value: 'bug',     label: 'Bug',     icon: 'bug_report',                cls: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800' },
  { value: 'subtask', label: 'Subtask', icon: 'subdirectory_arrow_right',  cls: 'bg-surface-container text-on-surface-variant border-outline-variant' },
];

function toHtml(text: string): string {
  if (!text) return '';
  if (text.startsWith('<')) return text;
  return text.split('\n').map((line) => `<p>${line || '<br/>'}</p>`).join('');
}

function DescriptionEditor({ content, onChange }: { content: string; onChange: (html: string) => void }) {
  const [showToolbar, setShowToolbar] = useState(false);
  const editor = useEditor({
    extensions: [StarterKit, Underline],
    content: toHtml(content),
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: 'min-h-[60px] max-h-[180px] overflow-y-auto outline-none font-work-sans text-sm text-on-surface leading-relaxed px-3 py-2',
      },
    },
  });

  if (!editor) return null;

  const Btn = ({ active, onPress, children }: { active: boolean; onPress: () => void; children: React.ReactNode }) => (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onPress(); }}
      className={`px-2 py-1 rounded text-xs font-medium transition-colors select-none ${active ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container'}`}
    >
      {children}
    </button>
  );

  return (
    <div className="border border-outline-variant/30 rounded-lg overflow-hidden focus-within:border-primary/40 transition-colors">
      {showToolbar && (
        <div className="flex gap-0.5 p-1.5 border-b border-outline-variant/20 bg-surface-container/50 flex-wrap">
          <Btn active={editor.isActive('bold')} onPress={() => editor.chain().focus().toggleBold().run()}><strong>B</strong></Btn>
          <Btn active={editor.isActive('italic')} onPress={() => editor.chain().focus().toggleItalic().run()}><em>I</em></Btn>
          <Btn active={editor.isActive('underline')} onPress={() => editor.chain().focus().toggleUnderline().run()}><span className="underline">U</span></Btn>
          <Btn active={editor.isActive('code')} onPress={() => editor.chain().focus().toggleCode().run()}>{'</>'}</Btn>
          <div className="w-px h-5 bg-outline-variant/40 self-center mx-0.5" />
          <Btn active={editor.isActive('bulletList')} onPress={() => editor.chain().focus().toggleBulletList().run()}>• List</Btn>
          <Btn active={editor.isActive('orderedList')} onPress={() => editor.chain().focus().toggleOrderedList().run()}>1. List</Btn>
          <div className="flex-1" />
          <Btn active={false} onPress={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}>Clear</Btn>
        </div>
      )}
      <div className="relative">
        <EditorContent editor={editor} />
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); setShowToolbar((v) => !v); }}
          className={`absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded text-[10px] font-inter font-semibold transition-colors ${showToolbar ? 'bg-primary text-on-primary' : 'bg-surface-container text-outline hover:text-on-surface'}`}
          title="Toggle formatting"
        >
          Aa
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

interface TaskModalProps {
  open: boolean;
  onClose: () => void;
  task?: Task | null;
  defaultStatus?: string;
  parentId?: string | null;
  defaultIssueType?: IssueType;
  scopeEpicId?: string | null;
  defaultSprintId?: string | null;
}

export default function TaskModal({
  open, onClose, task, defaultStatus = 'backlog', parentId = null, defaultIssueType, scopeEpicId = null, defaultSprintId = null,
}: TaskModalProps) {
  const { columns, tasks, addTask, updateTask } = useTasksStore();
  const { sprints } = useSprintStore();
  const openFocus = useTimerStore((s) => s.openFocus);
  const { notes } = useNotesStore();
  const { recordUsage, getSuggestions } = useTagStore();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState(defaultStatus);
  const [priority, setPriority] = useState<TaskPriority>('none');
  const [issueType, setIssueType] = useState<IssueType>(defaultIssueType ?? 'task');
  const [selectedParentId, setSelectedParentId] = useState<string | null>(parentId);
  const [sprintId, setSprintId] = useState<string | null>(null);
  const [linkedNoteIds, setLinkedNoteIds] = useState<string[]>([]);
  const [noteSearch, setNoteSearch] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [deadlineTime, setDeadlineTime] = useState('');
  const [notifOffsets, setNotifOffsets] = useState<('2h' | '1h' | '30min' | '15min')[]>(['30min', '15min']);
  const [recurring, setRecurring] = useState<RecurringFrequency | ''>('');

  // Available parents by issue type, scoped to a specific epic if opened from within one
  const parentOptions = useMemo(() => {
    if (issueType === 'epic') return [];
    let candidates: Task[];
    if (issueType === 'story') {
      candidates = tasks.filter((t) => t.issueType === 'epic');
    } else if (issueType === 'task' || issueType === 'bug') {
      candidates = tasks.filter((t) => t.issueType === 'epic' || t.issueType === 'story');
    } else if (issueType === 'subtask') {
      candidates = tasks.filter((t) => t.issueType === 'task' || t.issueType === 'bug' || t.issueType === 'story');
    } else {
      return [];
    }
    if (scopeEpicId) {
      candidates = candidates.filter((t) => t.id === scopeEpicId || t.parentId === scopeEpicId);
    }
    return candidates;
  }, [issueType, tasks, scopeEpicId]);

  const filteredNotes = useMemo(() => {
    const q = noteSearch.trim().toLowerCase();
    return notes
      .filter((n) => !linkedNoteIds.includes(n.id))
      .filter((n) => !q || n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q))
      .slice(0, 5);
  }, [notes, linkedNoteIds, noteSearch]);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description);
      setStatus(task.status);
      setPriority(task.priority);
      setIssueType(task.issueType ?? 'task');
      setSelectedParentId(task.parentId);
      setSprintId(task.sprintId ?? null);
      setLinkedNoteIds(task.linkedNoteIds ?? []);
      setTags(task.tags);
      setDueDate(task.dueDate ? task.dueDate.split('T')[0] : '');
      setStartTime(task.startTime ?? '');
      setDeadlineTime(task.deadlineTime ?? '');
      setNotifOffsets(task.notificationOffsets ?? ['30min', '15min']);
      setRecurring(task.recurring?.frequency ?? '');
    } else {
      setTitle('');
      setDescription('');
      setStatus(defaultStatus);
      setPriority('low');
      setIssueType(defaultIssueType ?? 'task');
      setSelectedParentId(parentId);
      setSprintId(defaultSprintId);
      setLinkedNoteIds([]);
      setTags([]);
      setDueDate('');
      setStartTime('');
      setDeadlineTime('');
      setNotifOffsets(['30min', '15min']);
      setRecurring('');
    }
    setTagInput('');
    setNoteSearch('');
  }, [task, open, defaultStatus, parentId, defaultIssueType]);

  useEffect(() => {
    if (issueType === 'epic') setSelectedParentId(null);
  }, [issueType]);

  const handleSave = () => {
    if (!title.trim()) return;

    // Auto-assign to active sprint if date falls within its range and no sprint chosen
    const activeSprint = sprints.find(s => s.status === 'active');
    const effectiveSprintId = sprintId
      ?? (dueDate && activeSprint && dueDate >= activeSprint.startDate && dueDate <= activeSprint.endDate
          ? activeSprint.id : null);
    const effectiveStatus = effectiveSprintId && status === 'backlog' ? 'todo' : status;

    const payload: Partial<Task> = {
      title: title.trim(),
      description,
      status: effectiveStatus,
      priority,
      issueType,
      tags,
      parentId: selectedParentId,
      sprintId: effectiveSprintId,
      linkedNoteIds,
      dueDate: dueDate || null,
      startTime: dueDate && startTime ? startTime : undefined,
      deadlineTime: dueDate && deadlineTime ? deadlineTime : undefined,
      notificationOffsets: dueDate && deadlineTime ? notifOffsets : dueDate && startTime ? notifOffsets : undefined,
      recurring: recurring
        ? { frequency: recurring as RecurringFrequency, nextDue: dueDate || new Date().toISOString() }
        : null,
    };
    if (tags.length) recordUsage(tags);
    let savedId: string;
    if (task) {
      updateTask(task.id, payload);
      savedId = task.id;
    } else {
      const created = addTask(payload);
      savedId = created.id;
    }
    scheduleTaskNotifications({
      id: savedId,
      title: title.trim(),
      dueDate: dueDate || null,
      startTime: payload.startTime,
      deadlineTime: payload.deadlineTime,
      notificationOffsets: payload.notificationOffsets,
    });
    onClose();
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput('');
  };

  const handleTagKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); }
    if (e.key === 'Backspace' && !tagInput && tags.length) setTags(tags.slice(0, -1));
  };

  const suggestions = getSuggestions(tags, tagInput, 5);

  const modalTitle = task ? 'Edit' : parentId ? `New ${ISSUE_TYPES.find((t) => t.value === issueType)?.label}` : 'New Task';

  // Auto-expand details if editing a task that already has values in those fields
  const hasDetails = !!(
    sprintId || recurring || startTime ||
    tags.length || linkedNoteIds.length || selectedParentId
  );
  const [showDetails, setShowDetails] = useState(false);
  const detailsRef = useRef<boolean>(false);
  useEffect(() => {
    if (!open) { detailsRef.current = false; setShowDetails(false); return; }
    if (!detailsRef.current && hasDetails) { setShowDetails(true); detailsRef.current = true; }
  }, [open, hasDetails]);

  return (
    <Modal open={open} onClose={onClose} title={modalTitle} size="md">
      <div className="p-5 space-y-4">

        {/* Title */}
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          autoFocus
          className="w-full border-none outline-none font-manrope font-bold text-lg text-on-surface bg-surface-container rounded-lg px-3 py-2 placeholder:text-outline/50"
        />

        {/* Issue type */}
        <div className="flex gap-1.5 flex-wrap">
          {ISSUE_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setIssueType(t.value)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border font-inter text-xs font-semibold transition-all ${
                issueType === t.value ? t.cls + ' border-current ring-1 ring-current/30' : 'border-outline-variant text-on-surface-variant hover:border-outline'
              }`}
            >
              <span className="material-symbols-outlined text-[13px]">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* Priority + Due Date row */}
        <div className="flex items-center gap-2 flex-wrap">
          {PRIORITIES.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPriority(p.value)}
              className={`px-2.5 py-1 rounded-lg border font-inter text-xs font-semibold transition-all ${
                priority === p.value ? `${p.bg} ${p.color}` : 'border-outline-variant text-on-surface-variant hover:border-outline'
              }`}
            >
              {p.label}
            </button>
          ))}
          <div className="w-px h-5 bg-outline-variant/40 self-center" />
          <DatePicker value={dueDate} onChange={setDueDate} placeholder="No due date" clearable />
        </div>

        {/* Deadline time — inline, visible only when a due date is set */}
        {dueDate && (
          <div className="flex items-center gap-2 bg-surface-container rounded-xl px-3 py-2.5">
            <span className="material-symbols-outlined text-[16px] text-error shrink-0">alarm</span>
            <span className="font-inter text-xs font-semibold text-on-surface-variant w-[82px] shrink-0">Deadline time</span>
            <input
              type="time"
              value={deadlineTime}
              onChange={(e) => setDeadlineTime(e.target.value)}
              className="bg-surface-container-high border border-outline-variant/30 rounded-lg px-2 py-1 font-inter text-sm text-on-surface outline-none focus:border-error/40 w-[110px] shrink-0"
            />
            {deadlineTime && (
              <>
                <div className="flex gap-1.5 ml-2 flex-wrap flex-1">
                  {(['15min', '30min', '1h', '2h'] as const).map((offset) => {
                    const active = notifOffsets.includes(offset);
                    return (
                      <button
                        key={offset}
                        type="button"
                        onClick={() => setNotifOffsets((prev) =>
                          active ? prev.filter((o) => o !== offset) : [...prev, offset],
                        )}
                        className={`px-2 py-0.5 rounded-full border font-inter text-[10px] font-semibold transition-all ${
                          active ? 'bg-error/10 text-error border-error/30' : 'border-outline-variant/50 text-outline hover:border-error/30 hover:text-error'
                        }`}
                      >
                        {offset}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => setDeadlineTime('')}
                  className="font-inter text-[10px] text-outline hover:text-error shrink-0"
                >
                  clear
                </button>
              </>
            )}
          </div>
        )}

        {/* Description */}
        <DescriptionEditor content={description} onChange={setDescription} />

        {/* Details toggle */}
        <button
          type="button"
          onClick={() => setShowDetails((v) => !v)}
          className="flex items-center gap-1.5 font-inter text-xs font-semibold text-on-surface-variant hover:text-on-surface transition-colors"
        >
          <span className={`material-symbols-outlined text-[14px] transition-transform ${showDetails ? 'rotate-90' : ''}`}>chevron_right</span>
          Details
          {hasDetails && !showDetails && (
            <span className="ml-1 px-1.5 py-0.5 bg-primary/10 text-primary rounded-full text-[10px]">
              {[sprintId, recurring, startTime, tags.length > 0, linkedNoteIds.length > 0, selectedParentId].filter(Boolean).length} set
            </span>
          )}
        </button>

        {showDetails && (
          <div className="space-y-4 border-t border-outline-variant/20 pt-4">

            {/* Status */}
            <div className="space-y-1">
              <label className="font-inter text-xs font-semibold uppercase tracking-wider text-outline">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-2 font-inter text-sm text-on-surface outline-none focus:border-primary/40"
              >
                {columns.map((col) => (
                  <option key={col.id} value={col.id}>{col.name}</option>
                ))}
              </select>
            </div>

            {/* Parent */}
            {parentOptions.length > 0 && (
              <div className="space-y-1.5">
                <label className="font-inter text-xs font-semibold uppercase tracking-wider text-outline">
                  Parent {issueType === 'story' ? 'Epic' : issueType === 'subtask' ? 'Task / Story' : 'Epic / Story'}
                </label>
                <select
                  value={selectedParentId ?? ''}
                  onChange={(e) => setSelectedParentId(e.target.value || null)}
                  className="w-full bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-2 font-inter text-sm text-on-surface outline-none focus:border-primary/40"
                >
                  <option value="">— No parent —</option>
                  {parentOptions.map((p) => (
                    <option key={p.id} value={p.id}>[{p.issueType.toUpperCase()}] {p.title}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Sprint */}
            {sprints.length > 0 && (
              <div className="space-y-1.5">
                <label className="font-inter text-xs font-semibold uppercase tracking-wider text-outline">Sprint</label>
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => setSprintId(null)}
                    className={`w-full flex items-center px-3 py-2 rounded-lg border font-inter text-xs text-left transition-all ${
                      !sprintId ? 'bg-surface-container border-outline/40 text-on-surface' : 'border-outline-variant/30 text-on-surface-variant hover:border-outline/40'
                    }`}
                  >
                    No sprint
                  </button>
                  {sprints.map((sp) => {
                    const [y, m, d] = sp.startDate.split('-').map(Number);
                    const [y2, m2, d2] = sp.endDate.split('-').map(Number);
                    const fmt = (yr: number, mo: number, dy: number) =>
                      new Date(yr, mo - 1, dy).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    return (
                      <button
                        key={sp.id}
                        type="button"
                        onClick={() => setSprintId(sp.id)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border font-inter text-xs text-left transition-all ${
                          sprintId === sp.id
                            ? 'bg-primary/10 border-primary/40 text-on-surface'
                            : 'border-outline-variant/30 text-on-surface-variant hover:border-outline/40'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${sp.status === 'active' ? 'bg-green-500' : 'bg-outline/40'}`} />
                        <span className="flex-1 font-semibold truncate">{sp.name}</span>
                        <span className="shrink-0 text-outline">{fmt(y, m, d)} → {fmt(y2, m2, d2)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recurring */}
            <div className="space-y-1">
              <label className="font-inter text-xs font-semibold uppercase tracking-wider text-outline">Recurring</label>
              <select
                value={recurring}
                onChange={(e) => setRecurring(e.target.value as RecurringFrequency | '')}
                className="w-full bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-2 font-inter text-sm text-on-surface outline-none focus:border-primary/40"
              >
                <option value="">Not recurring</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            {/* Start time (deadline time is inline in main area) */}
            {dueDate && (
              <div className="space-y-1">
                <label className="font-inter text-xs font-semibold uppercase tracking-wider text-outline flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px]">schedule</span>Start Time
                </label>
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
                  className="w-full bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-2 font-inter text-sm text-on-surface outline-none focus:border-primary/40" />
                {startTime && <button type="button" onClick={() => setStartTime('')} className="font-inter text-[10px] text-outline hover:text-error">clear</button>}
              </div>
            )}
            {/* Notification reminders card (start time only; deadline reminders are inline) */}
            {dueDate && startTime && (
              <div className="rounded-2xl overflow-hidden border border-primary/20 bg-gradient-to-br from-primary/5 via-background to-secondary/5">
                <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-primary/10">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[16px] text-primary">notifications_active</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-inter font-semibold text-sm text-on-surface leading-none">Reminders</p>
                    <p className="font-inter text-[10px] text-outline mt-0.5">
                      {notifOffsets.length === 0 ? 'No reminders set' : `${notifOffsets.length} reminder${notifOffsets.length > 1 ? 's' : ''} before each time`}
                    </p>
                  </div>
                </div>
                <div className="px-4 py-3 space-y-2">
                  <p className="font-inter text-[10px] font-semibold uppercase tracking-wider text-outline">Notify me before</p>
                  <div className="flex gap-2">
                    {(['2h', '1h', '30min'] as const).map((offset) => {
                      const active = notifOffsets.includes(offset);
                      const label = offset === '30min' ? '30 min' : offset;
                      return (
                        <button
                          key={offset}
                          type="button"
                          onClick={() => setNotifOffsets(prev =>
                            active ? prev.filter(o => o !== offset) : [...prev, offset]
                          )}
                          className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl border font-inter font-semibold text-xs transition-all ${
                            active
                              ? 'bg-primary text-on-primary border-primary shadow-sm'
                              : 'border-outline-variant/40 text-on-surface-variant hover:border-primary/40 hover:text-primary'
                          }`}
                        >
                          <span className={`material-symbols-outlined text-[18px] ${active ? 'text-on-primary' : 'text-outline'}`}>
                            {offset === '2h' ? 'schedule' : offset === '1h' ? 'timer' : 'alarm'}
                          </span>
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex gap-1 flex-wrap mt-1">
                    {startTime && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 font-inter text-[10px] text-primary">
                        <span className="material-symbols-outlined text-[11px]">schedule</span>
                        Start {startTime}
                      </span>
                    )}
                    {deadlineTime && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary/10 font-inter text-[10px] text-secondary">
                        <span className="material-symbols-outlined text-[11px]">timer</span>
                        Deadline {deadlineTime}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Tags */}
            <div className="space-y-1.5">
              <label className="font-inter text-xs font-semibold uppercase tracking-wider text-outline">Tags</label>
              <div className="flex flex-wrap gap-1.5 items-center min-h-[32px] bg-surface-container rounded-lg px-3 py-2">
                {tags.map((tag) => (
                  <TagChip key={tag} tag={tag} onRemove={() => setTags(tags.filter((t) => t !== tag))} size="sm" />
                ))}
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKey}
                  onBlur={addTag}
                  placeholder={tags.length ? '' : 'Add tag...'}
                  className="bg-transparent border-none outline-none font-inter text-xs text-on-surface placeholder:text-outline/50 flex-1 min-w-[80px]"
                />
              </div>
              {suggestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.map((s) => (
                    <button key={s} type="button" onMouseDown={(e) => { e.preventDefault(); setTags([...tags, s]); }}
                      className="px-2.5 py-1 rounded-full bg-surface-container-low border border-outline-variant font-inter text-xs text-on-surface-variant hover:border-primary/50 hover:text-primary transition-colors">
                      + {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Linked Notes */}
            <div className="space-y-1.5">
              <label className="font-inter text-xs font-semibold uppercase tracking-wider text-outline flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px]">sticky_note_2</span>Linked Notes
              </label>
              {linkedNoteIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-1.5">
                  {linkedNoteIds.map((nid) => {
                    const n = notes.find((x) => x.id === nid);
                    return n ? (
                      <div key={nid} className="flex items-center gap-1 bg-primary/10 text-primary rounded-full px-2.5 py-1 font-inter text-xs">
                        <span>{n.title || 'Untitled'}</span>
                        <button onClick={() => setLinkedNoteIds((ids) => ids.filter((id) => id !== nid))} className="ml-0.5 opacity-60 hover:opacity-100">×</button>
                      </div>
                    ) : null;
                  })}
                </div>
              )}
              <input type="text" value={noteSearch} onChange={(e) => setNoteSearch(e.target.value)}
                placeholder="Search notes to link..."
                className="w-full bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-2 font-inter text-sm text-on-surface outline-none focus:border-primary/40 placeholder:text-outline/50" />
              {noteSearch && filteredNotes.length > 0 && (
                <div className="bg-surface-container-low border border-outline-variant/20 rounded-lg overflow-hidden">
                  {filteredNotes.map((n) => (
                    <button key={n.id} type="button"
                      onClick={() => { setLinkedNoteIds((ids) => [...ids, n.id]); setNoteSearch(''); }}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-surface-container text-left transition-colors">
                      <span className="material-symbols-outlined text-[14px] text-outline">sticky_note_2</span>
                      <span className="font-inter text-sm text-on-surface truncate">{n.title || 'Untitled Note'}</span>
                    </button>
                  ))}
                </div>
              )}
              {noteSearch && filteredNotes.length === 0 && (
                <p className="font-inter text-xs text-outline px-1">No matching notes</p>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant/10">
          {task && (
            <button
              onClick={() => { handleSave(); openFocus(task.id, title.trim() || task.title); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary/10 text-secondary font-inter font-medium text-sm hover:bg-secondary/20 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">center_focus_strong</span>
              Focus
            </button>
          )}
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-on-surface-variant font-inter font-medium text-sm hover:bg-surface-container transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim()}
            className="px-4 py-2 rounded-lg bg-primary text-on-primary font-inter font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {task ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
