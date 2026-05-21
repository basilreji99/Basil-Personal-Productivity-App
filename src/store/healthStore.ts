import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { nanoid } from '../utils/nanoid';
import { localDateString } from '../utils/dateUtils';
import type { BodyMeasurement, HealthProfile } from '../types';

const DEFAULT_PROFILE: HealthProfile = {
  height: null,
  targetBodyFatMin: null,
  targetBodyFatMax: null,
  targetWeight: null,
  targetMuscleMass: null,
};

// ─── Store ────────────────────────────────────────────────────────────────────

interface HealthState {
  profile: HealthProfile;
  measurements: BodyMeasurement[];

  updateProfile: (updates: Partial<HealthProfile>) => void;
  addMeasurement: (m: Omit<BodyMeasurement, 'id'>) => void;
  updateMeasurement: (id: string, updates: Partial<Omit<BodyMeasurement, 'id'>>) => void;
  deleteMeasurement: (id: string) => void;
  getLatest: () => BodyMeasurement | null;
  getRecent: (days: number) => BodyMeasurement[];
  calcBMI: (weight: number) => number | null;
  calcFatMass: (weight: number, bodyFat: number) => number;
  calcFatFreeMass: (weight: number, bodyFat: number) => number;
}

export const useHealthStore = create<HealthState>()(
  persist(
    (set, get) => ({
      profile: DEFAULT_PROFILE,
      measurements: [],

      updateProfile: (updates) =>
        set(s => ({ profile: { ...s.profile, ...updates } })),

      addMeasurement: (m) =>
        set(s => ({
          measurements: [{ ...m, id: nanoid() }, ...s.measurements]
            .sort((a, b) => b.date.localeCompare(a.date)),
        })),

      updateMeasurement: (id, updates) =>
        set(s => ({
          measurements: s.measurements.map(m => m.id === id ? { ...m, ...updates } : m),
        })),

      deleteMeasurement: (id) =>
        set(s => ({ measurements: s.measurements.filter(m => m.id !== id) })),

      getLatest: () => get().measurements[0] ?? null,

      getRecent: (days) => {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        const cutoffStr = localDateString(cutoff);
        return get().measurements.filter(m => m.date >= cutoffStr);
      },

      calcBMI: (weight) => {
        const { height } = get().profile;
        if (!height) return null;
        return parseFloat((weight / Math.pow(height / 100, 2)).toFixed(1));
      },

      calcFatMass: (weight, bodyFat) =>
        parseFloat((weight * (bodyFat / 100)).toFixed(2)),

      calcFatFreeMass: (weight, bodyFat) =>
        parseFloat((weight * (1 - bodyFat / 100)).toFixed(2)),
    }),
    {
      name: 'basil-health',
      version: 2,
      migrate(persisted: any, version: number) {
        if (version < 2) {
          const existing: BodyMeasurement[] = persisted?.measurements ?? [];
          return {
            ...persisted,
            profile: existing.length > 0 ? (persisted?.profile ?? DEFAULT_PROFILE) : DEFAULT_PROFILE,
            measurements: existing.length > 0 ? existing : [],
          };
        }
        return persisted;
      },
    },
  ),
);
