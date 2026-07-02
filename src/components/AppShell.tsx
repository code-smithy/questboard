import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthProvider';

const navItems = [
  { to: '/calendar', label: 'Calendar' },
  { to: '/groups', label: 'Guilds' },
  { to: '/events/new', label: 'Post Quest' },
  { to: '/profile', label: 'Profile' },
];

export function AppShell() {
  const { profile, signOut, user } = useAuth();

  return (
    <div className="app-shell">
      <header className="site-header">
        <div>
          <p className="eyebrow">Friend-group event planner</p>
          <h1>Questboard</h1>
        </div>
        <div className="header-actions">
          <nav aria-label="Primary navigation">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to}>
                {item.label}
              </NavLink>
            ))}
          </nav>
          {user ? (
            <div className="user-chip">
              {profile?.avatar_url && <img src={profile.avatar_url} alt="" />}
              <span>{profile?.display_name ?? user.email ?? 'Signed in'}</span>
              <button type="button" className="secondary-button" onClick={() => void signOut()}>
                Sign out
              </button>
            </div>
          ) : (
            <NavLink className="login-link" to="/login">
              Login
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
