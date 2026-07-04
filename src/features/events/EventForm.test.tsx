import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventForm } from './EventForm';

const { listGroupCategories, listGroupLocations } = vi.hoisted(() => ({
  listGroupCategories: vi.fn(),
  listGroupLocations: vi.fn(),
}));

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
});
