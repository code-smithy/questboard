import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import {
  createGroup,
  createGroupInvite,
  deactivateGroupInvite,
  listGroupInvites,
  listUserGroups,
} from './groupApi';
import type { GroupInvite, GroupSummary } from './groupApi';

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function getInviteUrl(token: string) {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#/join/${token}`;
}

function formatLimit(invite: GroupInvite) {
  if (!invite.max_uses) return 'Unlimited uses';
  return `${invite.used_count}/${invite.max_uses} used`;
}

export function GroupsPage() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [invites, setInvites] = useState<GroupInvite[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);
  const [isLoadingInvites, setIsLoadingInvites] = useState(false);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [theme, setTheme] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) ?? groups[0] ?? null,
    [groups, selectedGroupId],
  );
  const canManageInvites = selectedGroup?.role === 'group_admin';

  const loadGroups = useCallback(async () => {
    if (!user) {
      setGroups([]);
      setSelectedGroupId(null);
      setIsLoadingGroups(false);
      return;
    }

    setIsLoadingGroups(true);
    setErrorMessage(null);

    try {
      const nextGroups = await listUserGroups(user.id);
      setGroups(nextGroups);
      setSelectedGroupId((currentGroupId) => {
        if (currentGroupId && nextGroups.some((group) => group.id === currentGroupId)) return currentGroupId;
        return nextGroups[0]?.id ?? null;
      });
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Questboard could not load your guilds.'));
    } finally {
      setIsLoadingGroups(false);
    }
  }, [user]);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  useEffect(() => {
    const loadInvites = async () => {
      if (!selectedGroup || selectedGroup.role !== 'group_admin') {
        setInvites([]);
        return;
      }

      setIsLoadingInvites(true);

      try {
        setInvites(await listGroupInvites(selectedGroup.id));
      } catch (error) {
        setErrorMessage(getErrorMessage(error, 'Questboard could not load invite links.'));
      } finally {
        setIsLoadingInvites(false);
      }
    };

    void loadInvites();
  }, [selectedGroup]);

  const handleCreateGroup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user || isCreatingGroup) return;
    if (!name.trim()) {
      setErrorMessage('Give the guild a name before creating it.');
      return;
    }

    setIsCreatingGroup(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const createdGroup = await createGroup({ name, description, theme, createdBy: user.id });
      setName('');
      setDescription('');
      setTheme('');
      setStatusMessage('Guild created. Default categories are ready.');
      await loadGroups();
      setSelectedGroupId(createdGroup.id);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Questboard could not create that guild.'));
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const handleCreateInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user || !selectedGroup || isCreatingInvite) return;

    const parsedMaxUses = maxUses ? Number(maxUses) : null;
    if (parsedMaxUses !== null && (!Number.isInteger(parsedMaxUses) || parsedMaxUses <= 0)) {
      setErrorMessage('Maximum uses must be a positive whole number.');
      return;
    }

    setIsCreatingInvite(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const invite = await createGroupInvite({
        groupId: selectedGroup.id,
        createdBy: user.id,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        maxUses: parsedMaxUses,
      });
      setInvites((currentInvites) => [invite, ...currentInvites]);
      setMaxUses('');
      setExpiresAt('');
      setStatusMessage('Invite link created.');
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Questboard could not create that invite.'));
    } finally {
      setIsCreatingInvite(false);
    }
  };

  const handleDeactivateInvite = async (inviteId: string) => {
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      await deactivateGroupInvite(inviteId);
      setInvites((currentInvites) =>
        currentInvites.map((invite) => (invite.id === inviteId ? { ...invite, is_active: false } : invite)),
      );
      setStatusMessage('Invite link disabled.');
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Questboard could not disable that invite.'));
    }
  };

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Groups</p>
          <h2>Your guilds</h2>
        </div>
        <p>Manage friend groups, reusable invite links, and the first shared calendar boundary for events.</p>
      </div>

      {statusMessage && <p className="status-message">{statusMessage}</p>}
      {errorMessage && (
        <p className="error-text" role="alert">
          {errorMessage}
        </p>
      )}

      <div className="two-column-layout">
        <form className="form-card" onSubmit={handleCreateGroup}>
          <h3>Create guild</h3>
          <label>
            Guild name
            <input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required />
          </label>
          <label>
            Description
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} />
          </label>
          <label>
            Theme
            <input
              value={theme}
              onChange={(event) => setTheme(event.target.value)}
              placeholder="DnD, painting night, board games"
              maxLength={80}
            />
          </label>
          <button type="submit" disabled={isCreatingGroup}>
            {isCreatingGroup ? 'Creating...' : 'Create guild'}
          </button>
        </form>

        <div className="stack">
          <div>
            <h3>Memberships</h3>
            {isLoadingGroups ? (
              <p className="hint">Loading your guilds...</p>
            ) : groups.length ? (
              <div className="item-list" role="list">
                {groups.map((group) => (
                  <button
                    type="button"
                    className={`list-button${selectedGroup?.id === group.id ? ' is-selected' : ''}`}
                    key={group.id}
                    onClick={() => setSelectedGroupId(group.id)}
                  >
                    <span>{group.name}</span>
                    <small>{group.role === 'group_admin' ? 'Admin' : 'Member'}</small>
                  </button>
                ))}
              </div>
            ) : (
              <p className="hint">Create a guild or join one through an invite link.</p>
            )}
          </div>

          {selectedGroup && (
            <div className="detail-panel">
              <p className="eyebrow">{selectedGroup.role === 'group_admin' ? 'Guild admin' : 'Guild member'}</p>
              <h3>{selectedGroup.name}</h3>
              <p>{selectedGroup.description || 'No description yet.'}</p>
              {selectedGroup.theme && <p className="hint">Theme: {selectedGroup.theme}</p>}
            </div>
          )}
        </div>
      </div>

      {selectedGroup && (
        <div className="invite-panel">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">Invites</p>
              <h3>Reusable invite links</h3>
            </div>
            {!canManageInvites && <p className="hint">Only guild admins can manage invite links.</p>}
          </div>

          {canManageInvites && (
            <form className="inline-form" onSubmit={handleCreateInvite}>
              <label>
                Expires
                <input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
              </label>
              <label>
                Max uses
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={maxUses}
                  onChange={(event) => setMaxUses(event.target.value)}
                  placeholder="Unlimited"
                />
              </label>
              <button type="submit" disabled={isCreatingInvite}>
                {isCreatingInvite ? 'Creating...' : 'Create invite'}
              </button>
            </form>
          )}

          {isLoadingInvites ? (
            <p className="hint">Loading invite links...</p>
          ) : invites.length ? (
            <div className="invite-list" role="list">
              {invites.map((invite) => (
                <article className="invite-card" key={invite.id}>
                  <div>
                    <strong>{invite.is_active ? 'Active invite' : 'Disabled invite'}</strong>
                    <code>{getInviteUrl(invite.token)}</code>
                    <p className="hint">
                      {formatLimit(invite)}
                      {invite.expires_at ? `, expires ${new Date(invite.expires_at).toLocaleString()}` : ', no expiry'}
                    </p>
                  </div>
                  {invite.is_active && (
                    <button type="button" className="secondary-button" onClick={() => void handleDeactivateInvite(invite.id)}>
                      Disable
                    </button>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <p className="hint">
              {canManageInvites ? 'Create an invite to let friends join this guild.' : 'No invite links are visible here.'}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
