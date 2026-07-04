import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../auth/AuthContext';
import type { AuthState } from '../auth/AuthContext';
import { PublicEventsPage } from './PublicEventsPage';

const { listPublicEventCards, requestPublicEventJoin } = vi.hoisted(() => ({
  listPublicEventCards: vi.fn(),
  requestPublicEventJoin: vi.fn(),
}));

vi.mock('./publicEventsApi', () => ({
  listPublicEventCards,
  requestPublicEventJoin,
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
    viewer_is_group_member: false,
    current_user_request_status: null,
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
    viewer_is_group_member: false,
    current_user_request_status: null,
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
    requestPublicEventJoin.mockReset();
    listPublicEventCards.mockResolvedValue(publicEvents);
    requestPublicEventJoin.mockResolvedValue('request-1');
  });

  it('renders public events without attendee identities or private detail links', async () => {
    renderPublicEvents();

    expect(await screen.findByRole('heading', { name: 'July 2026' })).toBeInTheDocument();
    const openTitle = screen.getByText('Open painting night');
    const openCard = openTitle.closest('article');
    expect(openCard).not.toBeNull();
    expect(openTitle).toBeInTheDocument();
    expect(within(openCard as HTMLElement).getByText(/Painting Crew/i)).toBeInTheDocument();
    expect(within(openCard as HTMLElement).getByText('Mini Painting')).toBeInTheDocument();
    expect(within(openCard as HTMLElement).getByText(/Offline/i)).toBeInTheDocument();
    expect(screen.getByText(/2\/6 seats - Needs 1 more/i)).toBeInTheDocument();
    expect(screen.getByText('Bring a miniature and paints.')).toBeInTheDocument();
    expect(screen.getByText(/Location: Community hall/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /open painting night/i })).not.toBeInTheDocument();
  });

  it('shows a navigable public month calendar with compact quest entries', async () => {
    renderPublicEvents();

    await screen.findByText('Open painting night');
    fireEvent.click(screen.getByRole('tab', { name: 'Month' }));

    expect(screen.getByRole('grid', { name: 'July 2026' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Mon' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /18:00 Open painting night/i })).toBeInTheDocument();
    expect(screen.queryByText('Discord board games')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /open painting night/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));

    expect(screen.getByRole('grid', { name: 'August 2026' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /19:00 Discord board games/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByRole('grid', { name: 'July 2026' })).toBeInTheDocument();
  });

  it('marks public cards with status and category colors', async () => {
    renderPublicEvents();

    const confirmedTitle = await screen.findByText('Discord board games');
    const confirmedCard = confirmedTitle.closest('article');

    expect(confirmedCard).not.toBeNull();
    expect(confirmedCard).toHaveAttribute('data-status', 'confirmed');
    expect(confirmedCard).toHaveStyle('--event-category-color: #f0b35a');
    expect(within(confirmedCard as HTMLElement).getByText('Confirmed')).toBeInTheDocument();
    expect(within(confirmedCard as HTMLElement).getByText('Board Games')).toBeInTheDocument();
  });

  it('filters public events by mode', async () => {
    renderPublicEvents();

    await screen.findByText('Open painting night');
    fireEvent.change(screen.getByLabelText(/mode/i), { target: { value: 'online' } });

    expect(screen.queryByText('Open painting night')).not.toBeInTheDocument();
    expect(screen.getByText('Discord board games')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open link/i })).toHaveAttribute('href', 'https://discord.example/events');
  });

  it('lets signed-in non-members request to join a public event', async () => {
    renderPublicEvents({ user: { id: 'user-1', email: 'user@example.com' } as AuthState['user'] });

    await screen.findByText('Open painting night');
    fireEvent.click(screen.getAllByRole('button', { name: 'Request to join' })[0]);

    await waitFor(() => {
      expect(requestPublicEventJoin).toHaveBeenCalledWith('event-1');
    });
    expect(screen.getByRole('button', { name: 'Request pending' })).toBeDisabled();
  });

  it('does not query Supabase when configuration is missing', async () => {
    renderPublicEvents({ isConfigured: false });

    expect(await screen.findByRole('alert')).toHaveTextContent(/need Supabase configuration/i);
    await waitFor(() => {
      expect(listPublicEventCards).not.toHaveBeenCalled();
    });
  });
});
