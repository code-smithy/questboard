import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { dismissInAppReminder, getAttendanceSummary, listDueInAppReminders, recordEventHistory, setEventRsvp } from '../events/eventApi';
import type { DueReminder, EventRsvpStatus } from '../events/eventApi';
import { formatAttendanceLabel, useLanguage } from '../i18n/LanguageContext';
import { getCalendarReadModel } from './calendarApi';
import type { CalendarEvent, CalendarEventMode } from './calendarApi';

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function getCategoryStyle(color: string | null | undefined): CSSProperties {
  return color ? ({ '--event-category-color': color } as CSSProperties) : {};
}

function formatEventDate(event: CalendarEvent, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: event.timezone || undefined,
  }).format(new Date(event.start_at));
}

function getMonthKey(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value;
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function getMonthLabel(monthKey: string, locale: string) {
  const [year, month] = monthKey.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function formatReminderDate(reminder: DueReminder, locale: string, unknownTimeLabel: string) {
  if (!reminder.events) return unknownTimeLabel;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: reminder.events.timezone || undefined,
  }).format(new Date(reminder.events.start_at));
}

const rsvpOptions: Array<{ status: EventRsvpStatus; labelKey: 'rsvp.attending' | 'rsvp.maybe' | 'rsvp.declined' }> = [
  { status: 'attending', labelKey: 'rsvp.attending' },
  { status: 'maybe', labelKey: 'rsvp.maybe' },
  { status: 'declined', labelKey: 'rsvp.declined' },
];

function updateEventRsvp(events: CalendarEvent[], eventId: string, userId: string, status: EventRsvpStatus) {
  return events.map((event) => {
    if (event.id !== eventId) return event;

    const hasCurrentUserRsvp = event.rsvps.some((rsvp) => rsvp.user_id === userId);
    const rsvps = hasCurrentUserRsvp
      ? event.rsvps.map((rsvp) => (rsvp.user_id === userId ? { ...rsvp, status } : rsvp))
      : [...event.rsvps, { user_id: userId, status }];

    return { ...event, rsvps };
  });
}

