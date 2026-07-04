import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { listUserGroups } from '../groups/groupApi';
import type { GroupSummary } from '../groups/groupApi';
import { EventForm } from './EventForm';
import type { EventFormValues } from './EventForm';
import { archiveEvent, getAttendanceSummary, getEvent, setEventRsvp, updateEvent } from './eventApi';
import type { EventRsvpStatus, QuestEvent } from './eventApi';

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

const rsvpOptions: Array<{ status: EventRsvpStatus; label: string }> = [
  { status: 'attending', label: 'Attending' },
  { status: 'maybe', label: 'Maybe' },
  { status: 'declined', label: 'Declined' },
];

export function EventDetailPage() {
  const { eventId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [event, setEvent] = useState<QuestEvent | null>(null);
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingRsvp, setIsSavingRsvp] = useState(false);
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

  const handleRsvp = async (status: EventRsvpStatus) => {
    if (!eventId || !user) return;

    setIsSavingRsvp(true);
    setErrorMessage(null);

    try {
      await setEventRsvp(eventId, user.id, status);
      setEvent(await getEvent(eventId));
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSavingRsvp(false);
    }
  };

  if (!user) return <Navigate to="/login" replace />;
  if (!eventId) return <Navigate to="/calendar" replace />;

  if (event && !isEditing) {
    const attendance = getAttendanceSummary({
      rsvps: event.event_rsvps,
      minimumAttendees: event.minimum_attendees,
      maximumAttendees: event.maximum_attendees,
      status: event.status,
    });
    const currentUserRsvp = event.event_rsvps.find((rsvp) => rsvp.user_id === user.id)?.status ?? null;
    const attendees = event.event_rsvps.filter((rsvp) => rsvp.status === 'attending');

    return (
      <section className="panel">
        <p className="eyebrow">Event detail</p>
        {errorMessage && <p className="error-text" role="alert">{errorMessage}</p>}
        <h2>{event.title}</h2>
        <dl className="details-list">
          <div><dt>When</dt><dd>{formatDate(event.start_at, event.timezone)} - {formatDate(event.end_at, event.timezone)}</dd></div>
          <div><dt>Category</dt><dd>{event.categories?.name ?? 'Uncategorized'}</dd></div>
          <div><dt>Mode</dt><dd>{event.mode}</dd></div>
          <div><dt>Status</dt><dd>{event.status}</dd></div>
          <div><dt>Attendance</dt><dd>{attendance.label}</dd></div>
          <div><dt>Location</dt><dd>{event.location_text ?? 'No location details yet.'}</dd></div>
          <div><dt>Online</dt><dd>{event.online_details.platform || event.online_details.url || event.online_details.instructions || 'No online details yet.'}</dd></div>
          <div><dt>Description</dt><dd>{event.description ?? 'No description yet.'}</dd></div>
        </dl>

        <section className="rsvp-panel" aria-labelledby="rsvp-heading">
          <div>
            <p className="eyebrow">RSVP</p>
            <h3 id="rsvp-heading">Attendance</h3>
            <p className="hint">
              {attendance.attendingCount} attending, {attendance.maybeCount} maybe, {attendance.declinedCount} declined.
            </p>
          </div>
          <div className="rsvp-actions" aria-label="Choose your RSVP">
            {rsvpOptions.map((option) => (
              <button
                type="button"
                className={currentUserRsvp === option.status ? 'is-selected' : undefined}
                disabled={isSavingRsvp || (option.status === 'attending' && attendance.isFull && currentUserRsvp !== 'attending')}
                key={option.status}
                onClick={() => void handleRsvp(option.status)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="attendee-list" aria-label="Attending members">
            {attendees.length ? attendees.map((rsvp) => (
              <span key={rsvp.id}>{rsvp.profiles?.display_name ?? 'Unknown member'}</span>
            )) : <span>No confirmed attendees yet.</span>}
          </div>
        </section>

        <div className="button-row">
          <button type="button" onClick={() => setIsEditing(true)}>Edit quest</button>
          <button type="button" className="secondary-button" onClick={handleArchive} disabled={isSubmitting}>
            {isSubmitting ? 'Archiving...' : 'Archive quest'}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="panel">
      <p className="eyebrow">Event detail</p>
      {errorMessage && <p className="error-text" role="alert">{errorMessage}</p>}
      {isLoading ? (
        <p className="hint">Loading quest details...</p>
      ) : !event ? (
        <p className="hint">Quest not found.</p>
      ) : (
        <>
          <h2>Edit quest</h2>
          <EventForm groups={groups} initialValues={toFormValues(event)} isSubmitting={isSubmitting} submitLabel="Save quest" onSubmit={handleUpdate} />
        </>
      )}
    </section>
  );
}
