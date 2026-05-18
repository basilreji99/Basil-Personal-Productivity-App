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

const OFFSET_SLOTS: Array<{ key: '2h' | '1h' | '30min' | '15min'; ms: number; label: string }> = [
  { key: '2h',    ms: 2 * 60 * 60 * 1000,  label: 'in 2 hours'     },
  { key: '1h',    ms:     60 * 60 * 1000,  label: 'in 1 hour'      },
  { key: '30min', ms:     30 * 60 * 1000,  label: 'in 30 minutes'  },
  { key: '15min', ms:     15 * 60 * 1000,  label: 'in 15 minutes'  },
];

interface NotifTask {
  id: string;
  title: string;
  dueDate: string | null;
  startTime?: string;
  deadlineTime?: string;
  notificationOffsets?: ('2h' | '1h' | '30min' | '15min')[];
}

function buildNotifications(task: NotifTask) {
  if (!task.dueDate) return [];
  const [y, m, d] = task.dueDate.slice(0, 10).split('-').map(Number);
  const now = Date.now();
  const items: { id: number; title: string; body: string; at: Date }[] = [];

  const activeOffsets: Set<'2h' | '1h' | '30min' | '15min'> = new Set(
    task.notificationOffsets?.length ? task.notificationOffsets : ['30min', '15min'],
  );

  // Day-before reminder at 8 PM
  const prevEvening = new Date(y, m - 1, d - 1, 20, 0, 0);
  if (prevEvening.getTime() > now) {
    items.push({
      id: notifId(task.id, 'due_eve'),
      title: `Due tomorrow: ${task.title}`,
      body: 'This task is due tomorrow — plan ahead.',
      at: prevEvening,
    });
  }

  // Morning-of reminder at 9 AM
  const morning = new Date(y, m - 1, d, 9, 0, 0);
  if (morning.getTime() > now) {
    items.push({
      id: notifId(task.id, 'due_today'),
      title: `Due today: ${task.title}`,
      body: 'This task is due today.',
      at: morning,
    });
  }

  function pushTimeReminders(timeStr: string, sfxPrefix: string, verb: string) {
    const [h, min] = timeStr.split(':').map(Number);
    const base = new Date(y, m - 1, d, h, min, 0).getTime();
    for (const slot of OFFSET_SLOTS) {
      if (!activeOffsets.has(slot.key)) continue;
      const at = new Date(base - slot.ms);
      if (at.getTime() > now) {
        items.push({
          id: notifId(task.id, sfxPrefix + slot.key),
          title: task.title,
          body: `${verb} ${slot.label}`,
          at,
        });
      }
    }
  }

  if (task.startTime)    pushTimeReminders(task.startTime,    'start_', 'Starts');
  if (task.deadlineTime) {
    pushTimeReminders(task.deadlineTime, 'dl_', 'Due');
    // Always fire an alert exactly at the deadline time
    const [dh, dm] = task.deadlineTime.split(':').map(Number);
    const atDeadline = new Date(y, m - 1, d, dh, dm, 0);
    if (atDeadline.getTime() > now) {
      items.push({
        id: notifId(task.id, 'dl_at'),
        title: `⏰ Deadline: ${task.title}`,
        body: 'This task\'s deadline has arrived.',
        at: atDeadline,
      });
    }
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
      { id: notifId(taskId, 'due_eve') },
      { id: notifId(taskId, 'due_today') },
      { id: notifId(taskId, 'start_2h') },
      { id: notifId(taskId, 'start_1h') },
      { id: notifId(taskId, 'start_30min') },
      { id: notifId(taskId, 'start_15min') },
      { id: notifId(taskId, 'dl_2h') },
      { id: notifId(taskId, 'dl_1h') },
      { id: notifId(taskId, 'dl_30min') },
      { id: notifId(taskId, 'dl_15min') },
      { id: notifId(taskId, 'dl_at') },
    ],
  });
}
