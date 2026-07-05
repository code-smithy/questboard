import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { getBrowserTimezone, getTimezoneOptions, normalizeTimezone } from '../../lib/timezones';
import { useAuth } from '../auth/AuthContext';
import { languageOptions, useLanguage } from '../i18n/LanguageContext';
import type { Language } from '../i18n/LanguageContext';
import { useReminders } from '../reminders/ReminderContext';
import { updateOwnProfileDefaultEventDuration, updateOwnProfileDisplayName, updateOwnProfileTimezone } from './profileApi';

export function ProfilePage() {
  const { profile, refreshProfile, user } = useAuth();
  const { language, locale, setLanguage, t } = useLanguage();
  const { browserNotificationsEnabled, notificationPermission, setBrowserNotificationsEnabled } = useReminders();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [defaultEventDurationHours, setDefaultEventDurationHours] = useState(String(profile?.default_event_duration_hours ?? 4));
  const [timezone, setTimezone] = useState(() => normalizeTimezone(profile?.timezone ?? getBrowserTimezone()));
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [durationSaveStatus, setDurationSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [timezoneSaveStatus, setTimezoneSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const trimmedDisplayName = useMemo(() => displayName.trim(), [displayName]);
  const timezoneOptions = useMemo(() => getTimezoneOptions([profile?.timezone, timezone]), [profile?.timezone, timezone]);
  const canSaveDisplayName = Boolean(profile) && trimmedDisplayName.length > 0 && trimmedDisplayName !== profile?.display_name && saveStatus !== 'saving';
  const parsedDefaultEventDurationHours = Number(defaultEventDurationHours);
  const canSaveDefaultEventDuration = Boolean(profile)
    && Number.isFinite(parsedDefaultEventDurationHours)
    && parsedDefaultEventDurationHours > 0
    && parsedDefaultEventDurationHours <= 168
    && parsedDefaultEventDurationHours !== profile?.default_event_duration_hours
    && durationSaveStatus !== 'saving';
  const normalizedTimezone = normalizeTimezone(timezone);
  const canSaveTimezone = Boolean(profile)
    && normalizedTimezone !== profile?.timezone
    && timezoneSaveStatus !== 'saving';

  useEffect(() => {
    setDisplayName(profile?.display_name ?? '');
  }, [profile?.display_name]);

  useEffect(() => {
    setDefaultEventDurationHours(String(profile?.default_event_duration_hours ?? 4));
  }, [profile?.default_event_duration_hours]);

  useEffect(() => {
    setTimezone(normalizeTimezone(profile?.timezone ?? getBrowserTimezone()));
  }, [profile?.timezone]);

  async function handleDisplayNameSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile || !canSaveDisplayName) return;

    setSaveStatus('saving');

    try {
      await updateOwnProfileDisplayName(profile.id, trimmedDisplayName);
      await refreshProfile();
      setSaveStatus('saved');
    } catch (error) {
      console.error('Questboard could not update the profile display name', error);
      setSaveStatus('error');
    }
  }

  async function handleDefaultEventDurationSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile || !canSaveDefaultEventDuration) return;

    setDurationSaveStatus('saving');

    try {
      await updateOwnProfileDefaultEventDuration(profile.id, parsedDefaultEventDurationHours);
      await refreshProfile();
      setDurationSaveStatus('saved');
    } catch (error) {
      console.error('Questboard could not update the default event duration', error);
      setDurationSaveStatus('error');
    }
  }

  async function handleTimezoneSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile || !canSaveTimezone) return;

    setTimezoneSaveStatus('saving');

    try {
      await updateOwnProfileTimezone(profile.id, normalizedTimezone);
      await refreshProfile();
      setTimezoneSaveStatus('saved');
    } catch (error) {
      console.error('Questboard could not update the profile timezone', error);
      setTimezoneSaveStatus('error');
    }
  }

  return (
    <section className="panel profile-card">
      <p className="eyebrow">{t('profile.eyebrow')}</p>
      <h2>{t('profile.title')}</h2>
      <p>{t('profile.description')}</p>

      <label className="language-select">
        {t('profile.languageLabel')}
        <select value={language} onChange={(event) => setLanguage(event.target.value as Language)}>
          {languageOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="hint">{t('profile.languageHint')}</span>
      </label>

      <label className="notification-toggle">
        <span className="checkbox-line">
          <input
            type="checkbox"
            checked={browserNotificationsEnabled}
            disabled={notificationPermission === 'unsupported'}
            onChange={(event) => void setBrowserNotificationsEnabled(event.target.checked)}
          />
          <span>{t('profile.browserNotificationsLabel')}</span>
        </span>
        <span className="hint">
          {notificationPermission === 'unsupported'
            ? t('profile.browserNotificationsUnsupported')
            : notificationPermission === 'denied'
              ? t('profile.browserNotificationsDenied')
              : t('profile.browserNotificationsHint')}
        </span>
      </label>

      <form className="profile-default-duration-form" onSubmit={(event) => void handleDefaultEventDurationSubmit(event)}>
        <div className="profile-form-field">
          <label htmlFor="profile-default-event-duration">{t('profile.defaultEventDuration')}</label>
          <input
            id="profile-default-event-duration"
            type="number"
            min="0.25"
            max="168"
            step="0.25"
            value={defaultEventDurationHours}
            disabled={!profile || durationSaveStatus === 'saving'}
            onChange={(event) => {
              setDefaultEventDurationHours(event.target.value);
              setDurationSaveStatus('idle');
            }}
          />
          <span className="hint">{t('profile.defaultEventDurationHint')}</span>
        </div>
        <button type="submit" disabled={!canSaveDefaultEventDuration}>
          {durationSaveStatus === 'saving' ? t('profile.savingDefaultEventDuration') : t('profile.saveDefaultEventDuration')}
        </button>
        {durationSaveStatus === 'saved' && <p className="status-message">{t('profile.defaultEventDurationSaved')}</p>}
        {durationSaveStatus === 'error' && <p className="error-text">{t('profile.defaultEventDurationSaveError')}</p>}
      </form>

      <form className="profile-timezone-form" onSubmit={(event) => void handleTimezoneSubmit(event)}>
        <div className="profile-form-field">
          <label htmlFor="profile-timezone">{t('profile.timezone')}</label>
          <select
            id="profile-timezone"
            value={timezone}
            disabled={!profile || timezoneSaveStatus === 'saving'}
            onChange={(event) => {
              setTimezone(event.target.value);
              setTimezoneSaveStatus('idle');
            }}
          >
            {timezoneOptions.map((timezoneOption) => (
              <option key={timezoneOption.value} value={timezoneOption.value}>{timezoneOption.label}</option>
            ))}
          </select>
          <span className="hint">{t('profile.timezoneHint')}</span>
        </div>
        <button type="submit" disabled={!canSaveTimezone}>
          {timezoneSaveStatus === 'saving' ? t('profile.savingTimezone') : t('profile.saveTimezone')}
        </button>
        {timezoneSaveStatus === 'saved' && <p className="status-message">{t('profile.timezoneSaved')}</p>}
        {timezoneSaveStatus === 'error' && <p className="error-text">{t('profile.timezoneSaveError')}</p>}
      </form>

      <form className="profile-display-name-form" onSubmit={(event) => void handleDisplayNameSubmit(event)}>
        <div className="profile-form-field">
          <label htmlFor="profile-display-name">{t('profile.displayName')}</label>
          <input
            id="profile-display-name"
            value={displayName}
            maxLength={80}
            required
            disabled={!profile || saveStatus === 'saving'}
            onChange={(event) => {
              setDisplayName(event.target.value);
              setSaveStatus('idle');
            }}
          />
        </div>
        <div className="profile-form-field">
          <label htmlFor="profile-synced-display-name">{t('profile.syncedDisplayName')}</label>
          <input
            id="profile-synced-display-name"
            value={profile?.synced_display_name ?? t('profile.notSynced')}
            readOnly
            aria-describedby="profile-synced-display-name-hint"
          />
          <span id="profile-synced-display-name-hint" className="hint">{t('profile.syncedDisplayNameHint')}</span>
        </div>
        <button type="submit" disabled={!canSaveDisplayName}>
          {saveStatus === 'saving' ? t('profile.savingDisplayName') : t('profile.saveDisplayName')}
        </button>
        {saveStatus === 'saved' && <p className="status-message">{t('profile.displayNameSaved')}</p>}
        {saveStatus === 'error' && <p className="error-text">{t('profile.displayNameSaveError')}</p>}
      </form>

      <dl className="details-list">
        <div>
          <dt>{t('profile.email')}</dt>
          <dd>{user?.email ?? t('profile.emailUnavailable')}</dd>
        </div>
        <div>
          <dt>{t('profile.discordUserId')}</dt>
          <dd>{profile?.discord_user_id ?? t('profile.notProvided')}</dd>
        </div>
        <div>
          <dt>{t('profile.lastSeen')}</dt>
          <dd>{profile?.last_seen_at ? new Date(profile.last_seen_at).toLocaleString(locale) : t('profile.notRecorded')}</dd>
        </div>
      </dl>
    </section>
  );
}
