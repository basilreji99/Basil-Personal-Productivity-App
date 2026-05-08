import { useState, useMemo, useEffect } from 'react';
import TopBar from '../components/layout/TopBar';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useGymStore } from '../store/gymStore';
import { MUSCLE_GROUP_LABELS, EQUIPMENT_LABELS } from '../data/exercises';
import { hcExerciseTypeName } from '../services/healthConnect';
import type {
  GymExercise,
  GymExerciseEntry,
  GymSet,
  GymSession,
  WorkoutTemplate,
  MuscleGroup,
} from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtVolume(v: number) {
  return v >= 1000 ? `${(v / 1000).toFixed(1)}t` : `${v}kg`;
}

// ─── Exercise Picker Modal ────────────────────────────────────────────────────

function ExercisePicker({
  open, onClose, onPick, allExercises,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (id: string) => void;
  allExercises: GymExercise[];
}) {
  const [search, setSearch] = useState('');
  const [filterGroup, setFilterGroup] = useState<MuscleGroup | 'all'>('all');

  const filtered = useMemo(() => {
    return allExercises.filter((e) => {
      const matchGroup = filterGroup === 'all' || e.muscleGroup === filterGroup;
      const matchSearch = e.name.toLowerCase().includes(search.toLowerCase());
      return matchGroup && matchSearch;
    });
  }, [allExercises, search, filterGroup]);

  const groups: Array<MuscleGroup | 'all'> = [
    'all', 'chest', 'back', 'shoulders', 'biceps', 'triceps',
    'core', 'quads', 'hamstrings', 'glutes', 'calves', 'full_body', 'cardio',
  ];

  return (
    <Modal open={open} onClose={onClose} title="Choose Exercise" size="sm">
      <div className="flex flex-col max-h-[70vh]">
        <div className="px-4 pb-3 space-y-2 shrink-0">
          <input
            type="text"
            placeholder="Search exercises…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-2 font-inter text-sm text-on-surface outline-none focus:border-primary/50"
          />
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {groups.map((g) => (
              <button
                key={g}
                onClick={() => setFilterGroup(g)}
                className={`shrink-0 px-3 py-1 rounded-full font-inter text-xs font-medium transition-colors ${
                  filterGroup === g
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container text-on-surface-variant'
                }`}
              >
                {g === 'all' ? 'All' : MUSCLE_GROUP_LABELS[g as MuscleGroup]}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-y-auto flex-1 divide-y divide-outline-variant/10">
          {filtered.map((ex) => (
            <button
              key={ex.id}
              onClick={() => { onPick(ex.id); onClose(); }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-container text-left"
            >
              <div className="flex-1 min-w-0">
                <p className="font-inter font-semibold text-sm text-on-surface">{ex.name}</p>
                <p className="font-inter text-[10px] text-outline">
                  {MUSCLE_GROUP_LABELS[ex.muscleGroup]} · {EQUIPMENT_LABELS[ex.equipment]}
                  {ex.isCustom ? ' · Custom' : ''}
                </p>
              </div>
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant">add</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="font-inter text-sm text-outline text-center py-8">No exercises found</p>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ─── Active Session Overlay ───────────────────────────────────────────────────

function SetRow({
  set, index, onUpdate, onDelete,
}: {
  set: GymSet;
  index: number;
  onUpdate: (update: Partial<GymSet>) => void;
  onDelete: () => void;
}) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${set.isWarmup ? 'bg-amber-50 dark:bg-amber-950/20' : 'bg-surface-container-lowest'}`}>
      <button
        onClick={() => onUpdate({ isWarmup: !set.isWarmup })}
        className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-inter font-bold shrink-0 ${
          set.isWarmup ? 'bg-amber-200 text-amber-700' : 'bg-surface-container text-outline'
        }`}
        title={set.isWarmup ? 'Warmup set' : 'Working set'}
      >
        {set.isWarmup ? 'W' : index + 1}
      </button>
      <input
        type="number"
        inputMode="decimal"
        placeholder="0"
        value={set.weight || ''}
        onChange={(e) => onUpdate({ weight: parseFloat(e.target.value) || 0 })}
        className="w-16 bg-surface-container border border-outline-variant/30 rounded-lg px-2 py-1.5 font-inter text-sm text-center outline-none focus:border-primary/50"
      />
      <span className="font-inter text-xs text-outline shrink-0">kg</span>
      <input
        type="number"
        inputMode="numeric"
        placeholder="0"
        value={set.reps || ''}
        onChange={(e) => onUpdate({ reps: parseInt(e.target.value) || 0 })}
        className="w-14 bg-surface-container border border-outline-variant/30 rounded-lg px-2 py-1.5 font-inter text-sm text-center outline-none focus:border-primary/50"
      />
      <span className="font-inter text-xs text-outline shrink-0">reps</span>
      <button
        onClick={onDelete}
        className="ml-auto p-1 rounded text-on-surface-variant hover:text-error transition-colors shrink-0"
      >
        <span className="material-symbols-outlined text-[14px]">close</span>
      </button>
    </div>
  );
}

function ExerciseCard({
  entry, exercise, onAddSet, onUpdateSet, onDeleteSet, onRemove,
}: {
  entry: GymExerciseEntry;
  exercise: GymExercise | undefined;
  onAddSet: () => void;
  onUpdateSet: (setId: string, update: Partial<GymSet>) => void;
  onDeleteSet: (setId: string) => void;
  onRemove: () => void;
}) {
  const workingSets = entry.sets.filter((s) => !s.isWarmup);

  return (
    <div className="bg-surface-container-low rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-outline-variant/10">
        <div className="flex-1 min-w-0">
          <p className="font-inter font-semibold text-sm text-on-surface">
            {exercise?.name ?? 'Unknown Exercise'}
          </p>
          {exercise && (
            <p className="font-inter text-[10px] text-outline">
              {MUSCLE_GROUP_LABELS[exercise.muscleGroup]} · {EQUIPMENT_LABELS[exercise.equipment]}
            </p>
          )}
        </div>
        {workingSets.length > 0 && (
          <span className="font-inter text-[10px] text-on-surface-variant shrink-0">
            {workingSets.length} × {workingSets[workingSets.length - 1].weight || '—'}kg
          </span>
        )}
        <button onClick={onRemove} className="p-1 text-on-surface-variant hover:text-error transition-colors shrink-0">
          <span className="material-symbols-outlined text-[16px]">delete</span>
        </button>
      </div>
      <div className="px-3 py-2 space-y-1.5">
        {entry.sets.map((set, i) => (
          <SetRow
            key={set.id}
            set={set}
            index={i}
            onUpdate={(u) => onUpdateSet(set.id, u)}
            onDelete={() => onDeleteSet(set.id)}
          />
        ))}
        <button
          onClick={onAddSet}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-surface-container text-on-surface-variant hover:bg-surface-container-high transition-colors font-inter text-xs"
        >
          <span className="material-symbols-outlined text-[14px]">add</span>
          Add Set
        </button>
      </div>
    </div>
  );
}

function ActiveSessionOverlay({
  session,
  allExercises,
  onFinish,
  onCancel,
}: {
  session: GymSession;
  allExercises: GymExercise[];
  onFinish: () => void;
  onCancel: () => void;
}) {
  const {
    addExerciseToSession, removeExerciseFromSession,
    addSet, updateSet, deleteSet,
    updateSessionName, finishSession, cancelSession,
  } = useGymStore();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(session.startedAt).getTime();
    const tick = () => setElapsed(Math.round((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [session.startedAt]);

  function handleAddSet(entryId: string) {
    const entry = session.exercises.find((e) => e.id === entryId);
    const lastSet = entry?.sets[entry.sets.length - 1];
    addSet(entryId, lastSet ? { weight: lastSet.weight, reps: lastSet.reps } : {});
  }

  function handleFinish() {
    finishSession();
    onFinish();
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-background flex flex-col"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-primary text-on-primary shrink-0">
        <button onClick={() => setConfirmCancel(true)} className="p-1 rounded">
          <span className="material-symbols-outlined text-[22px]">close</span>
        </button>
        <input
          value={session.name}
          onChange={(e) => updateSessionName(e.target.value)}
          className="flex-1 bg-transparent font-inter font-semibold text-base outline-none placeholder:text-on-primary/50"
          placeholder="Workout name"
        />
        <span className="font-inter text-sm font-semibold shrink-0">{fmtDuration(elapsed)}</span>
        <button
          onClick={handleFinish}
          className="px-4 py-1.5 bg-on-primary text-primary rounded-lg font-inter font-bold text-sm shrink-0"
        >
          Finish
        </button>
      </div>

      {/* Exercise list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-4">
        {session.exercises.length === 0 && (
          <div className="text-center py-12">
            <span className="material-symbols-outlined text-[48px] text-outline mb-3 block">exercise</span>
            <p className="font-inter font-semibold text-sm text-on-surface mb-1">No exercises yet</p>
            <p className="font-work-sans text-xs text-on-surface-variant">Tap Add Exercise to start</p>
          </div>
        )}
        {session.exercises.map((entry) => {
          const ex = allExercises.find((e) => e.id === entry.exerciseId);
          return (
            <ExerciseCard
              key={entry.id}
              entry={entry}
              exercise={ex}
              onAddSet={() => handleAddSet(entry.id)}
              onUpdateSet={(setId, update) => updateSet(entry.id, setId, update)}
              onDeleteSet={(setId) => deleteSet(entry.id, setId)}
              onRemove={() => removeExerciseFromSession(entry.id)}
            />
          );
        })}

        <button
          onClick={() => setPickerOpen(true)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-outline-variant text-on-surface-variant hover:border-primary/40 hover:text-primary transition-colors font-inter font-medium text-sm"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          Add Exercise
        </button>
      </div>

      <ExercisePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(id) => addExerciseToSession(id)}
        allExercises={allExercises}
      />

      <ConfirmDialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={() => { cancelSession(); onCancel(); }}
        title="Cancel Workout"
        message="Discard this workout? All progress will be lost."
        confirmLabel="Discard"
        danger
      />
    </div>
  );
}

// ─── Start Workout Modal ──────────────────────────────────────────────────────

function StartWorkoutModal({
  open, onClose, templates, onStart,
}: {
  open: boolean;
  onClose: () => void;
  templates: WorkoutTemplate[];
  onStart: (name: string, templateId?: string) => void;
}) {
  const [name, setName] = useState('');

  function startEmpty() {
    onStart(name || 'Quick Workout');
    onClose();
  }

  function startFromTemplate(tpl: WorkoutTemplate) {
    onStart(tpl.name, tpl.id);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Start Workout" size="sm">
      <div className="p-4 space-y-4">
        <div className="space-y-1">
          <label className="font-inter text-[10px] font-semibold uppercase tracking-wider text-outline">Workout Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Push Day"
            className="w-full bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-2 font-inter text-sm text-on-surface outline-none focus:border-primary/50"
          />
        </div>
        <button
          onClick={startEmpty}
          className="w-full py-3 bg-primary text-on-primary rounded-xl font-inter font-semibold text-sm"
        >
          Start Empty Workout
        </button>
        {templates.length > 0 && (
          <>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-outline-variant/30" />
              <span className="font-inter text-[10px] text-outline">or from template</span>
              <div className="flex-1 h-px bg-outline-variant/30" />
            </div>
            <div className="space-y-2">
              {templates.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => startFromTemplate(tpl)}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-surface-container rounded-xl hover:bg-surface-container-high text-left"
                >
                  <span className="material-symbols-outlined text-[20px] text-primary">content_copy</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-inter font-semibold text-sm text-on-surface">{tpl.name}</p>
                    <p className="font-inter text-[10px] text-outline">{tpl.exercises.length} exercises</p>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

// ─── Session Detail Modal ─────────────────────────────────────────────────────

function SessionDetailModal({
  session, open, onClose, allExercises, onDelete,
}: {
  session: GymSession | null;
  open: boolean;
  onClose: () => void;
  allExercises: GymExercise[];
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (!session) return null;

  return (
    <Modal open={open} onClose={onClose} title={session.name} size="sm">
      <div className="flex flex-col max-h-[75vh]">
        {/* Meta row */}
        <div className="px-4 py-3 border-b border-outline-variant/10 flex items-center gap-4 shrink-0">
          <div className="text-center">
            <p className="font-manrope font-bold text-base text-on-surface">
              {session.durationSeconds ? fmtDuration(session.durationSeconds) : '—'}
            </p>
            <p className="font-inter text-[9px] text-outline">Duration</p>
          </div>
          <div className="text-center">
            <p className="font-manrope font-bold text-base text-on-surface">
              {session.totalVolume ? fmtVolume(session.totalVolume) : '—'}
            </p>
            <p className="font-inter text-[9px] text-outline">Volume</p>
          </div>
          <div className="text-center">
            <p className="font-manrope font-bold text-base text-on-surface">{session.totalSets ?? '—'}</p>
            <p className="font-inter text-[9px] text-outline">Sets</p>
          </div>
          {session.calories && (
            <div className="text-center">
              <p className="font-manrope font-bold text-base text-on-surface">{session.calories}</p>
              <p className="font-inter text-[9px] text-outline">kcal</p>
            </div>
          )}
        </div>

        <div className="overflow-y-auto flex-1 px-4 py-3 space-y-4">
          {session.source === 'health_connect' && (
            <div className="flex items-center gap-2 bg-green-50 dark:bg-green-950/20 rounded-xl px-3 py-2">
              <span className="material-symbols-outlined text-[14px] text-green-600">sync</span>
              <p className="font-inter text-xs text-green-700">Imported from Health Connect · {hcExerciseTypeName(session.hcExerciseType ?? 0)}</p>
            </div>
          )}

          {session.exercises.length === 0 && session.source === 'health_connect' && (
            <p className="font-inter text-xs text-outline text-center py-4">
              Per-exercise data not available from Health Connect
            </p>
          )}

          {session.exercises.map((entry) => {
            const ex = allExercises.find((e) => e.id === entry.exerciseId);
            const workingSets = entry.sets.filter((s) => !s.isWarmup);
            return (
              <div key={entry.id} className="space-y-1.5">
                <p className="font-inter font-semibold text-sm text-on-surface">{ex?.name ?? 'Unknown'}</p>
                <div className="space-y-1">
                  {entry.sets.map((set, i) => (
                    <div key={set.id} className={`flex items-center gap-3 px-3 py-1.5 rounded-lg ${set.isWarmup ? 'bg-amber-50 dark:bg-amber-950/20' : 'bg-surface-container'}`}>
                      <span className="font-inter text-[10px] text-outline w-6 text-center">
                        {set.isWarmup ? 'W' : i + 1}
                      </span>
                      <span className="font-inter text-sm text-on-surface font-semibold">
                        {set.weight}kg × {set.reps}
                      </span>
                    </div>
                  ))}
                </div>
                {workingSets.length > 0 && (
                  <p className="font-inter text-[10px] text-outline">
                    Vol: {fmtVolume(workingSets.reduce((a, s) => a + s.weight * s.reps, 0))}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className="px-4 py-3 border-t border-outline-variant/20 flex justify-between items-center shrink-0">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="font-inter text-xs text-error">Delete?</span>
              <button onClick={onDelete} className="px-3 py-1.5 rounded-lg bg-error text-on-error font-inter text-xs font-medium">Yes</button>
              <button onClick={() => setConfirmDelete(false)} className="px-3 py-1.5 rounded-lg text-on-surface-variant font-inter text-xs">No</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="p-2 text-on-surface-variant hover:text-error transition-colors">
              <span className="material-symbols-outlined text-[20px]">delete</span>
            </button>
          )}
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-surface-container text-on-surface font-inter text-sm">Close</button>
        </div>
      </div>
    </Modal>
  );
}



// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Gym() {
  const {
    sessions, customExercises, activeSession,
    getAllExercises, deleteSession,
  } = useGymStore();

  const [startOpen, setStartOpen]       = useState(false);
  const [detailSession, setDetailSession] = useState<GymSession | null>(null);

  const allExercises = useMemo(() => getAllExercises(), [sessions, customExercises]);

  const sortedSessions = useMemo(
    () => [...sessions]
      .filter((s) => s.source !== 'health_connect')
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
    [sessions]
  );

  const monthStats = useMemo(() => {
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthly = sessions.filter((s) => s.startedAt.startsWith(monthStr) && s.source !== 'health_connect');
    const totalVol = monthly.reduce((a, s) => a + (s.totalVolume ?? 0), 0);
    const totalSets = monthly.reduce((a, s) => a + (s.totalSets ?? 0), 0);
    return { count: monthly.length, volume: totalVol, sets: totalSets };
  }, [sessions]);

  if (activeSession) {
    return (
      <ActiveSessionOverlay
        session={activeSession}
        allExercises={allExercises}
        onFinish={() => {}}
        onCancel={() => {}}
      />
    );
  }

  return (
    <div className="bg-background min-h-screen">
      <TopBar title="Gym" showBack />

      <main className="max-w-screen-xl mx-auto pb-32" style={{ paddingBottom: 'calc(96px + env(safe-area-inset-bottom, 0px))' }}>

        {/* Month summary hero */}
        <div className="bg-primary px-4 py-5 text-center">
          <p className="font-inter text-xs font-semibold uppercase tracking-widest text-on-primary/60 mb-1">This Month</p>
          <div className="flex items-center justify-center gap-8">
            <div>
              <p className="font-manrope font-bold text-3xl text-on-primary">{monthStats.count}</p>
              <p className="font-inter text-[10px] text-on-primary/60 uppercase tracking-wide">Workouts</p>
            </div>
            <div>
              <p className="font-manrope font-bold text-3xl text-on-primary">{fmtVolume(monthStats.volume)}</p>
              <p className="font-inter text-[10px] text-on-primary/60 uppercase tracking-wide">Volume</p>
            </div>
            <div>
              <p className="font-manrope font-bold text-3xl text-on-primary">{monthStats.sets}</p>
              <p className="font-inter text-[10px] text-on-primary/60 uppercase tracking-wide">Sets</p>
            </div>
          </div>
        </div>

        {/* Start workout CTA */}
        <div className="px-4 py-4">
          <button
            onClick={() => setStartOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-4 bg-primary/10 border-2 border-primary/20 rounded-2xl text-primary font-inter font-semibold text-base hover:bg-primary/15 active:bg-primary/20 transition-colors"
          >
            <span className="material-symbols-outlined text-[24px]">play_circle</span>
            Start Workout
          </button>
        </div>

        {/* ── History ── */}
        {(
          <div className="px-4 space-y-3">
            {sortedSessions.length === 0 ? (
              <div className="text-center py-16">
                <span className="material-symbols-outlined text-[56px] text-outline block mb-3">exercise</span>
                <p className="font-manrope font-semibold text-on-surface mb-1">No workouts yet</p>
                <p className="font-work-sans text-sm text-on-surface-variant">Start a workout to see it here</p>
              </div>
            ) : (
              sortedSessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setDetailSession(s)}
                  className="w-full bg-surface-container-lowest rounded-2xl p-4 shadow-card text-left hover:shadow-card-hover transition-shadow"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-inter font-semibold text-sm text-on-surface truncate">{s.name}</p>
                        {s.source === 'health_connect' && (
                          <span className="font-inter text-[9px] px-1.5 py-0.5 bg-green-50 text-green-600 rounded-full dark:bg-green-950/30 shrink-0">HC</span>
                        )}
                      </div>
                      <p className="font-inter text-xs text-outline">{fmtDate(s.startedAt)}</p>
                    </div>
                    <div className="flex gap-4 text-right shrink-0">
                      {s.durationSeconds ? (
                        <div>
                          <p className="font-inter font-semibold text-sm text-on-surface">{fmtDuration(s.durationSeconds)}</p>
                          <p className="font-inter text-[9px] text-outline">Duration</p>
                        </div>
                      ) : null}
                      {(s.totalVolume ?? 0) > 0 ? (
                        <div>
                          <p className="font-inter font-semibold text-sm text-on-surface">{fmtVolume(s.totalVolume!)}</p>
                          <p className="font-inter text-[9px] text-outline">Volume</p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  {s.exercises.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {s.exercises.slice(0, 4).map((entry) => {
                        const ex = allExercises.find((e) => e.id === entry.exerciseId);
                        return ex ? (
                          <span key={entry.id} className="font-inter text-[9px] px-2 py-0.5 bg-surface-container rounded-full text-on-surface-variant">
                            {ex.name}
                          </span>
                        ) : null;
                      })}
                      {s.exercises.length > 4 && (
                        <span className="font-inter text-[9px] px-2 py-0.5 bg-surface-container rounded-full text-outline">
                          +{s.exercises.length - 4}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        )}

      </main>

      <StartWorkoutModal
        open={startOpen}
        onClose={() => setStartOpen(false)}
        templates={[]}
        onStart={(name, templateId) => useGymStore.getState().startSession(name, templateId)}
      />

      <SessionDetailModal
        session={detailSession}
        open={!!detailSession}
        onClose={() => setDetailSession(null)}
        allExercises={allExercises}
        onDelete={() => {
          if (detailSession) deleteSession(detailSession.id);
          setDetailSession(null);
        }}
      />

    </div>
  );
}
