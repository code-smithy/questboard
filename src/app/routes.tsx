import { createHashRouter, Navigate } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { AuthCallbackPage } from '../features/auth/AuthCallbackPage';
import { LoginPage } from '../features/auth/LoginPage';
import { RequireAuth } from '../features/auth/RequireAuth';
import { CalendarPage } from '../features/calendar/CalendarPage';
import { EventDetailPage } from '../features/events/EventDetailPage';
import { NewEventPage } from '../features/events/NewEventPage';
import { GroupsPage } from '../features/groups/GroupsPage';
import { JoinInvitePage } from '../features/invites/JoinInvitePage';
import { ProfilePage } from '../features/profile/ProfilePage';

export const router = createHashRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/calendar" replace /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'auth/callback', element: <AuthCallbackPage /> },
      { path: 'join/:inviteToken', element: <JoinInvitePage /> },
      {
        element: <RequireAuth />,
        children: [
          { path: 'calendar', element: <CalendarPage /> },
          { path: 'events/new', element: <NewEventPage /> },
          { path: 'events/:eventId', element: <EventDetailPage /> },
          { path: 'groups', element: <GroupsPage /> },
          { path: 'profile', element: <ProfilePage /> },
        ],
      },
      { path: '*', element: <AuthCallbackPage /> },
    ],
  },
]);
