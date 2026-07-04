import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import type { CalendarEventMode } from '../calendar/calendarApi';
import { useLanguage } from '../i18n/LanguageContext';
import { listPublicEventCards } from './publicEventsApi';
import type { PublicEventCard } from './publicEventsApi';

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
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

function getMonthLabel(monthKey: string, locale: string) {
  const [year, month] = monthKey.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 1)));
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
  const [events, setEvents] = useState<PublicEventCard[]>([]);
  const [selectedMode, setSelectedMode] = useState<'all' | CalendarEventMode>('all');
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
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

  return (
    <section className="panel calendar-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t('public.eyebrow')}</p>
          <h2>{t('public.title')}</h2>
        </div>
        {user ? <Link className="login-link" to="/calendar">{t('public.yourCalendar')}</Link> : <Link className="login-link" to="/login">{t('app.nav.login')}</Link>}
      </div>

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

      {!isConfigured && <p className="error-text" role="alert">{t('public.notConfigured')}</p>}
      {errorMessage && <p className="error-text" role="alert">{errorMessage}</p>}
      {isLoading || isLoadingEvents ? (
        <p className="hint">{t('public.loading')}</p>
      ) : !filteredEvents.length ? (
        <p className="hint">{t('public.empty')}</p>
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
                      key={event.id}
                      style={{ borderLeftColor: event.category_color ?? undefined }}
                    >
                      <span className="event-date">{formatEventDate(event, locale)}</span>
                      <span className="event-title">{event.title}</span>
                      <span className="event-meta">
                        {event.group_name} - {event.category_name ?? t('event.uncategorized')} - {t(`mode.${event.mode}`)}
                      </span>
                      <span className="event-attendance">{attendanceLabel}</span>
                      {event.description && <span className="event-description">{event.description}</span>}
                      {event.location_text && <span className="event-meta">{t('public.location', { location: event.location_text })}</span>}
                      {(event.online_details.platform || onlineUrl) && (
                        <span className="event-meta">
                          {t('public.online', { platform: event.online_details.platform ?? t('public.link') })}
                          {onlineUrl && <> - <a href={onlineUrl} target="_blank" rel="noreferrer">{t('public.openLink')}</a></>}
                        </span>
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
