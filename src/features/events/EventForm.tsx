import { FormEvent, useEffect, useState } from 'react';
import { listGroupLocations } from '../groups/groupApi';
import type { GroupLocation, GroupSummary } from '../groups/groupApi';
import { useLanguage } from '../i18n/LanguageContext';
import { listGroupCategories } from './eventApi';
import type { EventCategory, EventFormInput, EventMode, EventStatus, EventVisibility } from './eventApi';

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
  const { t } = useLanguage();
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
        setErrorMessage(error instanceof Error ? error.message : t('form.loadOptionsError'));
      }
    };

    void loadGroupOptions();
  }, [groupId, t]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsedMinimum = Number(minimumAttendees);
    const parsedMaximum = maximumAttendees ? Number(maximumAttendees) : null;

    if (!groupId) {
      setErrorMessage(t('form.chooseGuildError'));
      return;
    }
    if (!title.trim()) {
      setErrorMessage(t('form.titleError'));
      return;
    }
    if (!Number.isInteger(parsedMinimum) || parsedMinimum < 0) {
      setErrorMessage(t('form.minError'));
      return;
    }
    if (parsedMaximum !== null && (!Number.isInteger(parsedMaximum) || parsedMaximum < parsedMinimum)) {
      setErrorMessage(t('form.maxError'));
      return;
    }
    if (new Date(endAt) < new Date(startAt)) {
      setErrorMessage(t('form.endError'));
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
        {t('form.guild')}
        <select value={groupId} onChange={(event) => setGroupId(event.target.value)} required>
          {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
        </select>
      </label>
      <label>
        {t('form.category')}
        <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
          <option value="">{t('event.uncategorized')}</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
      </label>
      <label>
        {t('form.title')}
        <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required />
      </label>
      <label>
        {t('form.description')}
        <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} />
      </label>
      <div className="inline-form two-up">
        <label>
          {t('form.starts')}
          <input type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} required />
        </label>
        <label>
          {t('form.ends')}
          <input type="datetime-local" value={endAt} onChange={(event) => setEndAt(event.target.value)} required />
        </label>
      </div>
      <label>
        {t('form.timezone')}
        <input value={timezone} onChange={(event) => setTimezone(event.target.value)} required />
      </label>
      <div className="inline-form three-up">
        <label>
          {t('form.mode')}
          <select value={mode} onChange={(event) => setMode(event.target.value as EventMode)}>
            <option value="offline">{t('mode.offline')}</option>
            <option value="online">{t('mode.online')}</option>
            <option value="hybrid">{t('mode.hybrid')}</option>
          </select>
        </label>
        <label>
          {t('form.visibility')}
          <select value={visibility} onChange={(event) => setVisibility(event.target.value as EventVisibility)}>
            <option value="private">{t('visibility.private')}</option>
            <option value="public">{t('visibility.public')}</option>
          </select>
        </label>
        <label>
          {t('form.status')}
          <select value={status} onChange={(event) => setStatus(event.target.value as Exclude<EventStatus, 'archived'>)}>
            <option value="draft">{t('status.draft')}</option>
            <option value="open">{t('status.open')}</option>
            <option value="confirmed">{t('status.confirmed')}</option>
            <option value="cancelled">{t('status.cancelled')}</option>
          </select>
        </label>
      </div>
      <label>
        {t('form.savedLocation')}
        <select value={locationId} onChange={(event) => setLocationId(event.target.value)}>
          <option value="">{t('form.oneOffLocation')}</option>
          {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
        </select>
      </label>
      <label>
        {t('form.locationNotes')}
        <input value={locationText} onChange={(event) => setLocationText(event.target.value)} placeholder={t('form.locationPlaceholder')} />
      </label>
      <div className="inline-form two-up">
        <label>
          {t('form.onlinePlatform')}
          <input value={onlinePlatform} onChange={(event) => setOnlinePlatform(event.target.value)} placeholder={t('form.onlinePlatformPlaceholder')} />
        </label>
        <label>
          {t('form.onlineUrl')}
          <input value={onlineUrl} onChange={(event) => setOnlineUrl(event.target.value)} placeholder="https://..." />
        </label>
      </div>
      <label>
        {t('form.onlineInstructions')}
        <textarea value={onlineInstructions} onChange={(event) => setOnlineInstructions(event.target.value)} rows={3} />
      </label>
      <div className="inline-form two-up">
        <label>
          {t('form.minAttendees')}
          <input type="number" min="0" step="1" value={minimumAttendees} onChange={(event) => setMinimumAttendees(event.target.value)} />
        </label>
        <label>
          {t('form.maxAttendees')}
          <input type="number" min="1" step="1" value={maximumAttendees} onChange={(event) => setMaximumAttendees(event.target.value)} placeholder={t('form.noLimit')} />
        </label>
      </div>
      <button type="submit" disabled={isSubmitting}>{isSubmitting ? t('form.saving') : submitLabel}</button>
    </form>
  );
}
