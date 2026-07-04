import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import type { CalendarEventMode } from '../calendar/calendarApi';
import { listPublicEventCards } from './publicEventsApi';
import type { PublicEventCard } from './publicEventsApi';

const modeLabels: Record<CalendarEventMode, string> = {
  online: 'Online',
  offline: 'Offline',
  hybrid: 'Hybrid',
};

function getErrorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : 'Questboard could not load public events.';
}

function formatEventDate(event: PublicEventCard) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: event.timezone || undefined,
  }).format(new Date(event.start_at));
}

function getMonthKey(value: string) {
  const date = new Date(value);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function getMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function getPublicAttendanceLabel(event: PublicEventCard) {
  const seatCount = event.maximum_attendees ? `${event.attending_count}/${event.maximum_attendees} seats` : `${event.attending_count} attending`;
  const remainingMinimum = Math.max(event.minimum_attendees - event.attending_count, 0);

  if (event.maximum_attendees !== null && event.attending_count >= event.maximum_attendees) return `${seatCount} - Full`;
  if (remainingMinimum === 0) return `${seatCount} - Minimum reached`;
  return `${seatCount} - Needs ${remainingMinimum} more`;
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
        if (isMounted) setErrorMessage(getErrorMessage(error));
      } finally {
        if (isMounted) setIsLoadingEvents(false);
      }
    };

    if (!isLoading) void loadPublicEvents();

    return () => {
      isMounted = false;
    };
  }, [isConfigured, isLoading]);

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
          <p className="eyebrow">Public board</p>
          <h2>Open quests</h2>
        </div>
        {user ? <Link className="login-link" to="/calendar">Your calendar</Link> : <Link className="login-link" to="/login">Login</Link>}
      </div>

      <div className="filter-bar public-filter-bar" aria-label="Public event filters">
        <label>
          Mode
          <select value={selectedMode} onChange={(event) => setSelectedMode(event.target.value as 'all' | CalendarEventMode)}>
            <option value="all">All modes</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
            <option value="hybrid">Hybrid</option>
          </select>
        </label>
      </div>

      {!isConfigured && <p className="error-text" role="alert">Public events need Supabase configuration before they can load.</p>}
      {errorMessage && <p className="error-text" role="alert">{errorMessage}</p>}
      {isLoading || isLoadingEvents ? (
        <p className="hint">Loading public quests...</p>
      ) : !filteredEvents.length ? (
        <p className="hint">No public quests are open yet.</p>
      ) : (
        <div className="calendar-months">
          {monthKeys.map((monthKey) => (
            <section className="month-section" key={monthKey}>
              <h3>{getMonthLabel(monthKey)}</h3>
              <div className="event-agenda" role="list">
                {eventsByMonth[monthKey].map((event) => {
                  const onlineUrl = getSafeOnlineUrl(event);

                  return (
                    <article
                      className="event-card public-event-card"
                      key={event.id}
                      style={{ borderLeftColor: event.category_color ?? undefined }}
                    >
                      <span className="event-date">{formatEventDate(event)}</span>
                      <span className="event-title">{event.title}</span>
                      <span className="event-meta">
                        {event.group_name} - {event.category_name ?? 'Uncategorized'} - {modeLabels[event.mode]}
                      </span>
                      <span className="event-attendance">{getPublicAttendanceLabel(event)}</span>
                      {event.description && <span className="event-description">{event.description}</span>}
                      {event.location_text && <span className="event-meta">Location: {event.location_text}</span>}
                      {(event.online_details.platform || onlineUrl) && (
                        <span className="event-meta">
                          Online: {event.online_details.platform ?? 'Link'}
                          {onlineUrl && <> - <a href={onlineUrl} target="_blank" rel="noreferrer">Open link</a></>}
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
