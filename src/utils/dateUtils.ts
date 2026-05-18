import { format, formatDistanceToNow, isToday, isTomorrow, isYesterday, parseISO } from 'date-fns';

// Date-only strings (YYYY-MM-DD) must be parsed as local midnight.
// new Date("2026-05-06") parses as UTC midnight, which is "yesterday" in Western timezones.
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function toDate(date: Date | string): Date {
  if (typeof date !== 'string') return date;
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? parseLocalDate(date) : new Date(date);
}

export const formatDate = (date: Date | string): string => {
  return format(toDate(date), 'yyyy-MM-dd');
};

export const formatDisplayDate = (date: Date | string): string => {
  const d = toDate(date);
  if (isToday(d)) return 'Today';
  if (isTomorrow(d)) return 'Tomorrow';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'MMM d, yyyy');
};

export const formatTime12 = (hhmm: string): string => {
  const [h, m] = hhmm.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${period}`;
};

export const formatRelative = (iso: string): string => {
  return formatDistanceToNow(parseISO(iso), { addSuffix: true });
};

export const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
};

export const getWeekStart = (date: Date = new Date()): Date => {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const getDaysInMonth = (year: number, month: number): number => {
  return new Date(year, month, 0).getDate();
};

export const getMonthName = (month: number): string => {
  return format(new Date(2000, month - 1, 1), 'MMMM');
};

export const getTodayString = (): string => formatDate(new Date());

export const isOverdue = (dueDate: string | null): boolean => {
  if (!dueDate) return false;
  const due = parseLocalDate(dueDate);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return due < today;
};

export const isDueSoon = (dueDate: string | null, days = 3): boolean => {
  if (!dueDate) return false;
  const due = parseLocalDate(dueDate);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const cutoff = new Date(today); cutoff.setDate(cutoff.getDate() + days);
  return due >= today && due <= cutoff;
};
