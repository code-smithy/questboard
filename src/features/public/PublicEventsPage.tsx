import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useIsNarrowViewport } from '../../hooks/useIsNarrowViewport';
import { useAuth } from '../auth/AuthContext';
import type { CalendarEventMode } from '../calendar/calendarApi';
import { useLanguage } from '../i18n/LanguageContext';
import { listPublicEventCards, requestPublicEventJoin } from './publicEventsApi';
import type { PublicEventCard } from './publicEventsApi';

type PublicBoardView = 'list' | 'month';

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function getCategoryStyle(color: string | null | undefined): CSSProperties {
  return color ? ({ '--event-category-color': color } as CSSProperties) : {};
}

function formatEventDate(event: PublicEventCard, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: event.timezone || undefined,
  }).format(new Date(event.start_at));
}

function getMonthKey(value: string) {
  const date = new Date(value);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function getLocalMonthKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthLabel(monthKey: string, locale: string) {
  const [year, month] = monthKey.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function getEventDayKey(event: PublicEventCard) {
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

function getTimeLabel(event: PublicEventCard, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: event.timezone || undefined,
  }).format(new Date(event.start_at));
}

function getSafeOnlineUrl(event: PublicEventCard) {
  const url = event.online_details.url;
  if (!url) return null;

  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function PublicEventsPage() {
  const { isConfigured, isLoading, user } = useAuth();
  const { locale, t } = useLanguage();
  const isNarrowViewport = useIsNarrowViewport();
  const [events, setEvents] = useState<PublicEventCard[]>([]);
  const [selectedMode, setSelectedMode] = useState<'all' | CalendarEventMode>('all');
  const [selectedView, setSelectedView] = useState<PublicBoardView>('list');
  const [focusedMonth, setFocusedMonth] = useState(() => getLocalMonthKey(new Date()));
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [requestingEventId, setRequestingEventId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadPublicEvents = async () => {
      if (!isConfigured) {
        setEvents([]);
        setIsLoadingEvents(false);
        return;
      }

      setIsLoadingEvents(true);
      setErrorMessage(null);

      try {
        const nextEvents = await listPublicEventCards();
        if (isMounted) setEvents(nextEvents);
      } catch (error) {
        if (isMounted) setErrorMessage(getErrorMessage(error, t('public.loadError')));
      } finally {
        if (isMounted) setIsLoadingEvents(false);
      }
    };

    if (!isLoading) void loadPublicEvents();

    return () => {
      isMounted = false;
    };
  }, [isConfigured, isLoading, t]);

  const filteredEvents = useMemo(() => events.filter((event) => selectedMode === 'all' || event.mode === selectedMode), [events, selectedMode]);

  const eventsByMonth = useMemo(() => filteredEvents.reduce<Record<string, PublicEventCard[]>>((months, event) => {
    const monthKey = getMonthKey(event.start_at);
    months[monthKey] = [...(months[monthKey] ?? []), event];
    return months;
  }, {}), [filteredEvents]);

  const monthKeys = Object.keys(eventsByMonth).sort();
  const weekdayLabels = useMemo(() => getWeekdayLabels(locale), [locale]);
  const calendarDayCells = useMemo(() => getCalendarDayCells(focusedMonth), [focusedMonth]);
  const calendarEventsByDay = useMemo(() => filteredEvents.reduce<Record<string, PublicEventCard[]>>((days, event) => {
    const dayKey = getEventDayKey(event);
    days[dayKey] = [...(days[dayKey] ?? []), event];
    return days;
  }, {}), [filteredEvents]);
  const activeFilterLabel = selectedMode === 'all' ? t('calendar.noActiveFilters') : t(`mode.${selectedMode}`);

  const showPreviousMonth = () => {
    const [year, month] = focusedMonth.split('-').map(Number);
    setFocusedMonth(getMonthKey(new Date(Date.UTC(year, month - 2, 1)).toISOString()));
  };

  const showNextMonth = () => {
    const [year, month] = focusedMonth.split('-').map(Number);
    setFocusedMonth(getMonthKey(new Date(Date.UTC(year, month, 1)).toISOString()));
  };

  const handleRequestJoin = async (eventId: string) => {
    if (!user) return;

    setRequestingEventId(eventId);
    setErrorMessage(null);

    try {
      await requestPublicEventJoin(eventId);
      setEvents((currentEvents) => currentEvents.map((event) =>
        event.id === eventId ? { ...event, current_user_request_status: 'pending' } : event,
      ));
    } catch (error) {
      setErrorMessage(getErrorMessage(error, t('public.requestError')));
    } finally {
      setRequestingEventId(null);
    }
  };

  return (
    <section className="panel calendar-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t('public.eyebrow')}</p>
          <h2>{t('public.title')}</h2>
        </div>
        {user ? <Link className="login-link" to="/calendar">{t('public.yourCalendar')}</Link> : <Link className="login-link" to="/login">{t('app.nav.login')}</Link>}
      </div>

      <details className="collapsible-section filter-disclosure public-filter-disclosure" open={!isNarrowViewport}>
        <summary>
          <span>{t('public.filters')}</span>
          <span className="filter-summary">{activeFilterLabel}</span>
        </summary>
        <div className="filter-bar public-filter-bar" aria-label={t('public.filters')}>
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

      {!isConfigured && <p className="error-text" role="alert">{t('public.notConfigured')}</p>}
      {errorMessage && <p className="error-text" role="alert">{errorMessage}</p>}
      {isLoading || isLoadingEvents ? (
        <p className="hint">{t('public.loading')}</p>
      ) : !filteredEvents.length ? (
        <p className="hint">{t('public.empty')}</p>
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
                    <div
                      aria-label={`${getTimeLabel(event, locale)} ${event.title}`}
                      className="month-event-chip"
                      data-status={event.status}
                      key={event.id}
                      role="group"
                      style={getCategoryStyle(event.category_color)}
                      title={`${getTimeLabel(event, locale)} ${event.title}`}
                    >
                      <span>{getTimeLabel(event, locale)}</span>
                      <strong>{event.title}</strong>
                    </div>
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
                  const onlineUrl = getSafeOnlineUrl(event);
                  const seatCount = event.maximum_attendees
                    ? t('attendance.seats', { attending: event.attending_count, maximum: event.maximum_attendees })
                    : t('attendance.attending', { attending: event.attending_count });
                  const remainingMinimum = Math.max(event.minimum_attendees - event.attending_count, 0);
                  const attendanceLabel = event.maximum_attendees !== null && event.attending_count >= event.maximum_attendees
                    ? t('attendance.full', { spots: seatCount })
                    : remainingMinimum === 0
                      ? t('attendance.minimumReached', { spots: seatCount })
                      : t('attendance.needsMore', { spots: seatCount, count: remainingMinimum });

                  return (
                    <article
                      className="event-card public-event-card"
                      data-status={event.status}
                      key={event.id}
                      style={getCategoryStyle(event.category_color)}
                    >
                      <span className="event-card-topline">
                        <span className="event-date">{formatEventDate(event, locale)}</span>
                        <span className="event-status-badge" data-status={event.status}>{t(`status.${event.status}`)}</span>
                      </span>
                      <span className="event-title">{event.title}</span>
                      <span className="event-meta event-card-meta-line">
                        {event.group_name} -{' '}
                        <span className="event-category-label">
                          <span className="event-category-swatch" aria-hidden="true" />
                          {event.category_name ?? t('event.uncategorized')}
                        </span>
                        {' - '}
                        {t(`mode.${event.mode}`)}
                      </span>
                      <span className="event-attendance">{attendanceLabel}</span>
                      {event.description && <span className="event-description clamped-mobile-description">{event.description}</span>}
                      {event.location_text && <span className="event-meta">{t('public.location', { location: event.location_text })}</span>}
                      {(event.online_details.platform || onlineUrl) && (
                        <span className="event-meta">
                          {t('public.online', { platform: event.online_details.platform ?? t('public.link') })}
                          {onlineUrl && <> - <a href={onlineUrl} target="_blank" rel="noreferrer">{t('public.openLink')}</a></>}
                        </span>
                      )}
                      {!event.viewer_is_group_member && (
                        <div className="public-event-actions">
                          {!user ? (
                            <Link className="login-link" to="/login">{t('public.loginToRequest')}</Link>
                          ) : event.current_user_request_status === 'pending' ? (
                            <button type="button" className="secondary-button" disabled>{t('public.requestPending')}</button>
                          ) : event.current_user_request_status === 'approved' ? (
                            <button type="button" className="secondary-button" disabled>{t('public.requestApproved')}</button>
                          ) : (
                            <button
                              type="button"
                              disabled={requestingEventId === event.id}
                              onClick={() => void handleRequestJoin(event.id)}
                            >
                              {requestingEventId === event.id
                                ? t('public.requesting')
                                : event.current_user_request_status === 'rejected'
                                  ? t('public.requestAgain')
                                  : t('public.requestJoin')}
                            </button>
                          )}
                        </div>
                      )}
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
