import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

// Deterministic numeric ID from task ID + suffix
function notifId(taskId: string, suffix: string): number {
  let hash = 0;
  const str = taskId + suffix;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 2_000_000_000; // keep within safe int range
}

async function ensurePermission(): Promise<boolean> {
  const { display } = await LocalNotifications.checkPermissions();
  if (display === 'granted') return true;
  const { display: after } = await LocalNotifications.requestPermissions();
  return after === 'granted';
}

interface NotifTask {
  id: string;
  title: string;
  dueDate: string | null;
  startTime?: string;
  deadlineTime?: string;
}

function buildNotifications(task: NotifTask) {
  if (!task.dueDate) return [];
  const [y, m, d] = task.dueDate.split('-').map(Number);
  const now = Date.now();
  const items: { id: number; title: string; body: string; at: Date }[] = [];

  function push(time: string, titlePrefix: string, suffixes: [string, number, string][]) {
    const [h, min] = time.split(':').map(Number);
    const base = new Date(y, m - 1, d, h, min, 0).getTime();
    for (const [sfx, offsetMs, body] of suffixes) {
      const at = new Date(base - offsetMs);
      if (at.getTime() > now) {
        items.push({ id: notifId(task.id, sfx), title: `${titlePrefix}: ${task.title}`, body, at });
      }
    }
  }

  if (task.startTime) {
    push(task.startTime, 'Starting soon', [
      ['start1h',  60 * 60 * 1000, 'Starts in 1 hour'],
      ['start30m', 30 * 60 * 1000, 'Starts in 30 minutes'],
    ]);
  }
  if (task.deadlineTime) {
    push(task.deadlineTime, 'Deadline approaching', [
      ['dl1h',  60 * 60 * 1000, 'Due in 1 hour'],
      ['dl30m', 30 * 60 * 1000, 'Due in 30 minutes'],
    ]);
  }
  return items;
}

export async function scheduleTaskNotifications(task: NotifTask): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await cancelTaskNotifications(task.id);
  const items = buildNotifications(task);
  if (!items.length) return;
  const granted = await ensurePermission();
  if (!granted) return;
  await LocalNotifications.schedule({
    notifications: items.map(n => ({
      id: n.id,
      title: n.title,
      body: n.body,
      schedule: { at: n.at },
      channelId: 'tasks',
    })),
  });
}

export async function cancelTaskNotifications(taskId: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await LocalNotifications.cancel({
    notifications: [
      { id: notifId(taskId, 'start1h') },
      { id: notifId(taskId, 'start30m') },
      { id: notifId(taskId, 'dl1h') },
      { id: notifId(taskId, 'dl30m') },
    ],
  });
}
