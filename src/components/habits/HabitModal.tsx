import { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import type { Habit, HabitColor, HabitFrequency } from '../../types';

const ICONS = [
  'fitness_center', 'menu_book', 'self_improvement', 'water_drop', 'bedtime',
  'directions_run', 'lunch_dining', 'local_cafe', 'music_note', 'code',
  'brush', 'language', 'psychology', 'hiking', 'monitor_heart',
  'mic', 'sports_soccer', 'camera_alt', 'shopping_bag', 'edit_note',
  'do_not_disturb', 'sports_basketball', 'pool', 'sports_martial_arts', 'star',
];

const COLORS: { value: HabitColor; bg: string; ring: string }[] = [
  { value: 'blue', bg: 'bg-blue-500', ring: 'ring-blue-300' },
  { value: 'green', bg: 'bg-green-500', ring: 'ring-green-300' },
  { value: 'purple', bg: 'bg-purple-500', ring: 'ring-purple-300' },
  { value: 'orange', bg: 'bg-orange-500', ring: 'ring-orange-300' },
  { value: 'pink', bg: 'bg-pink-500', ring: 'ring-pink-300' },
  { value: 'teal', bg: 'bg-teal-500', ring: 'ring-teal-300' },
];

const HABIT_BG: Record<HabitColor, string> = {
  blue: 'bg-blue-500', green: 'bg-green-500', purple: 'bg-purple-500',
  orange: 'bg-orange-500', pink: 'bg-pink-500', teal: 'bg-teal-500',
};

const FREQ_LABELS: Record<HabitFrequency, string> = {
  daily: 'Daily', weekdays: 'Weekdays', weekly: 'Weekly', monthly: 'Monthly',
};

interface HabitModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<Habit>) => void;
  habit?: Habit | null;
}

