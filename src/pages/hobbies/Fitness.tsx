import { useState, useMemo, useEffect } from 'react';
import { localDateString } from '../../utils/dateUtils';
import TopBar from '../../components/layout/TopBar';
import Modal from '../../components/ui/Modal';
import DatePicker from '../../components/ui/DatePicker';
import { useFitnessStore, type SportSession } from '../../store/fitnessStore';

type TimeView = 'month' | 'year' | 'compare';

const SPORT_OPTIONS = ['Cricket', 'Swimming', 'Basketball', 'Football', 'Tennis', 'Badminton', 'Cycling', 'Running', 'Other'];

const SPORT_COLORS: Record<string, string> = {
  'Cricket':    '#22c55e',
  'Swimming':   '#3b82f6',
  'Basketball': '#f97316',
  'Football':   '#ef4444',
  'Tennis':     '#84cc16',
  'Running':    '#ec4899',
  'Cycling':    '#06b6d4',
  'Badminton':  '#8b5cf6',
  'Other':      '#9e9e9e',
};

function colorFor(type: string, map: Record<string, string>) {
  return map[type] ?? '#737686';
}

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function parseDuration(str: string): number {
  const parts = str.trim().split(':').map(Number);
  if (parts.some(isNaN)) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parseInt(str) || 0;
}

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ─── Bar charts ───────────────────────────────────────────────────────────────

function MonthBars({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-0.5">
      {data.map((v, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-0.5" style={{ height: '88px', justifyContent: 'flex-end' }}>
          {v > 0 && <span className="font-inter text-[8px] text-outline leading-none">{v}</span>}
          <div className="w-full rounded-t-sm" style={{
            height: v > 0 ? `${Math.max((v / max) * 60, 4)}px` : '2px',
            background: v > 0 ? color : '#e0e0e0',
          }} />
          <span className="font-inter text-[8px] text-outline leading-none">{MONTH_ABBR[i]}</span>
        </div>
      ))}
    </div>
  );
}

