import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createGroup } from './groupApi';

const { rpc } = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: { rpc },
}));

describe('groupApi', () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it('creates groups through the RLS-safe database function', async () => {
    rpc.mockResolvedValue({ data: 'group-1', error: null });

    await expect(
      createGroup({
        name: '  Oneshot Company  ',
        description: ' Desc ',
        theme: ' DnD ',
        createdBy: 'user-1',
      }),
    ).resolves.toEqual({ id: 'group-1' });

    expect(rpc).toHaveBeenCalledWith('create_group_with_defaults', {
      group_name: 'Oneshot Company',
      group_description: 'Desc',
      group_theme: 'DnD',
      group_created_by: 'user-1',
    });
  });

  it('normalizes blank optional group fields before creating a group', async () => {
    rpc.mockResolvedValue({ data: 'group-2', error: null });

    await createGroup({ name: 'Guild', description: ' ', theme: '', createdBy: 'user-1' });

    expect(rpc).toHaveBeenCalledWith('create_group_with_defaults', {
      group_name: 'Guild',
      group_description: null,
      group_theme: null,
      group_created_by: 'user-1',
    });
  });
});
