import React, { useState, useEffect } from 'react';
import { useServerStore } from '../store/useServerStore';
import { useAuthStore } from '../store/useAuthStore';

export default function ServerSettingsModal({ isOpen, onClose }) {
  const {
    activeServer,
    serverRoles,
    createRole,
    assignMemberRole,
    kickMember,
    banUser,
    muteMember,
    fetchAuditLogs,
    auditLogs,
    isLoadingAuditLogs,
    deleteChannel,
    deleteServer,
    channels,
    addServerAdmin,
    removeServerAdmin,
  } = useServerStore();
  const { user } = useAuthStore();

  const [tab, setTab] = useState('roles'); // 'roles' | 'members' | 'channels' | 'audit-log'
  const [roleName, setRoleName] = useState('');
  const [roleColor, setRoleColor] = useState('#5865F2');
  const [permissions, setPermissions] = useState(['send_messages']);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Mute modal / inline state for selected member
  const [muteTargetUser, setMuteTargetUser] = useState(null);
  const [muteDuration, setMuteDuration] = useState('15'); // minutes

  useEffect(() => {
    if (isOpen && tab === 'audit-log' && activeServer?._id) {
      fetchAuditLogs(activeServer._id);
    }
  }, [isOpen, tab, activeServer?._id, fetchAuditLogs]);

  if (!isOpen || !activeServer) return null;

  const isOwner = (typeof activeServer.owner === 'object' ? activeServer.owner?._id : activeServer.owner) === user?._id;
  const isAdmin = (activeServer.admins || []).some((a) => (typeof a === 'object' ? a._id : a) === user?._id);
  const isOwnerOrAdmin = isOwner || isAdmin;

  const handleDeleteServer = async () => {
    if (
      window.confirm(
        `Are you sure you want to DELETE "${activeServer.name}"? All channels and messages will be permanently removed. This action cannot be undone!`
      )
    ) {
      const res = await deleteServer(activeServer._id);
      if (res.success) {
        onClose();
      } else {
        setErrorMsg(res.error);
      }
    }
  };

  const handlePermissionToggle = (perm) => {
    if (permissions.includes(perm)) {
      setPermissions(permissions.filter((p) => p !== perm));
    } else {
      setPermissions([...permissions, perm]);
    }
  };

  const handleCreateRole = async (e) => {
    e.preventDefault();
    if (!roleName.trim()) return;

    setLoading(true);
    setErrorMsg(null);

    const res = await createRole(activeServer._id, {
      name: roleName.trim(),
      color: roleColor,
      permissions,
    });

    setLoading(false);

    if (res.success) {
      setRoleName('');
      setPermissions(['send_messages']);
    } else {
      setErrorMsg(res.error);
    }
  };

  const handleRoleToggleForMember = async (memberUserId, currentRoleIds, roleId) => {
    let updatedRoleIds;
    if (currentRoleIds.includes(roleId)) {
      updatedRoleIds = currentRoleIds.filter((id) => id !== roleId);
    } else {
      updatedRoleIds = [...currentRoleIds, roleId];
    }

    const res = await assignMemberRole(activeServer._id, memberUserId, updatedRoleIds);
    if (!res.success) {
      setErrorMsg(res.error);
    }
  };

  const handleKickMember = async (memberUserId) => {
    if (window.confirm('Are you sure you want to kick this member?')) {
      const res = await kickMember(activeServer._id, memberUserId);
      if (!res.success) {
        setErrorMsg(res.error);
      }
    }
  };

  const handleBanUser = async (memberUserId) => {
    if (window.confirm('Are you sure you want to BAN this user? They will not be able to rejoin.')) {
      const res = await banUser(activeServer._id, memberUserId);
      if (!res.success) {
        setErrorMsg(res.error);
      }
    }
  };

  const handleMuteSubmit = async (memberUserId) => {
    const mins = parseInt(muteDuration, 10);
    const res = await muteMember(activeServer._id, memberUserId, mins);
    if (res.success) {
      setMuteTargetUser(null);
    } else {
      setErrorMsg(res.error);
    }
  };

  const handleDeleteChannel = async (channelId) => {
    if (window.confirm('Are you sure you want to delete this channel?')) {
      const res = await deleteChannel(activeServer._id, channelId);
      if (!res.success) {
        setErrorMsg(res.error);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-[#131528] p-6 shadow-2xl border border-[#262a4a] flex flex-col max-h-[85vh]">
        <div className="flex justify-between items-center border-b border-[#262a4a] pb-3 mb-4">
          <h2 className="text-xl font-extrabold text-white tracking-tight">Server Settings - {activeServer.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white cursor-pointer">
            ✕
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 rounded-lg bg-red-500/20 border border-red-500/40 p-2.5 text-xs font-semibold text-red-200">
            {errorMsg}
          </div>
        )}

        <div className="flex border-b border-[#262a4a] mb-4 space-x-1 overflow-x-auto">
          {[
            { id: 'roles', label: 'Roles & Permissions' },
            { id: 'members', label: `Members (${activeServer.members?.length || 0})` },
            { id: 'channels', label: 'Manage Channels' },
            { id: 'audit-log', label: 'Audit Log' },
          ].map((item) => (
            <button
              key={item.id}
              className={`pb-2 px-4 font-bold text-sm border-b-2 transition-colors whitespace-nowrap ${
                tab === item.id
                  ? 'border-indigo-500 text-white'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
              onClick={() => {
                setTab(item.id);
                setErrorMsg(null);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* TAB 1: ROLES & PERMISSIONS */}
          {tab === 'roles' && (
            <div className="space-y-6">
              <form onSubmit={handleCreateRole} className="bg-[#2b2d31] p-4 rounded-lg space-y-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Create New Role</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-gray-300">Role Name</label>
                    <input
                      type="text"
                      value={roleName}
                      onChange={(e) => setRoleName(e.target.value)}
                      placeholder="Moderator"
                      required
                      className="w-full rounded bg-[#1e1f22] p-2 text-white text-sm outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-gray-300">Role Color</label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="color"
                        value={roleColor}
                        onChange={(e) => setRoleColor(e.target.value)}
                        className="h-9 w-9 rounded cursor-pointer border-none bg-transparent"
                      />
                      <input
                        type="text"
                        value={roleColor}
                        onChange={(e) => setRoleColor(e.target.value)}
                        className="flex-1 rounded bg-[#1e1f22] p-2 text-white text-sm outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold text-gray-300">Permissions Checklist</label>
                  <div className="space-y-2">
                    {[
                      { id: 'manage_channels', label: 'Manage Channels (Create / Delete Channels)' },
                      { id: 'kick_members', label: 'Kick Members (Remove users from server)' },
                      { id: 'ban_members', label: 'Ban Members (Prevent users from rejoining)' },
                      { id: 'mute_members', label: 'Mute Members (Restrict text chat access)' },
                      { id: 'send_messages', label: 'Send Messages (Post in text channels)' },
                    ].map((perm) => (
                      <label key={perm.id} className="flex items-center space-x-2 cursor-pointer text-sm text-gray-200">
                        <input
                          type="checkbox"
                          checked={permissions.includes(perm.id)}
                          onChange={() => handlePermissionToggle(perm.id)}
                          className="h-4 w-4 rounded accent-indigo-500"
                        />
                        <span>{perm.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !roleName.trim()}
                  className="rounded bg-indigo-500 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-600 disabled:opacity-50"
                >
                  {loading ? 'Creating Role...' : 'Create Role'}
                </button>
              </form>

              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2">Existing Server Roles</h3>
                {serverRoles.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No custom roles created yet.</p>
                ) : (
                  <div className="space-y-2">
                    {serverRoles.map((role) => (
                      <div
                        key={role._id}
                        className="flex items-center justify-between bg-[#2b2d31] p-3 rounded text-sm"
                      >
                        <div className="flex items-center space-x-2">
                          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: role.color }} />
                          <span className="font-semibold text-white">{role.name}</span>
                        </div>
                        <div className="text-xs text-gray-400">
                          Permissions: {role.permissions?.join(', ') || 'None'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: MEMBERS */}
          {tab === 'members' && (
            <div className="space-y-3">
              {activeServer.members?.map((member) => {
                const memberUser = typeof member.user === 'object' && member.user ? member.user : {};
                const targetUserId = memberUser._id || (typeof member.user === 'string' ? member.user : member._id);

                const isServerOwner =
                  (typeof activeServer.owner === 'object' ? activeServer.owner?._id : activeServer.owner) === targetUserId;
                const isSelf = user?._id === targetUserId;
                const memberRoleIds = (member.roles || []).map((r) => r._id || r);
                const isMuted = member.mutedUntil && new Date(member.mutedUntil) > new Date();

                const isMemberAdmin = (activeServer.admins || []).some(
                  (a) => (typeof a === 'object' ? a._id : a) === targetUserId
                );

                return (
                  <div
                    key={targetUserId || Math.random()}
                    className="flex flex-col bg-[#2b2d31] p-3 rounded text-sm space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {memberUser.avatar ? (
                          <img src={memberUser.avatar} alt="Avatar" className="h-8 w-8 rounded-full object-cover" />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold text-xs">
                            {memberUser.username?.charAt(0).toUpperCase() || 'U'}
                          </div>
                        )}
                        <div>
                          <div className="font-semibold text-white flex items-center space-x-2">
                            <span>{memberUser.username || 'User'}</span>
                            {isServerOwner && (
                              <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded font-bold">
                                OWNER
                              </span>
                            )}
                            {isMemberAdmin && !isServerOwner && (
                              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-1.5 py-0.5 rounded font-bold">
                                🛡️ ADMIN
                              </span>
                            )}
                            {isMuted && (
                              <span className="text-[10px] bg-red-500/20 text-red-300 border border-red-500/40 px-1.5 py-0.5 rounded font-bold">
                                MUTED
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-400">{memberUser.email}</div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      {!isServerOwner && !isSelf && targetUserId && (
                        <div className="flex items-center space-x-2">
                          {/* WhatsApp-style Make / Remove Admin button */}
                          {isOwner && (
                            <button
                              onClick={async () => {
                                if (isMemberAdmin) {
                                  const res = await removeServerAdmin(activeServer._id, targetUserId);
                                  if (!res.success) setErrorMsg(res.error);
                                } else {
                                  const res = await addServerAdmin(activeServer._id, targetUserId);
                                  if (!res.success) setErrorMsg(res.error);
                                }
                              }}
                              className={`rounded px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                                isMemberAdmin
                                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 hover:bg-purple-500/30'
                                  : 'bg-indigo-600 text-white hover:bg-indigo-500'
                              }`}
                            >
                              {isMemberAdmin ? 'Dismiss Admin' : '+ Make Admin'}
                            </button>
                          )}
                          <button
                            onClick={() => setMuteTargetUser(muteTargetUser === targetUserId ? null : targetUserId)}
                            className="rounded bg-orange-500/20 px-2.5 py-1 text-xs font-semibold text-orange-300 hover:bg-orange-500/30 transition-colors cursor-pointer"
                          >
                            {isMuted ? 'Unmute' : 'Mute'}
                          </button>
                          <button
                            onClick={() => handleKickMember(targetUserId)}
                            className="rounded bg-red-500/20 px-2.5 py-1 text-xs font-semibold text-red-300 hover:bg-red-500/30 transition-colors cursor-pointer"
                          >
                            Kick Member
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Mute duration picker form */}
                    {muteTargetUser === targetUserId && (
                      <div className="flex items-center space-x-2 pt-2 border-t border-[#3f4147]">
                        <label className="text-xs font-medium text-gray-300">Duration:</label>
                        <select
                          value={muteDuration}
                          onChange={(e) => setMuteDuration(e.target.value)}
                          className="rounded bg-[#1e1f22] text-xs text-white p-1 outline-none"
                        >
                          <option value="5">5 Minutes</option>
                          <option value="15">15 Minutes</option>
                          <option value="60">1 Hour</option>
                          <option value="1440">24 Hours</option>
                          <option value="0">Unmute</option>
                        </select>
                        <button
                          onClick={() => handleMuteSubmit(targetUserId)}
                          className="rounded bg-indigo-500 px-2.5 py-1 text-xs font-bold text-white hover:bg-indigo-600 cursor-pointer"
                        >
                          Apply Mute
                        </button>
                      </div>
                    )}

                    {/* Roles checklist */}
                    {serverRoles.length > 0 && !isServerOwner && (
                      <div className="flex items-center space-x-2 pt-1">
                        <span className="text-[11px] text-gray-400">Roles:</span>
                        {serverRoles.map((r) => {
                          const isAssigned = memberRoleIds.includes(r._id);
                          return (
                            <button
                              key={r._id}
                              onClick={() => handleRoleToggleForMember(targetUserId, memberRoleIds, r._id)}
                              className={`px-2 py-0.5 text-[11px] rounded border transition-colors cursor-pointer ${
                                isAssigned
                                  ? 'bg-indigo-500 text-white border-indigo-500'
                                  : 'bg-[#1e1f22] text-gray-400 border-[#3f4147] hover:text-white'
                              }`}
                            >
                              {r.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 3: MANAGE CHANNELS */}
          {tab === 'channels' && (
            <div className="space-y-3">
              {channels.map((ch) => (
                <div key={ch._id} className="flex items-center justify-between bg-[#2b2d31] p-3 rounded text-sm">
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-400 text-base font-bold">#</span>
                    <span className="font-semibold text-white">{ch.name}</span>
                    <span className="text-xs text-gray-400">({ch.type || 'text'})</span>
                  </div>
                  <button
                    onClick={() => handleDeleteChannel(ch._id)}
                    className="rounded bg-red-500/20 px-2.5 py-1 text-xs font-semibold text-red-300 hover:bg-red-500/30 transition-colors"
                  >
                    Delete Channel
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* TAB 4: AUDIT LOG */}
          {tab === 'audit-log' && (
            <div className="space-y-3">
              {isLoadingAuditLogs ? (
                <div className="text-center py-6 text-sm text-gray-400">Loading audit logs...</div>
              ) : auditLogs.length === 0 ? (
                <div className="text-center py-6 text-sm text-gray-400 italic">
                  No moderation actions logged yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {auditLogs.map((log) => {
                    const actorName = log.actor?.username || 'System';
                    const targetName = log.target?.username || 'User';
                    const timeStr = new Date(log.createdAt).toLocaleString();

                    let badgeColor = 'bg-gray-500/20 text-gray-300 border-gray-500/40';
                    if (log.action === 'KICK') badgeColor = 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
                    if (log.action === 'BAN') badgeColor = 'bg-red-500/20 text-red-300 border-red-500/40';
                    if (log.action === 'UNBAN') badgeColor = 'bg-blue-500/20 text-blue-300 border-blue-500/40';
                    if (log.action === 'MUTE') badgeColor = 'bg-orange-500/20 text-orange-300 border-orange-500/40';
                    if (log.action === 'UNMUTE') badgeColor = 'bg-green-500/20 text-green-300 border-green-500/40';

                    return (
                      <div
                        key={log._id}
                        className="flex items-center justify-between bg-[#2b2d31] p-3 rounded text-xs"
                      >
                        <div className="flex items-center space-x-3">
                          <span
                            className={`px-2 py-0.5 rounded font-bold border ${badgeColor}`}
                          >
                            {log.action}
                          </span>
                          <div>
                            <span className="font-semibold text-white">{actorName}</span>
                            <span className="text-gray-400"> {log.action.toLowerCase()}ed </span>
                            <span className="font-semibold text-white">{targetName}</span>
                            {log.reason && (
                              <div className="text-gray-400 italic mt-0.5">"{log.reason}"</div>
                            )}
                          </div>
                        </div>
                        <div className="text-[11px] text-gray-400 whitespace-nowrap ml-2">
                          {timeStr}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Danger Zone (Owner Only) */}
        {isOwner && (
          <div className="mt-4 pt-3 border-t border-[#3f4147] flex justify-between items-center flex-shrink-0">
            <div>
              <div className="text-xs font-bold text-red-400 uppercase tracking-wider">Danger Zone</div>
              <div className="text-[11px] text-gray-400">Permanently delete this server, channels, and messages</div>
            </div>
            <button
              onClick={handleDeleteServer}
              className="px-3 py-1.5 rounded bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              Delete Server
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
