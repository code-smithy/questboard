import { beforeEach, describe, expect, it, vi } from 'vitest';
import { updateOwnProfileDefaultEventDuration, updateOwnProfileDisplayName } from './profileApi';

const { builders, from } = vi.hoisted(() => {
  const builders = {
    profiles: {
      update: vi.fn(() => builders.profiles),
      eq: vi.fn(() => builders.profiles),
      select: vi.fn(() => builders.profiles),
      single: vi.fn(),
    },
  };

  return {
    builders,
    from: vi.fn((table: 'profiles') => builders[table]),
  };
});

vi.mock('../../lib/supabase', () => ({
  supabase: { from },
}));

describe('profileApi', () => {
  beforeEach(() => {
    from.mockClear();
    Object.values(builders.profiles).forEach((fn) => fn.mockClear?.());
  });

  it('trims and saves the editable profile display name', async () => {
    builders.profiles.single.mockResolvedValue({
      data: { id: 'user-1', display_name: 'Guild Name' },
      error: null,
    });

    await expect(updateOwnProfileDisplayName('user-1', '  Guild Name  ')).resolves.toEqual({
      id: 'user-1',
      display_name: 'Guild Name',
    });

    expect(from).toHaveBeenCalledWith('profiles');
    expect(builders.profiles.update).toHaveBeenCalledWith({ display_name: 'Guild Name' });
    expect(builders.profiles.eq).toHaveBeenCalledWith('id', 'user-1');
  });

  it('saves the default event duration hours', async () => {
    builders.profiles.single.mockResolvedValue({
      data: { id: 'user-1', default_event_duration_hours: 3.5 },
      error: null,
    });

    await expect(updateOwnProfileDefaultEventDuration('user-1', 3.5)).resolves.toEqual({
      id: 'user-1',
      default_event_duration_hours: 3.5,
    });

    expect(from).toHaveBeenCalledWith('profiles');
    expect(builders.profiles.update).toHaveBeenCalledWith({ default_event_duration_hours: 3.5 });
    expect(builders.profiles.eq).toHaveBeenCalledWith('id', 'user-1');
  });
});
