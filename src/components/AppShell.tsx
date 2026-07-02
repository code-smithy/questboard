import { NavLink, Outlet } from 'react-router-dom';

const navItems = [
  { to: '/calendar', label: 'Calendar' },
  { to: '/groups', label: 'Guilds' },
  { to: '/events/new', label: 'Post Quest' },
  { to: '/profile', label: 'Profile' },
];

export function AppShell() {
  return (
    <div className="app-shell">
      <header className="site-header">
        <div>
          <p className="eyebrow">Friend-group event planner</p>
          <h1>Questboard</h1>
        </div>
        <nav aria-label="Primary navigation">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
