import { useState, useEffect, useRef } from 'react';

const CAL_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const CAL_DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

export default function DatePicker({
  value, onChange, placeholder = 'Select date', clearable = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  clearable?: boolean;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => value ? parseInt(value.slice(0, 4)) : new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => value ? parseInt(value.slice(5, 7)) - 1 : new Date().getMonth());
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open && !wasOpen.current) {
      const base = value || today;
      setViewYear(parseInt(base.slice(0, 4)));
      setViewMonth(parseInt(base.slice(5, 7)) - 1);
    }
    wasOpen.current = open;
  }, [open]);

  const firstDow    = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const prevMonth = () => viewMonth === 0  ? (setViewYear(y => y - 1), setViewMonth(11)) : setViewMonth(m => m - 1);
  const nextMonth = () => viewMonth === 11 ? (setViewYear(y => y + 1), setViewMonth(0))  : setViewMonth(m => m + 1);

  const pick = (day: number) => {
    onChange(`${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
    setOpen(false);
  };

  const displayDate = value
    ? new Date(value + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <div>
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-2 font-inter text-sm text-left hover:border-primary/40 transition-colors">
        <span className="material-symbols-outlined text-[16px] text-on-surface-variant">calendar_today</span>
        <span className={`flex-1 ${displayDate ? 'text-on-surface' : 'text-outline/50'}`}>
          {displayDate ?? placeholder}
        </span>
        {clearable && value && (
          <span onClick={(e) => { e.stopPropagation(); onChange(''); setOpen(false); }}
            className="text-outline hover:text-error transition-colors cursor-pointer">
            <span className="material-symbols-outlined text-[14px]">close</span>
          </span>
        )}
      </button>

      {open && (
        <div className="mt-2 bg-surface-container-lowest border border-outline-variant/20 rounded-xl shadow-modal overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-outline-variant/15">
            <button type="button" onClick={prevMonth}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container transition-colors">
              <span className="material-symbols-outlined text-[20px] text-on-surface-variant">chevron_left</span>
            </button>
            <span className="font-inter font-semibold text-sm text-on-surface">
              {CAL_MONTHS[viewMonth]} {viewYear}
            </span>
            <button type="button" onClick={nextMonth}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container transition-colors">
              <span className="material-symbols-outlined text-[20px] text-on-surface-variant">chevron_right</span>
            </button>
          </div>
          <div className="p-2">
            <div className="grid grid-cols-7 mb-1">
              {CAL_DAYS.map(d => (
                <span key={d} className="text-center font-inter text-[10px] text-outline font-semibold py-1">{d}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {Array.from({ length: firstDow }, (_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                const ds = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const sel = ds === value;
                const tdy = ds === today;
                return (
                  <button key={day} type="button" onClick={() => pick(day)}
                    className={`h-9 w-full rounded-lg font-inter text-sm font-medium transition-colors ${
                      sel ? 'bg-primary text-on-primary' :
                      tdy ? 'bg-primary/15 text-primary font-semibold' :
                      'hover:bg-surface-container text-on-surface'
                    }`}>
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
