import { useState, useMemo } from 'react';
import TopBar from '../components/layout/TopBar';
import Modal from '../components/ui/Modal';
import { useHealthStore } from '../store/healthStore';
import { useFitnessStore } from '../store/fitnessStore';
import type { BodyMeasurement } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function bmiCategory(bmi: number) {
  if (bmi < 18.5) return { label: 'Underweight', color: '#3b82f6' };
  if (bmi < 25)   return { label: 'Normal',      color: '#22c55e' };
  if (bmi < 30)   return { label: 'Overweight',  color: '#f59e0b' };
  return              { label: 'Obese',          color: '#ef4444' };
}

function bfCategory(bf: number) {
  if (bf < 6)  return { label: 'Essential',  color: '#3b82f6' };
  if (bf < 14) return { label: 'Athletic',   color: '#22c55e' };
  if (bf < 18) return { label: 'Fitness',    color: '#84cc16' };
  if (bf < 25) return { label: 'Acceptable', color: '#f59e0b' };
  return            { label: 'Obese',       color: '#ef4444' };
}

function fmt(date: string) {
  const d = new Date(date + 'T12:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function shortDate(date: string) {
  const d = new Date(date + 'T12:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// ─── SVG Line Chart ───────────────────────────────────────────────────────────

function LineChart({
  data, color, goalMin, goalMax, unit,
}: {
  data: { date: string; value: number }[];
  color: string;
  goalMin?: number;
  goalMax?: number;
  unit: string;
}) {
  if (data.length < 2) {
    return (
      <div className="h-28 flex items-center justify-center">
        <p className="font-inter text-xs text-outline">Not enough data</p>
      </div>
    );
  }

  const values = data.map(d => d.value);
  const allBounds = [...values, goalMin, goalMax].filter(v => v !== undefined) as number[];
  const rawMin = Math.min(...allBounds);
  const rawMax = Math.max(...allBounds);
  const pad = (rawMax - rawMin) * 0.18 || 1;
  const vMin = rawMin - pad;
  const vMax = rawMax + pad;

  const W = 300, H = 90;
  const toX = (i: number) => (i / (data.length - 1)) * W;
  const toY = (v: number) => H - ((v - vMin) / (vMax - vMin)) * H;

  const linePath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(d.value).toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${W},${H} L0,${H} Z`;

  const last = data[data.length - 1];
  const second = data[data.length - 2];
  const delta = last.value - second.value;

  return (
    <div>
      <div className="flex items-baseline gap-2 mb-2">
        <span className="font-manrope font-bold text-2xl" style={{ color }}>
          {last.value}{unit}
        </span>
        <span className={`font-inter text-xs font-semibold ${delta < 0 ? 'text-tertiary' : delta > 0 ? 'text-error' : 'text-outline'}`}>
          {delta > 0 ? '+' : ''}{delta.toFixed(1)}{unit} vs prev
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-28" preserveAspectRatio="none">
        {goalMin !== undefined && goalMax !== undefined && (
          <rect x={0} y={toY(goalMax)} width={W} height={Math.abs(toY(goalMin) - toY(goalMax))}
            fill="rgba(34,197,94,0.12)" />
        )}
        <path d={areaPath} fill={color} opacity="0.1" />
        <path d={linePath} stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {data.map((d, i) => (
          <circle key={i} cx={toX(i)} cy={toY(d.value)} r={i === data.length - 1 ? 4 : 2.5} fill={color} />
        ))}
        {[0, data.length - 1].map(i => (
          <text key={i} x={toX(i)} y={H - 2} textAnchor={i === 0 ? 'start' : 'end'}
            fontSize="8" fill={color} opacity="0.7" fontFamily="Inter, sans-serif">
            {shortDate(data[i].date)}
          </text>
        ))}
      </svg>
    </div>
  );
}

// ─── Range Bar ────────────────────────────────────────────────────────────────

function RangeBar({ value, min, max, label, color }: {
  value: number; min: number; max: number; label: string; color: string;
}) {
  const pct = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  return (
    <div className="space-y-1">
      <div className="flex justify-between">
        <span className="font-inter text-[10px] text-outline">{min}</span>
        <span className="font-inter text-[10px] font-semibold" style={{ color }}>{label}: {value}</span>
        <span className="font-inter text-[10px] text-outline">{max}</span>
      </div>
      <div className="relative h-2 bg-surface-container rounded-full overflow-hidden">
        <div className="absolute inset-0 rounded-full" style={{ background: `linear-gradient(to right, #22c55e 30%, #f59e0b 60%, #ef4444 100%)` }} />
        <div className="absolute top-0 h-full w-0.5 bg-white shadow-sm" style={{ left: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── Metric Detail Modal ──────────────────────────────────────────────────────

type MetricKey = 'weight' | 'bodyFat' | 'bmi' | 'muscleMass' | 'bodyWater' | 'bmr' | 'visceralFat' | 'protein' | 'metabolicAge';

interface MetricConfig {
  key: MetricKey;
  label: string;
  unit: string;
  color: string;
  icon: string;
  extract: (m: BodyMeasurement, bmi?: number | null) => number | undefined;
  rangeMin?: number;
  rangeMax?: number;
  rangeLabel?: string;
  info?: string;
}

const METRIC_CONFIGS: MetricConfig[] = [
  { key: 'weight',       label: 'Weight',        unit: 'kg',   color: '#3b82f6', icon: 'scale',           extract: m => m.weight,        rangeMin: 60, rangeMax: 90 },
  { key: 'bodyFat',      label: 'Body Fat',       unit: '%',    color: '#f97316', icon: 'water_drop',      extract: m => m.bodyFat,       rangeMin: 5, rangeMax: 30 },
  { key: 'bmi',          label: 'BMI',            unit: '',     color: '#8b5cf6', icon: 'person',          extract: (_m, bmi) => bmi ?? undefined, rangeMin: 15, rangeMax: 35 },
  { key: 'muscleMass',   label: 'Muscle Mass',    unit: 'kg',   color: '#7c3aed', icon: 'fitness_center',  extract: m => m.muscleMass,    rangeMin: 50, rangeMax: 65 },
  { key: 'bodyWater',    label: 'Body Water',     unit: '%',    color: '#06b6d4', icon: 'water',           extract: m => m.bodyWater,     rangeMin: 45, rangeMax: 75, info: 'Healthy range: 50–65%' },
  { key: 'bmr',          label: 'BMR',            unit: 'kcal', color: '#ec4899', icon: 'local_fire_department', extract: m => m.bmr,    rangeMin: 1400, rangeMax: 2200, info: 'Basal Metabolic Rate' },
  { key: 'visceralFat',  label: 'Visceral Fat',   unit: '',     color: '#ef4444', icon: 'favorite',        extract: m => m.visceralFat,   rangeMin: 1, rangeMax: 20, info: 'Score 1–9 healthy, 10–14 excess, 15+ high' },
  { key: 'protein',      label: 'Protein',        unit: '%',    color: '#84cc16', icon: 'nutrition',       extract: m => m.protein,       rangeMin: 15, rangeMax: 25, info: 'Ideal: 16–20%' },
  { key: 'metabolicAge', label: 'Metabolic Age',  unit: 'yrs',  color: '#f59e0b', icon: 'speed',           extract: m => m.metabolicAge,  rangeMin: 18, rangeMax: 50 },
];

function MetricModal({
  config, open, onClose, measurements, calcBMI,
}: {
  config: MetricConfig | null;
  open: boolean;
  onClose: () => void;
  measurements: BodyMeasurement[];
  calcBMI: (w: number) => number | null;
}) {
  if (!config) return null;

  const chartData = useMemo(() => {
    return [...measurements].reverse()
      .map(entry => {
        const bmi = entry.weight ? calcBMI(entry.weight) : null;
        const v = config.extract(entry, bmi);
        return v !== undefined ? { date: entry.date, value: v } : null;
      })
      .filter(Boolean) as { date: string; value: number }[];
  }, [measurements, config, calcBMI]);

  const latest = chartData[chartData.length - 1];

  return (
    <Modal open={open} onClose={onClose} title={config.label} size="sm">
      <div className="p-5 space-y-5">
        {latest && (
          <div className="flex items-baseline gap-2">
            <span className="font-manrope font-bold text-4xl" style={{ color: config.color }}>
              {latest.value}
            </span>
            <span className="font-inter text-lg text-outline">{config.unit}</span>
          </div>
        )}

        {config.info && (
          <p className="font-inter text-xs text-on-surface-variant bg-surface-container rounded-lg px-3 py-2">{config.info}</p>
        )}

        {config.key === 'bodyFat' && latest && (
          <div className="space-y-2">
            {(() => {
              const cat = bfCategory(latest.value);
              return (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: cat.color }} />
                  <span className="font-inter text-sm font-semibold" style={{ color: cat.color }}>{cat.label}</span>
                </div>
              );
            })()}
            <RangeBar value={latest.value} min={5} max={30} label="Body Fat" color={config.color} />
          </div>
        )}

        {config.key === 'bmi' && latest && (
          <div className="space-y-2">
            {(() => {
              const cat = bmiCategory(latest.value);
              return (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: cat.color }} />
                  <span className="font-inter text-sm font-semibold" style={{ color: cat.color }}>{cat.label}</span>
                </div>
              );
            })()}
            <RangeBar value={latest.value} min={15} max={35} label="BMI" color={config.color} />
          </div>
        )}

        <LineChart data={chartData} color={config.color} unit={config.unit} />

        <div className="space-y-1.5 max-h-40 overflow-y-auto">
          {[...chartData].reverse().slice(0, 10).map((d, i) => (
            <div key={i} className="flex justify-between items-center py-1 border-b border-outline-variant/10 last:border-0">
              <span className="font-inter text-xs text-on-surface-variant">{fmt(d.date)}</span>
              <span className="font-inter text-sm font-semibold text-on-surface">{d.value}{config.unit}</span>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

// ─── Log Measurement Modal ────────────────────────────────────────────────────

function LogModal({ open, onClose, measurement }: {
  open: boolean; onClose: () => void; measurement?: BodyMeasurement | null;
}) {
  const { addMeasurement, updateMeasurement, deleteMeasurement, calcBMI, profile } = useHealthStore();
  const today = new Date().toISOString().slice(0, 10);

  const [date, setDate]               = useState(today);
  const [weight, setWeight]           = useState('');
  const [bodyFat, setBodyFat]         = useState('');
  const [muscleMass, setMuscleMass]   = useState('');
  const [boneMass, setBoneMass]       = useState('');
  const [subcutFat, setSubcutFat]     = useState('');
  const [bodyWater, setBodyWater]     = useState('');
  const [skeletalMuscle, setSkeletal] = useState('');
  const [visceralFat, setVisceral]    = useState('');
  const [bmr, setBmr]                 = useState('');
  const [protein, setProtein]         = useState('');
  const [metabolicAge, setMetabolicAge] = useState('');
  const [notes, setNotes]             = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useMemo(() => {
    if (!open) return;
    if (measurement) {
      setDate(measurement.date);
      setWeight(measurement.weight?.toString() ?? '');
      setBodyFat(measurement.bodyFat?.toString() ?? '');
      setMuscleMass(measurement.muscleMass?.toString() ?? '');
      setBoneMass(measurement.boneMass?.toString() ?? '');
      setSubcutFat(measurement.subcutFat?.toString() ?? '');
      setBodyWater(measurement.bodyWater?.toString() ?? '');
      setSkeletal(measurement.skeletalMuscle?.toString() ?? '');
      setVisceral(measurement.visceralFat?.toString() ?? '');
      setBmr(measurement.bmr?.toString() ?? '');
      setProtein(measurement.protein?.toString() ?? '');
      setMetabolicAge(measurement.metabolicAge?.toString() ?? '');
      setNotes(measurement.notes ?? '');
    } else {
      setDate(today);
      setWeight(''); setBodyFat(''); setMuscleMass(''); setBoneMass('');
      setSubcutFat(''); setBodyWater(''); setSkeletal(''); setVisceral('');
      setBmr(''); setProtein(''); setMetabolicAge(''); setNotes('');
    }
    setConfirmDelete(false);
  }, [open]);

  const bmiPreview = weight && profile.height ? calcBMI(parseFloat(weight)) : null;

  const field = (label: string, val: string, set: (v: string) => void, ph = '') => (
    <div className="space-y-1">
      <label className="font-inter text-[10px] font-semibold uppercase tracking-wider text-outline">{label}</label>
      <input type="number" step="0.01" value={val} onChange={e => set(e.target.value)} placeholder={ph}
        className="w-full bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-2 font-inter text-sm text-on-surface outline-none focus:border-primary/50" />
    </div>
  );

  const handleSave = () => {
    const n = (s: string) => s ? parseFloat(s) : undefined;
    const payload: Omit<BodyMeasurement, 'id'> = {
      date,
      weight: n(weight), bodyFat: n(bodyFat), muscleMass: n(muscleMass),
      boneMass: n(boneMass), subcutFat: n(subcutFat), bodyWater: n(bodyWater),
      skeletalMuscle: n(skeletalMuscle), visceralFat: n(visceralFat),
      bmr: n(bmr), protein: n(protein), metabolicAge: n(metabolicAge),
      notes: notes || undefined,
    };
    if (measurement) updateMeasurement(measurement.id, payload);
    else addMeasurement(payload);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={measurement ? 'Edit Measurement' : 'Log Measurement'} size="sm">
      <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
        <div className="space-y-1">
          <label className="font-inter text-[10px] font-semibold uppercase tracking-wider text-outline">Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-2 font-inter text-sm text-on-surface outline-none focus:border-primary/50" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {field('Weight (kg)', weight, setWeight, '71.5')}
          {field('Body Fat (%)', bodyFat, setBodyFat, '16.1')}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {field('Muscle Mass (kg)', muscleMass, setMuscleMass, '56.9')}
          {field('Bone Mass (kg)', boneMass, setBoneMass, '3.0')}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {field('Subcut. Fat (%)', subcutFat, setSubcutFat, '14.1')}
          {field('Body Water (%)', bodyWater, setBodyWater, '60.5')}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {field('Skeletal Muscle (%)', skeletalMuscle, setSkeletal, '54.1')}
          {field('Visceral Fat', visceralFat, setVisceral, '6')}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {field('BMR (kcal)', bmr, setBmr, '1720')}
          {field('Protein (%)', protein, setProtein, '19.1')}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {field('Metabolic Age', metabolicAge, setMetabolicAge, '25')}
          {bmiPreview !== null ? (
            <div className="space-y-1">
              <label className="font-inter text-[10px] font-semibold uppercase tracking-wider text-outline">BMI (auto)</label>
              <div className="bg-surface-container-low border border-outline-variant/30 rounded-lg px-3 py-2 flex items-center">
                <span className="font-inter font-bold text-sm text-on-surface">{bmiPreview}</span>
              </div>
            </div>
          ) : <div />}
        </div>

        <div className="space-y-1">
          <label className="font-inter text-[10px] font-semibold uppercase tracking-wider text-outline">Notes</label>
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="How did you feel?"
            className="w-full bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-2 font-inter text-sm text-on-surface outline-none focus:border-primary/50" />
        </div>

        <div className="flex justify-between items-center pt-2">
          {measurement ? (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="font-inter text-xs text-error">Delete?</span>
                <button onClick={() => { deleteMeasurement(measurement.id); onClose(); }}
                  className="px-3 py-1.5 rounded-lg bg-error text-on-error font-inter text-xs font-medium">Yes</button>
                <button onClick={() => setConfirmDelete(false)} className="px-3 py-1.5 rounded-lg text-on-surface-variant font-inter text-xs">No</button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="p-2 text-on-surface-variant hover:text-error transition-colors">
                <span className="material-symbols-outlined text-[20px]">delete</span>
              </button>
            )
          ) : <div />}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-on-surface-variant font-inter text-sm hover:bg-surface-container">Cancel</button>
            <button onClick={handleSave} className="px-4 py-2 rounded-lg bg-primary text-on-primary font-inter font-medium text-sm">
              {measurement ? 'Save' : 'Log'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── Profile Modal ────────────────────────────────────────────────────────────

function ProfileModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile, updateProfile } = useHealthStore();
  const [height, setHeight]           = useState(profile.height?.toString() ?? '');
  const [bfMin, setBfMin]             = useState(profile.targetBodyFatMin.toString());
  const [bfMax, setBfMax]             = useState(profile.targetBodyFatMax.toString());
  const [targetWeight, setTargetWeight] = useState(profile.targetWeight?.toString() ?? '');
  const [targetMuscle, setTargetMuscle] = useState(profile.targetMuscleMass?.toString() ?? '');

  useMemo(() => {
    if (open) {
      setHeight(profile.height?.toString() ?? '');
      setBfMin(profile.targetBodyFatMin.toString());
      setBfMax(profile.targetBodyFatMax.toString());
      setTargetWeight(profile.targetWeight?.toString() ?? '');
      setTargetMuscle(profile.targetMuscleMass?.toString() ?? '');
    }
  }, [open]);

  const handleSave = () => {
    updateProfile({
      height: parseFloat(height) || 0,
      targetBodyFatMin: parseFloat(bfMin) || 10,
      targetBodyFatMax: parseFloat(bfMax) || 15,
      targetWeight: targetWeight ? parseFloat(targetWeight) : undefined,
      targetMuscleMass: targetMuscle ? parseFloat(targetMuscle) : undefined,
    });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Health Profile" size="sm">
      <div className="p-5 space-y-4">
        <div className="space-y-1">
          <label className="font-inter text-xs font-semibold uppercase tracking-wider text-outline">Height (cm)</label>
          <input type="number" value={height} onChange={e => setHeight(e.target.value)} placeholder="e.g. 173"
            className="w-full bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-2 font-inter text-sm outline-none focus:border-primary/50" />
        </div>
        <div className="space-y-1">
          <label className="font-inter text-xs font-semibold uppercase tracking-wider text-outline">Target Body Fat Range (%)</label>
          <div className="flex items-center gap-2">
            <input type="number" step="0.5" value={bfMin} onChange={e => setBfMin(e.target.value)}
              className="w-full bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-2 font-inter text-sm outline-none focus:border-primary/50" />
            <span className="font-inter text-sm text-outline shrink-0">to</span>
            <input type="number" step="0.5" value={bfMax} onChange={e => setBfMax(e.target.value)}
              className="w-full bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-2 font-inter text-sm outline-none focus:border-primary/50" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="font-inter text-xs font-semibold uppercase tracking-wider text-outline">Target Weight (kg)</label>
            <input type="number" step="0.5" value={targetWeight} onChange={e => setTargetWeight(e.target.value)} placeholder="optional"
              className="w-full bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-2 font-inter text-sm outline-none focus:border-primary/50" />
          </div>
          <div className="space-y-1">
            <label className="font-inter text-xs font-semibold uppercase tracking-wider text-outline">Target Muscle (kg)</label>
            <input type="number" step="0.5" value={targetMuscle} onChange={e => setTargetMuscle(e.target.value)} placeholder="optional"
              className="w-full bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-2 font-inter text-sm outline-none focus:border-primary/50" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-on-surface-variant font-inter text-sm hover:bg-surface-container">Cancel</button>
          <button onClick={handleSave} className="px-4 py-2 rounded-lg bg-primary text-on-primary font-inter font-medium text-sm">Save</button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Fitness History Modal ────────────────────────────────────────────────────

function FitnessHistoryModal({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="max-h-[70vh] overflow-y-auto divide-y divide-outline-variant/10">
        {children}
      </div>
    </Modal>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  'Push, Chest & Triceps': '#f97316',
  'Back & Biceps':         '#8b5cf6',
  'Legs & Core':           '#22c55e',
};
const SPORT_COLORS: Record<string, string> = {
  'Cricket':    '#22c55e',
  'Swimming':   '#3b82f6',
  'Basketball': '#f97316',
};

function gymColor(type: string)  { return TYPE_COLORS[type]  ?? '#737686'; }
function sportColor(sport: string) { return SPORT_COLORS[sport] ?? '#737686'; }

function fmtFitDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function Health() {
  const { measurements, profile, getLatest, calcBMI } = useHealthStore();
  const { gymSessions, sportSessions } = useFitnessStore();
  const [logOpen, setLogOpen]         = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [editEntry, setEditEntry]     = useState<BodyMeasurement | null>(null);
  const [metricModal, setMetricModal] = useState<MetricConfig | null>(null);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [gymHistoryOpen, setGymHistoryOpen]     = useState(false);
  const [sportHistoryOpen, setSportHistoryOpen] = useState(false);

  const sortedGym   = useMemo(() => [...gymSessions].sort((a, b) => b.date.localeCompare(a.date)), [gymSessions]);
  const sortedSport = useMemo(() => [...sportSessions].sort((a, b) => b.date.localeCompare(a.date)), [sportSessions]);

  const gymStats = useMemo(() => {
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthly = gymSessions.filter(s => s.date.startsWith(monthStr)).length;
    const typeCounts: Record<string, number> = {};
    gymSessions.forEach(s => { typeCounts[s.type] = (typeCounts[s.type] ?? 0) + 1; });
    const fav = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '–';
    return { total: gymSessions.length, monthly, fav };
  }, [gymSessions]);

  const sportStats = useMemo(() => {
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthly = sportSessions.filter(s => s.date.startsWith(monthStr)).length;
    const counts: Record<string, number> = {};
    sportSessions.forEach(s => { counts[s.sport] = (counts[s.sport] ?? 0) + 1; });
    const fav = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '–';
    return { total: sportSessions.length, monthly, fav };
  }, [sportSessions]);

  const latest = getLatest();
  const bmi = latest?.weight ? calcBMI(latest.weight) : null;
  const bmiCat = bmi ? bmiCategory(bmi) : null;
  const bfCat = latest?.bodyFat ? bfCategory(latest.bodyFat) : null;

  const weightChange = useMemo(() => {
    const wEntries = measurements.filter(m => m.weight !== undefined);
    if (wEntries.length < 2) return null;
    return (wEntries[0].weight! - wEntries[wEntries.length - 1].weight!).toFixed(1);
  }, [measurements]);

  const historyItems = showAllHistory ? measurements : measurements.slice(0, 3);

  function openEdit(m: BodyMeasurement) {
    setEditEntry(m);
    setLogOpen(true);
  }

  return (
    <div className="bg-background min-h-screen">
      <TopBar
        title="Health"
        rightSlot={
          <button onClick={() => setProfileOpen(true)}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container">
            <span className="material-symbols-outlined text-[22px]">settings</span>
          </button>
        }
      />

      <main className="max-w-screen-xl mx-auto px-4 py-4 pb-28 space-y-4">

        {/* Hero card */}
        {latest ? (
          <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-2xl p-4 shadow-card">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-inter text-xs font-semibold uppercase tracking-wider text-primary/70">Last Updated</p>
                <p className="font-manrope font-bold text-sm text-primary">{fmt(latest.date)}</p>
              </div>
              <button onClick={() => openEdit(latest)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-primary/60 hover:bg-primary/10">
                <span className="material-symbols-outlined text-[18px]">edit</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Weight */}
              {latest.weight !== undefined && (
                <button onClick={() => setMetricModal(METRIC_CONFIGS[0])}
                  className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-3 text-left hover:scale-[1.02] transition-transform active:scale-95">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="material-symbols-outlined text-[14px] text-blue-500">scale</span>
                    <p className="font-inter text-[10px] text-blue-500 font-semibold uppercase tracking-wide">Weight</p>
                  </div>
                  <p className="font-manrope font-bold text-2xl text-blue-700">{latest.weight}<span className="text-xs font-normal ml-0.5">kg</span></p>
                  {weightChange !== null && (
                    <p className="font-inter text-[10px] text-blue-400 mt-0.5">
                      {parseFloat(weightChange) < 0 ? '' : '+'}{weightChange}kg total
                    </p>
                  )}
                </button>
              )}

              {/* Body Fat */}
              {latest.bodyFat !== undefined && (
                <button onClick={() => setMetricModal(METRIC_CONFIGS[1])}
                  className="bg-orange-50 dark:bg-orange-950/30 rounded-xl p-3 text-left hover:scale-[1.02] transition-transform active:scale-95">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="material-symbols-outlined text-[14px] text-orange-500">water_drop</span>
                    <p className="font-inter text-[10px] text-orange-500 font-semibold uppercase tracking-wide">Body Fat</p>
                  </div>
                  <p className="font-manrope font-bold text-2xl text-orange-700">{latest.bodyFat}<span className="text-xs font-normal ml-0.5">%</span></p>
                  {bfCat && <p className="font-inter text-[10px] mt-0.5 font-semibold" style={{ color: bfCat.color }}>{bfCat.label}</p>}
                </button>
              )}

              {/* BMI */}
              {bmi !== null && (
                <button onClick={() => setMetricModal(METRIC_CONFIGS[2])}
                  className="bg-purple-50 dark:bg-purple-950/30 rounded-xl p-3 text-left hover:scale-[1.02] transition-transform active:scale-95">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="material-symbols-outlined text-[14px] text-purple-500">person</span>
                    <p className="font-inter text-[10px] text-purple-500 font-semibold uppercase tracking-wide">BMI</p>
                  </div>
                  <p className="font-manrope font-bold text-2xl text-purple-700">{bmi}</p>
                  {bmiCat && <p className="font-inter text-[10px] mt-0.5 font-semibold" style={{ color: bmiCat.color }}>{bmiCat.label}</p>}
                </button>
              )}

              {/* Muscle Mass */}
              {latest.muscleMass !== undefined && (
                <button onClick={() => setMetricModal(METRIC_CONFIGS[3])}
                  className="bg-violet-50 dark:bg-violet-950/30 rounded-xl p-3 text-left hover:scale-[1.02] transition-transform active:scale-95">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="material-symbols-outlined text-[14px] text-violet-500">fitness_center</span>
                    <p className="font-inter text-[10px] text-violet-500 font-semibold uppercase tracking-wide">Muscle</p>
                  </div>
                  <p className="font-manrope font-bold text-2xl text-violet-700">{latest.muscleMass}<span className="text-xs font-normal ml-0.5">kg</span></p>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-surface-container-lowest rounded-2xl p-6 text-center shadow-card">
            <span className="material-symbols-outlined text-[48px] text-outline mb-3">monitor_heart</span>
            <p className="font-inter font-semibold text-sm text-on-surface mb-4">No measurements yet</p>
            <button onClick={() => { setEditEntry(null); setLogOpen(true); }}
              className="px-4 py-2 bg-primary text-on-primary rounded-xl font-inter font-medium text-sm">
              Log First Measurement
            </button>
          </div>
        )}

        {/* Secondary metrics row */}
        {latest && (
          <div className="grid grid-cols-4 gap-2">
            {[
              { cfg: METRIC_CONFIGS[4], val: latest.bodyWater, unit: '%', label: 'Water' },
              { cfg: METRIC_CONFIGS[5], val: latest.bmr,       unit: 'kcal', label: 'BMR' },
              { cfg: METRIC_CONFIGS[6], val: latest.visceralFat, unit: '', label: 'Visceral' },
              { cfg: METRIC_CONFIGS[7], val: latest.protein,   unit: '%', label: 'Protein' },
            ].filter(x => x.val !== undefined).map(({ cfg, val, unit, label }) => (
              <button key={cfg.key} onClick={() => setMetricModal(cfg)}
                className="bg-surface-container-lowest rounded-xl p-2.5 text-center hover:scale-[1.03] transition-transform active:scale-95 shadow-sm">
                <span className="material-symbols-outlined text-[16px] mb-1" style={{ color: cfg.color }}>{cfg.icon}</span>
                <p className="font-manrope font-bold text-base text-on-surface leading-none">{val}</p>
                <p className="font-inter text-[9px] text-outline mt-0.5">{unit || label}</p>
                <p className="font-inter text-[9px] text-on-surface-variant">{unit ? label : ''}</p>
              </button>
            ))}
          </div>
        )}

        {/* Goal progress */}
        {latest?.bodyFat !== undefined && (
          <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-card">
            <p className="font-inter font-semibold text-sm text-on-surface mb-3">
              Target Body Fat: {profile.targetBodyFatMin}–{profile.targetBodyFatMax}%
            </p>
            <div className="relative h-4 bg-surface-container rounded-full overflow-hidden">
              <div className="absolute inset-0 rounded-full opacity-30"
                style={{ background: 'linear-gradient(to right, #3b82f6 0%, #22c55e 35%, #f59e0b 65%, #ef4444 100%)' }} />
              <div className="absolute top-0 bottom-0 bg-green-200/50 border-l border-r border-green-400/40"
                style={{
                  left: `${Math.min(100, (profile.targetBodyFatMin / 35) * 100)}%`,
                  width: `${Math.min(100, ((profile.targetBodyFatMax - profile.targetBodyFatMin) / 35) * 100)}%`,
                }} />
              <div className="absolute top-1 bottom-1 w-1.5 h-2.5 rounded-sm bg-white shadow-md -translate-x-1/2"
                style={{ left: `${Math.min(100, (latest.bodyFat / 35) * 100)}%` }} />
            </div>
            <div className="flex justify-between mt-1">
              <span className="font-inter text-[10px] text-outline">5%</span>
              <span className="font-inter text-[10px] font-semibold text-on-surface">
                {latest.bodyFat}% {latest.bodyFat <= profile.targetBodyFatMax && latest.bodyFat >= profile.targetBodyFatMin ? '✓ In range' : latest.bodyFat > profile.targetBodyFatMax ? `↓ ${(latest.bodyFat - profile.targetBodyFatMax).toFixed(1)}% to go` : '↑ Below target'}
              </span>
              <span className="font-inter text-[10px] text-outline">35%</span>
            </div>
          </div>
        )}

        {/* History */}
        {measurements.length > 0 && (
          <div className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-card">
            <div className="px-4 py-3 border-b border-outline-variant/20 flex items-center justify-between">
              <p className="font-inter font-semibold text-sm text-on-surface">History</p>
              <span className="font-inter text-xs text-outline">{measurements.length} entries</span>
            </div>
            <div className="divide-y divide-outline-variant/10">
              {historyItems.map(m => {
                const entryBmi = m.weight ? calcBMI(m.weight) : null;
                return (
                  <button key={m.id} onClick={() => openEdit(m)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-container text-left transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-surface-container flex flex-col items-center justify-center shrink-0">
                      <span className="font-inter font-bold text-xs text-primary leading-none">
                        {new Date(m.date + 'T12:00:00').getDate()}
                      </span>
                      <span className="font-inter text-[8px] text-outline uppercase">
                        {new Date(m.date + 'T12:00:00').toLocaleString('default', { month: 'short' })}
                      </span>
                    </div>
                    <div className="flex-1 flex items-center gap-4 min-w-0">
                      {m.weight !== undefined && (
                        <div className="text-center min-w-[36px]">
                          <p className="font-inter font-semibold text-sm text-on-surface">{m.weight}</p>
                          <p className="font-inter text-[9px] text-outline">kg</p>
                        </div>
                      )}
                      {m.bodyFat !== undefined && (
                        <div className="text-center min-w-[36px]">
                          <p className="font-inter font-semibold text-sm text-on-surface">{m.bodyFat}%</p>
                          <p className="font-inter text-[9px] text-outline">fat</p>
                        </div>
                      )}
                      {entryBmi !== null && (
                        <div className="text-center min-w-[36px]">
                          <p className="font-inter font-semibold text-sm text-on-surface">{entryBmi}</p>
                          <p className="font-inter text-[9px] text-outline">BMI</p>
                        </div>
                      )}
                      {m.muscleMass !== undefined && (
                        <div className="text-center min-w-[36px] hidden sm:block">
                          <p className="font-inter font-semibold text-sm text-on-surface">{m.muscleMass}</p>
                          <p className="font-inter text-[9px] text-outline">muscle</p>
                        </div>
                      )}
                    </div>
                    <span className="material-symbols-outlined text-[16px] text-outline shrink-0">chevron_right</span>
                  </button>
                );
              })}
            </div>
            {measurements.length > 3 && (
              <button onClick={() => setShowAllHistory(v => !v)}
                className="w-full py-3 font-inter text-xs text-primary font-semibold hover:bg-surface-container transition-colors border-t border-outline-variant/20">
                {showAllHistory ? 'Show less' : `Show all ${measurements.length} entries`}
              </button>
            )}
          </div>
        )}

        {/* ── Gym Stats ── */}
        <div className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-card">
          <div className="px-4 py-3 border-b border-outline-variant/20 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-primary">fitness_center</span>
            <p className="font-inter font-semibold text-sm text-on-surface flex-1">Gym Workouts</p>
            {sortedGym.length > 3 && (
              <button onClick={() => setGymHistoryOpen(true)} className="font-inter text-xs text-primary font-semibold">
                View all ({sortedGym.length})
              </button>
            )}
          </div>
          <div className="px-4 py-3 grid grid-cols-3 gap-2 border-b border-outline-variant/10">
            <div className="text-center">
              <p className="font-manrope font-bold text-lg text-primary">{gymStats.total}</p>
              <p className="font-inter text-[9px] text-outline">Total</p>
            </div>
            <div className="text-center">
              <p className="font-manrope font-bold text-lg text-on-surface">{gymStats.monthly}</p>
              <p className="font-inter text-[9px] text-outline">This Month</p>
            </div>
            <div className="text-center">
              <p className="font-manrope font-bold text-[11px] text-on-surface leading-tight mt-0.5 px-1">{gymStats.fav.split(',')[0]}</p>
              <p className="font-inter text-[9px] text-outline">Favourite</p>
            </div>
          </div>
          <div className="divide-y divide-outline-variant/10">
            {sortedGym.slice(0, 3).map(s => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: gymColor(s.type) }} />
                <div className="flex-1 min-w-0">
                  <p className="font-inter text-sm font-semibold text-on-surface">{s.type}</p>
                  <p className="font-inter text-xs text-outline">{fmtFitDate(s.date)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Sports Stats ── */}
        <div className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-card">
          <div className="px-4 py-3 border-b border-outline-variant/20 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-primary">sports_soccer</span>
            <p className="font-inter font-semibold text-sm text-on-surface flex-1">Sports</p>
            {sortedSport.length > 3 && (
              <button onClick={() => setSportHistoryOpen(true)} className="font-inter text-xs text-primary font-semibold">
                View all ({sortedSport.length})
              </button>
            )}
          </div>
          <div className="px-4 py-3 grid grid-cols-3 gap-2 border-b border-outline-variant/10">
            <div className="text-center">
              <p className="font-manrope font-bold text-lg text-primary">{sportStats.total}</p>
              <p className="font-inter text-[9px] text-outline">Total</p>
            </div>
            <div className="text-center">
              <p className="font-manrope font-bold text-lg text-on-surface">{sportStats.monthly}</p>
              <p className="font-inter text-[9px] text-outline">This Month</p>
            </div>
            <div className="text-center">
              <p className="font-manrope font-bold text-sm text-on-surface leading-tight mt-0.5">{sportStats.fav}</p>
              <p className="font-inter text-[9px] text-outline">Favourite</p>
            </div>
          </div>
          <div className="divide-y divide-outline-variant/10">
            {sortedSport.slice(0, 3).map(s => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: sportColor(s.sport) }} />
                <div className="flex-1 min-w-0">
                  <p className="font-inter text-sm font-semibold text-on-surface">{s.sport}</p>
                  <p className="font-inter text-xs text-outline">{fmtFitDate(s.date)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </main>

      <button onClick={() => { setEditEntry(null); setLogOpen(true); }}
        className="fixed right-4 bg-primary text-on-primary rounded-full shadow-fab flex items-center justify-center hover:scale-105 active:scale-95 transition-transform z-40 w-14 h-14"
        style={{ bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))' }}>
        <span className="material-symbols-outlined text-[28px]">add</span>
      </button>

      <LogModal open={logOpen} onClose={() => { setLogOpen(false); setEditEntry(null); }} measurement={editEntry} />
      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
      <MetricModal config={metricModal} open={!!metricModal} onClose={() => setMetricModal(null)}
        measurements={measurements} calcBMI={calcBMI} />

      <FitnessHistoryModal open={gymHistoryOpen} onClose={() => setGymHistoryOpen(false)} title="Gym History">
        {sortedGym.map(s => (
          <div key={s.id} className="flex items-center gap-3 px-4 py-3">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: gymColor(s.type) }} />
            <div className="flex-1 min-w-0">
              <p className="font-inter font-semibold text-sm text-on-surface">{s.type}</p>
              <p className="font-inter text-xs text-outline">{fmtFitDate(s.date)}{s.duration ? ` · ${s.duration} min` : ''}</p>
            </div>
          </div>
        ))}
      </FitnessHistoryModal>

      <FitnessHistoryModal open={sportHistoryOpen} onClose={() => setSportHistoryOpen(false)} title="Sports History">
        {sortedSport.map(s => (
          <div key={s.id} className="flex items-center gap-3 px-4 py-3">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: sportColor(s.sport) }} />
            <div className="flex-1 min-w-0">
              <p className="font-inter font-semibold text-sm text-on-surface">{s.sport}</p>
              <p className="font-inter text-xs text-outline">{fmtFitDate(s.date)}{s.notes ? ` · ${s.notes}` : ''}</p>
            </div>
          </div>
        ))}
      </FitnessHistoryModal>
    </div>
  );
}
