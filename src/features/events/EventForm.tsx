import { FormEvent, useEffect, useState } from 'react';
import { listGroupCategories } from './eventApi';
import type { EventCategory, EventFormInput, EventMode, EventStatus, EventVisibility } from './eventApi';
import { listGroupLocations } from '../groups/groupApi';
import type { GroupLocation, GroupSummary } from '../groups/groupApi';

export type EventFormValues = Omit<EventFormInput, 'ownerId'>;

type EventFormProps = {
  groups: GroupSummary[];
  initialValues?: Partial<EventFormValues>;
  isSubmitting: boolean;
  submitLabel: string;
  onSubmit: (values: EventFormValues) => Promise<void>;
};

const defaultStart = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16);
const defaultEnd = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 16);

function toIsoFromLocal(value: string) {
  return new Date(value).toISOString();
}

function toLocalInputValue(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function EventForm({ groups, initialValues, isSubmitting, onSubmit, submitLabel }: EventFormProps) {
  const [groupId, setGroupId] = useState(initialValues?.groupId ?? groups[0]?.id ?? '');
  const [categories, setCategories] = useState<EventCategory[]>([]);
  const [locations, setLocations] = useState<GroupLocation[]>([]);
  const [categoryId, setCategoryId] = useState(initialValues?.categoryId ?? '');
  const [locationId, setLocationId] = useState(initialValues?.locationId ?? '');
  const [title, setTitle] = useState(initialValues?.title ?? '');
  const [description, setDescription] = useState(initialValues?.description ?? '');
  const [startAt, setStartAt] = useState(toLocalInputValue(initialValues?.startAt) || defaultStart);
  const [endAt, setEndAt] = useState(toLocalInputValue(initialValues?.endAt) || defaultEnd);
  const [timezone, setTimezone] = useState(initialValues?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC');
  const [mode, setMode] = useState<EventMode>(initialValues?.mode ?? 'offline');
  const [locationText, setLocationText] = useState(initialValues?.locationText ?? '');
  const [onlinePlatform, setOnlinePlatform] = useState(initialValues?.onlinePlatform ?? '');
  const [onlineUrl, setOnlineUrl] = useState(initialValues?.onlineUrl ?? '');
  const [onlineInstructions, setOnlineInstructions] = useState(initialValues?.onlineInstructions ?? '');
  const [minimumAttendees, setMinimumAttendees] = useState(String(initialValues?.minimumAttendees ?? 1));
  const [maximumAttendees, setMaximumAttendees] = useState(initialValues?.maximumAttendees ? String(initialValues.maximumAttendees) : '');
  const [visibility, setVisibility] = useState<EventVisibility>(initialValues?.visibility ?? 'private');
  const [status, setStatus] = useState<Exclude<EventStatus, 'archived'>>(initialValues?.status ?? 'open');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadGroupOptions = async () => {
      if (!groupId) {
        setCategories([]);
        setLocations([]);
        return;
      }

      try {
        const [nextCategories, nextLocations] = await Promise.all([listGroupCategories(groupId), listGroupLocations(groupId)]);
        setCategories(nextCategories);
        setLocations(nextLocations);
        setCategoryId((currentCategoryId) => (
          currentCategoryId && nextCategories.some((category) => category.id === currentCategoryId)
            ? currentCategoryId
            : nextCategories[0]?.id ?? ''
        ));
        setLocationId((currentLocationId) => (
          currentLocationId && nextLocations.some((location) => location.id === currentLocationId)
            ? currentLocationId
            : ''
        ));
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Questboard could not load guild options.');
      }
    };

    void loadGroupOptions();
  }, [groupId]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsedMinimum = Number(minimumAttendees);
    const parsedMaximum = maximumAttendees ? Number(maximumAttendees) : null;

    if (!groupId) {
      setErrorMessage('Choose a guild before posting a quest.');
      return;
    }
    if (!title.trim()) {
      setErrorMessage('Give the quest a title.');
      return;
    }
    if (!Number.isInteger(parsedMinimum) || parsedMinimum < 0) {
      setErrorMessage('Minimum attendees must be zero or more.');
      return;
    }
    if (parsedMaximum !== null && (!Number.isInteger(parsedMaximum) || parsedMaximum < parsedMinimum)) {
      setErrorMessage('Maximum attendees must be blank or at least the minimum attendee count.');
      return;
    }
    if (new Date(endAt) < new Date(startAt)) {
      setErrorMessage('End time must be after the start time.');
      return;
    }

    setErrorMessage(null);

    await onSubmit({
      groupId,
      categoryId: categoryId || null,
      locationId: locationId || null,
      title,
      description,
      startAt: toIsoFromLocal(startAt),
      endAt: toIsoFromLocal(endAt),
      timezone,
      mode,
      locationText,
      onlinePlatform,
      onlineUrl,
      onlineInstructions,
      minimumAttendees: parsedMinimum,
      maximumAttendees: parsedMaximum,
      visibility,
      status,
    });
  };

  return (
    <form className="form-card event-form" onSubmit={handleSubmit}>
      {errorMessage && <p className="error-text" role="alert">{errorMessage}</p>}
      <label>
        Guild
        <select value={groupId} onChange={(event) => setGroupId(event.target.value)} required>
          {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
        </select>
      </label>
      <label>
        Category
        <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
          <option value="">Uncategorized</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
      </label>
      <label>
        Title
        <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required />
      </label>
      <label>
        Description
        <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} />
      </label>
      <div className="inline-form two-up">
        <label>
          Starts
          <input type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} required />
        </label>
        <label>
          Ends
          <input type="datetime-local" value={endAt} onChange={(event) => setEndAt(event.target.value)} required />
        </label>
      </div>
      <label>
        Timezone
        <input value={timezone} onChange={(event) => setTimezone(event.target.value)} required />
      </label>
      <div className="inline-form three-up">
        <label>
          Mode
          <select value={mode} onChange={(event) => setMode(event.target.value as EventMode)}>
            <option value="offline">Offline</option>
            <option value="online">Online</option>
            <option value="hybrid">Hybrid</option>
          </select>
        </label>
        <label>
          Visibility
          <select value={visibility} onChange={(event) => setVisibility(event.target.value as EventVisibility)}>
            <option value="private">Private</option>
            <option value="public">Public</option>
          </select>
        </label>
        <label>
          Status
          <select value={status} onChange={(event) => setStatus(event.target.value as Exclude<EventStatus, 'archived'>)}>
            <option value="draft">Draft</option>
            <option value="open">Open</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
      </div>
      <label>
        Saved location
        <select value={locationId} onChange={(event) => setLocationId(event.target.value)}>
          <option value="">One-off location</option>
          {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
        </select>
      </label>
      <label>
        Location notes
        <input value={locationText} onChange={(event) => setLocationText(event.target.value)} placeholder="Room, parking, doorbell, or one-off address" />
      </label>
      <div className="inline-form two-up">
        <label>
          Online platform
          <input value={onlinePlatform} onChange={(event) => setOnlinePlatform(event.target.value)} placeholder="Discord, Roll20, Steam" />
        </label>
        <label>
          Online URL
          <input value={onlineUrl} onChange={(event) => setOnlineUrl(event.target.value)} placeholder="https://..." />
        </label>
      </div>
      <label>
        Online instructions
        <textarea value={onlineInstructions} onChange={(event) => setOnlineInstructions(event.target.value)} rows={3} />
      </label>
      <div className="inline-form two-up">
        <label>
          Minimum attendees
          <input type="number" min="0" step="1" value={minimumAttendees} onChange={(event) => setMinimumAttendees(event.target.value)} />
        </label>
        <label>
          Maximum attendees
          <input type="number" min="1" step="1" value={maximumAttendees} onChange={(event) => setMaximumAttendees(event.target.value)} placeholder="No limit" />
        </label>
      </div>
      <button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : submitLabel}</button>
    </form>
  );
}
