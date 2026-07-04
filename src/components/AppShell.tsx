import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { useLanguage } from '../features/i18n/LanguageContext';

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
              {profile?.avatar_url && <img src={profile.avatar_url} alt="" />}
              <span>{profile?.display_name ?? user.email ?? t('app.signedIn')}</span>
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