function CompareBars({ data1, data2, year1, year2, color1, color2 }: {
  data1: number[]; data2: number[];
  year1: number; year2: number;
  color1: string; color2: string;
}) {
  const max = Math.max(...data1, ...data2, 1);
  return (
    <div>
      <div className="flex gap-4 mb-3">
        {[{ yr: year1, c: color1 }, { yr: year2, c: color2 }].map(({ yr, c }) => (
          <div key={yr} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: c }} />
            <span className="font-inter text-xs text-on-surface-variant">{yr}</span>
          </div>
        ))}
      </div>
      <div className="flex items-end gap-0.5">
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-0.5" style={{ height: '88px', justifyContent: 'flex-end' }}>
            <div className="w-full flex gap-px items-end" style={{ height: '68px' }}>
              <div className="flex-1 rounded-t-sm" style={{
                height: data1[i] > 0 ? `${Math.max((data1[i] / max) * 68, 4)}px` : '2px',
                background: data1[i] > 0 ? color1 : '#e0e0e0',
              }} />
              <div className="flex-1 rounded-t-sm" style={{
                height: data2[i] > 0 ? `${Math.max((data2[i] / max) * 68, 4)}px` : '2px',
                background: data2[i] > 0 ? color2 : '#e0e0e0',
              }} />
            </div>
            <span className="font-inter text-[8px] text-outline leading-none">{MONTH_ABBR[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Log Sport Modal ──────────────────────────────────────────────────────────

function SportLogModal({ open, onClose, session }: {
  open: boolean; onClose: () => void; session?: SportSession | null;
}) {
  const { addSportSession, updateSportSession, deleteSportSession } = useFitnessStore();
  const today = localDateString();

  const [date, setDate]          = useState(today);
  const [sport, setSport]        = useState('');
  const [customSport, setCustom] = useState('');
  const [duration, setDur]       = useState('');
  const [calories, setCals]      = useState('');
  const [notes, setNotes]        = useState('');
  const [confirmDel, setCDel]    = useState(false);

  useEffect(() => {
    if (!open) return;
    if (session) {
      setDate(session.date); setSport(session.sport);
      setCustom(SPORT_OPTIONS.includes(session.sport) ? '' : session.sport);
      setDur(session.duration !== undefined ? fmtDuration(session.duration) : '');
      setCals(session.calories?.toString() ?? '');
      setNotes(session.notes ?? '');
    } else {
      setDate(today); setSport(''); setCustom(''); setDur(''); setCals(''); setNotes('');
    }
    setCDel(false);
  }, [open]);

  const effectiveSport = sport === '__custom__' ? customSport : sport;

  const handleSave = () => {
    const payload = {
      date, sport: effectiveSport,
      duration: duration ? parseDuration(duration) : undefined,
      calories: calories ? parseInt(calories) : undefined,
      notes: notes || undefined,
    };
    if (session) updateSportSession(session.id, payload);
    else addSportSession(payload);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={session ? 'Edit Session' : 'Log Sport Session'} size="sm">
      <div className="flex flex-col">
        <div className="p-5 space-y-4 overflow-y-auto max-h-[60vh]">
          <div className="space-y-1">
            <label className="font-inter text-[10px] font-semibold uppercase tracking-wider text-outline">Date</label>
            <DatePicker value={date} onChange={setDate} placeholder="Select date" />
          </div>

          <div className="space-y-1.5">
            <label className="font-inter text-[10px] font-semibold uppercase tracking-wider text-outline">Sport</label>
            <div className="flex flex-wrap gap-1.5">
              {SPORT_OPTIONS.slice(0, -1).map(s => (
                <button key={s} onClick={() => setSport(s)}
                  className="px-2.5 py-1 rounded-full text-[11px] font-inter font-medium transition-colors"
                  style={sport === s ? { background: colorFor(s, SPORT_COLORS), color: '#fff' } : {}}>
                  <span className={sport !== s ? 'text-on-surface-variant bg-surface-container px-2.5 py-1 rounded-full' : ''}>
                    {s}
                  </span>
                </button>
              ))}
              <button onClick={() => setSport('__custom__')}
                className={`px-2.5 py-1 rounded-full text-[11px] font-inter font-medium transition-colors ${sport === '__custom__' ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'}`}>
                Other
              </button>
            </div>
            {sport === '__custom__' && (
              <input value={customSport} onChange={e => setCustom(e.target.value)} placeholder="Sport name"
                className="w-full bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-2 font-inter text-sm outline-none" />
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="font-inter text-[10px] font-semibold uppercase tracking-wider text-outline">Duration</label>
              <input type="text" value={duration} onChange={e => setDur(e.target.value)} placeholder="H:MM:SS"
                className="w-full bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-2 font-inter text-sm outline-none" />
            </div>
            <div className="space-y-1">
              <label className="font-inter text-[10px] font-semibold uppercase tracking-wider text-outline">Calories (kcal)</label>
              <input type="number" value={calories} onChange={e => setCals(e.target.value)} placeholder="optional"
                className="w-full bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-2 font-inter text-sm outline-none" />
            </div>
            <div className="space-y-1">
              <label className="font-inter text-[10px] font-semibold uppercase tracking-wider text-outline">Notes</label>
              <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="optional"
                className="w-full bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-2 font-inter text-sm outline-none" />
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center px-5 py-4 border-t border-outline-variant/20 shrink-0">
          {session ? (
            confirmDel ? (
              <div className="flex items-center gap-2">
                <span className="font-inter text-xs text-error">Delete?</span>
                <button onClick={() => { deleteSportSession(session.id); onClose(); }}
                  className="px-3 py-1.5 rounded-lg bg-error text-on-error font-inter text-xs">Yes</button>
                <button onClick={() => setCDel(false)} className="px-3 py-1.5 text-on-surface-variant font-inter text-xs">No</button>
              </div>
            ) : (
              <button onClick={() => setCDel(true)} className="p-2 text-on-surface-variant hover:text-error">
                <span className="material-symbols-outlined text-[20px]">delete</span>
              </button>
            )
          ) : <div />}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-on-surface-variant font-inter text-sm hover:bg-surface-container">Cancel</button>
            <button onClick={handleSave} disabled={!effectiveSport}
              className="px-4 py-2 rounded-lg bg-primary text-on-primary font-inter font-medium text-sm disabled:opacity-50">
              {session ? 'Save' : 'Log'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── Full History Modal ───────────────────────────────────────────────────────

function SportHistoryModal({ open, onClose, sessions, onEdit }: {
  open: boolean; onClose: () => void; sessions: SportSession[];
  onEdit: (s: SportSession) => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="All Sport Sessions" size="sm">
      <div className="max-h-[70vh] overflow-y-auto divide-y divide-outline-variant/10">
        {sessions.map(s => (
          <button key={s.id} onClick={() => { onEdit(s); onClose(); }}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-container text-left">
            <div className="w-3 h-3 rounded-full shrink-0" style={{ background: colorFor(s.sport, SPORT_COLORS) }} />
            <div className="flex-1 min-w-0">
              <p className="font-inter font-semibold text-sm text-on-surface">{s.sport}</p>
              <p className="font-inter text-xs text-outline">
                {fmtDate(s.date)}
                {s.duration ? ` · ${fmtDuration(s.duration)}` : ''}
                {s.calories ? ` · ${s.calories} kcal` : ''}
              </p>
            </div>
            <span className="material-symbols-outlined text-[16px] text-outline">edit</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Fitness() {
  const { sportSessions } = useFitnessStore();

  const now = new Date();
  const currentYear = now.getFullYear();

  const [timeView, setTimeView] = useState<TimeView>('month');

  // Month view state
  const [viewYM, setViewYM] = useState({ year: currentYear, month: now.getMonth() });
  const viewMonthStr   = `${viewYM.year}-${String(viewYM.month + 1).padStart(2, '0')}`;
  const viewMonthLabel = new Date(viewYM.year, viewYM.month).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const isCurrentMonth = viewMonthStr === now.toISOString().slice(0, 7);
  function prevMonth() { setViewYM(({ year, month }) => month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 }); }
  function nextMonth() { setViewYM(({ year, month }) => month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 }); }

  // Year view state
  const [viewYear, setViewYear] = useState(currentYear);

  // Compare view state
  const [cmpYears, setCmpYears] = useState<[number, number]>([currentYear - 1, currentYear]);

  // Modals
  const [sportLog, setSportLog]         = useState(false);
  const [sportEdit, setSportEdit]       = useState<SportSession | null>(null);
  const [sportHistory, setSportHistory] = useState(false);

  // ── Month stats ────────────────────────────────────────────────────────────

  const sportStats = useMemo(() => {
    const monthSessions = sportSessions.filter(s => s.date.startsWith(viewMonthStr));
    const count = monthSessions.length;
    const calories = monthSessions.reduce((sum, s) => sum + (s.calories ?? 0), 0);
    const counts: Record<string, number> = {};
    monthSessions.forEach(s => { counts[s.sport] = (counts[s.sport] ?? 0) + 1; });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const maxCount = sorted[0]?.[1] ?? 1;
    return { count, calories, sorted, maxCount, total: sportSessions.length };
  }, [sportSessions, viewMonthStr]);

  // ── Year stats ─────────────────────────────────────────────────────────────

  const sportYearStats = useMemo(() => {
    const yrStr = String(viewYear);
    const yearSessions = sportSessions.filter(s => s.date.startsWith(yrStr));
    const byMonth = Array.from({ length: 12 }, (_, i) => {
      const monthStr = `${yrStr}-${String(i + 1).padStart(2, '0')}`;
      return sportSessions.filter(s => s.date.startsWith(monthStr)).length;
    });
    const total    = yearSessions.length;
    const calories = yearSessions.reduce((acc, s) => acc + (s.calories ?? 0), 0);
    const minutes  = yearSessions.reduce((acc, s) => acc + (s.duration ?? 0), 0);
    const counts: Record<string, number> = {};
    yearSessions.forEach(s => { counts[s.sport] = (counts[s.sport] ?? 0) + 1; });
    const sorted   = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const maxCount = sorted[0]?.[1] ?? 1;
    return { byMonth, total, calories, minutes, sorted, maxCount };
  }, [sportSessions, viewYear]);

  // ── Compare stats ──────────────────────────────────────────────────────────

  const sportCmpData = useMemo(() => cmpYears.map(yr => {
    const yrStr = String(yr);
    return Array.from({ length: 12 }, (_, i) => {
      const monthStr = `${yrStr}-${String(i + 1).padStart(2, '0')}`;
      return sportSessions.filter(s => s.date.startsWith(monthStr)).length;
    });
  }) as [number[], number[]], [sportSessions, cmpYears]);

  const sportCmpTotals = useMemo(() => cmpYears.map(yr => sportSessions.filter(s => s.date.startsWith(String(yr))).length), [sportSessions, cmpYears]);

  // ── Sorted lists ───────────────────────────────────────────────────────────

  const sortedSport = [...sportSessions].sort((a, b) => b.date.localeCompare(a.date));
  const monthSport  = sortedSport.filter(s => s.date.startsWith(viewMonthStr));

  // ── Compare year helpers ───────────────────────────────────────────────────

  function setCmpYear(idx: 0 | 1, yr: number) {
    setCmpYears(prev => idx === 0 ? [yr, prev[1]] : [prev[0], yr]);
  }

  return (
    <div className="bg-background min-h-screen">
      <TopBar title="Sports" showBack />

      <main className="max-w-screen-xl mx-auto px-4 py-4 pb-28 space-y-4">

        {/* Time view switcher */}
        <div className="flex bg-surface-container rounded-xl p-1 gap-1">
          {([['month', 'Month'], ['year', 'Year'], ['compare', 'Compare']] as const).map(([v, label]) => (
            <button key={v} onClick={() => setTimeView(v)}
              className={`flex-1 py-2 rounded-lg font-inter text-xs font-semibold transition-colors ${timeView === v ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* ── MONTH VIEW NAVIGATOR ── */}
        {timeView === 'month' && (
          <div className="flex items-center justify-between bg-surface-container-lowest rounded-xl px-4 py-2.5 shadow-sm">
            <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container text-on-surface-variant">
              <span className="material-symbols-outlined text-[20px]">chevron_left</span>
            </button>
            <p className="font-inter font-semibold text-sm text-on-surface">{viewMonthLabel}</p>
            <button onClick={nextMonth} disabled={isCurrentMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container text-on-surface-variant disabled:opacity-30">
              <span className="material-symbols-outlined text-[20px]">chevron_right</span>
            </button>
          </div>
        )}

        {/* ── YEAR VIEW NAVIGATOR ── */}
        {timeView === 'year' && (
          <div className="flex items-center justify-between bg-surface-container-lowest rounded-xl px-4 py-2.5 shadow-sm">
            <button onClick={() => setViewYear(y => y - 1)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container text-on-surface-variant">
              <span className="material-symbols-outlined text-[20px]">chevron_left</span>
            </button>
            <p className="font-inter font-semibold text-sm text-on-surface">{viewYear}</p>
            <button onClick={() => setViewYear(y => y + 1)} disabled={viewYear >= currentYear} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container text-on-surface-variant disabled:opacity-30">
              <span className="material-symbols-outlined text-[20px]">chevron_right</span>
            </button>
          </div>
        )}

        {/* ── COMPARE YEAR SELECTORS ── */}
        {timeView === 'compare' && (
          <div className="grid grid-cols-2 gap-2">
            {([0, 1] as const).map(idx => (
              <div key={idx} className="flex items-center justify-between bg-surface-container-lowest rounded-xl px-3 py-2.5 shadow-sm">
                <button onClick={() => setCmpYear(idx, cmpYears[idx] - 1)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-container text-on-surface-variant">
                  <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                </button>
                <div className="text-center">
                  <p className="font-inter text-[9px] font-semibold uppercase tracking-wider text-outline">{idx === 0 ? 'Year A' : 'Year B'}</p>
                  <p className="font-inter font-semibold text-sm text-on-surface">{cmpYears[idx]}</p>
                </div>
                <button onClick={() => setCmpYear(idx, Math.min(cmpYears[idx] + 1, currentYear))} disabled={cmpYears[idx] >= currentYear} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-container text-on-surface-variant disabled:opacity-30">
                  <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── MONTH view ── */}
        {timeView === 'month' && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-surface-container-lowest rounded-xl p-3 text-center shadow-sm">
                <p className="font-manrope font-bold text-2xl text-primary">{sportStats.count}</p>
                <p className="font-inter text-[10px] text-outline">Sessions</p>
              </div>
              <div className="bg-surface-container-lowest rounded-xl p-3 text-center shadow-sm">
                <p className="font-manrope font-bold text-2xl text-on-surface">{sportStats.calories > 0 ? sportStats.calories.toLocaleString() : '—'}</p>
                <p className="font-inter text-[10px] text-outline">Calories</p>
              </div>
              <div className="bg-surface-container-lowest rounded-xl p-3 text-center shadow-sm">
                <p className="font-manrope font-bold text-2xl text-on-surface">{sportStats.sorted.length}</p>
                <p className="font-inter text-[10px] text-outline">Sports</p>
              </div>
            </div>

            {sportStats.sorted.length > 0 && (
              <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-card">
                <p className="font-inter font-semibold text-sm text-on-surface mb-3">Sports Breakdown</p>
                <div className="space-y-2.5">
                  {sportStats.sorted.map(([sport, count]) => (
                    <div key={sport} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ background: colorFor(sport, SPORT_COLORS) }} />
                      <span className="font-inter text-xs text-on-surface-variant flex-1 min-w-0">{sport}</span>
                      <div className="w-24 h-2 bg-surface-container rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${(count / sportStats.maxCount) * 100}%`, background: colorFor(sport, SPORT_COLORS) }} />
                      </div>
                      <span className="font-inter text-[11px] text-outline w-4 text-right shrink-0">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-card">
              <div className="px-4 py-3 border-b border-outline-variant/20 flex items-center justify-between">
                <p className="font-inter font-semibold text-sm text-on-surface">Sessions</p>
                {sortedSport.length > 3 && (
                  <button onClick={() => setSportHistory(true)} className="font-inter text-xs text-primary font-semibold">
                    All time ({sortedSport.length})
                  </button>
                )}
              </div>
              {monthSport.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <span className="material-symbols-outlined text-[40px] text-outline">sports_soccer</span>
                  <p className="font-inter text-sm text-on-surface-variant mt-2">No sessions this month</p>
                </div>
              ) : (
                <div className="divide-y divide-outline-variant/10">
                  {monthSport.slice(0, 5).map(s => (
                    <button key={s.id} onClick={() => { setSportEdit(s); setSportLog(true); }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-container text-left">
                      <div className="w-10 h-10 rounded-xl shrink-0 flex flex-col items-center justify-center"
                        style={{ background: colorFor(s.sport, SPORT_COLORS) + '20' }}>
                        <span className="font-inter font-bold text-xs leading-none" style={{ color: colorFor(s.sport, SPORT_COLORS) }}>
                          {new Date(s.date + 'T12:00:00').getDate()}
                        </span>
                        <span className="font-inter text-[8px] uppercase" style={{ color: colorFor(s.sport, SPORT_COLORS) }}>
                          {new Date(s.date + 'T12:00:00').toLocaleString('default', { month: 'short' })}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-inter font-semibold text-sm text-on-surface">{s.sport}</p>
                        {(s.duration || s.calories) ? (
                          <p className="font-inter text-xs text-outline">
                            {[s.duration !== undefined && fmtDuration(s.duration), s.calories && `${s.calories} kcal`].filter(Boolean).join(' · ')}
                          </p>
                        ) : s.notes ? (
                          <p className="font-inter text-xs text-outline truncate">{s.notes}</p>
                        ) : null}
                      </div>
                      <span className="material-symbols-outlined text-[16px] text-outline">edit</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── YEAR view ── */}
        {timeView === 'year' && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-surface-container-lowest rounded-xl p-3 text-center shadow-sm">
                <p className="font-manrope font-bold text-2xl text-primary">{sportYearStats.total}</p>
                <p className="font-inter text-[10px] text-outline">Sessions</p>
              </div>
              <div className="bg-surface-container-lowest rounded-xl p-3 text-center shadow-sm">
                <p className="font-manrope font-bold text-2xl text-on-surface">{sportYearStats.calories > 0 ? sportYearStats.calories.toLocaleString() : '—'}</p>
                <p className="font-inter text-[10px] text-outline">Calories</p>
              </div>
              <div className="bg-surface-container-lowest rounded-xl p-3 text-center shadow-sm">
                <p className="font-manrope font-bold text-2xl text-on-surface">{sportYearStats.minutes > 0 ? `${Math.floor(sportYearStats.minutes / 3600)}h ${Math.floor((sportYearStats.minutes % 3600) / 60)}m` : '—'}</p>
                <p className="font-inter text-[10px] text-outline">Active</p>
              </div>
            </div>

            <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-card">
              <p className="font-inter font-semibold text-sm text-on-surface mb-4">Sessions by Month</p>
              <MonthBars data={sportYearStats.byMonth} color="#22c55e" />
            </div>

            {sportYearStats.sorted.length > 0 && (
              <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-card">
                <p className="font-inter font-semibold text-sm text-on-surface mb-3">Sports Breakdown</p>
                <div className="space-y-2.5">
                  {sportYearStats.sorted.map(([sport, count]) => (
                    <div key={sport} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ background: colorFor(sport, SPORT_COLORS) }} />
                      <span className="font-inter text-xs text-on-surface-variant flex-1 min-w-0">{sport}</span>
                      <div className="w-24 h-2 bg-surface-container rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${(count / sportYearStats.maxCount) * 100}%`, background: colorFor(sport, SPORT_COLORS) }} />
                      </div>
                      <span className="font-inter text-[11px] text-outline w-4 text-right shrink-0">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {sportYearStats.total === 0 && (
              <p className="font-inter text-xs text-outline text-center py-4">No sport sessions in {viewYear}</p>
            )}
          </>
        )}

        {/* ── COMPARE view ── */}
        {timeView === 'compare' && (
          <>
            <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-card">
              <p className="font-inter font-semibold text-sm text-on-surface mb-4">Sessions by Month</p>
              <CompareBars
                data1={sportCmpData[0]} data2={sportCmpData[1]}
                year1={cmpYears[0]} year2={cmpYears[1]}
                color1="#f97316" color2="#3b82f6"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {([0, 1] as const).map(idx => (
                <div key={idx} className="bg-surface-container-lowest rounded-xl p-3 shadow-sm">
                  <p className="font-inter text-[10px] font-semibold uppercase tracking-wider text-outline mb-1">{cmpYears[idx]}</p>
                  <p className="font-manrope font-bold text-xl text-on-surface">{sportCmpTotals[idx]}</p>
                  <p className="font-inter text-[11px] text-outline">sessions</p>
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      {/* FAB */}
      <button
        onClick={() => { setSportEdit(null); setSportLog(true); }}
        className="fixed right-4 bg-primary text-on-primary rounded-full shadow-fab flex items-center justify-center hover:scale-105 active:scale-95 transition-transform z-40 w-14 h-14"
        style={{ bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))' }}>
        <span className="material-symbols-outlined text-[28px]">add</span>
      </button>

      <SportLogModal open={sportLog} onClose={() => { setSportLog(false); setSportEdit(null); }} session={sportEdit} />
      <SportHistoryModal open={sportHistory} onClose={() => setSportHistory(false)} sessions={sortedSport} onEdit={s => { setSportEdit(s); setSportLog(true); }} />
    </div>
  );
}
