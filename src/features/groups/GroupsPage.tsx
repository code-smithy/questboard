import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import {
  archiveGroup,
  archiveGroupLocation,
  createGroup,
  createGroupInvite,
  createGroupLocation,
  deactivateGroupInvite,
  listGroupInvites,
  listGroupLocations,
  listGroupMembers,
  listPendingEventJoinRequests,
  listUserGroups,
  leaveGroup,
  removeGroupMember,
  reviewEventJoinRequest,
} from './groupApi';
import type { EventJoinRequest, GroupInvite, GroupLocation, GroupMember, GroupSummary } from './groupApi';

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function getInviteUrl(token: string) {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#/join/${token}`;
}

function getLocationMapHref(location: GroupLocation) {
  if (location.map_url) return location.map_url;
  if (location.latitude !== null && location.longitude !== null) return `geo:${location.latitude},${location.longitude}`;
  if (location.address) return `https://www.openstreetmap.org/search?query=${encodeURIComponent(location.address)}`;
  return null;
}

export function GroupsPage() {
  const { user } = useAuth();
  const { locale, t } = useLanguage();
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [invites, setInvites] = useState<GroupInvite[]>([]);
  const [locations, setLocations] = useState<GroupLocation[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [joinRequests, setJoinRequests] = useState<EventJoinRequest[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);
  const [isLoadingInvites, setIsLoadingInvites] = useState(false);
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [isLoadingJoinRequests, setIsLoadingJoinRequests] = useState(false);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);
  const [isCreatingLocation, setIsCreatingLocation] = useState(false);
  const [isArchivingGroup, setIsArchivingGroup] = useState(false);
  const [isLeavingGroup, setIsLeavingGroup] = useState(false);
  const [removingMemberUserId, setRemovingMemberUserId] = useState<string | null>(null);
  const [reviewingJoinRequestId, setReviewingJoinRequestId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [theme, setTheme] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [locationName, setLocationName] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [locationLatitude, setLocationLatitude] = useState('');
  const [locationLongitude, setLocationLongitude] = useState('');
  const [locationMapUrl, setLocationMapUrl] = useState('');
  const [locationNotes, setLocationNotes] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) ?? groups[0] ?? null,
    [groups, selectedGroupId],
  );
  const canManageInvites = selectedGroup?.role === 'group_admin';
  const canArchiveGroup = selectedGroup?.role === 'group_admin';
  const canManageMembers = selectedGroup?.role === 'group_admin';

  const formatLimit = useCallback((invite: GroupInvite) => {
    if (!invite.max_uses) return t('groups.unlimitedUses');
    return t('groups.used', { used: invite.used_count, max: invite.max_uses });
  }, [t]);

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
      setErrorMessage(getErrorMessage(error, t('groups.loadError')));
    } finally {
      setIsLoadingGroups(false);
    }
  }, [t, user]);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  useEffect(() => {
    const loadInvites = async () => {
      if (!selectedGroup || selectedGroup.role !== 'group_admin') {
        setInvites([]);
        setJoinRequests([]);
        return;
      }

      setIsLoadingInvites(true);

      try {
        setInvites(await listGroupInvites(selectedGroup.id));
      } catch (error) {
        setErrorMessage(getErrorMessage(error, t('groups.inviteLoadError')));
      } finally {
        setIsLoadingInvites(false);
      }
    };

    void loadInvites();
  }, [selectedGroup, t]);

  useEffect(() => {
    const loadJoinRequests = async () => {
      if (!selectedGroup || selectedGroup.role !== 'group_admin') {
        setJoinRequests([]);
        return;
      }

      setIsLoadingJoinRequests(true);

      try {
        setJoinRequests(await listPendingEventJoinRequests(selectedGroup.id));
      } catch (error) {
        setErrorMessage(getErrorMessage(error, t('groups.requestLoadError')));
      } finally {
        setIsLoadingJoinRequests(false);
      }
    };

    void loadJoinRequests();
  }, [selectedGroup, t]);

  useEffect(() => {
    const loadMembers = async () => {
      if (!selectedGroup) {
        setMembers([]);
        return;
      }

      setIsLoadingMembers(true);

      try {
        setMembers(await listGroupMembers(selectedGroup.id));
      } catch (error) {
        setErrorMessage(getErrorMessage(error, t('groups.memberLoadError')));
      } finally {
        setIsLoadingMembers(false);
      }
    };

    void loadMembers();
  }, [selectedGroup, t]);

  useEffect(() => {
    const loadLocations = async () => {
      if (!selectedGroup) {
        setLocations([]);
        return;
      }

      setIsLoadingLocations(true);

      try {
        setLocations(await listGroupLocations(selectedGroup.id));
      } catch (error) {
        setErrorMessage(getErrorMessage(error, t('groups.locationLoadError')));
      } finally {
        setIsLoadingLocations(false);
      }
    };

    void loadLocations();
  }, [selectedGroup, t]);

  const handleCreateGroup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user || isCreatingGroup) return;
    if (!name.trim()) {
      setErrorMessage(t('groups.needName'));
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
      setStatusMessage(t('groups.created'));
      await loadGroups();
      setSelectedGroupId(createdGroup.id);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, t('groups.createError')));
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const handleCreateInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user || !selectedGroup || isCreatingInvite) return;

    const parsedMaxUses = maxUses ? Number(maxUses) : null;
    if (parsedMaxUses !== null && (!Number.isInteger(parsedMaxUses) || parsedMaxUses <= 0)) {
      setErrorMessage(t('groups.invalidInviteMax'));
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
      setStatusMessage(t('groups.inviteCreated'));
    } catch (error) {
      setErrorMessage(getErrorMessage(error, t('groups.inviteCreateError')));
    } finally {
      setIsCreatingInvite(false);
    }
  };

  const handleArchiveGroup = async () => {
    if (!selectedGroup || selectedGroup.role !== 'group_admin' || isArchivingGroup) return;
    if (!window.confirm(t('groups.archiveGuildConfirm', { name: selectedGroup.name }))) return;

    setIsArchivingGroup(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      await archiveGroup(selectedGroup.id);
      setInvites([]);
      setLocations([]);
      setMembers([]);
      setStatusMessage(t('groups.guildArchived'));
      await loadGroups();
    } catch (error) {
      setErrorMessage(getErrorMessage(error, t('groups.guildArchiveError')));
    } finally {
      setIsArchivingGroup(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!selectedGroup || isLeavingGroup) return;
    if (!window.confirm(t('groups.leaveGuildConfirm', { name: selectedGroup.name }))) return;

    setIsLeavingGroup(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      await leaveGroup(selectedGroup.id);
      setInvites([]);
      setLocations([]);
      setMembers([]);
      setStatusMessage(t('groups.guildLeft'));
      await loadGroups();
    } catch (error) {
      setErrorMessage(getErrorMessage(error, t('groups.guildLeaveError')));
    } finally {
      setIsLeavingGroup(false);
    }
  };

  const handleRemoveMember = async (member: GroupMember) => {
    if (!selectedGroup || selectedGroup.role !== 'group_admin' || member.user_id === user?.id || removingMemberUserId) return;
    const memberName = member.profiles?.display_name ?? t('event.unknownMember');
    if (!window.confirm(t('groups.removeMemberConfirm', { member: memberName, name: selectedGroup.name }))) return;

    setRemovingMemberUserId(member.user_id);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      await removeGroupMember(selectedGroup.id, member.user_id);
      setMembers((currentMembers) => currentMembers.filter((currentMember) => currentMember.user_id !== member.user_id));
      setStatusMessage(t('groups.memberRemoved'));
    } catch (error) {
      setErrorMessage(getErrorMessage(error, t('groups.memberRemoveError')));
    } finally {
      setRemovingMemberUserId(null);
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
      setStatusMessage(t('groups.inviteDisabled'));
    } catch (error) {
      setErrorMessage(getErrorMessage(error, t('groups.inviteDisableError')));
    }
  };

  const handleReviewJoinRequest = async (requestId: string, status: 'approved' | 'rejected') => {
    setReviewingJoinRequestId(requestId);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      await reviewEventJoinRequest(requestId, status);
      setJoinRequests((currentRequests) => currentRequests.filter((request) => request.id !== requestId));
      if (status === 'approved' && selectedGroup) {
        setMembers(await listGroupMembers(selectedGroup.id));
      }
      setStatusMessage(status === 'approved' ? t('groups.requestApproved') : t('groups.requestRejected'));
    } catch (error) {
      setErrorMessage(getErrorMessage(error, t('groups.requestReviewError')));
    } finally {
      setReviewingJoinRequestId(null);
    }
  };

  const handleCreateLocation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user || !selectedGroup || isCreatingLocation) return;
    if (!locationName.trim()) {
      setErrorMessage(t('groups.needLocationName'));
      return;
    }

    const parsedLatitude = locationLatitude ? Number(locationLatitude) : null;
    const parsedLongitude = locationLongitude ? Number(locationLongitude) : null;
    if ((parsedLatitude !== null && Number.isNaN(parsedLatitude)) || (parsedLongitude !== null && Number.isNaN(parsedLongitude))) {
      setErrorMessage(t('groups.invalidCoordinates'));
      return;
    }

    setIsCreatingLocation(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const location = await createGroupLocation({
        groupId: selectedGroup.id,
        createdBy: user.id,
        name: locationName,
        address: locationAddress,
        latitude: parsedLatitude,
        longitude: parsedLongitude,
        mapUrl: locationMapUrl,
        notes: locationNotes,
      });
      setLocations((currentLocations) => [...currentLocations, location].sort((a, b) => a.name.localeCompare(b.name)));
      setLocationName('');
      setLocationAddress('');
      setLocationLatitude('');
      setLocationLongitude('');
      setLocationMapUrl('');
      setLocationNotes('');
      setStatusMessage(t('groups.locationSaved'));
    } catch (error) {
      setErrorMessage(getErrorMessage(error, t('groups.locationSaveError')));
    } finally {
      setIsCreatingLocation(false);
    }
  };

  const handleArchiveLocation = async (locationId: string) => {
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      await archiveGroupLocation(locationId);
      setLocations((currentLocations) => currentLocations.filter((location) => location.id !== locationId));
      setStatusMessage(t('groups.locationArchived'));
    } catch (error) {
      setErrorMessage(getErrorMessage(error, t('groups.locationArchiveError')));
    }
  };

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t('groups.eyebrow')}</p>
          <h2>{t('groups.title')}</h2>
        </div>
        <p>{t('groups.description')}</p>
      </div>

      {statusMessage && <p className="status-message">{statusMessage}</p>}
      {errorMessage && (
        <p className="error-text" role="alert">
          {errorMessage}
        </p>
      )}

      <div className="two-column-layout">
        <form className="form-card" onSubmit={handleCreateGroup}>
          <h3>{t('groups.createTitle')}</h3>
          <label>
            {t('groups.name')}
            <input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required />
          </label>
          <label>
            {t('groups.descriptionLabel')}
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} />
          </label>
          <label>
            {t('groups.theme')}
            <input
              value={theme}
              onChange={(event) => setTheme(event.target.value)}
              placeholder={t('groups.themePlaceholder')}
              maxLength={80}
            />
          </label>
          <button type="submit" disabled={isCreatingGroup}>
            {isCreatingGroup ? t('groups.creating') : t('groups.createButton')}
          </button>
        </form>

        <div className="stack">
          <div>
            <h3>{t('groups.memberships')}</h3>
            {isLoadingGroups ? (
              <p className="hint">{t('groups.loading')}</p>
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
                    <small>{group.role === 'group_admin' ? t('groups.admin') : t('groups.member')}</small>
                  </button>
                ))}
              </div>
            ) : (
              <p className="hint">{t('groups.empty')}</p>
            )}
          </div>

          {selectedGroup && (
            <div className="detail-panel">
              <p className="eyebrow">{selectedGroup.role === 'group_admin' ? t('groups.guildAdmin') : t('groups.guildMember')}</p>
              <h3>{selectedGroup.name}</h3>
              <p>{selectedGroup.description || t('groups.noDescription')}</p>
              {selectedGroup.theme && <p className="hint">{t('groups.themePrefix', { theme: selectedGroup.theme })}</p>}
              {selectedGroup.role !== 'group_admin' && (
                <div className="button-row compact-actions">
                  <button type="button" className="secondary-button" disabled={isLeavingGroup} onClick={() => void handleLeaveGroup()}>
                    {isLeavingGroup ? t('groups.leavingGuild') : t('groups.leaveGuild')}
                  </button>
                </div>
              )}
              {canArchiveGroup && (
                <button type="button" className="secondary-button" disabled={isArchivingGroup} onClick={() => void handleArchiveGroup()}>
                  {isArchivingGroup ? t('groups.archivingGuild') : t('groups.archiveGuild')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {selectedGroup && (
        <div className="invite-panel">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">{t('groups.members')}</p>
              <h3>{t('groups.guildMembers', { count: members.length })}</h3>
            </div>
            {canManageMembers && <p className="hint">{t('groups.memberManagementHint')}</p>}
          </div>
          {isLoadingMembers ? (
            <p className="hint">{t('groups.loadingMembers')}</p>
          ) : members.length ? (
            <div className="member-list" role="list">
              {members.map((member) => {
                const memberName = member.profiles?.display_name ?? t('event.unknownMember');
                const canRemoveMember = canManageMembers && member.user_id !== user?.id;
                return (
                  <article className="member-card" key={member.id}>
                    <div>
                      <strong>{memberName}</strong>
                      <p className="hint">{member.role === 'group_admin' ? t('groups.admin') : t('groups.member')} - {t('groups.joinedAt', { date: new Date(member.joined_at).toLocaleDateString(locale) })}</p>
                    </div>
                    {canRemoveMember && (
                      <button type="button" className="secondary-button" disabled={removingMemberUserId === member.user_id} onClick={() => void handleRemoveMember(member)}>
                        {removingMemberUserId === member.user_id ? t('groups.removingMember') : t('groups.removeMember')}
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="hint">{t('groups.noMembers')}</p>
          )}
        </div>
      )}

      {selectedGroup && (
        <div className="invite-panel">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">{t('groups.joinRequests')}</p>
              <h3>{t('groups.pendingJoinRequests', { count: joinRequests.length })}</h3>
            </div>
            {!canManageInvites && <p className="hint">{t('groups.adminOnly')}</p>}
          </div>

          {canManageInvites && (
            isLoadingJoinRequests ? (
              <p className="hint">{t('groups.loadingJoinRequests')}</p>
            ) : joinRequests.length ? (
              <div className="join-request-list" role="list">
                {joinRequests.map((request) => (
                  <article className="join-request-card" key={request.id}>
                    <div>
                      <strong>{request.profiles?.display_name ?? t('event.unknownMember')}</strong>
                      <p className="hint">
                        {request.events?.title ?? t('event.notFound')} - {t('groups.requestedAt', { date: new Date(request.created_at).toLocaleString(locale) })}
                      </p>
                    </div>
                    <div className="button-row compact-actions">
                      <button
                        type="button"
                        disabled={reviewingJoinRequestId === request.id}
                        onClick={() => void handleReviewJoinRequest(request.id, 'approved')}
                      >
                        {reviewingJoinRequestId === request.id ? t('groups.reviewingRequest') : t('groups.approveRequest')}
                      </button>
                      <button
                        type="button"
                        className="secondary-button"
                        disabled={reviewingJoinRequestId === request.id}
                        onClick={() => void handleReviewJoinRequest(request.id, 'rejected')}
                      >
                        {t('groups.rejectRequest')}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="hint">{t('groups.noJoinRequests')}</p>
            )
          )}
        </div>
      )}

      {selectedGroup && (
        <div className="invite-panel">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">{t('groups.locations')}</p>
              <h3>{t('groups.savedSpots')}</h3>
            </div>
            <p className="hint">{t('groups.locationsHint')}</p>
          </div>

          <form className="form-card location-form" onSubmit={handleCreateLocation}>
            <label>
              {t('groups.locationName')}
              <input value={locationName} onChange={(event) => setLocationName(event.target.value)} maxLength={100} required />
            </label>
            <label>
              {t('groups.address')}
              <input value={locationAddress} onChange={(event) => setLocationAddress(event.target.value)} placeholder={t('groups.addressPlaceholder')} />
            </label>
            <div className="inline-form two-up">
              <label>
                {t('groups.latitude')}
                <input value={locationLatitude} onChange={(event) => setLocationLatitude(event.target.value)} placeholder={t('groups.optional')} />
              </label>
              <label>
                {t('groups.longitude')}
                <input value={locationLongitude} onChange={(event) => setLocationLongitude(event.target.value)} placeholder={t('groups.optional')} />
              </label>
            </div>
            <label>
              {t('groups.mapUrl')}
              <input value={locationMapUrl} onChange={(event) => setLocationMapUrl(event.target.value)} placeholder="https://..." />
            </label>
            <label>
              {t('groups.notes')}
              <textarea value={locationNotes} onChange={(event) => setLocationNotes(event.target.value)} rows={3} />
            </label>
            <button type="submit" disabled={isCreatingLocation}>
              {isCreatingLocation ? t('groups.saving') : t('groups.saveLocation')}
            </button>
          </form>

          {isLoadingLocations ? (
            <p className="hint">{t('groups.loadingLocations')}</p>
          ) : locations.length ? (
            <div className="location-list" role="list">
              {locations.map((location) => {
                const mapHref = getLocationMapHref(location);
                const canArchiveLocation = selectedGroup.role === 'group_admin' || location.created_by === user?.id;

                return (
                  <article className="location-card" key={location.id}>
                    <div>
                      <strong>{location.name}</strong>
                      {location.address && <p>{location.address}</p>}
                      {location.notes && <p className="hint">{location.notes}</p>}
                      {mapHref && <a href={mapHref} target="_blank" rel="noreferrer">{t('groups.openMap')}</a>}
                    </div>
                    {canArchiveLocation && (
                      <button type="button" className="secondary-button" onClick={() => void handleArchiveLocation(location.id)}>
                        {t('groups.archive')}
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="hint">{t('groups.noLocations')}</p>
          )}
        </div>
      )}

      {selectedGroup && (
        <div className="invite-panel">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">{t('groups.invites')}</p>
              <h3>{t('groups.inviteLinks')}</h3>
            </div>
            {!canManageInvites && <p className="hint">{t('groups.adminOnly')}</p>}
          </div>

          {canManageInvites && (
            <form className="inline-form" onSubmit={handleCreateInvite}>
              <label>
                {t('groups.expires')}
                <input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
              </label>
              <label>
                {t('groups.maxUses')}
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={maxUses}
                  onChange={(event) => setMaxUses(event.target.value)}
                  placeholder={t('groups.unlimited')}
                />
              </label>
              <button type="submit" disabled={isCreatingInvite}>
                {isCreatingInvite ? t('groups.creating') : t('groups.createInvite')}
              </button>
            </form>
          )}

          {isLoadingInvites ? (
            <p className="hint">{t('groups.loadingInvites')}</p>
          ) : invites.length ? (
            <div className="invite-list" role="list">
              {invites.map((invite) => (
                <article className="invite-card" key={invite.id}>
                  <div>
                    <strong>{invite.is_active ? t('groups.activeInvite') : t('groups.disabledInvite')}</strong>
                    <code>{getInviteUrl(invite.token)}</code>
                    <p className="hint">
                      {formatLimit(invite)}
                      {invite.expires_at
                        ? t('groups.expiresAt', { date: new Date(invite.expires_at).toLocaleString(locale) })
                        : t('groups.noExpiry')}
                    </p>
                  </div>
                  {invite.is_active && (
                    <button type="button" className="secondary-button" onClick={() => void handleDeactivateInvite(invite.id)}>
                      {t('groups.disable')}
                    </button>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <p className="hint">
              {canManageInvites ? t('groups.noInvitesAdmin') : t('groups.noInvitesMember')}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
