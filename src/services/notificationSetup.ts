import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

export async function setupNotificationChannels(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.createChannel({
      id: 'tasks',
      name: 'Task Reminders',
      description: 'Reminders for tasks with due dates and deadlines',
      importance: 4,
      vibration: true,
      sound: 'default',
    });
    await LocalNotifications.createChannel({
      id: 'habits',
      name: 'Habit Reminders',
      description: 'Daily, weekly, and monthly habit check-ins',
      importance: 3,
      vibration: true,
      sound: 'default',
    });
    await LocalNotifications.createChannel({
      id: 'timer',
      name: 'Focus Timer',
      description: 'Pomodoro session and break completions',
      importance: 4,
      vibration: true,
      sound: 'default',
    });
  } catch {
    // Channels not supported on this platform — silently skip
  }
}
