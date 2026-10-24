
import { LocalNotifications } from '@capacitor/local-notifications';
import { ReminderSettings } from '../types';
import { isNative } from './shareService';

const BASE_ID = 1000;
const DAYS_AHEAD = 14;

export type ReminderResult = 'scheduled' | 'off' | 'denied' | 'unsupported' | 'error';

// Schedules one notification per chosen weekday for the next two weeks.
// Today's is skipped once a report was sent, so the reminder only fires when you forgot.
export const syncReminders = async (reminder: ReminderSettings, sentToday: boolean, askPermission: boolean): Promise<ReminderResult> => {
  if (!isNative()) return 'unsupported';
  try {
    const pending = await LocalNotifications.getPending();
    const ours = pending.notifications.filter(n => n.id >= BASE_ID && n.id < BASE_ID + DAYS_AHEAD);
    if (ours.length) await LocalNotifications.cancel({ notifications: ours.map(n => ({ id: n.id })) });
    if (!reminder.enabled || reminder.days.length === 0) return 'off';

    let perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted' && askPermission) perm = await LocalNotifications.requestPermissions();
    if (perm.display !== 'granted') return 'denied';

    const [hour, minute] = reminder.time.split(':').map(Number);
    const now = new Date();
    const notifications = [];
    for (let i = 0; i < DAYS_AHEAD; i++) {
      const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, hour, minute);
      if (at <= now || (i === 0 && sentToday) || !reminder.days.includes(at.getDay())) continue;
      notifications.push({
        id: BASE_ID + i,
        title: 'QA Daily',
        body: 'עדיין לא שלחת את דוח ה-QA של היום 📋',
        schedule: { at, allowWhileIdle: true },
      });
    }
    if (notifications.length) await LocalNotifications.schedule({ notifications });
    return 'scheduled';
  } catch {
    return 'error';
  }
};
