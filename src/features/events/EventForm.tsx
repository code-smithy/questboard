import { FormEvent, useEffect, useState } from 'react';
import { listGroupLocations } from '../groups/groupApi';
import type { GroupLocation, GroupSummary } from '../groups/groupApi';
import { useLanguage } from '../i18n/LanguageContext';
import { listGroupCategories } from './eventApi';
import type { EventCategory, EventFormInput, EventMode, EventStatus, EventVisibility } from './eventApi';
import {
  buildRecurrenceRule,
  getMonthDay,
  getOrdinalWeekday,
  getWeekdayCode,
  parseRecurrenceRule,
  recurrenceOrdinalOptions,
  recurrenceWeekdays,
} from './recurrence';
import type { RecurrenceFrequency, RecurrenceOrdinal, RecurrenceWeekday } from './recurrence';
import type { RecurrenceEndMode } from './recurrence';

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
  const initialStartAt = toLocalInputValue(initialValues?.startAt) || defaultStart;
  const initialRecurrence = parseRecurrenceRule(initialValues?.recurrenceRule);
  const initialOrdinalWeekday = getOrdinalWeekday(initialStartAt);
  const [groupId, setGroupId] = useState(initialValues?.groupId ?? groups[0]?.id ?? '');
  const [categories, setCategories] = useState<EventCategory[]>([]);
  const [locations, setLocations] = useState<GroupLocation[]>([]);
  const [categoryId, setCategoryId] = useState(initialValues?.categoryId ?? '');
  const [locationId, setLocationId] = useState(initialValues?.locationId ?? '');
  const [title, setTitle] = useState(initialValues?.title ?? '');
  const [description, setDescription] = useState(initialValues?.description ?? '');
  const [startAt, setStartAt] = useState(initialStartAt);
  const [endAt, setEndAt] = useState(toLocalInputValue(initialValues?.endAt) || defaultEnd);
  const [timezone, setTimezone] = useState(initialValues?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC');
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<RecurrenceFrequency>(initialRecurrence.frequency);
  const [recurrenceInterval, setRecurrenceInterval] = useState(String(initialRecurrence.interval));
  const [recurrenceWeekdaySelections, setRecurrenceWeekdaySelections] = useState<RecurrenceWeekday[]>(
    initialRecurrence.weekdays.length ? initialRecurrence.weekdays : [getWeekdayCode(initialStartAt)],
  );
  const [recurrenceMonthDay, setRecurrenceMonthDay] = useState(String(initialRecurrence.monthDay || getMonthDay(initialStartAt)));
  const [recurrenceOrdinal, setRecurrenceOrdinal] = useState<RecurrenceOrdinal>(
    initialRecurrence.ordinal === '1' && initialRecurrence.frequency === 'none' ? initialOrdinalWeekday.ordinal : initialRecurrence.ordinal,
  );
  const [recurrenceWeekday, setRecurrenceWeekday] = useState<RecurrenceWeekday>(
    initialRecurrence.frequency === 'none' ? initialOrdinalWeekday.weekday : initialRecurrence.weekday,
  );
  const [recurrenceEndMode, setRecurrenceEndMode] = useState<RecurrenceEndMode>(initialRecurrence.endMode);
  const [recurrenceUntil, setRecurrenceUntil] = useState(initialRecurrence.until);
  const [recurrenceCount, setRecurrenceCount] = useState(String(initialRecurrence.count));
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

  const handleRecurrenceFrequencyChange = (nextFrequency: RecurrenceFrequency) => {
    setRecurrenceFrequency(nextFrequency);

    if (nextFrequency === 'weekly' && recurrenceWeekdaySelections.length === 0) {
      setRecurrenceWeekdaySelections([getWeekdayCode(startAt)]);
    }
    if (nextFrequency === 'monthly-date' && !recurrenceMonthDay) {
      setRecurrenceMonthDay(String(getMonthDay(startAt)));
    }
    if (nextFrequency === 'monthly-weekday') {
      const ordinalWeekday = getOrdinalWeekday(startAt);
      setRecurrenceOrdinal((currentOrdinal) => currentOrdinal || ordinalWeekday.ordinal);
      setRecurrenceWeekday((currentWeekday) => currentWeekday || ordinalWeekday.weekday);
    }
  };

  const handleRecurrenceWeekdayChange = (weekday: RecurrenceWeekday, isChecked: boolean) => {
    setRecurrenceWeekdaySelections((currentWeekdays) => (
      isChecked
        ? Array.from(new Set([...currentWeekdays, weekday]))
        : currentWeekdays.filter((currentWeekday) => currentWeekday !== weekday)
    ));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsedMinimum = Number(minimumAttendees);
    const parsedMaximum = maximumAttendees ? Number(maximumAttendees) : null;
    const parsedRecurrenceInterval = Number(recurrenceInterval);
    const parsedRecurrenceMonthDay = Number(recurrenceMonthDay);
    const parsedRecurrenceCount = Number(recurrenceCount);

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
    if (
      recurrenceFrequency !== 'none'
      && (!Number.isInteger(parsedRecurrenceInterval) || parsedRecurrenceInterval < 1)
    ) {
      setErrorMessage(t('form.recurrenceError'));
      return;
    }
    if (recurrenceFrequency === 'weekly' && recurrenceWeekdaySelections.length === 0) {
      setErrorMessage(t('form.recurrenceWeekdayError'));
      return;
    }
    if (
      recurrenceFrequency === 'monthly-date'
      && (!Number.isInteger(parsedRecurrenceMonthDay) || parsedRecurrenceMonthDay < 1 || parsedRecurrenceMonthDay > 31)
    ) {
      setErrorMessage(t('form.recurrenceMonthDayError'));
      return;
    }
    if (
      recurrenceFrequency !== 'none'
      && recurrenceEndMode === 'after-count'
      && (!Number.isInteger(parsedRecurrenceCount) || parsedRecurrenceCount < 2)
    ) {
      setErrorMessage(t('form.recurrenceCountError'));
      return;
    }
    if (
      recurrenceFrequency !== 'none'
      && recurrenceEndMode === 'on-date'
      && (!recurrenceUntil || new Date(`${recurrenceUntil}T23:59:59`) < new Date(startAt))
    ) {
      setErrorMessage(t('form.recurrenceUntilError'));
      return;
    }

    setErrorMessage(null);

    const recurrenceRule = buildRecurrenceRule({
      frequency: recurrenceFrequency,
      interval: parsedRecurrenceInterval || 1,
      weekdays: recurrenceWeekdaySelections,
      monthDay: parsedRecurrenceMonthDay || 1,
      ordinal: recurrenceOrdinal,
      weekday: recurrenceWeekday,
      endMode: recurrenceEndMode,
      until: recurrenceUntil,
      count: parsedRecurrenceCount || 2,
    });

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
      recurrenceRule,
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
      <fieldset className="recurrence-fieldset">
        <legend>{t('form.recurrence')}</legend>
        <label>
          {t('form.recurrencePattern')}
          <select value={recurrenceFrequency} onChange={(event) => handleRecurrenceFrequencyChange(event.target.value as RecurrenceFrequency)}>
            <option value="none">{t('recurrence.none')}</option>
            <option value="weekly">{t('recurrence.weekly')}</option>
            <option value="monthly-date">{t('recurrence.monthlyDate')}</option>
            <option value="monthly-weekday">{t('recurrence.monthlyWeekday')}</option>
          </select>
        </label>
        {recurrenceFrequency === 'weekly' && (
          <>
            <label>
              {t('form.recurrenceIntervalWeeks')}
              <input type="number" min="1" step="1" value={recurrenceInterval} onChange={(event) => setRecurrenceInterval(event.target.value)} />
            </label>
            <fieldset className="checkbox-fieldset">
              <legend>{t('form.recurrenceWeekdays')}</legend>
              <div className="weekday-grid">
                {recurrenceWeekdays.map((weekday) => (
                  <label key={weekday}>
                    <input
                      type="checkbox"
                      checked={recurrenceWeekdaySelections.includes(weekday)}
                      onChange={(event) => handleRecurrenceWeekdayChange(weekday, event.target.checked)}
                    />
                    <span>{t(`weekday.${weekday}`)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </>
        )}
        {recurrenceFrequency === 'monthly-date' && (
          <div className="inline-form two-up">
            <label>
              {t('form.recurrenceIntervalMonths')}
              <input type="number" min="1" step="1" value={recurrenceInterval} onChange={(event) => setRecurrenceInterval(event.target.value)} />
            </label>
            <label>
              {t('form.recurrenceMonthDay')}
              <input type="number" min="1" max="31" step="1" value={recurrenceMonthDay} onChange={(event) => setRecurrenceMonthDay(event.target.value)} />
            </label>
          </div>
        )}
        {recurrenceFrequency === 'monthly-weekday' && (
          <>
            <label>
              {t('form.recurrenceIntervalMonths')}
              <input type="number" min="1" step="1" value={recurrenceInterval} onChange={(event) => setRecurrenceInterval(event.target.value)} />
            </label>
            <div className="inline-form two-up">
              <label>
                {t('form.recurrenceOrdinal')}
                <select value={recurrenceOrdinal} onChange={(event) => setRecurrenceOrdinal(event.target.value as RecurrenceOrdinal)}>
                  {recurrenceOrdinalOptions.map((ordinal) => (
                    <option key={ordinal} value={ordinal}>{t(`ordinal.${ordinal}`)}</option>
                  ))}
                </select>
              </label>
              <label>
                {t('form.recurrenceWeekday')}
                <select value={recurrenceWeekday} onChange={(event) => setRecurrenceWeekday(event.target.value as RecurrenceWeekday)}>
                  {recurrenceWeekdays.map((weekday) => (
                    <option key={weekday} value={weekday}>{t(`weekday.${weekday}`)}</option>
                  ))}
                </select>
              </label>
            </div>
          </>
        )}
        {recurrenceFrequency !== 'none' && (
          <>
            <label>
              {t('form.recurrenceEnds')}
              <select value={recurrenceEndMode} onChange={(event) => setRecurrenceEndMode(event.target.value as RecurrenceEndMode)}>
                <option value="rolling">{t('recurrence.end.rolling')}</option>
                <option value="on-date">{t('recurrence.end.onDate')}</option>
                <option value="after-count">{t('recurrence.end.afterCount')}</option>
              </select>
            </label>
            {recurrenceEndMode === 'on-date' && (
              <label>
                {t('form.recurrenceUntil')}
                <input type="date" value={recurrenceUntil} onChange={(event) => setRecurrenceUntil(event.target.value)} />
              </label>
            )}
            {recurrenceEndMode === 'after-count' && (
              <label>
                {t('form.recurrenceCount')}
                <input type="number" min="2" max="100" step="1" value={recurrenceCount} onChange={(event) => setRecurrenceCount(event.target.value)} />
              </label>
            )}
            {recurrenceEndMode === 'rolling' && <p className="hint">{t('form.recurrenceRollingHint')}</p>}
          </>
        )}
      </fieldset>
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
