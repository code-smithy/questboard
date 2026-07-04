import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { languageOptions, useLanguage } from '../i18n/LanguageContext';
import type { Language } from '../i18n/LanguageContext';
import { useReminders } from '../reminders/ReminderContext';
import { updateOwnProfileDisplayName } from './profileApi';

export function ProfilePage() {
  const { profile, refreshProfile, user } = useAuth();
  const { language, locale, setLanguage, t } = useLanguage();
  const { browserNotificationsEnabled, notificationPermission, setBrowserNotificationsEnabled } = useReminders();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const trimmedDisplayName = useMemo(() => displayName.trim(), [displayName]);
  const canSaveDisplayName = Boolean(profile) && trimmedDisplayName.length > 0 && trimmedDisplayName !== profile?.display_name && saveStatus !== 'saving';

  useEffect(() => {
    setDisplayName(profile?.display_name ?? '');
  }, [profile?.display_name]);

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
