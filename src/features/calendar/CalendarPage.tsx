import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useIsNarrowViewport } from '../../hooks/useIsNarrowViewport';
import { usePersistedDisclosureState } from '../../hooks/usePersistedDisclosureState';
import { useAuth } from '../auth/AuthContext';
import { getAttendanceSummary, recordEventHistory, setEventRsvp } from '../events/eventApi';
import type { DueReminder, EventRsvpStatus } from '../events/eventApi';
import { formatAttendanceLabel, useLanguage } from '../i18n/LanguageContext';
import { useReminders } from '../reminders/ReminderContext';
import { getCalendarReadModel } from './calendarApi';
import type { CalendarEvent, CalendarEventMode } from './calendarApi';

type CalendarView = 'list' | 'month';

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

function getLocalMonthKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthLabel(monthKey: string, locale: string) {
  const [year, month] = monthKey.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function getEventDayKey(event: CalendarEvent) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: event.timezone || undefined,
    year: 'numeric',
  }).formatToParts(new Date(event.start_at));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function getDayKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function getCalendarDayCells(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number);
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 0));
  const firstDayOffset = (monthStart.getUTCDay() + 6) % 7;
  const daysInMonth = monthEnd.getUTCDate();
  const totalCells = Math.ceil((firstDayOffset + daysInMonth) / 7) * 7;
  const gridStart = new Date(monthStart);
  gridStart.setUTCDate(monthStart.getUTCDate() - firstDayOffset);

  return Array.from({ length: totalCells }, (_, index) => {
    const date = new Date(gridStart);
    date.setUTCDate(gridStart.getUTCDate() + index);
    return {
      date,
      dayNumber: date.getUTCDate(),
      isCurrentMonth: date.getUTCMonth() === month - 1,
      key: getDayKey(date),
    };
  });
}

function getWeekdayLabels(locale: string) {
  const monday = new Date(Date.UTC(2026, 0, 5));
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setUTCDate(monday.getUTCDate() + index);
    return new Intl.DateTimeFormat(locale, { timeZone: 'UTC', weekday: 'short' }).format(date);
  });
}

function getTimeLabel(event: CalendarEvent, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: event.timezone || undefined,
  }).format(new Date(event.start_at));
}

function formatReminderDate(reminder: DueReminder, locale: string, unknownTimeLabel: string) {
  if (!reminder.events) return unknownTimeLabel;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: reminder.events.timezone || undefined,
  }).format(new Date(reminder.events.start_at));
}

