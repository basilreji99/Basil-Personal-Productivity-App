import type { UnifiedEvent } from '../../store/calendarStore';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface MonthGridProps {
  year: number;
  month: number; // 0-indexed
  eventsByDate: Record<string, UnifiedEvent[]>;
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (date: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export default function MonthGrid({
  year, month, eventsByDate, selectedDate,
  onSelectDate, onPrev, onNext, onToday,
}: MonthGridProps) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();

  // Build a 6-row × 7-col grid
  const cells: { date: string; isCurrentMonth: boolean }[] = [];
  for (let i = 0; i < firstDay; i++) {
    const d = daysInPrev - firstDay + 1 + i;
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    cells.push({ date: `${prevYear}-${pad(prevMonth + 1)}-${pad(d)}`, isCurrentMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: `${year}-${pad(month + 1)}-${pad(d)}`, isCurrentMonth: true });
  }
  while (cells.length < 42) {
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    const d = cells.length - firstDay - daysInMonth + 1;
    cells.push({ date: `${nextYear}-${pad(nextMonth + 1)}-${pad(d)}`, isCurrentMonth: false });
  }

  return (
    <div className="bg-surface-container rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <button
          onClick={onPrev}
          className="p-1.5 rounded-lg hover:bg-surface-container-high active:opacity-70"
        >
          <span className="material-symbols-outlined text-[20px] text-on-surface-variant">chevron_left</span>
        </button>
        <button
          onClick={onToday}
          className="font-inter font-semibold text-sm text-on-surface"
        >
          {MONTHS[month]} {year}
        </button>
        <button
          onClick={onNext}
          className="p-1.5 rounded-lg hover:bg-surface-container-high active:opacity-70"
        >
          <span className="material-symbols-outlined text-[20px] text-on-surface-variant">chevron_right</span>
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-t border-outline-variant">
        {DAYS.map(d => (
          <div key={d} className="text-center py-1.5 font-inter text-[10px] font-semibold text-on-surface-variant uppercase tracking-wide">
            {d}
          </div>
        ))}
      </div>

      {/* Cells */}
      <div className="grid grid-cols-7 border-t border-outline-variant">
        {cells.map((cell, i) => {
          const isToday = cell.date === todayStr;
          const isSelected = cell.date === selectedDate;
          const events = eventsByDate[cell.date] ?? [];
          const dots = events.slice(0, 3);

          return (
            <button
              key={i}
              onClick={() => onSelectDate(cell.date)}
              className={`
                relative flex flex-col items-center py-1.5 min-h-[48px]
                border-b border-r border-outline-variant last-of-type:border-r-0
                ${!cell.isCurrentMonth ? 'opacity-30' : ''}
                active:bg-surface-container-high
              `}
            >
              <span
                className={`
                  w-7 h-7 flex items-center justify-center rounded-full font-inter text-xs font-medium
                  ${isSelected && isToday ? 'bg-primary text-on-primary' :
                    isSelected ? 'bg-secondary-container text-on-secondary-container' :
                    isToday ? 'border-2 border-primary text-primary' :
                    'text-on-surface'}
                `}
              >
                {parseInt(cell.date.slice(8))}
              </span>
              {dots.length > 0 && (
                <div className="flex gap-0.5 mt-0.5">
                  {dots.map((ev, j) => (
                    <span
                      key={j}
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: ev.color }}
                    />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
