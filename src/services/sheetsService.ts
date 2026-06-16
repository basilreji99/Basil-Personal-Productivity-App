import type { BodyMeasurement, SheetTransaction, SheetNewRow, OweEntry } from '../types';
import { nanoid } from '../utils/nanoid';

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

// ─── Finance / Expense sheet ─────────────────────────────────────────────────

const FINANCE_SPREADSHEET_ID = '1z00eRDoBIHef0t1ZH97A22eBsnfR5u-GoXNX7irUatw';
const EXPENSE_SHEET = 'Expense';

// Sheet columns (0-indexed): Day, Month, Year, Name, Expense(USD), Income(USD),
// TotalExp, Balance, USDRate, InINR, TotalExpINR, ClassI, ClassII, Tags, Trip, State, Note

const MONTH_NAMES: Record<string, number> = {
  january:1,february:2,march:3,april:4,may:5,june:6,
  july:7,august:8,september:9,october:10,november:11,december:12,
  jan:1,feb:2,mar:3,apr:4,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12,
};
function parseMonth(v: string): number {
  const n = parseInt(v);
  return isNaN(n) ? (MONTH_NAMES[v.toLowerCase().trim()] ?? 0) : n;
}

function parseExpenseRow(row: string[], rowIndex: number): SheetTransaction | null {
  const day = parseInt(row[0]);
  const month = parseMonth(row[1]);
  const year = parseInt(row[2]);
  if (!day || !month || !year) return null;

  const expenseUSD = parseFloat(row[4]) || 0;
  const incomeUSD = parseFloat(row[5]) || 0;
  const usdRate = parseFloat(row[8]) || 0;
  const inINR = parseFloat(row[9]) || (expenseUSD || incomeUSD) * usdRate;
  const type: 'income' | 'expense' = incomeUSD > 0 && expenseUSD === 0 ? 'income' : 'expense';
  const amountUSD = type === 'income' ? incomeUSD : expenseUSD;

  return {
    localId: nanoid(),
    rowIndex,
    day, month, year,
    date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    name: row[3] ?? '',
    expenseUSD,
    incomeUSD,
    usdRate,
    inINR,
    expenseClassI: row[11] ?? '',
    expenseClassII: row[12] ?? '',
    tags: row[13] ?? '',
    tripName: row[14] ?? '',
    tripState: row[15] ?? '',
    note: row[16] ?? '',
    type,
    amountUSD,
    amountINR: inINR,
  };
}

export async function readExpenseSheet(token: string): Promise<{ transactions: SheetTransaction[]; error?: string }> {
  const range = `${EXPENSE_SHEET}!A:Q`;
  let res: Response;
  try {
    res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${FINANCE_SPREADSHEET_ID}/values/${encodeURIComponent(range)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
  } catch (e) {
    return { transactions: [], error: `Network error: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (!res.ok) {
    let detail = '';
    try { const j = await res.json(); detail = j?.error?.message ?? ''; } catch { /* ignore */ }
    return { transactions: [], error: res.status === 401 || res.status === 403 ? 'auth' : `Read failed (${res.status})${detail ? ': ' + detail : ''}` };
  }
  const data = await res.json();
  const rows: string[][] = data.values ?? [];
  if (rows.length === 0) return { transactions: [], error: `Sheet "${EXPENSE_SHEET}" appears empty or tab name is wrong` };
  const transactions: SheetTransaction[] = [];
  rows.slice(1).forEach((row, i) => {
    const tx = parseExpenseRow(row, i + 2);
    if (tx) transactions.push(tx);
  });
  return { transactions };
}

export async function appendExpenseRows(token: string, rows: SheetNewRow[]): Promise<{ ok: boolean; error?: string }> {
  const values = rows.map(r => {
    const amount = r.expenseUSD || r.incomeUSD;
    const inINR = r.usdRate ? amount * r.usdRate : '';
    return [
      r.day, r.month, r.year,
      r.name,
      r.expenseUSD || '',
      r.incomeUSD || '',
      '', '', // TotalExp, Balance — leave blank (no formula)
      r.usdRate || '',
      inINR,
      '', // TotalExpINR — leave blank
      r.expenseClassI,
      r.expenseClassII,
      r.tags,
      r.tripName,
      r.tripState,
      r.note,
    ];
  });
  const range = `${EXPENSE_SHEET}!A:Q`;
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${FINANCE_SPREADSHEET_ID}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values }),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    return { ok: false, error: res.status === 401 || res.status === 403 ? 'auth' : (err.error?.message ?? `Append failed (${res.status})`) };
  }
  return { ok: true };
}

// ─── Owe sheet ────────────────────────────────────────────────────────────────

const OWE_SHEET = 'Owe';

// Columns: Month, Year, Owe To, Reason, Amount, Currency, Notes

function parseOweRow(row: string[]): OweEntry | null {
  const month = parseMonth(row[0]);
  const year = parseInt(row[1]);
  if (!month || !year) return null;
  return {
    localId: nanoid(),
    month,
    year,
    oweTo: row[2]?.trim() ?? '',
    reason: row[3]?.trim() ?? '',
    amount: parseFloat(row[4]) || 0,
    currency: row[5]?.trim().toUpperCase() || 'USD',
    notes: row[6]?.trim() ?? '',
  };
}

export async function readOweSheet(token: string): Promise<{ entries: OweEntry[]; error?: string }> {
  let res: Response;
  try {
    res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${FINANCE_SPREADSHEET_ID}/values/${encodeURIComponent(OWE_SHEET + '!A:G')}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
  } catch (e) {
    return { entries: [], error: `Network error: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (!res.ok) {
    let detail = '';
    try { const j = await res.json(); detail = j?.error?.message ?? ''; } catch { /* ignore */ }
    return { entries: [], error: res.status === 401 || res.status === 403 ? 'auth' : `Owe read failed (${res.status})${detail ? ': ' + detail : ''}` };
  }
  const data = await res.json();
  const rows: string[][] = data.values ?? [];
  if (rows.length === 0) return { entries: [] };
  const entries: OweEntry[] = [];
  rows.slice(1).forEach(row => {
    const e = parseOweRow(row);
    if (e) entries.push(e);
  });
  return { entries };
}
