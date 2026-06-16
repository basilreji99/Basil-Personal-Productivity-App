import { useHabitsStore } from '../../store/habitsStore';
import { getTodayString } from '../../utils/dateUtils';
import { useNavigate } from 'react-router-dom';

const HABIT_BG: Record<string, string> = {
  blue: 'bg-blue-500', green: 'bg-green-500', purple: 'bg-purple-500',
  orange: 'bg-orange-500', pink: 'bg-pink-500', teal: 'bg-teal-500',
};

export default function HabitQuickSheet({ onClose }: { onClose: () => void }) {
  const habits = useHabitsStore(s => s.habits.filter(h => !h.archivedAt));
  const isCompleted = useHabitsStore(s => s.isCompleted);
  const toggleEntry = useHabitsStore(s => s.toggleEntry);
  const today = getTodayString();
  const navigate = useNavigate();

  const done = habits.filter(h => isCompleted(h.id, today)).length;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-surface rounded-t-3xl shadow-2xl max-h-[80dvh] flex flex-col"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}>

        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-outline-variant" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3">
          <div>
            <p className="font-manrope font-bold text-lg text-on-surface">Today's Habits</p>
            <p className="font-inter text-xs text-on-surface-variant">{done}/{habits.length} done</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { onClose(); navigate('/habits'); }}
              className="font-inter text-xs font-semibold text-primary px-3 py-1.5 rounded-lg hover:bg-primary/10">
              All Habits
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container">
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* Progress bar */}
        {habits.length > 0 && (
          <div className="mx-5 h-1.5 bg-surface-container rounded-full overflow-hidden mb-3">
            <div className="h-full bg-tertiary rounded-full transition-all duration-500"
              style={{ width: `${habits.length > 0 ? (done / habits.length) * 100 : 0}%` }} />
          </div>
        )}

        {/* Habit list */}
        <div className="flex-1 overflow-y-auto px-4 pb-2 space-y-2">
          {habits.length === 0 ? (
            <div className="text-center py-10">
              <span className="material-symbols-outlined text-[40px] text-outline block mb-2">track_changes</span>
              <p className="font-work-sans text-sm text-on-surface-variant">No habits set up yet</p>
            </div>
          ) : (
            habits.map(habit => {
              const checked = isCompleted(habit.id, today);
              return (
                <button key={habit.id} onClick={() => toggleEntry(habit.id, today)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all active:scale-[0.98] ${
                    checked
                      ? 'bg-tertiary/10 border-tertiary/30'
                      : 'bg-surface-container border-outline-variant/20 hover:bg-surface-container-high'
                  }`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                    checked ? 'bg-tertiary' : (HABIT_BG[habit.color] ?? 'bg-primary')
                  }`}>
                    <span className="material-symbols-outlined text-[18px] text-white">{habit.icon}</span>
                  </div>
                  <span className={`font-inter font-medium text-sm flex-1 text-left transition-all ${
                    checked ? 'line-through text-on-surface-variant' : 'text-on-surface'
                  }`}>{habit.name}</span>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                    checked ? 'border-tertiary bg-tertiary' : 'border-outline-variant'
                  }`}>
                    {checked && <span className="material-symbols-outlined text-[14px] text-white icon-fill">check</span>}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