const rsvpOptions: Array<{
  status: EventRsvpStatus;
  labelKey: 'rsvp.attending' | 'rsvp.maybe' | 'rsvp.declined';
  seal: string;
}> = [
  { status: 'attending', labelKey: 'rsvp.attending', seal: '✒️' },
  { status: 'maybe', labelKey: 'rsvp.maybe', seal: '🕯️' },
  { status: 'declined', labelKey: 'rsvp.declined', seal: '✕' },
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
  const userId = user?.id ?? null;
  const { locale, t } = useLanguage();
  const { dismissReminder, dueReminders } = useReminders();
  const isNarrowViewport = useIsNarrowViewport();
  const filterDisclosure = usePersistedDisclosureState('calendar.filters', !isNarrowViewport);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [groups, setGroups] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedGroupId, setSelectedGroupId] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedMode, setSelectedMode] = useState<'all' | CalendarEventMode>('all');
  const [selectedView, setSelectedView] = useState<CalendarView>('list');
  const [focusedMonth, setFocusedMonth] = useState(() => getLocalMonthKey(new Date()));
  const [isLoading, setIsLoading] = useState(true);
  const [savingRsvpEventId, setSavingRsvpEventId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasCalendarData = groups.length > 0 || events.length > 0;

  useEffect(() => {
    let isMounted = true;

    const loadCalendar = async () => {
      if (!userId) {
        setGroups([]);
        setEvents([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const readModel = await getCalendarReadModel(userId);
        if (!isMounted) return;
        setGroups(readModel.groups.map((group) => ({ id: group.id, name: group.name })));
        setEvents(readModel.events);
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
  }, [t, userId]);

  const handleDismissReminder = async (reminderId: string) => {
    setErrorMessage(null);

    try {
      await dismissReminder(reminderId);
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
  const weekdayLabels = useMemo(() => getWeekdayLabels(locale), [locale]);
  const calendarDayCells = useMemo(() => getCalendarDayCells(focusedMonth), [focusedMonth]);
  const calendarEventsByDay = useMemo(() => filteredEvents.reduce<Record<string, CalendarEvent[]>>((days, event) => {
    const dayKey = getEventDayKey(event);
    days[dayKey] = [...(days[dayKey] ?? []), event];
    return days;
  }, {}), [filteredEvents]);
  const activeFilterLabels = [
    selectedGroupId === 'all' ? null : groups.find((group) => group.id === selectedGroupId)?.name,
    selectedCategory === 'all' ? null : selectedCategory,
    selectedMode === 'all' ? null : t(`mode.${selectedMode}`),
  ].filter(Boolean);

  const showPreviousMonth = () => {
    const [year, month] = focusedMonth.split('-').map(Number);
    setFocusedMonth(getMonthKey(new Date(Date.UTC(year, month - 2, 1))));
  };

  const showNextMonth = () => {
    const [year, month] = focusedMonth.split('-').map(Number);
    setFocusedMonth(getMonthKey(new Date(Date.UTC(year, month, 1))));
  };

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

      <details className="collapsible-section filter-disclosure" {...filterDisclosure}>
        <summary>
          <span>{t('calendar.filters')}</span>
          <span className="filter-summary">{activeFilterLabels.length ? activeFilterLabels.join(' / ') : t('calendar.noActiveFilters')}</span>
        </summary>
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
      </details>

      <div className="calendar-view-bar" aria-label={t('calendar.viewLabel')}>
        <div className="view-tabs" role="tablist" aria-label={t('calendar.viewLabel')}>
          <button
            type="button"
            aria-selected={selectedView === 'list'}
            className={selectedView === 'list' ? 'is-selected' : undefined}
            role="tab"
            onClick={() => setSelectedView('list')}
          >
            {t('calendar.listView')}
          </button>
          <button
            type="button"
            aria-selected={selectedView === 'month'}
            className={selectedView === 'month' ? 'is-selected' : undefined}
            role="tab"
            onClick={() => setSelectedView('month')}
          >
            {t('calendar.monthView')}
          </button>
        </div>
        {selectedView === 'month' && (
          <div className="month-nav">
            <button type="button" className="secondary-button icon-button" aria-label={t('calendar.previousMonth')} onClick={showPreviousMonth}>
              &lt;
            </button>
            <h3>{getMonthLabel(focusedMonth, locale)}</h3>
            <button type="button" className="secondary-button icon-button" aria-label={t('calendar.nextMonth')} onClick={showNextMonth}>
              &gt;
            </button>
          </div>
        )}
      </div>

      {errorMessage && <p className="error-text" role="alert">{errorMessage}</p>}
      {isLoading && !hasCalendarData ? (
        <p className="hint">{t('calendar.loading')}</p>
      ) : !groups.length ? (
        <p className="hint">{t('calendar.noGroups')}</p>
      ) : !filteredEvents.length ? (
        <p className="hint">{t('calendar.noMatches')}</p>
      ) : selectedView === 'month' ? (
        <div className="month-grid" role="grid" aria-label={getMonthLabel(focusedMonth, locale)}>
          {weekdayLabels.map((weekday) => (
            <div className="month-grid-weekday" role="columnheader" key={weekday}>
              {weekday}
            </div>
          ))}
          {calendarDayCells.map((day) => {
            const dayEvents = day.isCurrentMonth
              ? [...(calendarEventsByDay[day.key] ?? [])].sort((firstEvent, secondEvent) =>
                new Date(firstEvent.start_at).getTime() - new Date(secondEvent.start_at).getTime(),
              )
              : [];
            const visibleEvents = dayEvents.slice(0, 3);
            const hiddenEventCount = dayEvents.length - visibleEvents.length;

            return (
              <div className="month-grid-day" data-outside-month={!day.isCurrentMonth || undefined} key={day.key} role="gridcell">
                <span className="month-grid-date">{day.dayNumber}</span>
                <div className="month-grid-events">
                  {visibleEvents.map((event) => (
                    <Link
                      className="month-event-link"
                      data-status={event.status}
                      key={event.id}
                      aria-label={`${getTimeLabel(event, locale)} ${event.title} - ${event.group_name}`}
                      style={getCategoryStyle(event.category?.color)}
                      title={`${getTimeLabel(event, locale)} ${event.title} - ${event.group_name}`}
                      to={`/events/${event.id}`}
                    >
                      <span>{getTimeLabel(event, locale)}</span>
                      <strong>{event.title}</strong>
                    </Link>
                  ))}
                  {hiddenEventCount > 0 && (
                    <span className="month-more-events">
                      {t('calendar.moreQuests', { count: hiddenEventCount })}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
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
                          <span className="event-meta event-card-meta-line">
                            {event.group_name} -{' '}
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
                          {rsvpOptions.map((option) => {
                            const isSelectedRsvp = currentUserRsvp === option.status;
                            const className = [
                              isSelectedRsvp ? 'is-selected' : null,
                              !isSelectedRsvp ? 'is-muted' : null,
                            ].filter(Boolean).join(' ') || undefined;
                            const label = t(option.labelKey);

                            return (
                              <button
                                type="button"
                                aria-label={label}
                                aria-pressed={isSelectedRsvp}
                                className={className}
                                disabled={isSavingThisRsvp || (option.status === 'attending' && attendance.isFull && currentUserRsvp !== 'attending')}
                                key={option.status}
                                onClick={() => void handleRsvp(event, option.status)}
                                title={label}
                              >
                                <span aria-hidden="true" className="rsvp-seal-mark">{option.seal}</span>
                                <span className="sr-only">{label}</span>
                              </button>
                            );
                          })}
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
