import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/layout/TopBar';
import Modal from '../components/ui/Modal';
import { Capacitor } from '@capacitor/core';
import { useHealthStore } from '../store/healthStore';
import { useFitnessStore } from '../store/fitnessStore';
import { HealthConnect } from '../services/healthConnect';
import { runHCSync } from '../services/hcSync';
import { syncHealthToSheets } from '../services/sheetsService';
import { useSyncStore } from '../store/syncStore';
import type { BodyMeasurement } from '../types';
import { localDateString } from '../utils/dateUtils';

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

interface RefLine {
  value: number;
  label: string;
  color: string;
}

function LineChart({
  data, color, goalMin, goalMax, unit, refLines,
}: {
  data: { date: string; value: number }[];
  color: string;
  goalMin?: number;
  goalMax?: number;
  unit: string;
  refLines?: RefLine[];
}) {
  if (data.length < 2) {
    return (
      <div className="h-28 flex items-center justify-center">
        <p className="font-inter text-xs text-outline">Not enough data</p>
      </div>
    );
  }

  const values = data.map(d => d.value);
  const refValues = refLines?.map(r => r.value) ?? [];
  const allBounds = [...values, goalMin, goalMax, ...refValues].filter(v => v !== undefined) as number[];
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
        {/* Goal band */}
        {goalMin !== undefined && goalMax !== undefined && (
          <rect x={0} y={toY(goalMax)} width={W} height={Math.abs(toY(goalMin) - toY(goalMax))}
            fill="rgba(34,197,94,0.12)" />
        )}
        <path d={areaPath} fill={color} opacity="0.1" />
        <path d={linePath} stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {data.map((d, i) => (
          <circle key={i} cx={toX(i)} cy={toY(d.value)} r={i === data.length - 1 ? 4 : 2.5} fill={color} />
        ))}
        {/* Reference lines */}
        {refLines?.map((rl, i) => {
          const y = toY(rl.value);
          if (y < 0 || y > H) return null;
          const labelY = y <= 10 ? y + 9 : y - 3;
          return (
            <g key={i}>
              <line x1={0} y1={y} x2={W} y2={y}
                stroke={rl.color} strokeWidth="1" strokeDasharray="4,3" opacity="0.75" />
              <text x={W - 2} y={labelY} textAnchor="end"
                fontSize="7" fill={rl.color} opacity="0.9" fontFamily="Inter, sans-serif">
                {rl.label}
              </text>
            </g>
          );
        })}
        {/* Date labels */}
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
  goalMin?: number;
  goalMax?: number;
  refLines?: RefLine[];
}

// Weight range for 172 cm: BMI 18.5 → 54.7 kg, BMI 24.9 → 73.8 kg
const WEIGHT_REF: RefLine[] = [
  { value: 54.7, label: '54.7 min',  color: '#22c55e' },
  { value: 73.8, label: '73.8 max',  color: '#f59e0b' },
];
const BF_REF: RefLine[] = [
  { value: 6,  label: '6% essential',   color: '#3b82f6' },
  { value: 14, label: '14% athletic',   color: '#22c55e' },
  { value: 18, label: '18% fitness',    color: '#84cc16' },
  { value: 25, label: '25% acceptable', color: '#f59e0b' },
];
const BMI_REF: RefLine[] = [
  { value: 18.5, label: '18.5 normal',     color: '#22c55e' },
  { value: 25,   label: '25 overweight',   color: '#f59e0b' },
  { value: 30,   label: '30 obese',        color: '#ef4444' },
];

