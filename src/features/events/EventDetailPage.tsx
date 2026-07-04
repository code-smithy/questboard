import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { listUserGroups } from '../groups/groupApi';
import type { GroupSummary } from '../groups/groupApi';
import { EventForm } from './EventForm';
import type { EventFormValues } from './EventForm';
import { addEventComment, archiveEvent, archiveEventComment, buildEventIcs, getAttendanceSummary, getEvent, recordEventHistory, replaceInAppReminder, setEventRsvp, updateEvent } from './eventApi';
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
    locationId: event.location_id,
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

const reminderOptions: Array<{ minutes: number | null; label: string }> = [
  { minutes: null, label: 'No reminder' },
  { minutes: 15, label: '15 minutes before' },
  { minutes: 60, label: '1 hour before' },
  { minutes: 1440, label: '1 day before' },
];

function toHistoryValues(values: EventFormValues) {
  return {
    group_id: values.groupId,
    category_id: values.categoryId,
    location_id: values.locationId,
    title: values.title.trim(),
    description: values.description.trim() || null,
    start_at: values.startAt,
    end_at: values.endAt,
    timezone: values.timezone.trim() || 'UTC',
    mode: values.mode,
    location_text: values.locationText.trim() || null,
    online_details: {
      platform: values.onlinePlatform.trim() || null,
      url: values.onlineUrl.trim() || null,
      instructions: values.onlineInstructions.trim() || null,
    },
    minimum_attendees: values.minimumAttendees,
    maximum_attendees: values.maximumAttendees,
    visibility: values.visibility,
    status: values.status,
  };
}

function toEventHistoryValues(event: QuestEvent) {
  return {
    group_id: event.group_id,
    category_id: event.category_id,
    location_id: event.location_id,
    title: event.title,
    description: event.description,
    start_at: event.start_at,
    end_at: event.end_at,
    timezone: event.timezone,
    mode: event.mode,
    location_text: event.location_text,
    online_details: event.online_details,
    minimum_attendees: event.minimum_attendees,
    maximum_attendees: event.maximum_attendees,
    visibility: event.visibility,
    status: event.status,
  };
}

function getChangedValues(oldValue: Record<string, unknown>, newValue: Record<string, unknown>) {
  const oldChanges: Record<string, unknown> = {};
  const newChanges: Record<string, unknown> = {};

  Object.entries(newValue).forEach(([key, value]) => {
    if (JSON.stringify(oldValue[key]) !== JSON.stringify(value)) {
      oldChanges[key] = oldValue[key];
      newChanges[key] = value;
    }
  });

  return Object.keys(newChanges).length ? { oldChanges, newChanges } : null;
}

function formatHistoryLabel(changeType: string) {
  return changeType.replace(/_/g, ' ');
}

function getLocationMapHref(event: QuestEvent) {
  if (event.locations?.map_url) return event.locations.map_url;
  if (event.locations?.latitude !== null && event.locations?.longitude !== null && event.locations?.latitude !== undefined && event.locations?.longitude !== undefined) {
    return `geo:${event.locations.latitude},${event.locations.longitude}`;
  }
  if (event.locations?.address) return `https://www.openstreetmap.org/search?query=${encodeURIComponent(event.locations.address)}`;
  return null;
}

function getReminderOffsetMinutes(event: QuestEvent, userId: string) {
  const reminder = event.event_reminders.find((item) => item.user_id === userId && item.method === 'in_app' && !item.is_sent);
  if (!reminder) return null;

  const offset = Math.round((new Date(event.start_at).getTime() - new Date(reminder.remind_at).getTime()) / 60_000);
  return reminderOptions.some((option) => option.minutes === offset) ? offset : null;
}

