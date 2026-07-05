import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../i18n/LanguageContext';
import { EventForm } from './EventForm';

const { listGroupCategories, listGroupLocations } = vi.hoisted(() => ({
  listGroupCategories: vi.fn(),
  listGroupLocations: vi.fn(),
}));

function toLocalInputValue(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

vi.mock('./eventApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./eventApi')>()),
  listGroupCategories,
}));

vi.mock('../groups/groupApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../groups/groupApi')>()),
  listGroupLocations,
}));

describe('EventForm', () => {
  beforeEach(() => {
    window.localStorage.removeItem('questboard.language');
    listGroupCategories.mockResolvedValue([]);
    listGroupLocations.mockResolvedValue([]);
  });

  it('submits a weekly recurrence rule for selected weekdays', async () => {
    const handleSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <EventForm
        groups={[{
          id: 'group-1',
          name: 'Friday Guild',
          description: null,
          theme: null,
          created_at: '2026-07-01T12:00:00.000Z',
          role: 'regular',
          joined_at: '2026-07-01T12:00:00.000Z',
        }]}
        initialValues={{
          startAt: '2026-07-06T18:00:00.000Z',
          endAt: '2026-07-06T21:00:00.000Z',
          timezone: 'UTC',
        }}
        isSubmitting={false}
        submitLabel="Post quest"
        onSubmit={handleSubmit}
      />,
    );

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Dungeon night' } });
    fireEvent.change(screen.getByLabelText('Repeat pattern'), { target: { value: 'weekly' } });
    fireEvent.change(screen.getByLabelText('Week interval'), { target: { value: '2' } });
    fireEvent.click(screen.getByLabelText('Wednesday'));
    fireEvent.click(screen.getByRole('button', { name: 'Post quest' }));

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith(expect.objectContaining({
        recurrenceRule: 'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE',
      }));
    });
  });

  it('shows localized date-time picker controls', async () => {
    render(
      <EventForm
        groups={[{
          id: 'group-1',
          name: 'Friday Guild',
          description: null,
          theme: null,
          created_at: '2026-07-01T12:00:00.000Z',
          role: 'regular',
          joined_at: '2026-07-01T12:00:00.000Z',
        }]}
        initialValues={{
          startAt: '2026-07-06T18:00:00.000Z',
          endAt: '2026-07-06T21:00:00.000Z',
          timezone: 'UTC',
        }}
        isSubmitting={false}
        submitLabel="Post quest"
        onSubmit={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    const startLocalValue = toLocalInputValue('2026-07-06T18:00:00.000Z');
    const startPicker = screen.getByRole('button', { name: /^Starts / });
    const startDisplay = startPicker.textContent ?? '';

    fireEvent.click(startPicker);

    expect(startDisplay).toBe(new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(startLocalValue)));
    expect(screen.getByRole('combobox', { name: 'Time' })).toHaveValue(startLocalValue.split('T')[1]);
    expect(screen.getAllByRole('button', { name: '6' }).some((button) => button.getAttribute('aria-pressed') === 'true')).toBe(true);
  });

  it('formats picker values with the selected language', () => {
    window.localStorage.setItem('questboard.language', 'de');

    render(
      <LanguageProvider>
        <EventForm
          groups={[{
            id: 'group-1',
            name: 'Friday Guild',
            description: null,
            theme: null,
            created_at: '2026-07-01T12:00:00.000Z',
            role: 'regular',
            joined_at: '2026-07-01T12:00:00.000Z',
          }]}
          initialValues={{
            startAt: '2026-07-06T18:00:00.000Z',
            endAt: '2026-07-06T21:00:00.000Z',
            timezone: 'UTC',
          }}
          isSubmitting={false}
          submitLabel="Quest erstellen"
          onSubmit={vi.fn().mockResolvedValue(undefined)}
        />
      </LanguageProvider>,
    );

    const startLocalValue = toLocalInputValue('2026-07-06T18:00:00.000Z');
    const startPicker = screen.getByRole('button', { name: /^Beginn / });

    expect(startPicker.textContent).toBe(new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(startLocalValue)));
  });

  it('uses the date-time picker for recurrence end', async () => {
    render(
      <EventForm
        groups={[{
          id: 'group-1',
          name: 'Friday Guild',
          description: null,
          theme: null,
          created_at: '2026-07-01T12:00:00.000Z',
          role: 'regular',
          joined_at: '2026-07-01T12:00:00.000Z',
        }]}
        initialValues={{
          startAt: '2026-07-06T18:00:00.000Z',
          endAt: '2026-07-06T21:00:00.000Z',
          timezone: 'UTC',
        }}
        isSubmitting={false}
        submitLabel="Post quest"
        onSubmit={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    fireEvent.change(screen.getByLabelText('Repeat pattern'), { target: { value: 'weekly' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Ends' }), { target: { value: 'on-date' } });
    fireEvent.click(screen.getByRole('button', { name: 'End date and time Choose date and time' }));

    expect(screen.getByRole('combobox', { name: 'Time' })).toHaveValue('23:59');
  });
});
