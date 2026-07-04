import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { listUserGroups } from '../groups/groupApi';
import type { GroupSummary } from '../groups/groupApi';
import { formatAttendanceLabel, useLanguage } from '../i18n/LanguageContext';
import { EventForm } from './EventForm';
import type { EventFormValues } from './EventForm';
import { addEventComment, archiveEvent, archiveEventComment, buildEventIcs, getAttendanceSummary, getEvent, recordEventHistory, replaceInAppReminder, setEventRsvp, updateEvent } from './eventApi';
import type { EventRsvpStatus, QuestEvent } from './eventApi';
import { formatRecurrenceRule } from './recurrence';

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function formatDate(value: string, timezone: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: timezone || undefined }).format(new Date(value));
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
    recurrenceRule: event.recurrence_rule,
  };
}

const rsvpOptions: Array<{ status: EventRsvpStatus; labelKey: 'rsvp.attending' | 'rsvp.maybe' | 'rsvp.declined' }> = [
  { status: 'attending', labelKey: 'rsvp.attending' },
  { status: 'maybe', labelKey: 'rsvp.maybe' },
  { status: 'declined', labelKey: 'rsvp.declined' },
];

const reminderOptions: Array<{ minutes: number | null; labelKey: 'reminder.none' | 'reminder.15' | 'reminder.60' | 'reminder.1440' }> = [
  { minutes: null, labelKey: 'reminder.none' },
  { minutes: 15, labelKey: 'reminder.15' },
  { minutes: 60, labelKey: 'reminder.60' },
  { minutes: 1440, labelKey: 'reminder.1440' },
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
    recurrence_rule: values.recurrenceRule,
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
    recurrence_rule: event.recurrence_rule,
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
  const { locale, t } = useLanguage();
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
        setErrorMessage(getErrorMessage(error, t('event.loadError')));
      } finally {
        setIsLoading(false);
      }
    };

    void loadEvent();
  }, [eventId, t, user]);

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
      setErrorMessage(getErrorMessage(error, t('event.loadError')));
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
      setErrorMessage(getErrorMessage(error, t('event.loadError')));
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
      setErrorMessage(getErrorMessage(error, t('event.loadError')));
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
      setErrorMessage(getErrorMessage(error, t('event.loadError')));
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
      setErrorMessage(getErrorMessage(error, t('event.loadError')));
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
      setErrorMessage(getErrorMessage(error, t('event.loadError')));
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
        <p className="eyebrow">{t('event.detailEyebrow')}</p>
        {errorMessage && <p className="error-text" role="alert">{errorMessage}</p>}
        <h2>{event.title}</h2>
        <dl className="details-list">
          <div><dt>{t('event.when')}</dt><dd>{formatDate(event.start_at, event.timezone, locale)} - {formatDate(event.end_at, event.timezone, locale)}</dd></div>
          {event.recurrence_rule && <div><dt>{t('event.recurrence')}</dt><dd>{formatRecurrenceRule(t, event.recurrence_rule)}</dd></div>}
          <div><dt>{t('event.category')}</dt><dd>{event.categories?.name ?? t('event.uncategorized')}</dd></div>
          <div><dt>{t('event.mode')}</dt><dd>{t(`mode.${event.mode}`)}</dd></div>
          <div><dt>{t('event.status')}</dt><dd>{t(`status.${event.status}`)}</dd></div>
          <div>
            <dt>{t('event.attendance')}</dt>
            <dd>{formatAttendanceLabel(t, { ...attendance, maximumAttendees: event.maximum_attendees, status: event.status })}</dd>
          </div>
          <div>
            <dt>{t('event.location')}</dt>
            <dd>
              {event.locations ? (
                <span className="location-detail">
                  <strong>{event.locations.name}</strong>
                  {event.locations.address && <span>{event.locations.address}</span>}
                  {event.location_text && <span>{event.location_text}</span>}
                  {event.locations.notes && <span>{event.locations.notes}</span>}
                  {locationMapHref && <a href={locationMapHref} target="_blank" rel="noreferrer">{t('event.openMap')}</a>}
                </span>
              ) : event.location_text ?? t('event.noLocation')}
            </dd>
          </div>
          <div><dt>{t('event.online')}</dt><dd>{event.online_details.platform || event.online_details.url || event.online_details.instructions || t('event.noOnline')}</dd></div>
          <div><dt>{t('event.description')}</dt><dd>{event.description ?? t('event.noDescription')}</dd></div>
        </dl>

        <section className="rsvp-panel" aria-labelledby="rsvp-heading">
          <div>
            <p className="eyebrow">{t('event.rsvpEyebrow')}</p>
            <h3 id="rsvp-heading">{t('event.rsvpTitle')}</h3>
            <p className="hint">
              {t('event.rsvpSummary', { attending: attendance.attendingCount, maybe: attendance.maybeCount, declined: attendance.declinedCount })}
            </p>
          </div>
          <div className="rsvp-actions" aria-label={t('event.chooseRsvp')}>
            {rsvpOptions.map((option) => (
              <button
                type="button"
                className={currentUserRsvp === option.status ? 'is-selected' : undefined}
                disabled={isSavingRsvp || (option.status === 'attending' && attendance.isFull && currentUserRsvp !== 'attending')}
                key={option.status}
                onClick={() => void handleRsvp(option.status)}
              >
                {t(option.labelKey)}
              </button>
            ))}
          </div>
          <div className="attendee-list" aria-label={t('event.attendingMembers')}>
            {attendees.length ? attendees.map((rsvp) => (
              <span key={rsvp.id}>{rsvp.profiles?.display_name ?? t('event.unknownMember')}</span>
            )) : <span>{t('event.noAttendees')}</span>}
          </div>
        </section>

        <section className="reminder-panel" aria-labelledby="reminder-heading">
          <div>
            <p className="eyebrow">{t('event.reminderEyebrow')}</p>
            <h3 id="reminder-heading">{t('event.reminderTitle')}</h3>
          </div>
          <label>
            {t('event.remindMe')}
            <select
              value={currentReminderOffset ?? 'none'}
              disabled={isSavingReminder}
              onChange={(event) => {
                const value = event.target.value;
                void handleReminderChange(value === 'none' ? null : Number(value));
              }}
            >
              {reminderOptions.map((option) => (
                <option key={option.minutes ?? 'none'} value={option.minutes ?? 'none'}>{t(option.labelKey)}</option>
              ))}
            </select>
          </label>
        </section>

        <section className="discussion-panel" aria-labelledby="comments-heading">
          <div>
            <p className="eyebrow">{t('event.discussion')}</p>
            <h3 id="comments-heading">{t('event.comments')}</h3>
          </div>
          <div className="comment-list">
            {event.event_comments.length ? event.event_comments.map((comment) => {
              const canArchiveComment = comment.user_id === user.id || canModerateComments;

              return (
                <article className="comment-item" key={comment.id}>
                  <div>
                    <strong>{comment.profiles?.display_name ?? t('event.unknownMember')}</strong>
                    <time dateTime={comment.created_at}>{formatDate(comment.created_at, event.timezone, locale)}</time>
                  </div>
                  <p>{comment.body}</p>
                  {canArchiveComment && (
                    <button type="button" className="secondary-button" onClick={() => void handleArchiveComment(comment.id)}>
                      {t('event.archiveComment')}
                    </button>
                  )}
                </article>
              );
            }) : <p className="hint">{t('event.noComments')}</p>}
          </div>
          <label>
            {t('event.addComment')}
            <textarea value={commentBody} onChange={(event) => setCommentBody(event.target.value)} rows={3} />
          </label>
          <button type="button" disabled={isPostingComment} onClick={() => void handleAddComment()}>
            {isPostingComment ? t('event.posting') : t('event.postComment')}
          </button>
        </section>

        <section className="history-panel" aria-labelledby="history-heading">
          <div>
            <p className="eyebrow">{t('event.history')}</p>
            <h3 id="history-heading">{t('event.changes')}</h3>
          </div>
          {event.event_history.length ? (
            <ol className="history-list">
              {event.event_history.map((entry) => (
                <li key={entry.id}>
                  <span>{formatHistoryLabel(entry.change_type)}</span>
                  <small>
                    {entry.profiles?.display_name ?? t('event.system')} - {formatDate(entry.created_at, event.timezone, locale)}
                  </small>
                </li>
              ))}
            </ol>
          ) : <p className="hint">{t('event.noChanges')}</p>}
        </section>

        <div className="button-row">
          <button type="button" onClick={() => setIsEditing(true)}>{t('event.editQuest')}</button>
          <button type="button" className="secondary-button" onClick={handleDownloadIcs}>{t('event.downloadIcs')}</button>
          <button type="button" className="secondary-button" onClick={handleArchive} disabled={isSubmitting}>
            {isSubmitting ? t('event.archiving') : t('event.archiveQuest')}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="panel">
      <p className="eyebrow">{t('event.detailEyebrow')}</p>
      {errorMessage && <p className="error-text" role="alert">{errorMessage}</p>}
      {isLoading ? (
        <p className="hint">{t('event.loadingDetails')}</p>
      ) : !event ? (
        <p className="hint">{t('event.notFound')}</p>
      ) : (
        <>
          <h2>{t('event.editTitle')}</h2>
          <EventForm groups={groups} initialValues={toFormValues(event)} isSubmitting={isSubmitting} submitLabel={t('event.saveQuest')} onSubmit={handleUpdate} />
        </>
      )}
    </section>
  );
}
