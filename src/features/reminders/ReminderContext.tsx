/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import { dismissInAppReminder, listDueInAppReminders } from '../events/eventApi';
import type { DueReminder } from '../events/eventApi';
import { useLanguage } from '../i18n/LanguageContext';

type BrowserNotificationPermission = NotificationPermission | 'unsupported';

type ReminderContextValue = {
  browserNotificationsEnabled: boolean;
  dueReminders: DueReminder[];
  dismissReminder: (reminderId: string) => Promise<void>;
  notificationPermission: BrowserNotificationPermission;
  refreshDueReminders: () => Promise<void>;
  setBrowserNotificationsEnabled: (isEnabled: boolean) => Promise<void>;
};

const BROWSER_NOTIFICATIONS_STORAGE_KEY = 'questboard.browserNotificationsEnabled';
const NOTIFIED_REMINDERS_STORAGE_KEY = 'questboard.browserNotifiedReminderIds';
const REMINDER_POLL_INTERVAL_MS = 60_000;

function supportsBrowserNotifications() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

function getNotificationPermission(): BrowserNotificationPermission {
  return supportsBrowserNotifications() ? Notification.permission : 'unsupported';
}

function readStoredBoolean(key: string) {
  if (typeof window === 'undefined') return false;

  try {
    return window.localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

function writeStoredBoolean(key: string, value: boolean) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Local storage can be unavailable in private browsing or tests.
  }
}

function readNotifiedReminderIds() {
  if (typeof window === 'undefined') return new Set<string>();

  try {
    const storedValue = window.localStorage.getItem(NOTIFIED_REMINDERS_STORAGE_KEY);
    const ids = storedValue ? JSON.parse(storedValue) : [];
    return new Set(Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : []);
  } catch {
    return new Set<string>();
  }
}

function writeNotifiedReminderIds(ids: Set<string>) {
  try {
    window.localStorage.setItem(NOTIFIED_REMINDERS_STORAGE_KEY, JSON.stringify(Array.from(ids).slice(-100)));
  } catch {
    // Local storage can be unavailable in private browsing or tests.
  }
}

const fallbackContext: ReminderContextValue = {
  browserNotificationsEnabled: false,
  dueReminders: [],
  dismissReminder: async () => undefined,
  notificationPermission: 'unsupported',
  refreshDueReminders: async () => undefined,
  setBrowserNotificationsEnabled: async () => undefined,
};

export const ReminderContext = createContext<ReminderContextValue>(fallbackContext);

export function ReminderProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { locale, t } = useLanguage();
  const [dueReminders, setDueReminders] = useState<DueReminder[]>([]);
  const [notificationPermission, setNotificationPermission] = useState<BrowserNotificationPermission>(() => getNotificationPermission());
  const [browserNotificationsEnabled, setBrowserNotificationsEnabledState] = useState(
    () => readStoredBoolean(BROWSER_NOTIFICATIONS_STORAGE_KEY) && getNotificationPermission() === 'granted',
  );

  const refreshDueReminders = useCallback(async () => {
    if (!user) {
      setDueReminders([]);
      return;
    }

    setDueReminders(await listDueInAppReminders(user.id));
  }, [user]);

  const setBrowserNotificationsEnabled = useCallback(async (isEnabled: boolean) => {
    if (!isEnabled) {
      setBrowserNotificationsEnabledState(false);
      writeStoredBoolean(BROWSER_NOTIFICATIONS_STORAGE_KEY, false);
      setNotificationPermission(getNotificationPermission());
      return;
    }

    if (!supportsBrowserNotifications()) {
      setBrowserNotificationsEnabledState(false);
      writeStoredBoolean(BROWSER_NOTIFICATIONS_STORAGE_KEY, false);
      setNotificationPermission('unsupported');
      return;
    }

    const permission = Notification.permission === 'default'
      ? await Notification.requestPermission()
      : Notification.permission;

    setNotificationPermission(permission);
    const canEnable = permission === 'granted';
    setBrowserNotificationsEnabledState(canEnable);
    writeStoredBoolean(BROWSER_NOTIFICATIONS_STORAGE_KEY, canEnable);
  }, []);

  const dismissReminder = useCallback(async (reminderId: string) => {
    await dismissInAppReminder(reminderId);
    setDueReminders((currentReminders) => currentReminders.filter((reminder) => reminder.id !== reminderId));
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadReminders = async () => {
      try {
        await refreshDueReminders();
      } catch (error) {
        if (isMounted) {
          console.error('Questboard could not load due reminders', error);
        }
      }
    };

    void loadReminders();
    const intervalId = window.setInterval(() => void loadReminders(), REMINDER_POLL_INTERVAL_MS);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [refreshDueReminders]);

  useEffect(() => {
    if (!browserNotificationsEnabled || notificationPermission !== 'granted' || !supportsBrowserNotifications()) return;

    const notifiedIds = readNotifiedReminderIds();
    const newlyDueReminders = dueReminders.filter((reminder) => !notifiedIds.has(reminder.id));

    newlyDueReminders.forEach((reminder) => {
      const title = reminder.events?.title ?? t('calendar.questReminder');
      const body = reminder.events
        ? new Intl.DateTimeFormat(locale, {
          dateStyle: 'medium',
          timeStyle: 'short',
          timeZone: reminder.events.timezone || undefined,
        }).format(new Date(reminder.events.start_at))
        : t('calendar.dueNow');

      try {
        new Notification(title, { body, tag: `questboard-reminder-${reminder.id}` });
      } catch (error) {
        console.error('Questboard could not send a browser reminder notification', error);
      }
      notifiedIds.add(reminder.id);
    });

    if (newlyDueReminders.length > 0) {
      writeNotifiedReminderIds(notifiedIds);
    }
  }, [browserNotificationsEnabled, dueReminders, locale, notificationPermission, t]);

  const value = useMemo<ReminderContextValue>(() => ({
    browserNotificationsEnabled,
    dueReminders,
    dismissReminder,
    notificationPermission,
    refreshDueReminders,
    setBrowserNotificationsEnabled,
  }), [
    browserNotificationsEnabled,
    dismissReminder,
    dueReminders,
    notificationPermission,
    refreshDueReminders,
    setBrowserNotificationsEnabled,
  ]);

  return <ReminderContext.Provider value={value}>{children}</ReminderContext.Provider>;
}

export function useReminders() {
  return useContext(ReminderContext);
}