export default function HabitModal({ open, onClose, onSave, habit }: HabitModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [frequency, setFrequency] = useState<HabitFrequency>('daily');
  const [color, setColor] = useState<HabitColor>('blue');
  const [icon, setIcon] = useState('fitness_center');
  const [targetDays, setTargetDays] = useState(3);
  const [hasNotes, setHasNotes] = useState(false);
  const [notesPrompt, setNotesPrompt] = useState('');
  const [reminderTime, setReminderTime] = useState('');
  const [linkedSource, setLinkedSource] = useState<'gym' | 'sports' | ''>('');

  useEffect(() => {
    if (habit) {
      setName(habit.name);
      setDescription(habit.description);
      setFrequency(habit.frequency);
      setColor(habit.color);
      setIcon(habit.icon);
      setTargetDays(habit.targetDays);
      setHasNotes(habit.hasNotes);
      setNotesPrompt(habit.notesPrompt ?? '');
      setReminderTime(habit.reminderTime ?? '');
      setLinkedSource(habit.linkedSource ?? '');
    } else {
      setName('');
      setDescription('');
      setFrequency('daily');
      setColor('blue');
      setIcon('fitness_center');
      setTargetDays(3);
      setHasNotes(false);
      setNotesPrompt('');
      setReminderTime('');
      setLinkedSource('');
    }
  }, [habit, open]);

  // Auto-adjust targetDays when frequency changes
  useEffect(() => {
    if (frequency === 'daily') setTargetDays(7);
    else if (frequency === 'weekdays') setTargetDays(5);
    else if (frequency === 'monthly') setTargetDays(1);
  }, [frequency]);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      description,
      frequency,
      color,
      icon,
      targetDays,
      hasNotes,
      notesPrompt: hasNotes ? notesPrompt.trim() || undefined : undefined,
      reminderTime: reminderTime.trim() || undefined,
      linkedSource: linkedSource || undefined,
    });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={habit ? 'Edit Habit' : 'New Habit'} size="md">
      <div className="p-5 space-y-4">
        {/* Preview */}
        <div className={`flex items-center gap-3 p-4 rounded-xl ${HABIT_BG[color]}`}>
          <span className="material-symbols-outlined text-[28px] text-white">{icon}</span>
          <div>
            <p className="font-manrope font-bold text-base text-white">{name || 'Habit Name'}</p>
            <p className="font-inter text-xs text-white/70">{FREQ_LABELS[frequency]}</p>
          </div>
        </div>

        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Habit name"
          className="w-full px-4 py-2.5 bg-surface-container rounded-lg font-work-sans text-base text-on-surface outline-none border border-outline-variant/30 focus:border-primary/40 placeholder:text-outline/50"
        />

        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          className="w-full px-4 py-2.5 bg-surface-container rounded-lg font-work-sans text-sm text-on-surface outline-none border border-outline-variant/30 focus:border-primary/40 placeholder:text-outline/50"
        />

        {/* Frequency */}
        <div className="space-y-1.5">
          <label className="font-inter text-xs font-semibold uppercase tracking-wider text-outline">Frequency</label>
          <div className="grid grid-cols-2 gap-2">
            {(['daily', 'weekdays', 'weekly', 'monthly'] as HabitFrequency[]).map((f) => (
              <button
                key={f}
                onClick={() => setFrequency(f)}
                className={`py-2 rounded-lg border font-inter font-medium text-xs transition-all ${
                  frequency === f
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-outline-variant text-on-surface-variant hover:border-outline'
                }`}
              >
                {FREQ_LABELS[f]}
              </button>
            ))}
          </div>
        </div>

        {/* Target days (weekly only) */}
        {frequency === 'weekly' && (
          <div className="space-y-1.5">
            <label className="font-inter text-xs font-semibold uppercase tracking-wider text-outline">
              Target days per week: <span className="text-primary">{targetDays}</span>
            </label>
            <input
              type="range"
              min={1}
              max={7}
              value={targetDays}
              onChange={e => setTargetDays(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between font-inter text-[10px] text-outline">
              <span>1 day</span>
              <span>7 days</span>
            </div>
          </div>
        )}

        {/* Log notes */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="font-inter text-xs font-semibold uppercase tracking-wider text-outline">Log a note when done</label>
            <button
              onClick={() => setHasNotes(v => !v)}
              className={`w-11 h-6 rounded-full transition-colors ${hasNotes ? 'bg-primary' : 'bg-outline-variant'}`}
            >
              <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform mx-0.5 ${hasNotes ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
          {hasNotes && (
            <input
              type="text"
              value={notesPrompt}
              onChange={e => setNotesPrompt(e.target.value)}
              placeholder='Prompt, e.g. "Which book?" "Which workout?"'
              className="w-full px-3 py-2 bg-surface-container rounded-lg font-inter text-sm text-on-surface outline-none border border-outline-variant/30 focus:border-primary/40 placeholder:text-outline/50"
            />
          )}
        </div>

        {/* Reminder time */}
        <div className="space-y-1.5">
          <label className="font-inter text-xs font-semibold uppercase tracking-wider text-outline flex items-center gap-1">
            <span className="material-symbols-outlined text-[13px]">notifications</span>
            Daily reminder (optional)
          </label>
          <div className="flex items-center gap-3">
            <input
              type="time"
              value={reminderTime}
              onChange={(e) => setReminderTime(e.target.value)}
              className="flex-1 px-3 py-2 bg-surface-container rounded-lg font-inter text-sm text-on-surface outline-none border border-outline-variant/30 focus:border-primary/40"
            />
            {reminderTime && (
              <button
                onClick={() => setReminderTime('')}
                className="font-inter text-xs text-outline hover:text-error transition-colors"
              >
                Clear
              </button>
            )}
          </div>
          <p className="font-inter text-[10px] text-outline">
            You'll get a push notification at this time if the habit isn't done yet.
          </p>
        </div>

        {/* Auto-track source */}
        <div className="space-y-1.5">
          <label className="font-inter text-xs font-semibold uppercase tracking-wider text-outline flex items-center gap-1">
            <span className="material-symbols-outlined text-[13px]">link</span>
            Auto-track from activity (optional)
          </label>
          <div className="flex gap-2">
            {([
              { value: '', label: 'None' },
              { value: 'gym', label: 'Gym', icon: 'fitness_center' },
              { value: 'sports', label: 'Sports', icon: 'sports_soccer' },
            ] as const).map(opt => (
              <button
                key={opt.value}
                onClick={() => setLinkedSource(opt.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-inter text-xs font-medium transition-all ${
                  linkedSource === opt.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-outline-variant text-on-surface-variant hover:border-outline'
                }`}
              >
                {'icon' in opt && <span className="material-symbols-outlined text-[14px]">{opt.icon}</span>}
                {opt.label}
              </button>
            ))}
          </div>
          {linkedSource && (
            <p className="font-inter text-[10px] text-outline">
              This habit will be marked done automatically when you log a {linkedSource === 'gym' ? 'gym' : 'sport'} session on the same date.
            </p>
          )}
        </div>

        {/* Color */}
        <div className="space-y-1.5">
          <label className="font-inter text-xs font-semibold uppercase tracking-wider text-outline">Color</label>
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button
                key={c.value}
                onClick={() => setColor(c.value)}
                className={`w-8 h-8 rounded-full ${c.bg} transition-all ${color === c.value ? `ring-2 ring-offset-2 ${c.ring}` : ''}`}
              />
            ))}
          </div>
        </div>

        {/* Icon */}
        <div className="space-y-1.5">
          <label className="font-inter text-xs font-semibold uppercase tracking-wider text-outline">Icon</label>
          <div className="grid grid-cols-8 gap-1.5">
            {ICONS.map((ic) => (
              <button
                key={ic}
                onClick={() => setIcon(ic)}
                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                  icon === ic ? 'bg-primary/10 text-primary ring-1 ring-primary/30' : 'text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">{ic}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-on-surface-variant font-inter font-medium text-sm hover:bg-surface-container transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="px-4 py-2 rounded-lg bg-primary text-on-primary font-inter font-medium text-sm hover:opacity-90 disabled:opacity-40"
          >
            {habit ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
