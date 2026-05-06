import { LocalNotifications } from '@capacitor/local-notifications';
import type { Habit } from '../types';
import { getWeekStart, formatDate } from '../utils/dateUtils';

interface CheckFns {
  isCompleted: (id: string, date: string) => boolean;
  getWeekCompletionCount: (id: string, ws: Date) => number;
  getMonthCompletionCount: (id: string, year: number, month: number) => number;
}

export async function scheduleHabitReminders(
  habits: Habit[],
  fns: CheckFns,
): Promise<void> {
  try {
    const perm = await LocalNotifications.requestPermissions();
    if (perm.display !== 'granted') return;

    // Cancel all previously scheduled habit reminders
    const pending = await LocalNotifications.getPending();
    const habitIds = pending.notifications.filter(n => n.id >= 9000 && n.id < 9100);
    if (habitIds.length > 0) {
      await LocalNotifications.cancel({ notifications: habitIds });
    }

    const today = new Date();
    const todayStr = formatDate(today);
    const weekStart = getWeekStart(today);
    const year = today.getFullYear();
    const month = today.getMonth();

    const active = habits.filter(h => !h.archivedAt);

    // ── Daily / Weekday reminder at 20:00 ──────────────────────────────────
    const dailyHabits = active.filter(
      h => h.frequency === 'daily' || h.frequency === 'weekdays',
    );
    const pendingDaily = dailyHabits.filter(h => !fns.isCompleted(h.id, todayStr));

    if (pendingDaily.length > 0) {
      const at = new Date(today);
      at.setHours(20, 0, 0, 0);
      if (at > today) {
        await LocalNotifications.schedule({
          notifications: [{
            id: 9001,
            title: '🔥 Don\'t break your streak!',
            body: `${pendingDaily.length} daily habit${pendingDaily.length > 1 ? 's' : ''} left today: ${pendingDaily.map(h => h.name).join(', ')}`,
            schedule: { at },
            smallIcon: 'ic_stat_icon_config_sample',
          }],
        });
      }
    }

    // ── Weekly reminder: Sunday at 19:00 if week target not met ───────────
    const weeklyHabits = active.filter(h => h.frequency === 'weekly');
    const pendingWeekly = weeklyHabits.filter(h =>
      fns.getWeekCompletionCount(h.id, weekStart) < h.targetDays,
    );

    if (pendingWeekly.length > 0) {
      // Find next Sunday at 19:00
      const sunday = new Date(today);
      const daysUntilSunday = (7 - today.getDay()) % 7;
      sunday.setDate(sunday.getDate() + daysUntilSunday);
      sunday.setHours(19, 0, 0, 0);
      if (sunday > today) {
        await LocalNotifications.schedule({
          notifications: [{
            id: 9002,
            title: '📅 Week ending soon!',
            body: `${pendingWeekly.map(h => `${h.name} (${fns.getWeekCompletionCount(h.id, weekStart)}/${h.targetDays})`).join(', ')}`,
            schedule: { at: sunday },
            smallIcon: 'ic_stat_icon_config_sample',
          }],
        });
      }
    }

    // ── Monthly reminder: last day of month at 18:00 ───────────────────────
    const monthlyHabits = active.filter(h => h.frequency === 'monthly');
    const pendingMonthly = monthlyHabits.filter(h =>
      fns.getMonthCompletionCount(h.id, year, month) < h.targetDays,
    );

    if (pendingMonthly.length > 0) {
      const lastDay = new Date(year, month + 1, 0);
      lastDay.setHours(18, 0, 0, 0);
      if (lastDay > today) {
        await LocalNotifications.schedule({
          notifications: [{
            id: 9003,
            title: '📆 Last chance this month!',
            body: `Still to do: ${pendingMonthly.map(h => h.name).join(', ')}`,
            schedule: { at: lastDay },
            smallIcon: 'ic_stat_icon_config_sample',
          }],
        });
      }
    }
  } catch {
    // Notifications unavailable (web browser) — silently skip
  }
}
