import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getCalendarReadModel } from './calendarApi';
import type { CalendarEvent, CalendarEventMode } from './calendarApi';

const modeLabels: Record<CalendarEventMode, string> = {
  online: 'Online',
  offline: 'Offline',
  hybrid: 'Hybrid',
};

function getErrorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : 'Questboard could not load your calendar.';
}

function formatEventDate(event: CalendarEvent) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: event.timezone || undefined,
  }).format(new Date(event.start_at));
}

function getMonthKey(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value;
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function getMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function getAttendanceLabel(event: CalendarEvent) {
  const attendingCount = event.rsvps.filter((rsvp) => rsvp.status === 'attending').length;
  const spotsLabel = event.maximum_attendees ? `${attendingCount}/${event.maximum_attendees} seats` : `${attendingCount} attending`;

  if (event.status === 'cancelled') return `${spotsLabel} · Cancelled`;
  if (attendingCount >= event.minimum_attendees) return `${spotsLabel} · Minimum reached`;

  return `${spotsLabel} · Needs ${event.minimum_attendees - attendingCount} more`;
}

export function CalendarPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [groups, setGroups] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedGroupId, setSelectedGroupId] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedMode, setSelectedMode] = useState<'all' | CalendarEventMode>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadCalendar = async () => {
      if (!user) {
        setGroups([]);
        setEvents([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const readModel = await getCalendarReadModel(user.id);
        if (!isMounted) return;
        setGroups(readModel.groups.map((group) => ({ id: group.id, name: group.name })));
        setEvents(readModel.events);
      } catch (error) {
        if (isMounted) setErrorMessage(getErrorMessage(error));
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void loadCalendar();

    return () => {
      isMounted = false;
    };
  }, [user]);

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
          <p className="eyebrow">Calendar</p>
          <h2>Your quest board</h2>
        </div>
        <Link className="login-link" to="/events/new">Post quest</Link>
      </div>

      <div className="filter-bar" aria-label="Calendar filters">
        <label>
          Guild
          <select value={selectedGroupId} onChange={(event) => setSelectedGroupId(event.target.value)}>
            <option value="all">All guilds</option>
            {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
          </select>
        </label>
        <label>
          Category
          <select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)}>
            <option value="all">All categories</option>
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </label>
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

      {errorMessage && <p className="error-text" role="alert">{errorMessage}</p>}
      {isLoading ? (
        <p className="hint">Loading your quest board...</p>
      ) : !groups.length ? (
        <p className="hint">Create or join a guild to see calendar events here.</p>
      ) : !filteredEvents.length ? (
        <p className="hint">No events match these filters yet.</p>
      ) : (
        <div className="calendar-months">
          {monthKeys.map((monthKey) => (
            <section className="month-section" key={monthKey}>
              <h3>{getMonthLabel(monthKey)}</h3>
              <div className="event-agenda" role="list">
                {eventsByMonth[monthKey].map((event) => (
                  <Link className="event-card" to={`/events/${event.id}`} key={event.id}>
                    <span className="event-date">{formatEventDate(event)}</span>
                    <span className="event-title">{event.title}</span>
                    <span className="event-meta">
                      {event.category?.name ?? 'Uncategorized'} · {modeLabels[event.mode]} · {event.visibility}
                    </span>
                    <span className="event-attendance">{getAttendanceLabel(event)}</span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
