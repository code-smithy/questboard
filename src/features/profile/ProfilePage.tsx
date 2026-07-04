import { useAuth } from '../auth/AuthContext';
import { languageOptions, useLanguage } from '../i18n/LanguageContext';
import type { Language } from '../i18n/LanguageContext';

export function ProfilePage() {
  const { profile, user } = useAuth();
  const { language, locale, setLanguage, t } = useLanguage();

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

      <dl className="details-list">
        <div>
          <dt>{t('profile.displayName')}</dt>
          <dd>{profile?.display_name ?? t('profile.notSynced')}</dd>
        </div>
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
