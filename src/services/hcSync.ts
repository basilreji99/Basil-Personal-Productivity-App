import { HealthConnect, hcExerciseTypeName } from './healthConnect';
import { useHealthStore } from '../store/healthStore';
import { useGymStore } from '../store/gymStore';
import type { BodyMeasurement, GymSession } from '../types';

export interface HCSyncResult {
  imported: number;
  error?: string;
}

export async function runHCSync(): Promise<HCSyncResult> {
  try {
    const avail = await HealthConnect.checkAvailability().catch(() => null);
    if (avail?.status !== 'available') return { imported: 0 };

    const perms = await HealthConnect.checkHCPermissions().catch(() => null);
    if (!perms?.granted) return { imported: 0, error: 'permissions_missing' };

    let imported = 0;

    // ── Body measurements: group by date, one merged entry per day ─────────────
    const body = await HealthConnect.readBodyMeasurements({ daysBack: 90 }).catch(() => null);
    if (body) {
      type HCDayData = { weight?: number; bodyFat?: number; muscleMass?: number; boneMass?: number; bmr?: number };
      const byDate: Record<string, HCDayData> = {};
      const merge = (date: string, fields: HCDayData) => { byDate[date] = { ...byDate[date], ...fields }; };

      body.weight.forEach(pt => merge(pt.time.slice(0, 10), { weight: parseFloat(pt.value.toFixed(2)) }));
      body.bodyFat.forEach(pt => merge(pt.time.slice(0, 10), { bodyFat: parseFloat(pt.value.toFixed(2)) }));
      body.muscleMass.forEach(pt => merge(pt.time.slice(0, 10), { muscleMass: parseFloat(pt.value.toFixed(2)) }));
      body.boneMass.forEach(pt => merge(pt.time.slice(0, 10), { boneMass: parseFloat(pt.value.toFixed(2)) }));
      body.bmr.forEach(pt => merge(pt.time.slice(0, 10), { bmr: Math.round(pt.value) }));

      const { measurements, addMeasurement, updateMeasurement } = useHealthStore.getState();
      Object.entries(byDate).forEach(([date, hcData]) => {
        const existing = measurements.find(m => m.date === date);
        if (existing) {
          const updates: Partial<Omit<BodyMeasurement, 'id'>> = {};
          if (hcData.weight     !== undefined && existing.weight     === undefined) updates.weight     = hcData.weight;
          if (hcData.bodyFat    !== undefined && existing.bodyFat    === undefined) updates.bodyFat    = hcData.bodyFat;
          if (hcData.muscleMass !== undefined && existing.muscleMass === undefined) updates.muscleMass = hcData.muscleMass;
          if (hcData.boneMass   !== undefined && existing.boneMass   === undefined) updates.boneMass   = hcData.boneMass;
          if (hcData.bmr        !== undefined && existing.bmr        === undefined) updates.bmr        = hcData.bmr;
          if (Object.keys(updates).length > 0) { updateMeasurement(existing.id, updates); imported++; }
        } else {
          addMeasurement({ date, ...hcData });
          imported++;
        }
      });
    }

    // ── Exercise sessions (Zepp, Garmin, etc. via HC) ─────────────────────────
    const exResult = await HealthConnect.readExerciseSessions({ daysBack: 90 }).catch(() => null);
    if (exResult?.sessions) {
      const gymStore = useGymStore.getState();
      exResult.sessions.forEach(s => {
        // Skip sessions with no calorie data — filters out phantom HC entries
        if (s.calories <= 0) return;

        const session: GymSession = {
          id: s.id,
          name: s.title || hcExerciseTypeName(s.exerciseType),
          startedAt: s.start,
          finishedAt: s.end,
          durationSeconds: s.durationMinutes * 60,
          exercises: [],
          notes: s.notes || undefined,
          calories: Math.round(s.calories),
          source: 'health_connect',
          hcExerciseType: s.exerciseType,
          totalVolume: 0,
          totalSets: 0,
        };
        gymStore.importHCSession(session);
      });
      imported += exResult.sessions.length;
    }

    localStorage.setItem('basil-hc-last-sync', new Date().toISOString());
    return { imported };
  } catch (e: unknown) {
    return { imported: 0, error: e instanceof Error ? e.message : String(e) };
  }
}
