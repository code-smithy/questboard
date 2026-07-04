import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { useLanguage } from '../features/i18n/LanguageContext';
import { useReminders } from '../features/reminders/ReminderContext';

const navItems = [
  { to: '/public', labelKey: 'app.nav.public' },
  { to: '/calendar', labelKey: 'app.nav.calendar' },
  { to: '/groups', labelKey: 'app.nav.groups' },
  { to: '/events/new', labelKey: 'app.nav.newEvent' },
  { to: '/profile', labelKey: 'app.nav.profile' },
] as const;

export function AppShell() {
  const { profile, signOut, user } = useAuth();
  const { t } = useLanguage();
  const { dueReminders } = useReminders();
  const reminderCount = dueReminders.length;
  const avatarLabel = profile?.display_name ?? user?.email ?? t('app.signedIn');

  return (
    <div className="app-shell">
      <header className="site-header">
        <div>
          <p className="eyebrow">{t('app.eyebrow')}</p>
          <h1>Questboard</h1>
        </div>
        <div className="header-actions">
          <nav aria-label="Primary navigation">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to}>
                {t(item.labelKey)}
              </NavLink>
            ))}
          </nav>
          {user ? (
            <div className="user-chip">
              <span className="avatar-frame" aria-label={avatarLabel}>
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" />
                ) : (
                  <span className="avatar-fallback" aria-hidden="true">{avatarLabel.slice(0, 1).toUpperCase()}</span>
                )}
                {reminderCount > 0 && (
                  <span className="avatar-reminder-count" aria-label={t('app.reminderCount', { count: reminderCount })}>
                    {reminderCount > 9 ? '9+' : reminderCount}
                  </span>
                )}
              </span>
              <span>{avatarLabel}</span>
              <button type="button" className="secondary-button" onClick={() => void signOut()}>
                {t('app.signOut')}
              </button>
            </div>
          ) : (
            <NavLink className="login-link" to="/login">
              {t('app.nav.login')}
            </NavLink>
          )}
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
