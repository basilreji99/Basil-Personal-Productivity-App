import { useState, useMemo } from 'react';
import TopBar from '../../components/layout/TopBar';
import Modal from '../../components/ui/Modal';
import { useFitnessStore, type GymSession, type SportSession } from '../../store/fitnessStore';

type FitnessTab = 'gym' | 'sports';

const GYM_TYPES = [
  'Push, Chest & Triceps',
  'Back & Biceps',
  'Legs & Core',
  'Full Body',
  'Shoulders & Arms',
  'Cardio',
];

const SPORT_OPTIONS = ['Cricket', 'Swimming', 'Basketball', 'Football', 'Tennis', 'Badminton', 'Cycling', 'Running', 'Other'];

const TYPE_COLORS: Record<string, string> = {
  'Push, Chest & Triceps': '#f97316',
  'Back & Biceps':         '#8b5cf6',
  'Legs & Core':           '#22c55e',
  'Full Body':             '#3b82f6',
  'Shoulders & Arms':      '#ec4899',
  'Cardio':                '#06b6d4',
};

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

function thisMonth(date: string) {
  const now = new Date();
  return date.startsWith(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
}

// ─── Log Gym Modal ────────────────────────────────────────────────────────────

function GymLogModal({ open, onClose, session }: {
  open: boolean; onClose: () => void; session?: GymSession | null;
}) {
  const { addGymSession, updateGymSession, deleteGymSession } = useFitnessStore();
  const today = new Date().toISOString().slice(0, 10);

  const [date, setDate]       = useState(today);
  const [type, setType]       = useState('');
  const [customType, setCustom] = useState('');
  const [duration, setDur]    = useState('');
  const [notes, setNotes]     = useState('');
  const [confirmDel, setCDel] = useState(false);

  useMemo(() => {
    if (!open) return;
    if (session) {
      setDate(session.date); setType(session.type);
      setCustom(GYM_TYPES.includes(session.type) ? '' : session.type);
      setDur(session.duration?.toString() ?? ''); setNotes(session.notes ?? '');
    } else {
      setDate(today); setType(''); setCustom(''); setDur(''); setNotes('');
    }
    setCDel(false);
  }, [open]);

  const effectiveType = type === '__custom__' ? customType : type;

  const handleSave = () => {
    const payload = { date, type: effectiveType, duration: duration ? parseInt(duration) : undefined, notes: notes || undefined };
    if (session) updateGymSession(session.id, payload);
    else addGymSession(payload);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={session ? 'Edit Session' : 'Log Gym Session'} size="sm">
      <div className="flex flex-col">
        <div className="p-5 space-y-4 overflow-y-auto max-h-[60vh]">
          <div className="space-y-1">
            <label className="font-inter text-[10px] font-semibold uppercase tracking-wider text-outline">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-2 font-inter text-sm outline-none focus:border-primary/50" />
          </div>

          <div className="space-y-1.5">
            <label className="font-inter text-[10px] font-semibold uppercase tracking-wider text-outline">Workout Type</label>
            <div className="flex flex-wrap gap-1.5">
              {GYM_TYPES.map(t => (
                <button key={t} onClick={() => setType(t)}
                  className="px-2.5 py-1 rounded-full text-[11px] font-inter font-medium transition-colors"
                  style={type === t ? { background: colorFor(t, TYPE_COLORS), color: '#fff' } : {}}>
                  <span className={type !== t ? 'text-on-surface-variant bg-surface-container px-2.5 py-1 rounded-full' : ''}>
                    {t}
                  </span>
                </button>
              ))}
              <button onClick={() => setType('__custom__')}
                className={`px-2.5 py-1 rounded-full text-[11px] font-inter font-medium transition-colors ${type === '__custom__' ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'}`}>
                Custom
              </button>
            </div>
            {type === '__custom__' && (
              <input value={customType} onChange={e => setCustom(e.target.value)} placeholder="e.g. Upper Body"
                className="w-full bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-2 font-inter text-sm outline-none" />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-inter text-[10px] font-semibold uppercase tracking-wider text-outline">Duration (min)</label>
              <input type="number" value={duration} onChange={e => setDur(e.target.value)} placeholder="optional"
                className="w-full bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-2 font-inter text-sm outline-none" />
            </div>
            <div className="space-y-1">
              <label className="font-inter text-[10px] font-semibold uppercase tracking-wider text-outline">Notes</label>
              <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="optional"
                className="w-full bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-2 font-inter text-sm outline-none" />
            </div>
          </div>
        </div>

        {/* Action buttons — always visible outside scrollable area */}
        <div className="flex justify-between items-center px-5 py-4 border-t border-outline-variant/20 shrink-0">
          {session ? (
            confirmDel ? (
              <div className="flex items-center gap-2">
                <span className="font-inter text-xs text-error">Delete?</span>
                <button onClick={() => { deleteGymSession(session.id); onClose(); }}
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
            <button onClick={handleSave} disabled={!effectiveType}
              className="px-4 py-2 rounded-lg bg-primary text-on-primary font-inter font-medium text-sm disabled:opacity-50">
              {session ? 'Save' : 'Log'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── Log Sport Modal ──────────────────────────────────────────────────────────

function SportLogModal({ open, onClose, session }: {
  open: boolean; onClose: () => void; session?: SportSession | null;
}) {
  const { addSportSession, updateSportSession, deleteSportSession } = useFitnessStore();
  const today = new Date().toISOString().slice(0, 10);

  const [date, setDate]         = useState(today);
  const [sport, setSport]       = useState('');
  const [customSport, setCustom] = useState('');
  const [duration, setDur]      = useState('');
  const [notes, setNotes]       = useState('');
  const [confirmDel, setCDel]   = useState(false);

  useMemo(() => {
    if (!open) return;
    if (session) {
      setDate(session.date); setSport(session.sport);
      setCustom(SPORT_OPTIONS.includes(session.sport) ? '' : session.sport);
      setDur(session.duration?.toString() ?? ''); setNotes(session.notes ?? '');
    } else {
      setDate(today); setSport(''); setCustom(''); setDur(''); setNotes('');
    }
    setCDel(false);
  }, [open]);

  const effectiveSport = sport === '__custom__' ? customSport : sport;

  const handleSave = () => {
    const payload = { date, sport: effectiveSport, duration: duration ? parseInt(duration) : undefined, notes: notes || undefined };
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
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-2 font-inter text-sm outline-none focus:border-primary/50" />
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-inter text-[10px] font-semibold uppercase tracking-wider text-outline">Duration (min)</label>
              <input type="number" value={duration} onChange={e => setDur(e.target.value)} placeholder="optional"
                className="w-full bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-2 font-inter text-sm outline-none" />
            </div>
            <div className="space-y-1">
              <label className="font-inter text-[10px] font-semibold uppercase tracking-wider text-outline">Notes</label>
              <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="optional"
                className="w-full bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-2 font-inter text-sm outline-none" />
            </div>
          </div>
        </div>

        {/* Action buttons — always visible outside scrollable area */}
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

function GymHistoryModal({ open, onClose, sessions, onEdit }: {
  open: boolean; onClose: () => void; sessions: GymSession[];
  onEdit: (s: GymSession) => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="All Gym Sessions" size="sm">
      <div className="max-h-[70vh] overflow-y-auto divide-y divide-outline-variant/10">
        {sessions.map(s => (
          <button key={s.id} onClick={() => { onEdit(s); onClose(); }}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-container text-left">
            <div className="w-3 h-3 rounded-full shrink-0" style={{ background: colorFor(s.type, TYPE_COLORS) }} />
            <div className="flex-1 min-w-0">
              <p className="font-inter font-semibold text-sm text-on-surface">{s.type}</p>
              <p className="font-inter text-xs text-outline">{fmtDate(s.date)}{s.duration ? ` · ${s.duration} min` : ''}</p>
            </div>
            <span className="material-symbols-outlined text-[16px] text-outline">edit</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}

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
              <p className="font-inter text-xs text-outline">{fmtDate(s.date)}{s.duration ? ` · ${s.duration} min` : ''}</p>
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
  const { gymSessions, sportSessions } = useFitnessStore();

  const [tab, setTab]               = useState<FitnessTab>('gym');
  const [gymLog, setGymLog]         = useState(false);
  const [gymEdit, setGymEdit]       = useState<GymSession | null>(null);
  const [sportLog, setSportLog]     = useState(false);
  const [sportEdit, setSportEdit]   = useState<SportSession | null>(null);
  const [gymHistory, setGymHistory] = useState(false);
  const [sportHistory, setSportHistory] = useState(false);

  // ── Gym stats ──────────────────────────────────────────────────────────────

  const gymStats = useMemo(() => {
    const total     = gymSessions.length;
    const monthly   = gymSessions.filter(s => thisMonth(s.date)).length;
    const typeCounts: Record<string, number> = {};
    gymSessions.forEach(s => { typeCounts[s.type] = (typeCounts[s.type] ?? 0) + 1; });
    const sorted = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
    const maxCount = sorted[0]?.[1] ?? 1;
    return { total, monthly, sorted, maxCount };
  }, [gymSessions]);

  // ── Sports stats ───────────────────────────────────────────────────────────

  const sportStats = useMemo(() => {
    const total   = sportSessions.length;
    const monthly = sportSessions.filter(s => thisMonth(s.date)).length;
    const counts: Record<string, number> = {};
    sportSessions.forEach(s => { counts[s.sport] = (counts[s.sport] ?? 0) + 1; });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const maxCount = sorted[0]?.[1] ?? 1;
    return { total, monthly, sorted, maxCount };
  }, [sportSessions]);

  // ── Sorted lists ───────────────────────────────────────────────────────────

  const sortedGym   = [...gymSessions].sort((a, b) => b.date.localeCompare(a.date));
  const sortedSport = [...sportSessions].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="bg-background min-h-screen">
      <TopBar title="Fitness & Sports" showBack />

      <main className="max-w-screen-xl mx-auto px-4 py-4 pb-28 space-y-4">

        {/* Tabs */}
        <div className="flex bg-surface-container rounded-xl p-1 gap-1">
          {([['gym', 'fitness_center', 'Gym'], ['sports', 'sports_soccer', 'Sports']] as const).map(([t, icon, label]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg font-inter text-sm font-semibold transition-colors ${tab === t ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant'}`}>
              <span className="material-symbols-outlined text-[16px]">{icon}</span>
              {label}
            </button>
          ))}
        </div>

        {/* ── GYM TAB ── */}
        {tab === 'gym' && (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-surface-container-lowest rounded-xl p-3 text-center shadow-sm">
                <p className="font-manrope font-bold text-2xl text-primary">{gymStats.total}</p>
                <p className="font-inter text-[10px] text-outline">Total</p>
              </div>
              <div className="bg-surface-container-lowest rounded-xl p-3 text-center shadow-sm">
                <p className="font-manrope font-bold text-2xl text-on-surface">{gymStats.monthly}</p>
                <p className="font-inter text-[10px] text-outline">This Month</p>
              </div>
              <div className="bg-surface-container-lowest rounded-xl p-3 text-center shadow-sm">
                <p className="font-manrope font-bold text-2xl text-on-surface">{gymStats.sorted.length}</p>
                <p className="font-inter text-[10px] text-outline">Types</p>
              </div>
            </div>

            {/* Workout type breakdown */}
            {gymStats.sorted.length > 0 && (
              <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-card">
                <p className="font-inter font-semibold text-sm text-on-surface mb-3">Workout Breakdown</p>
                <div className="space-y-2.5">
                  {gymStats.sorted.map(([type, count]) => (
                    <div key={type} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ background: colorFor(type, TYPE_COLORS) }} />
                      <span className="font-inter text-xs text-on-surface-variant flex-1 min-w-0 truncate">{type}</span>
                      <div className="w-24 h-2 bg-surface-container rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${(count / gymStats.maxCount) * 100}%`, background: colorFor(type, TYPE_COLORS) }} />
                      </div>
                      <span className="font-inter text-[11px] text-outline w-4 text-right shrink-0">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent sessions */}
            <div className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-card">
              <div className="px-4 py-3 border-b border-outline-variant/20 flex items-center justify-between">
                <p className="font-inter font-semibold text-sm text-on-surface">History</p>
                {sortedGym.length > 3 && (
                  <button onClick={() => setGymHistory(true)} className="font-inter text-xs text-primary font-semibold">
                    View all ({sortedGym.length})
                  </button>
                )}
              </div>
              {sortedGym.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <span className="material-symbols-outlined text-[40px] text-outline">fitness_center</span>
                  <p className="font-inter text-sm text-on-surface-variant mt-2">No sessions yet</p>
                </div>
              ) : (
                <div className="divide-y divide-outline-variant/10">
                  {sortedGym.slice(0, 3).map(s => (
                    <button key={s.id} onClick={() => { setGymEdit(s); setGymLog(true); }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-container text-left">
                      <div className="w-10 h-10 rounded-xl shrink-0 flex flex-col items-center justify-center"
                        style={{ background: colorFor(s.type, TYPE_COLORS) + '20' }}>
                        <span className="font-inter font-bold text-xs leading-none" style={{ color: colorFor(s.type, TYPE_COLORS) }}>
                          {new Date(s.date + 'T12:00:00').getDate()}
                        </span>
                        <span className="font-inter text-[8px] uppercase" style={{ color: colorFor(s.type, TYPE_COLORS) }}>
                          {new Date(s.date + 'T12:00:00').toLocaleString('default', { month: 'short' })}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-inter font-semibold text-sm text-on-surface">{s.type}</p>
                        {s.duration && <p className="font-inter text-xs text-outline">{s.duration} min</p>}
                      </div>
                      <span className="material-symbols-outlined text-[16px] text-outline">edit</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── SPORTS TAB ── */}
        {tab === 'sports' && (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-surface-container-lowest rounded-xl p-3 text-center shadow-sm">
                <p className="font-manrope font-bold text-2xl text-primary">{sportStats.total}</p>
                <p className="font-inter text-[10px] text-outline">Total</p>
              </div>
              <div className="bg-surface-container-lowest rounded-xl p-3 text-center shadow-sm">
                <p className="font-manrope font-bold text-2xl text-on-surface">{sportStats.monthly}</p>
                <p className="font-inter text-[10px] text-outline">This Month</p>
              </div>
              <div className="bg-surface-container-lowest rounded-xl p-3 text-center shadow-sm">
                <p className="font-manrope font-bold text-2xl text-on-surface">{sportStats.sorted.length}</p>
                <p className="font-inter text-[10px] text-outline">Sports</p>
              </div>
            </div>

            {/* Sport breakdown */}
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

            {/* Recent sessions */}
            <div className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-card">
              <div className="px-4 py-3 border-b border-outline-variant/20 flex items-center justify-between">
                <p className="font-inter font-semibold text-sm text-on-surface">History</p>
                {sortedSport.length > 3 && (
                  <button onClick={() => setSportHistory(true)} className="font-inter text-xs text-primary font-semibold">
                    View all ({sortedSport.length})
                  </button>
                )}
              </div>
              {sortedSport.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <span className="material-symbols-outlined text-[40px] text-outline">sports_soccer</span>
                  <p className="font-inter text-sm text-on-surface-variant mt-2">No sessions yet</p>
                </div>
              ) : (
                <div className="divide-y divide-outline-variant/10">
                  {sortedSport.slice(0, 3).map(s => (
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
                        {s.notes && <p className="font-inter text-xs text-outline truncate">{s.notes}</p>}
                      </div>
                      <span className="material-symbols-outlined text-[16px] text-outline">edit</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* FAB */}
      <button
        onClick={() => tab === 'gym' ? (setGymEdit(null), setGymLog(true)) : (setSportEdit(null), setSportLog(true))}
        className="fixed right-4 bg-primary text-on-primary rounded-full shadow-fab flex items-center justify-center hover:scale-105 active:scale-95 transition-transform z-40 w-14 h-14"
        style={{ bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))' }}>
        <span className="material-symbols-outlined text-[28px]">add</span>
      </button>

      <GymLogModal   open={gymLog}   onClose={() => { setGymLog(false);   setGymEdit(null); }}   session={gymEdit} />
      <SportLogModal open={sportLog} onClose={() => { setSportLog(false); setSportEdit(null); }} session={sportEdit} />
      <GymHistoryModal   open={gymHistory}   onClose={() => setGymHistory(false)}   sessions={sortedGym}   onEdit={s => { setGymEdit(s);   setGymLog(true); }} />
      <SportHistoryModal open={sportHistory} onClose={() => setSportHistory(false)} sessions={sortedSport} onEdit={s => { setSportEdit(s); setSportLog(true); }} />
    </div>
  );
}