export function CalendarPage() {
  const { user } = useAuth();
  const { locale, t } = useLanguage();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [dueReminders, setDueReminders] = useState<DueReminder[]>([]);
  const [groups, setGroups] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedGroupId, setSelectedGroupId] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedMode, setSelectedMode] = useState<'all' | CalendarEventMode>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [savingRsvpEventId, setSavingRsvpEventId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadCalendar = async () => {
      if (!user) {
        setGroups([]);
        setEvents([]);
        setDueReminders([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const [readModel, reminders] = await Promise.all([getCalendarReadModel(user.id), listDueInAppReminders(user.id)]);
        if (!isMounted) return;
        setGroups(readModel.groups.map((group) => ({ id: group.id, name: group.name })));
        setEvents(readModel.events);
        setDueReminders(reminders);
      } catch (error) {
        if (isMounted) setErrorMessage(getErrorMessage(error, t('calendar.loadError')));
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void loadCalendar();

    return () => {
      isMounted = false;
    };
  }, [t, user]);

  const handleDismissReminder = async (reminderId: string) => {
    setErrorMessage(null);

    try {
      await dismissInAppReminder(reminderId);
      setDueReminders((currentReminders) => currentReminders.filter((reminder) => reminder.id !== reminderId));
    } catch (error) {
      setErrorMessage(getErrorMessage(error, t('calendar.loadError')));
    }
  };

  const handleRsvp = async (event: CalendarEvent, status: EventRsvpStatus) => {
    if (!user) return;

    setSavingRsvpEventId(event.id);
    setErrorMessage(null);

    try {
      const previousStatus = event.rsvps.find((rsvp) => rsvp.user_id === user.id)?.status ?? null;
      await setEventRsvp(event.id, user.id, status);
      await recordEventHistory({
        eventId: event.id,
        changedBy: user.id,
        changeType: 'rsvp_updated',
        oldValue: { status: previousStatus },
        newValue: { status },
      });
      setEvents((currentEvents) => updateEventRsvp(currentEvents, event.id, user.id, status));
    } catch (error) {
      setErrorMessage(getErrorMessage(error, t('calendar.loadError')));
    } finally {
      setSavingRsvpEventId(null);
    }
  };

  const categories = useMemo(() => {
    const names = new Set<string>();
    events.forEach((event) => {
      if (event.category?.name) names.add(event.category.name);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [events]);

  const filteredEvents = useMemo(() => events.filter((event) => {
    if (selectedGroupId !== 'all' && event.group_id !== selectedGroupId) return false;
    if (selectedCategory !== 'all' && event.category?.name !== selectedCategory) return false;
    if (selectedMode !== 'all' && event.mode !== selectedMode) return false;
    return true;
  }), [events, selectedCategory, selectedGroupId, selectedMode]);

  const eventsByMonth = useMemo(() => filteredEvents.reduce<Record<string, CalendarEvent[]>>((months, event) => {
    const monthKey = getMonthKey(event.start_at);
    months[monthKey] = [...(months[monthKey] ?? []), event];
    return months;
  }, {}), [filteredEvents]);

  const monthKeys = Object.keys(eventsByMonth).sort();

  return (
    <section className="panel calendar-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t('calendar.eyebrow')}</p>
          <h2>{t('calendar.title')}</h2>
        </div>
        <Link className="login-link" to="/events/new">{t('calendar.postQuest')}</Link>
      </div>

      {dueReminders.length > 0 && (
        <section className="reminder-banner" aria-labelledby="due-reminders-heading">
          <div>
            <p className="eyebrow">{t('calendar.reminders')}</p>
            <h3 id="due-reminders-heading">{t('calendar.dueNow')}</h3>
          </div>
          <div className="reminder-list">
            {dueReminders.map((reminder) => (
              <article key={reminder.id}>
                <div>
                  <strong>{reminder.events?.title ?? t('calendar.questReminder')}</strong>
                  <p className="hint">{formatReminderDate(reminder, locale, t('calendar.unknownTime'))}</p>
                </div>
                <button type="button" className="secondary-button" onClick={() => void handleDismissReminder(reminder.id)}>
                  {t('calendar.dismiss')}
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="filter-bar" aria-label={t('calendar.filters')}>
        <label>
          {t('calendar.guild')}
          <select value={selectedGroupId} onChange={(event) => setSelectedGroupId(event.target.value)}>
            <option value="all">{t('calendar.allGuilds')}</option>
            {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
          </select>
        </label>
        <label>
          {t('calendar.category')}
          <select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)}>
            <option value="all">{t('calendar.allCategories')}</option>
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </label>
        <label>
          {t('calendar.mode')}
          <select value={selectedMode} onChange={(event) => setSelectedMode(event.target.value as 'all' | CalendarEventMode)}>
            <option value="all">{t('calendar.allModes')}</option>
            <option value="online">{t('mode.online')}</option>
            <option value="offline">{t('mode.offline')}</option>
            <option value="hybrid">{t('mode.hybrid')}</option>
          </select>
        </label>
      </div>

      {errorMessage && <p className="error-text" role="alert">{errorMessage}</p>}
      {isLoading ? (
        <p className="hint">{t('calendar.loading')}</p>
      ) : !groups.length ? (
        <p className="hint">{t('calendar.noGroups')}</p>
      ) : !filteredEvents.length ? (
        <p className="hint">{t('calendar.noMatches')}</p>
      ) : (
        <div className="calendar-months">
          {monthKeys.map((monthKey) => (
            <section className="month-section" key={monthKey}>
              <h3>{getMonthLabel(monthKey, locale)}</h3>
              <div className="event-agenda" role="list">
                {eventsByMonth[monthKey].map((event) => {
                  const attendance = getAttendanceSummary({
                    rsvps: event.rsvps,
                    minimumAttendees: event.minimum_attendees,
                    maximumAttendees: event.maximum_attendees,
                    status: event.status,
                  });

                  const currentUserRsvp = event.rsvps.find((rsvp) => rsvp.user_id === user?.id)?.status ?? null;
                  const isSavingThisRsvp = savingRsvpEventId === event.id;

                  return (
                      <article
                        className="event-card"
                        data-status={event.status}
                        key={event.id}
                        style={getCategoryStyle(event.category?.color)}
                      >
                        <Link className="event-card-link" to={`/events/${event.id}`}>
                          <span className="event-card-topline">
                            <span className="event-date">{formatEventDate(event, locale)}</span>
                            <span className="event-status-badge" data-status={event.status}>{t(`status.${event.status}`)}</span>
                          </span>
                          <span className="event-title">{event.title}</span>
                          <span className="event-meta">
                            <span className="event-category-label">
                              <span className="event-category-swatch" aria-hidden="true" />
                              {event.category?.name ?? t('event.uncategorized')}
                            </span>
                            {' - '}
                            {t(`mode.${event.mode}`)} - {t(`visibility.${event.visibility}`)}
                          </span>
                          <span className="event-attendance">
                            {formatAttendanceLabel(t, { ...attendance, maximumAttendees: event.maximum_attendees, status: event.status })}
                          </span>
                        </Link>
                        <div className="rsvp-actions event-rsvp-actions" aria-label={t('event.chooseRsvp')}>
                          {rsvpOptions.map((option) => (
                            <button
                              type="button"
                              className={currentUserRsvp === option.status ? 'is-selected' : undefined}
                              disabled={isSavingThisRsvp || (option.status === 'attending' && attendance.isFull && currentUserRsvp !== 'attending')}
                              key={option.status}
                              onClick={() => void handleRsvp(event, option.status)}
                            >
                              {t(option.labelKey)}
                            </button>
                          ))}
                        </div>
                      </article>
                    );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
