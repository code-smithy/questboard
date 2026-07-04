import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../auth/AuthContext';
import type { AuthState } from '../auth/AuthContext';
import { PublicEventsPage } from './PublicEventsPage';

const { listPublicEventCards } = vi.hoisted(() => ({
  listPublicEventCards: vi.fn(),
}));

vi.mock('./publicEventsApi', () => ({
  listPublicEventCards,
}));

const baseAuthState: AuthState = {
  isConfigured: true,
  isLoading: false,
  session: null,
  user: null,
  profile: null,
  refreshProfile: vi.fn(),
  signOut: vi.fn(),
};

const publicEvents = [
  {
    id: 'event-1',
    title: 'Open painting night',
    description: 'Bring a miniature and paints.',
    start_at: '2026-07-10T18:00:00Z',
    end_at: '2026-07-10T21:00:00Z',
    timezone: 'UTC',
    mode: 'offline',
    location_text: 'Community hall',
    online_details: {},
    minimum_attendees: 3,
    maximum_attendees: 6,
    status: 'open',
    group_id: 'group-1',
    group_name: 'Painting Crew',
    category_name: 'Mini Painting',
    category_color: '#77ddaa',
    category_icon: null,
    attending_count: 2,
  },
  {
    id: 'event-2',
    title: 'Discord board games',
    description: null,
    start_at: '2026-08-02T19:00:00Z',
    end_at: '2026-08-02T21:00:00Z',
    timezone: 'UTC',
    mode: 'online',
    location_text: null,
    online_details: { platform: 'Discord', url: 'https://discord.example/events' },
    minimum_attendees: 1,
    maximum_attendees: null,
    status: 'confirmed',
    group_id: 'group-2',
    group_name: 'Friday Guild',
    category_name: 'Board Games',
    category_color: '#f0b35a',
    category_icon: null,
    attending_count: 4,
  },
];

function renderPublicEvents(authState: Partial<AuthState> = {}) {
  return render(
    <AuthContext.Provider value={{ ...baseAuthState, ...authState }}>
      <MemoryRouter initialEntries={['/public']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/public" element={<PublicEventsPage />} />
          <Route path="/login" element={<h1>Login route</h1>} />
          <Route path="/calendar" element={<h1>Calendar route</h1>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('PublicEventsPage', () => {
  beforeEach(() => {
    listPublicEventCards.mockReset();
    listPublicEventCards.mockResolvedValue(publicEvents);
  });

  it('renders public events without attendee identities or private detail links', async () => {
    renderPublicEvents();

    expect(await screen.findByRole('heading', { name: 'July 2026' })).toBeInTheDocument();
    expect(screen.getByText('Open painting night')).toBeInTheDocument();
    expect(screen.getByText(/Painting Crew - Mini Painting - Offline/i)).toBeInTheDocument();
    expect(screen.getByText(/2\/6 seats - Needs 1 more/i)).toBeInTheDocument();
    expect(screen.getByText('Bring a miniature and paints.')).toBeInTheDocument();
    expect(screen.getByText(/Location: Community hall/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /open painting night/i })).not.toBeInTheDocument();
  });

  it('filters public events by mode', async () => {
    renderPublicEvents();

    await screen.findByText('Open painting night');
    fireEvent.change(screen.getByLabelText(/mode/i), { target: { value: 'online' } });

    expect(screen.queryByText('Open painting night')).not.toBeInTheDocument();
    expect(screen.getByText('Discord board games')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open link/i })).toHaveAttribute('href', 'https://discord.example/events');
  });

  it('does not query Supabase when configuration is missing', async () => {
    renderPublicEvents({ isConfigured: false });

    expect(await screen.findByRole('alert')).toHaveTextContent(/need Supabase configuration/i);
    await waitFor(() => {
      expect(listPublicEventCards).not.toHaveBeenCalled();
    });
  });
});