function getIcsFilename(event: QuestEvent) {
  const slug = event.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'quest';
  return `${slug}.ics`;
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
  const [isSavingRsvp, setIsSavingRsvp] = useState(false);
  const [isSavingReminder, setIsSavingReminder] = useState(false);
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [commentBody, setCommentBody] = useState('');
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
      const currentEvent = event;
      const changes = currentEvent ? getChangedValues(toEventHistoryValues(currentEvent), toHistoryValues(values)) : null;
      await updateEvent(eventId, { ...values, ownerId: user.id });
      if (changes) {
        await recordEventHistory({
          eventId,
          changedBy: user.id,
          changeType: 'event_updated',
          oldValue: changes.oldChanges,
          newValue: changes.newChanges,
        });
      }
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
      await recordEventHistory({
        eventId,
        changedBy: user?.id ?? null,
        changeType: 'event_archived',
        oldValue: event ? { status: event.status, archived_at: event.archived_at } : null,
        newValue: { status: 'archived' },
      });
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
      const previousStatus = event?.event_rsvps.find((rsvp) => rsvp.user_id === user.id)?.status ?? null;
      await setEventRsvp(eventId, user.id, status);
      await recordEventHistory({
        eventId,
        changedBy: user.id,
        changeType: 'rsvp_updated',
        oldValue: { status: previousStatus },
        newValue: { status },
      });
      setEvent(await getEvent(eventId));
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSavingRsvp(false);
    }
  };

  const handleAddComment = async () => {
    if (!eventId || !user) return;

    setIsPostingComment(true);
    setErrorMessage(null);

    try {
      await addEventComment(eventId, user.id, commentBody);
      await recordEventHistory({
        eventId,
        changedBy: user.id,
        changeType: 'comment_added',
        newValue: { body: commentBody.trim() },
      });
      setCommentBody('');
      setEvent(await getEvent(eventId));
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsPostingComment(false);
    }
  };

  const handleArchiveComment = async (commentId: string) => {
    if (!eventId || !user) return;

    setErrorMessage(null);

    try {
      await archiveEventComment(commentId);
      await recordEventHistory({
        eventId,
        changedBy: user.id,
        changeType: 'comment_archived',
        newValue: { comment_id: commentId },
      });
      setEvent(await getEvent(eventId));
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  };

  const handleReminderChange = async (offsetMinutes: number | null) => {
    if (!eventId || !user || !event) return;

    setIsSavingReminder(true);
    setErrorMessage(null);

    try {
      await replaceInAppReminder(eventId, user.id, event.start_at, offsetMinutes);
      setEvent(await getEvent(eventId));
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSavingReminder(false);
    }
  };

  const handleDownloadIcs = () => {
    if (!event) return;

    const blob = new Blob([buildEventIcs(event)], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = getIcsFilename(event);
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
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
    const currentReminderOffset = getReminderOffsetMinutes(event, user.id);
    const attendees = event.event_rsvps.filter((rsvp) => rsvp.status === 'attending');
    const currentGroup = groups.find((group) => group.id === event.group_id);
    const canModerateComments = currentGroup?.role === 'group_admin';
    const locationMapHref = getLocationMapHref(event);

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
          <div>
            <dt>Location</dt>
            <dd>
              {event.locations ? (
                <span className="location-detail">
                  <strong>{event.locations.name}</strong>
                  {event.locations.address && <span>{event.locations.address}</span>}
                  {event.location_text && <span>{event.location_text}</span>}
                  {event.locations.notes && <span>{event.locations.notes}</span>}
                  {locationMapHref && <a href={locationMapHref} target="_blank" rel="noreferrer">Open map link</a>}
                </span>
              ) : event.location_text ?? 'No location details yet.'}
            </dd>
          </div>
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

        <section className="reminder-panel" aria-labelledby="reminder-heading">
          <div>
            <p className="eyebrow">Reminder</p>
            <h3 id="reminder-heading">In-app reminder</h3>
          </div>
          <label>
            Remind me
            <select
              value={currentReminderOffset ?? 'none'}
              disabled={isSavingReminder}
              onChange={(event) => {
                const value = event.target.value;
                void handleReminderChange(value === 'none' ? null : Number(value));
              }}
            >
              {reminderOptions.map((option) => (
                <option key={option.minutes ?? 'none'} value={option.minutes ?? 'none'}>{option.label}</option>
              ))}
            </select>
          </label>
        </section>

        <section className="discussion-panel" aria-labelledby="comments-heading">
          <div>
            <p className="eyebrow">Discussion</p>
            <h3 id="comments-heading">Comments</h3>
          </div>
          <div className="comment-list">
            {event.event_comments.length ? event.event_comments.map((comment) => {
              const canArchiveComment = comment.user_id === user.id || canModerateComments;

              return (
                <article className="comment-item" key={comment.id}>
                  <div>
                    <strong>{comment.profiles?.display_name ?? 'Unknown member'}</strong>
                    <time dateTime={comment.created_at}>{formatDate(comment.created_at, event.timezone)}</time>
                  </div>
                  <p>{comment.body}</p>
                  {canArchiveComment && (
                    <button type="button" className="secondary-button" onClick={() => void handleArchiveComment(comment.id)}>
                      Archive comment
                    </button>
                  )}
                </article>
              );
            }) : <p className="hint">No comments yet.</p>}
          </div>
          <label>
            Add comment
            <textarea value={commentBody} onChange={(event) => setCommentBody(event.target.value)} rows={3} />
          </label>
          <button type="button" disabled={isPostingComment} onClick={() => void handleAddComment()}>
            {isPostingComment ? 'Posting...' : 'Post comment'}
          </button>
        </section>

        <section className="history-panel" aria-labelledby="history-heading">
          <div>
            <p className="eyebrow">History</p>
            <h3 id="history-heading">Event changes</h3>
          </div>
          {event.event_history.length ? (
            <ol className="history-list">
              {event.event_history.map((entry) => (
                <li key={entry.id}>
                  <span>{formatHistoryLabel(entry.change_type)}</span>
                  <small>
                    {entry.profiles?.display_name ?? 'System'} - {formatDate(entry.created_at, event.timezone)}
                  </small>
                </li>
              ))}
            </ol>
          ) : <p className="hint">No changes recorded yet.</p>}
        </section>

        <div className="button-row">
          <button type="button" onClick={() => setIsEditing(true)}>Edit quest</button>
          <button type="button" className="secondary-button" onClick={handleDownloadIcs}>Download .ics</button>
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
