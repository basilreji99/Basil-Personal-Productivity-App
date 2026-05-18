import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { nanoid } from '../utils/nanoid';
import type { BodyMeasurement, HealthProfile } from '../types';

// ─── Seeded data from VeryFit March–May 2026 ─────────────────────────────────

const INITIAL_MEASUREMENTS: BodyMeasurement[] = [
  { id: 'health_030', date: '2026-05-05', weight: 71.55, bodyFat: 16.1, subcutFat: 14.1, bodyWater: 60.5, skeletalMuscle: 54.1, muscleMass: 56.97, boneMass: 3, bmr: 1720, visceralFat: 6, protein: 19.1, metabolicAge: 25 },
  { id: 'health_029', date: '2026-04-28', weight: 71.1, bodyFat: 15.9, subcutFat: 13.9, bodyWater: 60.6, skeletalMuscle: 54.2, muscleMass: 56.71, boneMass: 2.98, bmr: 1714, visceralFat: 6, protein: 19.1, metabolicAge: 25 },
  { id: 'health_028', date: '2026-04-26', weight: 70.35, bodyFat: 15.4, subcutFat: 13.6, bodyWater: 60.9, skeletalMuscle: 54.5, muscleMass: 56.42, boneMass: 2.97, bmr: 1704, visceralFat: 6, protein: 19.2, metabolicAge: 25 },
  { id: 'health_027', date: '2026-04-21', weight: 70.4, bodyFat: 15.4, subcutFat: 13.6, bodyWater: 60.9, skeletalMuscle: 54.5, muscleMass: 56.46, boneMass: 2.97, bmr: 1705, visceralFat: 6, protein: 19.2, metabolicAge: 25 },
  { id: 'health_026', date: '2026-04-19', weight: 69.75, bodyFat: 15.1, subcutFat: 13.3, bodyWater: 61.2, skeletalMuscle: 54.7, muscleMass: 56.14, boneMass: 2.95, bmr: 1696, visceralFat: 6, protein: 19.3, metabolicAge: 25 },
  { id: 'health_025', date: '2026-04-17', weight: 71.15, bodyFat: 15.9, subcutFat: 13.9, bodyWater: 60.6, skeletalMuscle: 54.2, muscleMass: 56.76, boneMass: 2.98, bmr: 1715, visceralFat: 6, protein: 19.1, metabolicAge: 25 },
  { id: 'health_024', date: '2026-04-16', weight: 71.1, bodyFat: 15.9, subcutFat: 13.9, bodyWater: 60.6, skeletalMuscle: 54.2, muscleMass: 56.71, boneMass: 2.98, bmr: 1714, visceralFat: 6, protein: 19.1, metabolicAge: 25 },
  { id: 'health_023', date: '2026-04-11', weight: 71.5, bodyFat: 16.1, subcutFat: 14.1, bodyWater: 60.5, skeletalMuscle: 54.1, muscleMass: 56.93, boneMass: 2.99, bmr: 1720, visceralFat: 6, protein: 19.1, metabolicAge: 25 },
  { id: 'health_022', date: '2026-04-10', weight: 71.25, bodyFat: 15.9, subcutFat: 13.9, bodyWater: 60.6, skeletalMuscle: 54.2, muscleMass: 56.8, boneMass: 2.99, bmr: 1716, visceralFat: 6, protein: 19.1, metabolicAge: 25 },
  { id: 'health_021', date: '2026-04-09', weight: 71.2, bodyFat: 15.9, subcutFat: 13.9, bodyWater: 60.6, skeletalMuscle: 54.2, muscleMass: 56.8, boneMass: 2.99, bmr: 1716, visceralFat: 6, protein: 19.1, metabolicAge: 25 },
  { id: 'health_020', date: '2026-04-08', weight: 71.45, bodyFat: 16.1, subcutFat: 14.1, bodyWater: 60.5, skeletalMuscle: 54.1, muscleMass: 56.89, boneMass: 2.99, bmr: 1719, visceralFat: 6, protein: 19.1, metabolicAge: 25 },
  { id: 'health_019', date: '2026-04-06', weight: 71.25, bodyFat: 15.9, subcutFat: 13.9, bodyWater: 60.6, skeletalMuscle: 54.2, muscleMass: 56.86, boneMass: 2.99, bmr: 1716, visceralFat: 6, protein: 19.1, metabolicAge: 25 },
  { id: 'health_018', date: '2026-04-04', weight: 71.85, bodyFat: 16.2, subcutFat: 14.2, bodyWater: 60.4, skeletalMuscle: 54, muscleMass: 57.11, boneMass: 3, bmr: 1724, visceralFat: 7, protein: 19, metabolicAge: 25 },
  { id: 'health_017', date: '2026-04-03', weight: 72.05, bodyFat: 16.4, subcutFat: 14.3, bodyWater: 60.3, skeletalMuscle: 53.9, muscleMass: 57.16, boneMass: 3.01, bmr: 1727, visceralFat: 7, protein: 19, metabolicAge: 25 },
  { id: 'health_016', date: '2026-04-01', weight: 71.75, bodyFat: 16.2, subcutFat: 14.2, bodyWater: 60.4, skeletalMuscle: 54, muscleMass: 57.03, boneMass: 3, bmr: 1723, visceralFat: 7, protein: 19, metabolicAge: 25 },
  { id: 'health_015', date: '2026-03-30', weight: 71.4, bodyFat: 16.1, subcutFat: 14.1, bodyWater: 60.5, skeletalMuscle: 54.1, muscleMass: 56.85, boneMass: 2.99, bmr: 1718, visceralFat: 6, protein: 19.1, metabolicAge: 25 },
  { id: 'health_014', date: '2026-03-28', weight: 71.5, bodyFat: 16.1, subcutFat: 14.1, bodyWater: 60.5, skeletalMuscle: 54.1, muscleMass: 56.93, boneMass: 2.99, bmr: 1720, visceralFat: 6, protein: 19.1, metabolicAge: 25 },
  { id: 'health_013', date: '2026-03-27', weight: 71.7, bodyFat: 16.2, subcutFat: 14.2, bodyWater: 60.4, skeletalMuscle: 54, muscleMass: 56.99, boneMass: 3, bmr: 1722, visceralFat: 7, protein: 19, metabolicAge: 25 },
  { id: 'health_012', date: '2026-03-26', weight: 71.8, bodyFat: 16.2, subcutFat: 14.2, bodyWater: 60.4, skeletalMuscle: 54, muscleMass: 57.07, boneMass: 3, bmr: 1724, visceralFat: 7, protein: 19, metabolicAge: 25 },
  { id: 'health_011', date: '2026-03-25', weight: 72.45, bodyFat: 16.5, subcutFat: 14.4, bodyWater: 60.2, skeletalMuscle: 53.8, muscleMass: 57.37, boneMass: 3.02, bmr: 1732, visceralFat: 7, protein: 19, metabolicAge: 25 },
  { id: 'health_010', date: '2026-03-23', weight: 71.95, bodyFat: 16.2, subcutFat: 14.2, bodyWater: 60.4, skeletalMuscle: 54, muscleMass: 57.19, boneMass: 3.01, bmr: 1726, visceralFat: 7, protein: 19, metabolicAge: 25 },
  { id: 'health_009', date: '2026-03-22', weight: 72.2, bodyFat: 16.4, subcutFat: 14.3, bodyWater: 60.3, skeletalMuscle: 53.9, muscleMass: 57.28, boneMass: 3.01, bmr: 1730, visceralFat: 7, protein: 19, metabolicAge: 25 },
  { id: 'health_008', date: '2026-03-21', weight: 72.3, bodyFat: 16.5, subcutFat: 14.4, bodyWater: 60.2, skeletalMuscle: 53.8, muscleMass: 57.26, boneMass: 3.01, bmr: 1730, visceralFat: 7, protein: 19, metabolicAge: 25 },
  { id: 'health_007', date: '2026-03-20', weight: 72.95, bodyFat: 16.8, subcutFat: 14.7, bodyWater: 59.9, skeletalMuscle: 53.6, muscleMass: 57.56, boneMass: 3.03, bmr: 1739, visceralFat: 7, protein: 18.9, metabolicAge: 25 },
  { id: 'health_006', date: '2026-03-18', weight: 73.3, bodyFat: 17, subcutFat: 14.8, bodyWater: 59.8, skeletalMuscle: 53.5, muscleMass: 57.73, boneMass: 3.04, bmr: 1744, visceralFat: 7, protein: 18.9, metabolicAge: 25 },
  { id: 'health_005', date: '2026-03-14', weight: 72.2, bodyFat: 16.4, subcutFat: 14.3, bodyWater: 60.3, skeletalMuscle: 53.9, muscleMass: 57.28, boneMass: 3.01, bmr: 1729, visceralFat: 7, protein: 19, metabolicAge: 25 },
  { id: 'health_004', date: '2026-03-12', weight: 73, bodyFat: 16.8, subcutFat: 14.7, bodyWater: 59.9, skeletalMuscle: 53.6, muscleMass: 57.6, boneMass: 3.03, bmr: 1740, visceralFat: 7, protein: 18.9, metabolicAge: 25 },
  { id: 'health_003', date: '2026-03-10', weight: 70.7, bodyFat: 15.6, subcutFat: 13.7, bodyWater: 60.8, skeletalMuscle: 54.4, muscleMass: 56.6, boneMass: 2.98, bmr: 1709, visceralFat: 6, protein: 19.2, metabolicAge: 25 },
  { id: 'health_002', date: '2026-03-08', weight: 71.85, bodyFat: 16.2, subcutFat: 14.2, bodyWater: 60.4, skeletalMuscle: 54, muscleMass: 57.1, boneMass: 3, bmr: 1724, visceralFat: 7, protein: 19, metabolicAge: 25 },
  { id: 'health_001', date: '2026-03-04', weight: 71.4, bodyFat: 16.1, subcutFat: 14.1, bodyWater: 60.5, skeletalMuscle: 54.1, muscleMass: 56.85, boneMass: 2.99, bmr: 1718, visceralFat: 6, protein: 19.1, metabolicAge: 25 },
];

const DEFAULT_PROFILE: HealthProfile = {
  height: 173,
  targetBodyFatMin: 10,
  targetBodyFatMax: 15,
  targetWeight: 70,
  targetMuscleMass: 58,
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
      measurements: INITIAL_MEASUREMENTS,

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
        const cutoffStr = cutoff.toISOString().slice(0, 10);
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
            measurements: existing.length > 0 ? existing : INITIAL_MEASUREMENTS,
          };
        }
        return persisted;
      },
    },
  ),
);
