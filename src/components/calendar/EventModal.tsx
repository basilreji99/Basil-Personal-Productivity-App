import { useState } from 'react';
import type { LocalEvent } from '../../store/calendarStore';
import { localDateString } from '../../utils/dateUtils';

const EVENT_COLORS = [
  '#4285f4', '#e67c73', '#33b679', '#f6c026',
  '#8e24aa', '#039be5', '#f5511d', '#616161',
];

interface EventModalProps {
  initial?: LocalEvent;
  defaultDate?: string;
  onSave: (e: Omit<LocalEvent, 'id'>) => void;
  onDelete?: () => void;
  onClose: () => void;
}

export default function EventModal({ initial, defaultDate, onSave, onDelete, onClose }: EventModalProps) {
  const today = localDateString();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [date, setDate] = useState(initial?.date ?? defaultDate ?? today);
  const [isAllDay, setIsAllDay] = useState(initial?.isAllDay ?? true);
  const [startTime, setStartTime] = useState(initial?.startTime ?? '09:00');
  const [endTime, setEndTime] = useState(initial?.endTime ?? '10:00');
  const [color, setColor] = useState(initial?.color ?? '#4285f4');
  const [location, setLocation] = useState(initial?.location ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleSave() {
    if (!title.trim() || !date) return;
    onSave({
      title: title.trim(),
      date,
      isAllDay,
      startTime: isAllDay ? undefined : startTime,
      endTime: isAllDay ? undefined : endTime,
      color,
      location: location.trim() || undefined,
      description: description.trim() || undefined,
    });
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background" style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-outline-variant">
        <button onClick={onClose} className="p-1.5 -ml-1.5 rounded-xl text-on-surface-variant">
          <span className="material-symbols-outlined text-[22px]">close</span>
        </button>
        <h2 className="flex-1 font-inter font-semibold text-base text-on-surface">
          {initial ? 'Edit Event' : 'New Event'}
        </h2>
        <button
          onClick={handleSave}
          disabled={!title.trim()}
          className="px-4 py-1.5 rounded-xl bg-primary text-on-primary font-inter font-semibold text-sm disabled:opacity-40"
        >
          Save
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Title */}
        <input
          autoFocus
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Event title"
          className="w-full bg-surface-container border border-outline-variant rounded-xl px-4 py-3 font-inter text-base text-on-surface placeholder:text-on-surface-variant outline-none focus:border-primary"
        />

        {/* Date + All day */}
        <div className="bg-surface-container rounded-xl divide-y divide-outline-variant">
          <div className="flex items-center justify-between px-4 py-3">
            <label className="font-inter text-sm text-on-surface">All day</label>
            <button
              onClick={() => setIsAllDay(v => !v)}
              className={`w-11 h-6 rounded-full transition-colors ${isAllDay ? 'bg-primary' : 'bg-outline-variant'}`}
            >
              <span
                className={`block w-5 h-5 rounded-full bg-white dark:bg-gray-200 shadow transition-transform mx-0.5 ${isAllDay ? 'translate-x-5' : 'translate-x-0'}`}
              />
            </button>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <label className="font-inter text-sm text-on-surface">Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="font-inter text-sm text-primary bg-transparent outline-none"
            />
          </div>
          {!isAllDay && (
            <>
              <div className="flex items-center justify-between px-4 py-3">
                <label className="font-inter text-sm text-on-surface">Start</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  className="font-inter text-sm text-primary bg-transparent outline-none"
                />
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <label className="font-inter text-sm text-on-surface">End</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  className="font-inter text-sm text-primary bg-transparent outline-none"
                />
              </div>
            </>
          )}
        </div>

        {/* Color */}
        <div>
          <p className="font-inter text-xs text-on-surface-variant mb-2 px-1">Color</p>
          <div className="flex gap-2 flex-wrap">
            {EVENT_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: c }}
              >
                {color === c && (
                  <span className="material-symbols-outlined text-white text-[16px]">check</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Location */}
        <div className="bg-surface-container rounded-xl">
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="material-symbols-outlined text-[18px] text-on-surface-variant">location_on</span>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="Add location"
              className="flex-1 bg-transparent font-inter text-sm text-on-surface placeholder:text-on-surface-variant outline-none"
            />
          </div>
        </div>

        {/* Description */}
        <div className="bg-surface-container rounded-xl">
          <div className="flex items-start gap-3 px-4 py-3">
            <span className="material-symbols-outlined text-[18px] text-on-surface-variant mt-0.5">notes</span>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Add description"
              rows={3}
              className="flex-1 bg-transparent font-inter text-sm text-on-surface placeholder:text-on-surface-variant outline-none resize-none"
            />
          </div>
        </div>

        {/* Delete */}
        {initial && onDelete && (
          confirmDelete ? (
            <div className="bg-error-container rounded-xl p-4 space-y-2">
              <p className="font-inter text-sm text-on-error-container text-center">Delete this event?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 py-2 rounded-xl bg-surface-container font-inter text-sm text-on-surface"
                >
                  Cancel
                </button>
                <button
                  onClick={onDelete}
                  className="flex-1 py-2 rounded-xl bg-error text-on-error font-inter text-sm font-semibold"
                >
                  Delete
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-full py-3 rounded-xl border border-error text-error font-inter text-sm font-medium"
            >
              Delete event
            </button>
          )
        )}
      </div>
    </div>
  );
}
