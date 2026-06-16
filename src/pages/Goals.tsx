import { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';
import TopBar from '../components/layout/TopBar';
import { useGoalsStore, goalProgress, currentQuarter, type Goal, type KeyResult } from '../store/goalsStore';

// ─── Quarter helpers ──────────────────────────────────────────────────────────

function generateQuarters(): string[] {
  const quarters: string[] = [];
  const now = new Date();
  const year = now.getFullYear();
  const q = Math.ceil((now.getMonth() + 1) / 3);
  // 2 quarters before current + current + 3 ahead
  for (let dy = -1; dy <= 1; dy++) {
    for (let dq = 1; dq <= 4; dq++) {
      quarters.push(`Q${dq} ${year + dy}`);
    }
  }
  // de-dup and filter to a sensible window around now
  const cur = `Q${q} ${year}`;
  const curIdx = quarters.indexOf(cur);
  return quarters.slice(Math.max(0, curIdx - 3), curIdx + 6);
}

// ─── KR Progress bar ─────────────────────────────────────────────────────────

function KRBar({ pct, status }: { pct: number; status: Goal['status'] }) {
  const color =
    status === 'completed' ? 'bg-tertiary' :
    pct >= 70 ? 'bg-primary' :
    pct >= 40 ? 'bg-amber-500' : 'bg-error';
  return (
    <div className="h-1.5 bg-surface-container rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ─── KR Row ──────────────────────────────────────────────────────────────────

function KRRow({ kr, goalId, goalStatus, onDelete }: {
  kr: KeyResult; goalId: string; goalStatus: Goal['status']; onDelete: () => void;
}) {
  const { updateKeyResult } = useGoalsStore();
  const pct = Math.min(Math.round((kr.current / Math.max(kr.target, 1)) * 100), 100);
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(kr.current));
  const [showHistory, setShowHistory] = useState(false);

  function commitEdit() {
    const n = parseFloat(val);
    if (!isNaN(n)) updateKeyResult(goalId, kr.id, { current: Math.max(0, n) });
    setEditing(false);
  }

  const histData = useMemo(() => {
    const hist = kr.history ?? [];
    if (hist.length === 0) return [];
    return hist.map((p) => ({ date: p.date.slice(5), value: p.value }));
  }, [kr.history]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className={`text-[10px] font-mono font-bold w-8 shrink-0 ${
          pct >= 100 ? 'text-tertiary' : 'text-on-surface-variant'
        }`}>{pct}%</span>
        <p className="font-inter text-sm text-on-surface flex-1">{kr.title}</p>
        <div className="flex items-center gap-1 shrink-0">
          {editing ? (
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={val}
                onChange={(e) => setVal(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(false); }}
                className="w-16 bg-surface-container border border-primary/40 rounded px-1.5 py-0.5 font-inter text-xs text-on-surface outline-none text-right"
                autoFocus
              />
              <span className="font-inter text-xs text-outline">/ {kr.target} {kr.unit}</span>
            </div>
          ) : (
            <button
              onClick={() => { setVal(String(kr.current)); setEditing(true); }}
              className="font-inter text-xs text-on-surface-variant hover:text-primary transition-colors"
              disabled={goalStatus !== 'active'}
            >
              {kr.current} / {kr.target} {kr.unit}
            </button>
          )}
          {histData.length > 0 && (
            <button
              onClick={() => setShowHistory((v) => !v)}
              className={`p-0.5 transition-colors ${showHistory ? 'text-primary' : 'text-outline hover:text-primary'}`}
              title="Progress history"
            >
              <span className="material-symbols-outlined text-[14px]">show_chart</span>
            </button>
          )}
          <button
            onClick={onDelete}
            className="p-0.5 text-outline hover:text-error transition-colors"
          >
            <span className="material-symbols-outlined text-[14px]">close</span>
          </button>
        </div>
      </div>
      <KRBar pct={pct} status={goalStatus} />
      {showHistory && histData.length > 0 && (
        <div className="mt-1 bg-surface-container-low rounded-xl px-3 pt-3 pb-2">
          <div className="flex items-center justify-between mb-1">
            <span className="font-inter text-[10px] font-semibold uppercase tracking-wider text-outline">Progress over time</span>
            <span className="font-inter text-[10px] text-outline">Target: {kr.target} {kr.unit}</span>
          </div>
          <ResponsiveContainer width="100%" height={90}>
            <LineChart data={histData} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
              <XAxis dataKey="date" tick={{ fontSize: 8, fontFamily: 'Inter, sans-serif' }} tickLine={false} axisLine={false} />
              <YAxis domain={[0, kr.target]} tick={{ fontSize: 8, fontFamily: 'Inter, sans-serif' }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ fontSize: 10, fontFamily: 'Inter, sans-serif', borderRadius: 6, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,.15)' }}
                formatter={(v) => [`${v} ${kr.unit}`, 'Value']}
              />
              <ReferenceLine y={kr.target} stroke="#006243" strokeDasharray="4 3" strokeWidth={1} />
              <Line type="monotone" dataKey="value" stroke="#004ac6" strokeWidth={2} dot={{ r: 2.5, fill: '#004ac6' }} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ─── Goal Card ────────────────────────────────────────────────────────────────

function GoalCard({ goal }: { goal: Goal }) {
  const { updateGoal, deleteGoal, addKeyResult, deleteKeyResult } = useGoalsStore();
  const [expanded, setExpanded] = useState(true);
  const [addingKR, setAddingKR] = useState(false);
  const [newKRTitle, setNewKRTitle] = useState('');
  const [newKRTarget, setNewKRTarget] = useState('');
  const [newKRUnit, setNewKRUnit] = useState('');

  const pct = goalProgress(goal);

  const statusColor =
    goal.status === 'completed' ? 'text-tertiary bg-tertiary/10 border-tertiary/30' :
    goal.status === 'abandoned' ? 'text-outline bg-surface-container border-outline-variant' :
    pct >= 70 ? 'text-primary bg-primary/10 border-primary/20' :
    'text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/20 dark:border-amber-800/30';

  function handleAddKR() {
    const t = parseFloat(newKRTarget);
    if (!newKRTitle.trim() || isNaN(t) || t <= 0) return;
    addKeyResult(goal.id, { title: newKRTitle.trim(), current: 0, target: t, unit: newKRUnit.trim() || '' });
    setNewKRTitle(''); setNewKRTarget(''); setNewKRUnit(''); setAddingKR(false);
  }

  return (
    <div className="bg-surface-container rounded-2xl overflow-hidden">
      {/* Goal header */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`px-2 py-0.5 rounded-full font-inter text-[10px] font-bold border uppercase tracking-wider ${statusColor}`}>
                {goal.status === 'active' ? `${pct}%` : goal.status}
              </span>
            </div>
            <h3 className="font-manrope font-bold text-base text-on-surface leading-snug">{goal.title}</h3>
            {goal.description && (
              <p className="font-inter text-xs text-on-surface-variant mt-0.5 line-clamp-2">{goal.description}</p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {goal.status === 'active' && (
              <>
                <button
                  onClick={() => updateGoal(goal.id, { status: 'completed' })}
                  className="p-1.5 rounded-lg text-tertiary hover:bg-tertiary/10 transition-colors"
                  title="Mark complete"
                >
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                </button>
                <button
                  onClick={() => updateGoal(goal.id, { status: 'abandoned' })}
                  className="p-1.5 rounded-lg text-outline hover:bg-surface-container-high transition-colors"
                  title="Abandon"
                >
                  <span className="material-symbols-outlined text-[18px]">archive</span>
                </button>
              </>
            )}
            {goal.status !== 'active' && (
              <button
                onClick={() => updateGoal(goal.id, { status: 'active' })}
                className="p-1.5 rounded-lg text-outline hover:bg-surface-container-high transition-colors"
                title="Reactivate"
              >
                <span className="material-symbols-outlined text-[18px]">replay</span>
              </button>
            )}
            <button
              onClick={() => deleteGoal(goal.id)}
              className="p-1.5 rounded-lg text-outline hover:text-error hover:bg-error/10 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">delete</span>
            </button>
            <button
              onClick={() => setExpanded((v) => !v)}
              className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">
                {expanded ? 'expand_less' : 'expand_more'}
              </span>
            </button>
          </div>
        </div>

        {/* Overall progress bar */}
        <div className="mt-3">
          <KRBar pct={pct} status={goal.status} />
        </div>
      </div>

      {/* Key Results */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-outline-variant/10 pt-3">
          {goal.keyResults.length === 0 && !addingKR && (
            <p className="font-inter text-xs text-outline text-center py-2">No key results yet</p>
          )}

          {goal.keyResults.map((kr) => (
            <KRRow
              key={kr.id}
              kr={kr}
              goalId={goal.id}
              goalStatus={goal.status}
              onDelete={() => deleteKeyResult(goal.id, kr.id)}
            />
          ))}

          {/* Add KR form */}
          {addingKR ? (
            <div className="space-y-2 bg-surface-container-low rounded-xl p-3">
              <input
                type="text"
                value={newKRTitle}
                onChange={(e) => setNewKRTitle(e.target.value)}
                placeholder="Key result title"
                autoFocus
                className="w-full bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-2 font-inter text-sm text-on-surface outline-none focus:border-primary/40 placeholder:text-outline/50"
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  value={newKRTarget}
                  onChange={(e) => setNewKRTarget(e.target.value)}
                  placeholder="Target (e.g. 10)"
                  className="flex-1 bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-2 font-inter text-sm text-on-surface outline-none focus:border-primary/40 placeholder:text-outline/50"
                />
                <input
                  type="text"
                  value={newKRUnit}
                  onChange={(e) => setNewKRUnit(e.target.value)}
                  placeholder="Unit (e.g. tasks, %)"
                  className="flex-1 bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-2 font-inter text-sm text-on-surface outline-none focus:border-primary/40 placeholder:text-outline/50"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setAddingKR(false)} className="px-3 py-1.5 text-on-surface-variant font-inter text-xs">
                  Cancel
                </button>
                <button
                  onClick={handleAddKR}
                  disabled={!newKRTitle.trim() || !newKRTarget}
                  className="px-3 py-1.5 bg-primary text-on-primary rounded-lg font-inter text-xs font-semibold disabled:opacity-40"
                >
                  Add
                </button>
              </div>
            </div>
          ) : (
            goal.status === 'active' && (
              <button
                onClick={() => setAddingKR(true)}
                className="flex items-center gap-1.5 text-xs text-primary font-inter font-medium hover:underline"
              >
                <span className="material-symbols-outlined text-[14px]">add</span>
                Add key result
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

// ─── Add Goal Modal ───────────────────────────────────────────────────────────

function AddGoalModal({ quarter, onClose }: { quarter: string; onClose: () => void }) {
  const { addGoal } = useGoalsStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  function handleAdd() {
    if (!title.trim()) return;
    addGoal({ title: title.trim(), description: description.trim(), quarter });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-surface-container-lowest rounded-2xl w-full max-w-md p-5 space-y-4 shadow-modal animate-slide-up">
        <h2 className="font-manrope font-bold text-lg text-on-surface">New Goal — {quarter}</h2>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Goal title"
          autoFocus
          className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-3 py-2.5 font-inter text-sm text-on-surface outline-none focus:border-primary/40 placeholder:text-outline/50"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          rows={2}
          className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-3 py-2.5 font-inter text-sm text-on-surface outline-none focus:border-primary/40 placeholder:text-outline/50 resize-none"
        />
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-on-surface-variant font-inter text-sm">Cancel</button>
          <button
            onClick={handleAdd}
            disabled={!title.trim()}
            className="px-4 py-2 rounded-xl bg-primary text-on-primary font-inter font-semibold text-sm disabled:opacity-40"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Goals() {
  const { goals } = useGoalsStore();
  const quarters = useMemo(() => generateQuarters(), []);
  const [selectedQuarter, setSelectedQuarter] = useState(currentQuarter);
  const [showAdd, setShowAdd] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const quarterGoals = goals.filter((g) => g.quarter === selectedQuarter);
  const active = quarterGoals.filter((g) => g.status === 'active');
  const archived = quarterGoals.filter((g) => g.status !== 'active');

  const overallPct = active.length
    ? Math.round(active.reduce((s, g) => s + goalProgress(g), 0) / active.length)
    : 0;

  return (
    <div className="bg-background min-h-screen">
      <TopBar
        title="Goals & OKRs"
        showBack
        rightSlot={
          <button
            onClick={() => setShowAdd(true)}
            className="p-2 rounded-xl text-primary"
          >
            <span className="material-symbols-outlined text-[22px]">add</span>
          </button>
        }
      />

      <main className="max-w-screen-xl mx-auto px-4 py-4 pb-32 space-y-5">

        {/* Quarter selector */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {quarters.map((q) => (
            <button
              key={q}
              onClick={() => setSelectedQuarter(q)}
              className={`shrink-0 px-3 py-1.5 rounded-xl font-inter text-xs font-semibold transition-all ${
                selectedQuarter === q
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container text-on-surface-variant'
              }`}
            >
              {q}
            </button>
          ))}
        </div>

        {/* Quarter summary */}
        {active.length > 0 && (
          <div className="bg-gradient-to-br from-primary/10 to-secondary/10 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-inter text-xs text-on-surface-variant">{selectedQuarter} — {active.length} active goal{active.length !== 1 ? 's' : ''}</p>
                <p className="font-manrope font-bold text-3xl text-on-surface">{overallPct}%</p>
                <p className="font-inter text-xs text-on-surface-variant">Overall progress</p>
              </div>
              <div className="relative w-20 h-20">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" strokeWidth="7" className="text-surface-container" />
                  <circle
                    cx="40" cy="40" r="34" fill="none" stroke="currentColor" strokeWidth="7"
                    className="text-primary"
                    strokeDasharray={2 * Math.PI * 34}
                    strokeDashoffset={2 * Math.PI * 34 * (1 - overallPct / 100)}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="font-manrope font-bold text-sm text-primary">{overallPct}%</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Active goals */}
        {active.length > 0 ? (
          <div className="space-y-3">
            {active.map((g) => <GoalCard key={g.id} goal={g} />)}
          </div>
        ) : (
          <div className="bg-surface-container rounded-2xl px-4 py-10 text-center">
            <span className="material-symbols-outlined text-[40px] text-on-surface-variant">target</span>
            <p className="font-inter font-semibold text-sm text-on-surface mt-2">No goals for {selectedQuarter}</p>
            <p className="font-inter text-xs text-on-surface-variant mt-1">Tap + to set a goal for this quarter</p>
            <button
              onClick={() => setShowAdd(true)}
              className="mt-4 px-4 py-2 rounded-xl bg-primary text-on-primary font-inter font-semibold text-sm"
            >
              Add goal
            </button>
          </div>
        )}

        {/* Archived goals */}
        {archived.length > 0 && (
          <div>
            <button
              onClick={() => setShowArchived((v) => !v)}
              className="flex items-center gap-1 text-xs text-on-surface-variant font-inter font-semibold uppercase tracking-wider mb-2"
            >
              <span className="material-symbols-outlined text-[14px]">{showArchived ? 'expand_less' : 'expand_more'}</span>
              Completed / Abandoned ({archived.length})
            </button>
            {showArchived && (
              <div className="space-y-3">
                {archived.map((g) => <GoalCard key={g.id} goal={g} />)}
              </div>
            )}
          </div>
        )}
      </main>

      {/* FAB */}
      <button
        onClick={() => setShowAdd(true)}
        className="fixed right-4 bg-primary-container text-on-primary-container rounded-2xl w-14 h-14 flex items-center justify-center shadow-lg"
        style={{ bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))' }}
      >
        <span className="material-symbols-outlined text-[24px]">add</span>
      </button>

      {showAdd && <AddGoalModal quarter={selectedQuarter} onClose={() => setShowAdd(false)} />}
    </div>
  );
}
