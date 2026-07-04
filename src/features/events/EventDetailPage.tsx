import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { listUserGroups } from '../groups/groupApi';
import type { GroupSummary } from '../groups/groupApi';
import { EventForm } from './EventForm';
import type { EventFormValues } from './EventForm';
import { archiveEvent, getEvent, updateEvent } from './eventApi';
import type { QuestEvent } from './eventApi';

function getErrorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : 'Questboard could not load that quest.';
}

function formatDate(value: string, timezone: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone: timezone || undefined }).format(new Date(value));
}

function toFormValues(event: QuestEvent): EventFormValues {
  return {
    groupId: event.group_id,
    categoryId: event.category_id,
    title: event.title,
    description: event.description ?? '',
    startAt: event.start_at,
    endAt: event.end_at,
    timezone: event.timezone,
    mode: event.mode,
    locationText: event.location_text ?? '',
    onlinePlatform: event.online_details.platform ?? '',
    onlineUrl: event.online_details.url ?? '',
    onlineInstructions: event.online_details.instructions ?? '',
    minimumAttendees: event.minimum_attendees,
    maximumAttendees: event.maximum_attendees,
    visibility: event.visibility,
    status: event.status === 'archived' ? 'open' : event.status,
  };
}

export function EventDetailPage() {
  const { eventId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [event, setEvent] = useState<QuestEvent | null>(null);
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadEvent = async () => {
      if (!user || !eventId) {
        setIsLoading(false);
        return;
      }

      try {
        const [nextEvent, nextGroups] = await Promise.all([getEvent(eventId), listUserGroups(user.id)]);
        setEvent(nextEvent);
        setGroups(nextGroups);
      } catch (error) {
        setErrorMessage(getErrorMessage(error));
      } finally {
        setIsLoading(false);
      }
    };

    void loadEvent();
  }, [eventId, user]);

  const handleUpdate = async (values: EventFormValues) => {
    if (!user || !eventId) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await updateEvent(eventId, { ...values, ownerId: user.id });
      setEvent(await getEvent(eventId));
      setIsEditing(false);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchive = async () => {
    if (!eventId) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await archiveEvent(eventId);
      navigate('/calendar', { replace: true });
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setIsSubmitting(false);
    }
  };

  if (!user) return <Navigate to="/login" replace />;
  if (!eventId) return <Navigate to="/calendar" replace />;

  return (
    <section className="panel">
      <p className="eyebrow">Event detail</p>
      {errorMessage && <p className="error-text" role="alert">{errorMessage}</p>}
      {isLoading ? (
        <p className="hint">Loading quest details...</p>
      ) : !event ? (
        <p className="hint">Quest not found.</p>
      ) : isEditing ? (
        <>
          <h2>Edit quest</h2>
          <EventForm groups={groups} initialValues={toFormValues(event)} isSubmitting={isSubmitting} submitLabel="Save quest" onSubmit={handleUpdate} />
        </>
      ) : (
        <>
          <h2>{event.title}</h2>
          <dl className="details-list">
            <div><dt>When</dt><dd>{formatDate(event.start_at, event.timezone)} – {formatDate(event.end_at, event.timezone)}</dd></div>
            <div><dt>Category</dt><dd>{event.categories?.name ?? 'Uncategorized'}</dd></div>
            <div><dt>Mode</dt><dd>{event.mode}</dd></div>
            <div><dt>Status</dt><dd>{event.status}</dd></div>
            <div><dt>Attendance</dt><dd>Minimum {event.minimum_attendees}{event.maximum_attendees ? `, maximum ${event.maximum_attendees}` : ', no maximum'}</dd></div>
            <div><dt>Location</dt><dd>{event.location_text ?? 'No location details yet.'}</dd></div>
            <div><dt>Online</dt><dd>{event.online_details.platform || event.online_details.url || event.online_details.instructions || 'No online details yet.'}</dd></div>
            <div><dt>Description</dt><dd>{event.description ?? 'No description yet.'}</dd></div>
          </dl>
          <div className="button-row">
            <button type="button" onClick={() => setIsEditing(true)}>Edit quest</button>
            <button type="button" className="secondary-button" onClick={handleArchive} disabled={isSubmitting}>
              {isSubmitting ? 'Archiving...' : 'Archive quest'}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
