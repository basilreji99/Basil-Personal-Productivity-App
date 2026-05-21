import { HealthConnect, hcExerciseTypeName } from './healthConnect';
import { useHealthStore } from '../store/healthStore';
import { useGymStore } from '../store/gymStore';
import { useSleepStore } from '../store/sleepStore';
import { localDateString } from '../utils/dateUtils';
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

      body.weight.forEach(pt => merge(localDateString(new Date(pt.time)), { weight: parseFloat(pt.value.toFixed(2)) }));
      body.bodyFat.forEach(pt => merge(localDateString(new Date(pt.time)), { bodyFat: parseFloat(pt.value.toFixed(2)) }));
      body.muscleMass.forEach(pt => merge(localDateString(new Date(pt.time)), { muscleMass: parseFloat(pt.value.toFixed(2)) }));
      body.boneMass.forEach(pt => merge(localDateString(new Date(pt.time)), { boneMass: parseFloat(pt.value.toFixed(2)) }));
      body.bmr.forEach(pt => merge(localDateString(new Date(pt.time)), { bmr: Math.round(pt.value) }));

      const { measurements, addMeasurement, updateMeasurement } = useHealthStore.getState();
      Object.entries(byDate).forEach(([date, hcData]) => {
        const existing = measurements.find(m => m.date === date);
        if (existing) {
          // Always apply fresh HC values — HC is the source of truth for scale data
          const updates: Partial<Omit<BodyMeasurement, 'id'>> = {};
          if (hcData.weight     !== undefined) updates.weight     = hcData.weight;
          if (hcData.bodyFat    !== undefined) updates.bodyFat    = hcData.bodyFat;
          if (hcData.muscleMass !== undefined) updates.muscleMass = hcData.muscleMass;
          if (hcData.boneMass   !== undefined) updates.boneMass   = hcData.boneMass;
          if (hcData.bmr        !== undefined) updates.bmr        = hcData.bmr;
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
      const existingIds = new Set(gymStore.sessions.map((x) => x.id));
      exResult.sessions.forEach(s => {
        if (s.durationMinutes <= 0) return;
        if (existingIds.has(s.id)) return;
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
        imported++;
      });
    }

    // ── Sleep sessions ────────────────────────────────────────────────────────
    const sleepResult = await HealthConnect.readSleepSessions({ daysBack: 90 }).catch(() => null);
    if (sleepResult?.sessions?.length) {
      const sleepStore = useSleepStore.getState();
      const existingSleepIds = new Set(sleepStore.sessions.map((x) => x.id));
      const newSessions = sleepResult.sessions
        .filter((s) => !existingSleepIds.has(s.id))
        .map((s) => ({
          id: s.id,
          start: s.start,
          end: s.end,
          durationMinutes: s.durationMinutes,
          title: s.title || undefined,
          stages: s.stages,
        }));
      if (newSessions.length > 0) {
        sleepStore.importHCSessions(newSessions);
        imported += newSessions.length;
      }
    }

    localStorage.setItem('basil-hc-last-sync', new Date().toISOString());
    return { imported };
  } catch (e: unknown) {
    return { imported: 0, error: e instanceof Error ? e.message : String(e) };
  }
}
