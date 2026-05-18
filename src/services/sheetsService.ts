import type { BodyMeasurement } from '../types';

const SPREADSHEET_ID = '1sxvRrh0VP3xuh7nEWbcLStydKavguTl72xUFLouOoaw';
const HEALTH_SHEET_GID = 851080091;

// Columns: Date, Weight, BMI, Body Fat %, Fat Mass (kg), Fat Free Mass (kg),
//          Subcutaneous Fat, Body Water, Skeletal Muscle, Muscle Mass, Bone Mass,
//          BMR (kcal), Visceral Fat, Protein %, Metabolic Age

async function getHealthSheetName(token: string): Promise<{ name: string | null; authError: boolean }> {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return { name: null, authError: res.status === 401 || res.status === 403 };
  const data = await res.json();
  const sheet = data.sheets?.find((s: { properties?: { sheetId?: number; title?: string } }) =>
    s.properties?.sheetId === HEALTH_SHEET_GID
  );
  return { name: sheet?.properties?.title ?? null, authError: false };
}

export interface SheetsSyncResult {
  synced: number;
  alreadySynced: number;
  error?: string;
}

export async function syncHealthToSheets(
  token: string,
  measurements: BodyMeasurement[],
  height: number,
): Promise<SheetsSyncResult> {
  const sheetResult = await getHealthSheetName(token).catch(() => ({ name: null, authError: false }));
  if (!sheetResult.name) {
    if (sheetResult.authError) {
      return { synced: 0, alreadySynced: 0, error: 'Sheets access denied — sign out and sign back in to grant Sheets permission.' };
    }
    return { synced: 0, alreadySynced: 0, error: 'Health sheet tab not found in the spreadsheet (check the GID).' };
  }
  const sheetName = sheetResult.name;

  // Read existing dates from column A to skip duplicates
  const readRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(sheetName + '!A:A')}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!readRes.ok) {
    if (readRes.status === 403) {
      return { synced: 0, alreadySynced: 0, error: 'Sheets permission denied — re-authorize in settings.' };
    }
    return { synced: 0, alreadySynced: 0, error: `Sheets read failed (${readRes.status})` };
  }

  const readData = await readRes.json();
  const existingDates = new Set<string>(
    ((readData.values ?? []) as string[][]).slice(1).map(row => row[0]).filter(Boolean),
  );

  // Only sync entries that have at least weight and are not yet in the sheet
  const toSync = measurements
    .filter(m => m.weight !== undefined && !existingDates.has(m.date))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (toSync.length === 0) {
    return { synced: 0, alreadySynced: existingDates.size };
  }

  const rows = toSync.map(m => {
    const bmi = height ? parseFloat((m.weight! / Math.pow(height / 100, 2)).toFixed(1)) : '';
    const fatMass    = m.bodyFat !== undefined ? parseFloat((m.weight! * m.bodyFat / 100).toFixed(2)) : '';
    const fatFreeMass = m.bodyFat !== undefined ? parseFloat((m.weight! * (1 - m.bodyFat / 100)).toFixed(2)) : '';
    return [
      m.date,
      m.weight,
      bmi,
      m.bodyFat      ?? '',
      fatMass,
      fatFreeMass,
      m.subcutFat    ?? '',
      m.bodyWater    ?? '',
      m.skeletalMuscle ?? '',
      m.muscleMass   ?? '',
      m.boneMass     ?? '',
      m.bmr          ?? '',
      m.visceralFat  ?? '',
      m.protein      ?? '',
      m.metabolicAge ?? '',
    ];
  });

  const appendRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(sheetName + '!A:O')}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: rows }),
    },
  );

  if (!appendRes.ok) {
    const err = await appendRes.json().catch(() => ({})) as { error?: { message?: string } };
    if (appendRes.status === 403) {
      return { synced: 0, alreadySynced: existingDates.size, error: 'Sheets permission denied — re-authorize in settings.' };
    }
    return { synced: 0, alreadySynced: existingDates.size, error: err.error?.message ?? `Append failed (${appendRes.status})` };
  }

  return { synced: rows.length, alreadySynced: existingDates.size };
}
