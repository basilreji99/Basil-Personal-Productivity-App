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
    let { display } = await LocalNotifications.checkPermissions();
    if (display !== 'granted') {
      ({ display } = await LocalNotifications.requestPermissions());
    }
    if (display !== 'granted') return;

    // Cancel all previously scheduled habit reminders (IDs 9000–9200)
    const pending = await LocalNotifications.getPending();
    const habitNotifIds = pending.notifications.filter(n => n.id >= 9000 && n.id < 9200);
    if (habitNotifIds.length > 0) {
      await LocalNotifications.cancel({ notifications: habitNotifIds });
    }

    const today = new Date();
    const todayStr = formatDate(today);
    const weekStart = getWeekStart(today);
    const year = today.getFullYear();
    const month = today.getMonth();

    const active = habits.filter(h => !h.archivedAt);
    const toSchedule: Parameters<typeof LocalNotifications.schedule>[0]['notifications'] = [];

    // ── Per-habit custom reminder times ───────────────────────────────────────
    // Only fire if the habit has a reminderTime set and isn't completed today
    active.forEach((h, i) => {
      if (!h.reminderTime) return;

      const [hh, mm] = h.reminderTime.split(':').map(Number);
      const at = new Date(today);
      at.setHours(hh, mm, 0, 0);
      if (at <= today) return; // already past for today

      let isDone = false;
      if (h.frequency === 'daily' || h.frequency === 'weekdays') {
        isDone = fns.isCompleted(h.id, todayStr);
      } else if (h.frequency === 'weekly') {
        isDone = fns.getWeekCompletionCount(h.id, weekStart) >= h.targetDays;
      } else if (h.frequency === 'monthly') {
        isDone = fns.getMonthCompletionCount(h.id, year, month) >= h.targetDays;
      }
      if (isDone) return;

      toSchedule.push({
        id: 9100 + i,
        title: `${h.name} reminder`,
        body: h.description || `Time to complete your habit!`,
        schedule: { at },
        channelId: 'habits',
        smallIcon: 'ic_stat_icon_config_sample',
      });
    });

    // ── Fallback group reminders (only for habits WITHOUT a custom time) ──────

    // Daily / Weekday: group reminder at 20:00 for all unset habits
    const dailyHabits = active.filter(
      h => (h.frequency === 'daily' || h.frequency === 'weekdays') && !h.reminderTime,
    );
    const pendingDaily = dailyHabits.filter(h => !fns.isCompleted(h.id, todayStr));

    if (pendingDaily.length > 0) {
      const at = new Date(today);
      at.setHours(20, 0, 0, 0);
      if (at > today) {
        toSchedule.push({
          id: 9001,
          title: '🔥 Don\'t break your streak!',
          body: `${pendingDaily.length} daily habit${pendingDaily.length > 1 ? 's' : ''} left today: ${pendingDaily.map(h => h.name).join(', ')}`,
          schedule: { at },
          channelId: 'habits',
        smallIcon: 'ic_stat_icon_config_sample',
        });
      }
    }

    // Weekly: Sunday 19:00 for habits without custom time and target not met
    const weeklyHabits = active.filter(h => h.frequency === 'weekly' && !h.reminderTime);
    const pendingWeekly = weeklyHabits.filter(h =>
      fns.getWeekCompletionCount(h.id, weekStart) < h.targetDays,
    );
    if (pendingWeekly.length > 0) {
      const sunday = new Date(today);
      const daysUntilSunday = (7 - today.getDay()) % 7;
      sunday.setDate(sunday.getDate() + daysUntilSunday);
      sunday.setHours(19, 0, 0, 0);
      if (sunday > today) {
        toSchedule.push({
          id: 9002,
          title: '📅 Week ending soon!',
          body: pendingWeekly.map(h => `${h.name} (${fns.getWeekCompletionCount(h.id, weekStart)}/${h.targetDays})`).join(', '),
          schedule: { at: sunday },
          channelId: 'habits',
        smallIcon: 'ic_stat_icon_config_sample',
        });
      }
    }

    // Monthly: last day 18:00 for habits without custom time and target not met
    const monthlyHabits = active.filter(h => h.frequency === 'monthly' && !h.reminderTime);
    const pendingMonthly = monthlyHabits.filter(h =>
      fns.getMonthCompletionCount(h.id, year, month) < h.targetDays,
    );
    if (pendingMonthly.length > 0) {
      const lastDay = new Date(year, month + 1, 0);
      lastDay.setHours(18, 0, 0, 0);
      if (lastDay > today) {
        toSchedule.push({
          id: 9003,
          title: '📆 Last chance this month!',
          body: `Still to do: ${pendingMonthly.map(h => h.name).join(', ')}`,
          schedule: { at: lastDay },
          channelId: 'habits',
        smallIcon: 'ic_stat_icon_config_sample',
        });
      }
    }

    if (toSchedule.length > 0) {
      await LocalNotifications.schedule({ notifications: toSchedule });
    }
  } catch {
    // Notifications unavailable (web browser) — silently skip
  }
}