const METRIC_CONFIGS: MetricConfig[] = [
  { key: 'weight',       label: 'Weight',        unit: 'kg',   color: '#3b82f6', icon: 'scale',           extract: m => m.weight,        rangeMin: 60, rangeMax: 90,   goalMin: 54.7, goalMax: 73.8, refLines: WEIGHT_REF },
  { key: 'bodyFat',      label: 'Body Fat',       unit: '%',    color: '#f97316', icon: 'water_drop',      extract: m => m.bodyFat,       rangeMin: 5,  rangeMax: 30,   goalMin: 6,    goalMax: 14,   refLines: BF_REF },
  { key: 'bmi',          label: 'BMI',            unit: '',     color: '#8b5cf6', icon: 'person',          extract: (_m, bmi) => bmi ?? undefined, rangeMin: 15, rangeMax: 35, goalMin: 18.5, goalMax: 25, refLines: BMI_REF },
  { key: 'muscleMass',   label: 'Muscle Mass',    unit: 'kg',   color: '#7c3aed', icon: 'fitness_center',  extract: m => m.muscleMass,    rangeMin: 50, rangeMax: 65 },
  { key: 'bodyWater',    label: 'Body Water',     unit: '%',    color: '#06b6d4', icon: 'water',           extract: m => m.bodyWater,     rangeMin: 45, rangeMax: 75,   info: 'Healthy range: 50–65%' },
  { key: 'bmr',          label: 'BMR',            unit: 'kcal', color: '#ec4899', icon: 'local_fire_department', extract: m => m.bmr,    rangeMin: 1400, rangeMax: 2200, info: 'Basal Metabolic Rate' },
  { key: 'visceralFat',  label: 'Visceral Fat',   unit: '',     color: '#ef4444', icon: 'favorite',        extract: m => m.visceralFat,   rangeMin: 1,  rangeMax: 20,   info: 'Score 1–9 healthy, 10–14 excess, 15+ high' },
  { key: 'protein',      label: 'Protein',        unit: '%',    color: '#84cc16', icon: 'nutrition',       extract: m => m.protein,       rangeMin: 15, rangeMax: 25,   info: 'Ideal: 16–20%' },
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

        <LineChart
          data={chartData}
          color={config.color}
          unit={config.unit}
          goalMin={config.goalMin}
          goalMax={config.goalMax}
          refLines={config.refLines}
        />

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
  const today = localDateString();

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

  useEffect(() => {
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
      <div className="flex flex-col">
      <div className="p-5 space-y-4 overflow-y-auto max-h-[60vh]">
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

        </div>
        <div className="flex justify-between items-center px-5 py-4 border-t border-outline-variant/20 shrink-0">
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

// ─── Main Page ────────────────────────────────────────────────────────────────

type HealthTab = 'body' | 'sync' | 'profile';

export default function Health() {
  const navigate = useNavigate();
  const { measurements, profile, getLatest, calcBMI, updateProfile } = useHealthStore();
  const { sportSessions } = useFitnessStore();
  const [tab, setTab]                 = useState<HealthTab>('body');
  const [logOpen, setLogOpen]         = useState(false);
  const [editEntry, setEditEntry]     = useState<BodyMeasurement | null>(null);
  const [metricModal, setMetricModal] = useState<MetricConfig | null>(null);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [hcSyncing, setHcSyncing]     = useState(false);
  const [hcStatus, setHcStatus]       = useState<string | null>(null);
  const [hcNeedsSetup, setHcNeedsSetup] = useState(false);
  const [hcLastSync, setHcLastSync]   = useState(() => localStorage.getItem('basil-hc-last-sync'));
  const [sheetsSyncing, setSheetsSyncing] = useState(false);
  const [sheetsStatus, setSheetsStatus]   = useState<string | null>(null);

  // Profile inline editing state
  const [height, setHeight]           = useState(profile.height?.toString() ?? '');
  const [bfMin, setBfMin]             = useState(profile.targetBodyFatMin.toString());
  const [bfMax, setBfMax]             = useState(profile.targetBodyFatMax.toString());
  const [targetWeight, setTargetWeight] = useState(profile.targetWeight?.toString() ?? '');
  const [targetMuscle, setTargetMuscle] = useState(profile.targetMuscleMass?.toString() ?? '');
  const [profileSaved, setProfileSaved] = useState(false);

  // Sync profile form when tab switches to profile
  useEffect(() => {
    if (tab !== 'profile') return;
    setHeight(profile.height?.toString() ?? '');
    setBfMin(profile.targetBodyFatMin.toString());
    setBfMax(profile.targetBodyFatMax.toString());
    setTargetWeight(profile.targetWeight?.toString() ?? '');
    setTargetMuscle(profile.targetMuscleMass?.toString() ?? '');
    setProfileSaved(false);
  }, [tab]);

  const isNative = Capacitor.isNativePlatform();

  // Auto-sync from Health Connect when Health page opens, if >4h since last sync
  useEffect(() => {
    if (!isNative) return;
    const FOUR_HOURS = 4 * 60 * 60 * 1000;
    const lastSyncStr = localStorage.getItem('basil-hc-last-sync');
    const lastSync = lastSyncStr ? new Date(lastSyncStr).getTime() : 0;
    if (Date.now() - lastSync < FOUR_HOURS) return;
    runHCSync().then(({ imported }) => {
      if (imported > 0) {
        setHcStatus(`Auto-synced ${imported} records from Health Connect`);
        setHcLastSync(localStorage.getItem('basil-hc-last-sync'));
      }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNative]);

  const syncFromHealthConnect = useCallback(async () => {
    setHcSyncing(true);
    setHcStatus(null);
    setHcNeedsSetup(false);
    try {
      const avail = await HealthConnect.checkAvailability().catch(() => null);
      if (!avail || avail.status === 'unavailable') {
        setHcStatus('Health Connect not available on this device');
        return;
      }
      if (avail.status === 'update_required') {
        setHcStatus('Health Connect app needs to be updated');
        return;
      }

      let perms = await HealthConnect.checkHCPermissions().catch(() => null);
      if (!perms?.granted) {
        perms = await HealthConnect.requestHCPermissions().catch(() => null);
      }
      if (!perms?.granted) {
        setHcStatus('Tap below to open Health Connect and grant permissions, then return and tap Sync.');
        setHcNeedsSetup(true);
        return;
      }

      const { imported, error } = await runHCSync();
      if (error && error !== 'permissions_missing') {
        setHcStatus(`Sync failed: ${error}`);
        return;
      }

      const { accessToken, isTokenValid } = useSyncStore.getState();
      if (isTokenValid() && accessToken) {
        setHcStatus(`HC synced (${imported} records) — updating Sheets…`);
        const freshMeasurements = useHealthStore.getState().measurements;
        const sheetsResult = await syncHealthToSheets(accessToken, freshMeasurements, profile.height ?? 0);
        if (sheetsResult.error) {
          setHcStatus(`HC synced (${imported} records) · Sheets: ${sheetsResult.error}`);
        } else if (sheetsResult.synced > 0) {
          setHcStatus(`Sync complete — ${imported} HC records · ${sheetsResult.synced} new rows → Sheets`);
        } else {
          setHcStatus(`Sync complete — ${imported} records · Sheets up to date`);
        }
      } else {
        setHcStatus(`Sync complete — ${imported} records imported`);
      }
      setHcLastSync(localStorage.getItem('basil-hc-last-sync'));
    } catch (e: unknown) {
      setHcStatus(`Sync failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setHcSyncing(false);
    }
  }, [profile.height]);

  const syncToSheets = useCallback(async () => {
    const { accessToken, isTokenValid } = useSyncStore.getState();
    if (!isTokenValid() || !accessToken) {
      setSheetsStatus('Connect Google Drive first to export to Sheets');
      return;
    }
    setSheetsSyncing(true);
    setSheetsStatus(null);
    try {
      const result = await syncHealthToSheets(accessToken, measurements, profile.height ?? 0);
      if (result.error) {
        setSheetsStatus(`Export failed: ${result.error}`);
      } else if (result.synced > 0) {
        setSheetsStatus(`Exported ${result.synced} new rows to Google Sheets`);
      } else {
        setSheetsStatus('Sheets already up to date');
      }
    } catch (e: unknown) {
      setSheetsStatus(`Export failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSheetsSyncing(false);
    }
  }, [measurements, profile.height]);

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

  const handleSaveProfile = () => {
    updateProfile({
      height: parseFloat(height) || 0,
      targetBodyFatMin: parseFloat(bfMin) || 10,
      targetBodyFatMax: parseFloat(bfMax) || 15,
      targetWeight: targetWeight ? parseFloat(targetWeight) : undefined,
      targetMuscleMass: targetMuscle ? parseFloat(targetMuscle) : undefined,
    });
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2000);
  };

  const TABS: { key: HealthTab; label: string; icon: string }[] = [
    { key: 'body',    label: 'Body',    icon: 'monitor_heart' },
    { key: 'sync',    label: 'Sync',    icon: 'sync' },
    { key: 'profile', label: 'Profile', icon: 'person' },
  ];

  return (
    <div className="bg-background min-h-screen">
      <TopBar title="Health" />

      {/* Tab switcher */}
      <div className="sticky top-14 z-30 bg-background/95 backdrop-blur-sm border-b border-outline-variant/20">
        <div className="flex max-w-screen-xl mx-auto px-4">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-inter font-medium transition-colors border-b-2 ${
                tab === t.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className={`material-symbols-outlined text-[16px] ${tab === t.key ? 'icon-fill' : ''}`}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-screen-xl mx-auto px-4 py-4 pb-28 space-y-4">

        {/* ── BODY TAB ── */}
        {tab === 'body' && (
          <>
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

                  {latest.bmr !== undefined && (
                    <button onClick={() => setMetricModal(METRIC_CONFIGS[5])}
                      className="bg-pink-50 dark:bg-pink-950/30 rounded-xl p-3 text-left hover:scale-[1.02] transition-transform active:scale-95">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="material-symbols-outlined text-[14px] text-pink-500">local_fire_department</span>
                        <p className="font-inter text-[10px] text-pink-500 font-semibold uppercase tracking-wide">BMR</p>
                      </div>
                      <p className="font-manrope font-bold text-2xl text-pink-700">{latest.bmr}<span className="text-xs font-normal ml-0.5">kcal</span></p>
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
              <div className="grid grid-cols-3 gap-2">
                {[
                  { cfg: METRIC_CONFIGS[4], val: latest.bodyWater,   unit: '%', label: 'Water' },
                  { cfg: METRIC_CONFIGS[6], val: latest.visceralFat, unit: '',  label: 'Visceral' },
                  { cfg: METRIC_CONFIGS[7], val: latest.protein,     unit: '%', label: 'Protein' },
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

            {/* Fitness Hub */}
            <div className="space-y-2">
              <p className="font-inter text-xs font-semibold uppercase tracking-wider text-outline px-1">Fitness</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => navigate('/hobbies/fitness')}
                  className="flex flex-col items-start gap-2.5 p-4 rounded-2xl bg-orange-50 dark:bg-orange-950/30 border border-orange-100 dark:border-orange-900/50 hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-sm text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[22px] text-orange-600">fitness_center</span>
                  </div>
                  <div>
                    <p className="font-manrope font-bold text-sm text-on-surface">Sports</p>
                    <p className="font-inter text-[10px] text-on-surface-variant mt-0.5">
                      {sportStats.monthly} sport sessions this month
                    </p>
                  </div>
                  <span className="font-inter text-[10px] font-semibold text-orange-600">{sportStats.total} sessions total</span>
                </button>
                <button
                  onClick={() => navigate('/hobbies/gym')}
                  className="flex flex-col items-start gap-2.5 p-4 rounded-2xl bg-violet-50 dark:bg-violet-950/30 border border-violet-100 dark:border-violet-900/50 hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-sm text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[22px] text-violet-600">exercise</span>
                  </div>
                  <div>
                    <p className="font-manrope font-bold text-sm text-on-surface">Gym</p>
                    <p className="font-inter text-[10px] text-on-surface-variant mt-0.5">Sets, reps & weights</p>
                  </div>
                  <span className="font-inter text-[10px] font-semibold text-violet-600">Track detailed workouts</span>
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── SYNC TAB ── */}
        {tab === 'sync' && (
          <div className="space-y-4">
            {/* Health Connect — Android only */}
            {isNative ? (
              <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-card">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-950/30 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[22px] text-green-600">health_and_safety</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-inter font-semibold text-sm text-on-surface">Health Connect</p>
                    <p className="font-inter text-[10px] text-on-surface-variant">Import weight, body fat & workouts from Health Connect</p>
                  </div>
                </div>
                {hcLastSync && (
                  <p className="font-inter text-[10px] text-outline mb-3">
                    Last synced: {new Date(hcLastSync).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
                {hcStatus && (
                  <p className={`font-inter text-xs rounded-lg px-3 py-2 mb-3 select-all cursor-text ${hcStatus.includes('failed') || hcStatus.includes('not granted') || hcStatus.includes('not available') || hcStatus.includes('needs') ? 'bg-error-container/20 text-error' : 'bg-tertiary/10 text-tertiary'}`}>
                    {hcStatus}
                  </p>
                )}
                {hcNeedsSetup && (
                  <button
                    onClick={() => HealthConnect.openHealthConnect().catch(() => {})}
                    className="mb-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-surface-container text-primary font-inter font-medium text-xs"
                  >
                    <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                    Grant permissions in Health Connect
                  </button>
                )}
                <button
                  onClick={syncFromHealthConnect}
                  disabled={hcSyncing}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-on-primary rounded-xl font-inter font-medium text-sm disabled:opacity-60"
                >
                  <span className={`material-symbols-outlined text-[18px] ${hcSyncing ? 'animate-spin' : ''}`}>
                    {hcSyncing ? 'progress_activity' : 'sync'}
                  </span>
                  {hcSyncing ? 'Syncing…' : 'Sync from Health Connect'}
                </button>
              </div>
            ) : (
              <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-card">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[22px] text-outline">health_and_safety</span>
                  </div>
                  <div>
                    <p className="font-inter font-semibold text-sm text-on-surface">Health Connect</p>
                    <p className="font-inter text-[10px] text-outline">Available on Android only</p>
                  </div>
                </div>
              </div>
            )}

            {/* Google Sheets export */}
            <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-card">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[22px] text-emerald-600">table_chart</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-inter font-semibold text-sm text-on-surface">Google Sheets Export</p>
                  <p className="font-inter text-[10px] text-on-surface-variant">Export all {measurements.length} measurements to a Sheets spreadsheet</p>
                </div>
              </div>
              {sheetsStatus && (
                <p className={`font-inter text-xs rounded-lg px-3 py-2 mb-3 select-all cursor-text ${sheetsStatus.includes('failed') || sheetsStatus.includes('Connect') ? 'bg-error-container/20 text-error' : 'bg-tertiary/10 text-tertiary'}`}>
                  {sheetsStatus}
                </p>
              )}
              <button
                onClick={syncToSheets}
                disabled={sheetsSyncing || measurements.length === 0}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 text-white rounded-xl font-inter font-medium text-sm disabled:opacity-60"
              >
                <span className={`material-symbols-outlined text-[18px] ${sheetsSyncing ? 'animate-spin' : ''}`}>
                  {sheetsSyncing ? 'progress_activity' : 'upload'}
                </span>
                {sheetsSyncing ? 'Exporting…' : 'Export to Sheets'}
              </button>
            </div>

            <p className="font-inter text-[10px] text-outline text-center px-4">
              Drive sync keeps your health data backed up automatically. Sheets export creates a spreadsheet for analysis.
            </p>
          </div>
        )}

        {/* ── PROFILE TAB ── */}
        {tab === 'profile' && (
          <div className="space-y-4">
            <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-card space-y-4">
              <p className="font-inter font-semibold text-sm text-on-surface">Body Measurements</p>

              <div className="space-y-1">
                <label className="font-inter text-[10px] font-semibold uppercase tracking-wider text-outline">Height (cm)</label>
                <input type="number" value={height} onChange={e => setHeight(e.target.value)} placeholder="e.g. 173"
                  className="w-full bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-2.5 font-inter text-sm outline-none focus:border-primary/50" />
              </div>
            </div>

            <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-card space-y-4">
              <p className="font-inter font-semibold text-sm text-on-surface">Body Fat Goals</p>

              <div className="space-y-1">
                <label className="font-inter text-[10px] font-semibold uppercase tracking-wider text-outline">Target Body Fat Range (%)</label>
                <div className="flex items-center gap-2">
                  <input type="number" step="0.5" value={bfMin} onChange={e => setBfMin(e.target.value)} placeholder="Min"
                    className="w-full bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-2.5 font-inter text-sm outline-none focus:border-primary/50" />
                  <span className="font-inter text-sm text-outline shrink-0">to</span>
                  <input type="number" step="0.5" value={bfMax} onChange={e => setBfMax(e.target.value)} placeholder="Max"
                    className="w-full bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-2.5 font-inter text-sm outline-none focus:border-primary/50" />
                </div>
              </div>
            </div>

            <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-card space-y-4">
              <p className="font-inter font-semibold text-sm text-on-surface">Weight & Muscle Targets</p>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-inter text-[10px] font-semibold uppercase tracking-wider text-outline">Target Weight (kg)</label>
                  <input type="number" step="0.5" value={targetWeight} onChange={e => setTargetWeight(e.target.value)} placeholder="optional"
                    className="w-full bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-2.5 font-inter text-sm outline-none focus:border-primary/50" />
                </div>
                <div className="space-y-1">
                  <label className="font-inter text-[10px] font-semibold uppercase tracking-wider text-outline">Target Muscle (kg)</label>
                  <input type="number" step="0.5" value={targetMuscle} onChange={e => setTargetMuscle(e.target.value)} placeholder="optional"
                    className="w-full bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-2.5 font-inter text-sm outline-none focus:border-primary/50" />
                </div>
              </div>
            </div>

            <button
              onClick={handleSaveProfile}
              className={`w-full py-3 rounded-xl font-inter font-semibold text-sm transition-colors ${profileSaved ? 'bg-tertiary text-on-primary' : 'bg-primary text-on-primary hover:bg-primary/90'}`}
            >
              {profileSaved ? '✓ Saved' : 'Save Profile'}
            </button>
          </div>
        )}

      </main>

      {tab === 'body' && (
        <button onClick={() => { setEditEntry(null); setLogOpen(true); }}
          className="fixed right-4 bg-primary text-on-primary rounded-full shadow-fab flex items-center justify-center hover:scale-105 active:scale-95 transition-transform z-40 w-14 h-14"
          style={{ bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))' }}>
          <span className="material-symbols-outlined text-[28px]">add</span>
        </button>
      )}

      <LogModal open={logOpen} onClose={() => { setLogOpen(false); setEditEntry(null); }} measurement={editEntry} />
      <MetricModal config={metricModal} open={!!metricModal} onClose={() => setMetricModal(null)}
        measurements={measurements} calcBMI={calcBMI} />
    </div>
  );
}
