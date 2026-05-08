import { registerPlugin } from '@capacitor/core';

export interface HCAvailabilityResult {
  status: 'available' | 'update_required' | 'unavailable';
}

export interface HCPermissionResult {
  granted: boolean;
  needsSetup?: boolean;
}

export interface HCMeasurementPoint {
  time: string;
  value: number;
}

export interface HCBodyMeasurements {
  weight: HCMeasurementPoint[];
  bodyFat: HCMeasurementPoint[];
  boneMass: HCMeasurementPoint[];
  muscleMass: HCMeasurementPoint[];
  bmr: HCMeasurementPoint[];
  height: HCMeasurementPoint[];
}

export interface HCSleepStage {
  start: string;
  end: string;
  stage: number; // 0=unknown,1=awake,2=sleeping,3=out_of_bed,4=light,5=deep,6=REM
}

export interface HCSleepSession {
  id: string;
  start: string;
  end: string;
  durationMinutes: number;
  title: string;
  stages: HCSleepStage[];
}

export interface HCExerciseSegment {
  start: string;
  end: string;
  type: number;
}

export interface HCExerciseSession {
  id: string;
  start: string;
  end: string;
  durationMinutes: number;
  exerciseType: number;
  title: string;
  notes: string;
  calories: number;
  segments: HCExerciseSegment[];
}

interface HealthConnectPlugin {
  checkAvailability(): Promise<HCAvailabilityResult>;
  checkHCPermissions(): Promise<HCPermissionResult>;
  requestHCPermissions(): Promise<HCPermissionResult>;
  openHealthConnect(): Promise<void>;
  readBodyMeasurements(options: { daysBack?: number }): Promise<HCBodyMeasurements>;
  readSleepSessions(options: { daysBack?: number }): Promise<{ sessions: HCSleepSession[] }>;
  readExerciseSessions(options: { daysBack?: number }): Promise<{ sessions: HCExerciseSession[] }>;
}

export const HealthConnect = registerPlugin<HealthConnectPlugin>('HealthConnect');

// Map HC exercise type integers to readable names
const HC_EXERCISE_TYPE_MAP: Record<number, string> = {
  0: 'Other',
  2: 'Badminton',
  4: 'Baseball',
  5: 'Basketball',
  8: 'Biking',
  9: 'Biking Stationary',
  10: 'Boot Camp',
  11: 'Boxing',
  13: 'Cricket',
  14: 'Cross Country Skiing',
  15: 'Crossfit',
  16: 'Curling',
  17: 'Dancing',
  19: 'Elliptical',
  20: 'Exercise Class',
  21: 'Fencing',
  22: 'Football American',
  23: 'Football Australian',
  24: 'Frisbee Disc',
  25: 'Golf',
  26: 'Guided Breathing',
  27: 'Gymnastics',
  28: 'Handball',
  29: 'High Intensity Interval Training',
  30: 'Hiking',
  31: 'Ice Hockey',
  32: 'Ice Skating',
  33: 'Martial Arts',
  34: 'Mountain Biking',
  35: 'Orienteering',
  36: 'Paddling',
  37: 'Paragliding',
  38: 'Pilates',
  39: 'Racquetball',
  40: 'Rock Climbing',
  41: 'Roller Hockey',
  42: 'Rowing',
  43: 'Rowing Machine',
  44: 'Rugby',
  45: 'Running',
  46: 'Running Treadmill',
  47: 'Sailing',
  48: 'Scuba Diving',
  49: 'Skating',
  50: 'Skiing',
  51: 'Snowboarding',
  52: 'Snowshoeing',
  53: 'Soccer',
  54: 'Softball',
  55: 'Squash',
  56: 'Stair Climbing',
  57: 'Stair Climbing Machine',
  58: 'Strength Training',
  59: 'Stretching',
  60: 'Surfing',
  61: 'Swimming Open Water',
  62: 'Swimming Pool',
  63: 'Table Tennis',
  64: 'Tennis',
  65: 'Volleyball',
  66: 'Walking',
  67: 'Water Polo',
  68: 'Weightlifting',
  69: 'Wheelchair',
  70: 'Yoga',
};

export function hcExerciseTypeName(type: number): string {
  return HC_EXERCISE_TYPE_MAP[type] ?? `Exercise (${type})`;
}

export const HC_SLEEP_STAGE_LABELS: Record<number, string> = {
  0: 'Unknown',
  1: 'Awake',
  2: 'Sleeping',
  3: 'Out of Bed',
  4: 'Light',
  5: 'Deep',
  6: 'REM',
};
