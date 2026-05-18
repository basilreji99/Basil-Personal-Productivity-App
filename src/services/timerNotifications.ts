import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import type { TimerMode } from '../types';

export async function fireTimerCompletionNotification(
  completedMode: TimerMode,
  pomodoroCount: number,
  taskTitle: string | null,
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { display } = await LocalNotifications.checkPermissions();
    if (display !== 'granted') return;

    let title: string;
    let body: string;

    if (completedMode === 'work') {
      title = `🍅 Focus session complete! #${pomodoroCount}`;
      body = taskTitle
        ? `Great work on "${taskTitle}". Time for a break.`
        : 'Nice work — take a well-earned break.';
    } else if (completedMode === 'short_break') {
      title = '⚡ Break over — back to it!';
      body = taskTitle ? `Continue: "${taskTitle}"` : 'Time to focus again.';
    } else {
      title = '🔋 Long break done';
      body = taskTitle ? `Ready to continue "${taskTitle}"?` : 'Ready for your next focus session?';
    }

    await LocalNotifications.schedule({
      notifications: [{
        id: 8000 + (Date.now() % 1000),
        title,
        body,
        schedule: { at: new Date(Date.now() + 200) },
        channelId: 'timer',
        smallIcon: 'ic_stat_icon_config_sample',
      }],
    });
  } catch {
    // Notifications unavailable — silently skip
  }
}
