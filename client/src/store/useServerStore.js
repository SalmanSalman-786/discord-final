import { create } from 'zustand';
import api from '../utils/api';
import { getSocket } from '../utils/socket';

export const useServerStore = create((set, get) => ({
  servers: [],
  activeServer: null,
  channels: [],
  activeChannel: null,
  messages: [],
  onlineUsers: [],

  // Typing users: Map<channelId, Map<userId, username>> or array [{ userId, username, channelId }]
  typingUsers: [],

  // DM State
  isDMMode: false,
  dms: [],
  activeDM: null,
  allUsers: [],

  // Thread State
  activeThreadParent: null,
  activeThreadReplies: [],
  isLoadingReplies: false,

  // Pin & Search State
  pinnedMessages: [],
  isPinnedPanelOpen: false,
  searchResults: [],
  isSearching: false,
  highlightedMessageId: null,

  // Unread & Mention & Voice State
  readStates: {},
  unreadChannels: {},
  mentionChannels: {},
  voiceStates: {},
  pendingInvites: [],

  // Audit Log State
  auditLogs: [],
  isLoadingAuditLogs: false,

  // Event State
  events: [],
  isEventsModalOpen: false,
  eventToastNotification: null,

  // Rate Limiting State
  rateLimitWarning: null,

  isLoadingServers: false,
  isLoadingChannels: false,
  isLoadingMessages: false,
  error: null,

  // Clear error
  clearError: () => set({ error: null }),

  // Unread & Mention Actions
  fetchReadStates: async () => {
    try {
      const response = await api.get('/channels/read-states');
      const map = {};
      (response.data || []).forEach((rs) => {
        if (rs.channel) {
          map[rs.channel] = rs.lastReadMessageId;
        }
      });
      set({ readStates: map });
    } catch (err) {
      console.error('fetchReadStates error:', err.message);
    }
  },

  markChannelRead: async (channelId) => {
    if (!channelId) return;
    try {
      const response = await api.post(`/channels/${channelId}/read`);
      const updatedRS = response.data;
      set((state) => {
        const newUnread = { ...state.unreadChannels };
        delete newUnread[channelId];
        const newMention = { ...state.mentionChannels };
        delete newMention[channelId];
        return {
          readStates: {
            ...state.readStates,
            [channelId]: updatedRS.lastReadMessageId,
          },
          unreadChannels: newUnread,
          mentionChannels: newMention,
        };
      });
    } catch (err) {
      console.error('markChannelRead error:', err.message);
    }
  },

  // Pin & Search Actions
  togglePinnedPanel: () => {
    const isOpening = !get().isPinnedPanelOpen;
    set({ isPinnedPanelOpen: isOpening });
    if (isOpening) {
      const activeChannel = get().activeChannel;
      if (activeChannel) {
        get().fetchPinnedMessages(activeChannel._id);
      }
    }
  },

  fetchPinnedMessages: async (channelId) => {
    try {
      const response = await api.get(`/channels/${channelId}/pins`);
      set({ pinnedMessages: response.data });
    } catch (err) {
      console.error('fetchPinnedMessages error:', err.message);
    }
  },

  pinMessage: async (messageId) => {
    try {
      await api.post(`/messages/${messageId}/pin`);
      set((state) => ({
        messages: state.messages.map((m) =>
          m._id === messageId ? { ...m, pinned: true } : m
        ),
      }));
      const activeChannel = get().activeChannel;
      if (activeChannel) {
        get().fetchPinnedMessages(activeChannel._id);
      }
      return { success: true };
    } catch (err) {
      console.error('pinMessage error:', err.message);
      return { success: false, error: err.response?.data?.message };
    }
  },

  unpinMessage: async (messageId) => {
    try {
      await api.post(`/messages/${messageId}/unpin`);
      set((state) => ({
        messages: state.messages.map((m) =>
          m._id === messageId ? { ...m, pinned: false } : m
        ),
        pinnedMessages: state.pinnedMessages.filter((m) => m._id !== messageId),
      }));
      return { success: true };
    } catch (err) {
      console.error('unpinMessage error:', err.message);
      return { success: false, error: err.response?.data?.message };
    }
  },

  searchChannelMessages: async (channelId, query) => {
    if (!query || !query.trim()) {
      set({ searchResults: [], isSearching: false });
      return;
    }
    set({ isSearching: true });
    try {
      const response = await api.get(`/channels/${channelId}/search?q=${encodeURIComponent(query)}`);
      set({ searchResults: response.data, isSearching: false });
    } catch (err) {
      console.error('searchChannelMessages error:', err.message);
      set({ isSearching: false });
    }
  },

  setHighlightedMessageId: (messageId) => {
    set({ highlightedMessageId: messageId });
    setTimeout(() => {
      set({ highlightedMessageId: null });
    }, 3000);
  },

  // Thread actions
  openThread: (parentMessage) => {
    set({ activeThreadParent: parentMessage, activeThreadReplies: [] });
    get().fetchReplies(parentMessage._id);
  },

  closeThread: () => {
    set({ activeThreadParent: null, activeThreadReplies: [] });
  },

  fetchReplies: async (parentMessageId) => {
    set({ isLoadingReplies: true });
    try {
      const response = await api.get(`/messages/${parentMessageId}/replies`);
      set({ activeThreadReplies: response.data, isLoadingReplies: false });
    } catch (err) {
      console.error('fetchReplies error:', err.message);
      set({ isLoadingReplies: false });
    }
  },

  sendReply: async (parentMessageId, content, attachments = []) => {
    try {
      const response = await api.post(`/messages/${parentMessageId}/replies`, {
        content,
        attachments,
      });
      const newReply = response.data;
      set((state) => ({
        activeThreadReplies: [...state.activeThreadReplies, newReply],
        messages: state.messages.map((m) =>
          m._id === parentMessageId ? { ...m, replyCount: (m.replyCount || 0) + 1 } : m
        ),
      }));
      return { success: true, reply: newReply };
    } catch (err) {
      console.error('sendReply error:', err.message);
      return { success: false, error: err.response?.data?.message };
    }
  },

  // Toggle DM mode vs Server mode
  toggleDMMode: (isDM) => {
    set({ isDMMode: isDM });
    if (isDM) {
      get().fetchMyDMs();
      get().fetchAllUsers();
    }
  },

  openFriendsView: () => {
    set({ isDMMode: true, activeDM: null, activeChannel: null });
    get().fetchMyDMs();
    get().fetchAllUsers();
  },

  fetchAllUsers: async () => {
    try {
      const response = await api.get('/dms/users');
      set({ allUsers: response.data || [] });
    } catch (err) {
      console.error('fetchAllUsers error:', err.message);
    }
  },

  startDMByQuery: async (query) => {
    try {
      const response = await api.post('/dms/start', { query });
      const dmChannel = response.data;
      await get().fetchMyDMs();
      get().selectDM(dmChannel);
      return { success: true, dmChannel };
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to start DM';
      set({ error: msg });
      return { success: false, error: msg };
    }
  },

  // Initialize socket listeners
  initSocketListeners: () => {
    const socket = getSocket();
    if (!socket) return;

    socket.off('new_message');
    socket.on('new_message', (message) => {
      const activeChannel = get().activeChannel;
      const activeDM = get().activeDM;
      const isDMMode = get().isDMMode;

      const currentRoomId = isDMMode ? activeDM?._id : activeChannel?._id;

      if (currentRoomId && message.channel === currentRoomId && !message.parentMessage) {
        set((state) => {
          const exists = state.messages.some((m) => m._id === message._id);
          if (exists) return state;
          return { messages: [...state.messages, message] };
        });
      } else if (message.channel && message.channel !== currentRoomId) {
        set((state) => ({
          unreadChannels: { ...state.unreadChannels, [message.channel]: true },
        }));
      }
    });

    // Listen for @mentions
    socket.off('mention');
    socket.on('mention', ({ channelId }) => {
      if (channelId) {
        set((state) => ({
          unreadChannels: { ...state.unreadChannels, [channelId]: true },
          mentionChannels: { ...state.mentionChannels, [channelId]: true },
        }));
      }
    });

    // Listen for rate_limited warnings
    socket.off('rate_limited');
    socket.on('rate_limited', ({ message }) => {
      set({ rateLimitWarning: message || 'You are sending messages too fast!' });
      setTimeout(() => {
        set({ rateLimitWarning: null });
      }, 4000);
    });

    // Listen for presence updates
    socket.off('presence_update');
    socket.on('presence_update', (onlineUserIds) => {
      set({ onlineUsers: onlineUserIds });
    });

    // Listen for voice state updates
    socket.off('voice_state_update');
    socket.on('voice_state_update', (voiceStateMap) => {
      set({ voiceStates: voiceStateMap || {} });
    });

    // Listen for incoming server invites
    socket.off('server_invite_received');
    socket.on('server_invite_received', (invite) => {
      set((state) => {
        const exists = state.pendingInvites.some((i) => i._id === invite._id);
        if (exists) return state;
        return { pendingInvites: [...state.pendingInvites, invite] };
      });
    });

    // Listen for message updates, deletions, and reactions
    socket.off('message_updated');
    socket.on('message_updated', (updatedMessage) => {
      set((state) => ({
        messages: state.messages.map((m) =>
          m._id === updatedMessage._id ? updatedMessage : m
        ),
        activeThreadReplies: state.activeThreadReplies.map((m) =>
          m._id === updatedMessage._id ? updatedMessage : m
        ),
        pinnedMessages: state.pinnedMessages.map((m) =>
          m._id === updatedMessage._id ? updatedMessage : m
        ),
      }));
    });

    socket.off('message_deleted');
    socket.on('message_deleted', ({ messageId }) => {
      set((state) => ({
        messages: state.messages.filter((m) => m._id !== messageId),
        activeThreadReplies: state.activeThreadReplies.filter((m) => m._id !== messageId),
        pinnedMessages: state.pinnedMessages.filter((m) => m._id !== messageId),
      }));
    });

    socket.off('message_reaction_updated');
    socket.on('message_reaction_updated', ({ messageId, reactions }) => {
      set((state) => ({
        messages: state.messages.map((m) =>
          m._id === messageId ? { ...m, reactions } : m
        ),
        activeThreadReplies: state.activeThreadReplies.map((m) =>
          m._id === messageId ? { ...m, reactions } : m
        ),
        pinnedMessages: state.pinnedMessages.map((m) =>
          m._id === messageId ? { ...m, reactions } : m
        ),
      }));
    });

    // Listen for pinned and unpinned socket events
    socket.off('message_pinned');
    socket.on('message_pinned', ({ messageId }) => {
      set((state) => ({
        messages: state.messages.map((m) =>
          m._id === messageId ? { ...m, pinned: true } : m
        ),
      }));
      const activeChannel = get().activeChannel;
      if (activeChannel) {
        get().fetchPinnedMessages(activeChannel._id);
      }
    });

    socket.off('message_unpinned');
    socket.on('message_unpinned', ({ messageId }) => {
      set((state) => ({
        messages: state.messages.map((m) =>
          m._id === messageId ? { ...m, pinned: false } : m
        ),
        pinnedMessages: state.pinnedMessages.filter((m) => m._id !== messageId),
      }));
    });


    // Listen for new replies
    socket.off('new_reply');
    socket.on('new_reply', ({ parentMessageId, reply, replyCount }) => {
      set((state) => {
        const updatedMessages = state.messages.map((m) =>
          m._id === parentMessageId ? { ...m, replyCount } : m
        );

        let updatedReplies = state.activeThreadReplies;
        if (state.activeThreadParent?._id === parentMessageId) {
          const exists = state.activeThreadReplies.some((r) => r._id === reply._id);
          if (!exists) {
            updatedReplies = [...state.activeThreadReplies, reply];
          }
        }

        return {
          messages: updatedMessages,
          activeThreadReplies: updatedReplies,
          activeThreadParent:
            state.activeThreadParent?._id === parentMessageId
              ? { ...state.activeThreadParent, replyCount }
              : state.activeThreadParent,
        };
      });
    });

    // Listen for user_typing
    socket.off('user_typing');
    socket.on('user_typing', ({ userId, username, channelId }) => {
      set((state) => {
        const filtered = state.typingUsers.filter(
          (t) => !(t.userId === userId && t.channelId === channelId)
        );
        return { typingUsers: [...filtered, { userId, username, channelId }] };
      });
    });

    // Listen for event socket events
    socket.off('event_created');
    socket.on('event_created', (event) => {
      const activeServer = get().activeServer;
      if (activeServer && event.server === activeServer._id) {
        set((state) => ({
          events: [...state.events.filter((e) => e._id !== event._id), event],
        }));
      }
    });

    socket.off('event_updated');
    socket.on('event_updated', (updatedEvent) => {
      set((state) => ({
        events: state.events.map((e) =>
          e._id === updatedEvent._id ? updatedEvent : e
        ),
      }));
    });

    socket.off('event_deleted');
    socket.on('event_deleted', ({ eventId }) => {
      set((state) => ({
        events: state.events.filter((e) => e._id !== eventId),
      }));
    });

    socket.off('event_reminder');
    socket.on('event_reminder', (notification) => {
      set({ eventToastNotification: { ...notification, type: 'reminder' } });
      setTimeout(() => {
        set({ eventToastNotification: null });
      }, 8000);
    });

    socket.off('event_started');
    socket.on('event_started', (notification) => {
      set({ eventToastNotification: { ...notification, type: 'started' } });
      set((state) => ({
        events: state.events.map((e) =>
          e._id === notification.eventId ? { ...e, status: 'active' } : e
        ),
      }));
      setTimeout(() => {
        set({ eventToastNotification: null });
      }, 10000);
    });
  },



  // Send typing start
  sendTypingStart: (channelId) => {
    const socket = getSocket();
    if (socket && socket.connected && channelId) {
      socket.emit('typing_start', { channelId });
    }
  },

  // Send typing stop
  sendTypingStop: (channelId) => {
    const socket = getSocket();
    if (socket && socket.connected && channelId) {
      socket.emit('typing_stop', { channelId });
    }
  },

  // Fetch servers for logged-in user
  fetchMyServers: async () => {
    set({ isLoadingServers: true, error: null });
    try {
      const response = await api.get('/servers/mine');
      const servers = response.data;
      set({ servers, isLoadingServers: false });

      get().fetchReadStates();
      get().initSocketListeners();

      const currentActive = get().activeServer;
      if (!get().isDMMode && servers.length > 0) {
        if (!currentActive || !servers.find((s) => s._id === currentActive._id)) {
          get().selectServer(servers[0]);
        }
      }
    } catch (err) {
      console.error('Fetch servers error:', err.message);
      set({ error: 'Failed to load servers', isLoadingServers: false });
    }
  },

  // Select a server
  selectServer: async (server) => {
    set({ activeServer: server, isDMMode: false, isLoadingChannels: true });
    try {
      const response = await api.get(`/servers/${server._id}/channels`);
      const channels = response.data;
      set({ channels, isLoadingChannels: false });

      get().fetchServerRoles(server._id);
      get().fetchServerEvents(server._id);

      if (channels.length > 0) {
        get().selectChannel(channels[0]);
      } else {
        set({ activeChannel: null, messages: [] });
      }
    } catch (err) {
      console.error('Fetch channels error:', err.message);
      set({ error: 'Failed to load channels', isLoadingChannels: false });
    }
  },

  // Select a server channel
  selectChannel: async (channel) => {
    const socket = getSocket();
    set({ activeChannel: channel, isDMMode: false, activeDM: null });

    if (channel) {
      if (socket && socket.connected) {
        socket.emit('join_channel', channel._id);
      }
      get().initSocketListeners();
      get().fetchMessages(channel._id);
      get().markChannelRead(channel._id);
    } else {
      set({ messages: [] });
    }
  },

  // Fetch messages for active server channel
  fetchMessages: async (channelId) => {
    set({ isLoadingMessages: true });
    try {
      const response = await api.get(`/channels/${channelId}/messages?limit=100`);
      const rawMessages = response.data.messages || [];
      const messages = [...rawMessages].reverse();
      set({ messages, isLoadingMessages: false });
    } catch (err) {
      console.error('Fetch messages error:', err.message);
      set({ error: 'Failed to load messages', isLoadingMessages: false });
    }
  },

  // Send a message (Server channel or DM channel)
  sendMessage: async (content, attachments = []) => {
    const isDMMode = get().isDMMode;
    const activeChannel = get().activeChannel;
    const activeDM = get().activeDM;
    const socket = getSocket();

    const targetChannelId = isDMMode ? activeDM?._id : activeChannel?._id;
    if (!targetChannelId) return;

    // Send typing stop when sending message
    get().sendTypingStop(targetChannelId);

    if (socket && socket.connected) {
      socket.emit('send_message', {
        channelId: targetChannelId,
        content,
        attachments,
      });
    } else {
      try {
        const endpoint = isDMMode
          ? `/dms/${targetChannelId}/messages`
          : `/channels/${targetChannelId}/messages`;
        await api.post(endpoint, { content, attachments });

        if (isDMMode) {
          get().fetchDMMessages(targetChannelId);
        } else {
          get().fetchMessages(targetChannelId);
        }
      } catch (err) {
        console.error('Send message error:', err.message);
        set({ error: err.response?.data?.message || 'Failed to send message' });
      }
    }
  },

  // Fetch DMs list
  fetchMyDMs: async () => {
    try {
      const response = await api.get('/dms/mine');
      set({ dms: response.data });
      get().initSocketListeners();
    } catch (err) {
      console.error('Fetch DMs error:', err.message);
    }
  },

  // Open DM with a user
  openDM: async (userId) => {
    try {
      const response = await api.post(`/dms/${userId}`);
      const dmChannel = response.data;

      await get().fetchMyDMs();
      get().selectDM(dmChannel);
    } catch (err) {
      console.error('Open DM error:', err.message);
      set({ error: err.response?.data?.message || 'Failed to open DM' });
    }
  },

  // Select a DM conversation
  selectDM: (dmChannel) => {
    const socket = getSocket();
    set({ isDMMode: true, activeDM: dmChannel, activeChannel: null });

    if (dmChannel) {
      if (socket && socket.connected) {
        socket.emit('join_channel', dmChannel._id);
      }
      get().initSocketListeners();
      get().fetchDMMessages(dmChannel._id);
      get().markChannelRead(dmChannel._id);
    }
  },

  // Fetch DM messages
  fetchDMMessages: async (dmChannelId) => {
    set({ isLoadingMessages: true });
    try {
      const response = await api.get(`/dms/${dmChannelId}/messages?limit=100`);
      const rawMessages = response.data.messages || [];
      const messages = [...rawMessages].reverse();
      set({ messages, isLoadingMessages: false });
    } catch (err) {
      console.error('Fetch DM messages error:', err.message);
      set({ error: 'Failed to load DM messages', isLoadingMessages: false });
    }
  },

  // Fetch roles for active server
  fetchServerRoles: async (serverId) => {
    try {
      const response = await api.get(`/servers/${serverId}/roles`);
      set({ serverRoles: response.data });
    } catch (err) {
      console.error('Fetch server roles error:', err.message);
    }
  },

  // Create role for server
  createRole: async (serverId, roleData) => {
    try {
      const response = await api.post(`/servers/${serverId}/roles`, roleData);
      await get().fetchServerRoles(serverId);
      return { success: true, role: response.data };
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to create role';
      set({ error: msg });
      return { success: false, error: msg };
    }
  },

  // Assign roles to member
  assignMemberRole: async (serverId, userId, roleIds) => {
    try {
      const response = await api.post(`/servers/${serverId}/members/${userId}/roles`, {
        roleIds,
      });
      set({ activeServer: response.data });
      await get().fetchMyServers();
      return { success: true };
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to assign role';
      set({ error: msg });
      return { success: false, error: msg };
    }
  },

  // Kick member from server
  kickMember: async (serverId, userId, reason = '') => {
    try {
      const res = await api.delete(`/servers/${serverId}/members/${userId}`, { data: { reason } });
      if (res.data?.server) {
        set({ activeServer: res.data.server });
      }
      await get().fetchMyServers();
      return { success: true };
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to kick member';
      set({ error: msg });
      return { success: false, error: msg };
    }
  },

  // Ban user from server
  banUser: async (serverId, userId, reason = '') => {
    try {
      const res = await api.post(`/servers/${serverId}/bans/${userId}`, { reason });
      if (res.data?.server) {
        set({ activeServer: res.data.server });
      }
      await get().fetchMyServers();
      return { success: true };
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to ban user';
      set({ error: msg });
      return { success: false, error: msg };
    }
  },

  // Unban user from server
  unbanUser: async (serverId, userId) => {
    try {
      await api.delete(`/servers/${serverId}/bans/${userId}`);
      await get().fetchMyServers();
      return { success: true };
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to unban user';
      set({ error: msg });
      return { success: false, error: msg };
    }
  },

  // Mute member in server
  muteMember: async (serverId, userId, durationMinutes, reason = '') => {
    try {
      const res = await api.post(`/servers/${serverId}/members/${userId}/mute`, {
        durationMinutes,
        reason,
      });
      if (res.data?.server) {
        set({ activeServer: res.data.server });
      }
      await get().fetchMyServers();
      return { success: true, message: res.data?.message };
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to mute member';
      set({ error: msg });
      return { success: false, error: msg };
    }
  },

  // Fetch Audit Logs for server
  fetchAuditLogs: async (serverId) => {
    set({ isLoadingAuditLogs: true });
    try {
      const res = await api.get(`/servers/${serverId}/audit-log`);
      set({ auditLogs: res.data, isLoadingAuditLogs: false });
    } catch (err) {
      console.error('fetchAuditLogs error:', err.message);
      set({ isLoadingAuditLogs: false });
    }
  },

  // Delete channel
  deleteChannel: async (serverId, channelId) => {
    try {
      await api.delete(`/servers/${serverId}/channels/${channelId}`);
      const channelsRes = await api.get(`/servers/${serverId}/channels`);
      const updatedChannels = channelsRes.data;
      set({ channels: updatedChannels });

      if (get().activeChannel?._id === channelId) {
        if (updatedChannels.length > 0) {
          get().selectChannel(updatedChannels[0]);
        } else {
          set({ activeChannel: null, messages: [] });
        }
      }
      return { success: true };
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to delete channel';
      set({ error: msg });
      return { success: false, error: msg };
    }
  },

  // Create server & join server existing methods
  createServer: async (name, icon) => {
    try {
      const response = await api.post('/servers', { name, icon });
      const newServer = response.data;
      await get().fetchMyServers();
      await get().selectServer(newServer);
      return { success: true };
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to create server';
      set({ error: msg });
      return { success: false, error: msg };
    }
  },

  joinServer: async (serverId) => {
    try {
      const response = await api.post(`/servers/${serverId}/join`);
      const joinedServer = response.data;
      await get().fetchMyServers();
      await get().selectServer(joinedServer);
      return { success: true };
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to join server';
      set({ error: msg });
      return { success: false, error: msg };
    }
  },

  deleteServer: async (serverId) => {
    try {
      await api.delete(`/servers/${serverId}`);
      await get().fetchMyServers();
      return { success: true };
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to delete server';
      set({ error: msg });
      return { success: false, error: msg };
    }
  },

  fetchMyPendingInvites: async () => {
    try {
      const response = await api.get('/invites/mine');
      set({ pendingInvites: response.data || [] });
    } catch (err) {
      console.error('fetchMyPendingInvites error:', err.message);
    }
  },

  acceptServerInvite: async (inviteId) => {
    try {
      const response = await api.post(`/invites/${inviteId}/accept`);
      const { server } = response.data;
      set((state) => ({
        pendingInvites: state.pendingInvites.filter((i) => i._id !== inviteId),
      }));
      await get().fetchMyServers();
      if (server) {
        await get().selectServer(server);
      }
      return { success: true };
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to accept invite';
      set({ error: msg });
      return { success: false, error: msg };
    }
  },

  declineServerInvite: async (inviteId) => {
    try {
      await api.post(`/invites/${inviteId}/decline`);
      set((state) => ({
        pendingInvites: state.pendingInvites.filter((i) => i._id !== inviteId),
      }));
      return { success: true };
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to decline invite';
      set({ error: msg });
      return { success: false, error: msg };
    }
  },

  createChannel: async (name, type = 'text') => {
    const activeServer = get().activeServer;
    if (!activeServer) return { success: false, error: 'No active server' };

    try {
      const response = await api.post(`/servers/${activeServer._id}/channels`, { name, type });
      const newChannel = response.data;
      const channelsRes = await api.get(`/servers/${activeServer._id}/channels`);
      set({ channels: channelsRes.data });
      get().selectChannel(newChannel);
      return { success: true };
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to create channel';
      set({ error: msg });
      return { success: false, error: msg };
    }
  },

  // Toggle Reaction on a Message
  toggleReaction: async (messageId, emoji) => {
    try {
      const response = await api.post(`/messages/${messageId}/react`, { emoji });
      const { reactions } = response.data;
      set((state) => ({
        messages: state.messages.map((m) =>
          m._id === messageId ? { ...m, reactions } : m
        ),
      }));
      return { success: true };
    } catch (err) {
      console.error('toggleReaction error:', err.message);
      return { success: false };
    }
  },

  // Edit Message
  editMessage: async (messageId, content) => {
    try {
      const response = await api.patch(`/messages/${messageId}`, { content });
      const updatedMessage = response.data;
      set((state) => ({
        messages: state.messages.map((m) =>
          m._id === messageId ? updatedMessage : m
        ),
      }));
      return { success: true };
    } catch (err) {
      console.error('editMessage error:', err.message);
      return { success: false, error: err.response?.data?.message };
    }
  },

  // Delete Message
  deleteMessage: async (messageId) => {
    try {
      await api.delete(`/messages/${messageId}`);
      set((state) => ({
        messages: state.messages.filter((m) => m._id !== messageId),
      }));
      return { success: true };
    } catch (err) {
      console.error('deleteMessage error:', err.message);
      return { success: false, error: err.response?.data?.message };
    }
  },

  // Event Actions
  openEventsModal: () => set({ isEventsModalOpen: true }),
  closeEventsModal: () => set({ isEventsModalOpen: false }),

  fetchServerEvents: async (serverId) => {
    if (!serverId) return;
    try {
      const response = await api.get(`/servers/${serverId}/events`);
      set({ events: response.data || [] });
    } catch (err) {
      console.error('fetchServerEvents error:', err.message);
    }
  },

  createEvent: async (serverId, eventData) => {
    try {
      const response = await api.post(`/servers/${serverId}/events`, eventData);
      const newEvent = response.data;
      set((state) => ({ events: [...state.events, newEvent] }));
      return { success: true, event: newEvent };
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to create event';
      set({ error: msg });
      return { success: false, error: msg };
    }
  },

  updateEvent: async (eventId, eventData) => {
    try {
      const response = await api.patch(`/events/${eventId}`, eventData);
      const updatedEvent = response.data;
      set((state) => ({
        events: state.events.map((e) =>
          e._id === eventId ? updatedEvent : e
        ),
      }));
      return { success: true, event: updatedEvent };
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update event';
      set({ error: msg });
      return { success: false, error: msg };
    }
  },

  deleteEvent: async (eventId) => {
    try {
      await api.delete(`/events/${eventId}`);
      set((state) => ({
        events: state.events.filter((e) => e._id !== eventId),
      }));
      return { success: true };
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to delete event';
      set({ error: msg });
      return { success: false, error: msg };
    }
  },

  toggleEventInterested: async (eventId) => {
    try {
      const response = await api.post(`/events/${eventId}/interested`);
      const updatedEvent = response.data;
      set((state) => ({
        events: state.events.map((e) =>
          e._id === eventId ? updatedEvent : e
        ),
      }));
      return { success: true, event: updatedEvent };
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to toggle interest';
      set({ error: msg });
      return { success: false, error: msg };
    }
  },

  // WhatsApp-style Server Admin Actions
  addServerAdmin: async (serverId, targetUserId) => {
    try {
      const response = await api.post(`/servers/${serverId}/admins/${targetUserId}`);
      const updatedServer = response.data.server;
      if (updatedServer) set({ activeServer: updatedServer });
      await get().fetchMyServers();
      return { success: true };
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to add admin';
      set({ error: msg });
      return { success: false, error: msg };
    }
  },

  removeServerAdmin: async (serverId, targetUserId) => {
    try {
      const response = await api.delete(`/servers/${serverId}/admins/${targetUserId}`);
      const updatedServer = response.data.server;
      if (updatedServer) set({ activeServer: updatedServer });
      await get().fetchMyServers();
      return { success: true };
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to remove admin';
      set({ error: msg });
      return { success: false, error: msg };
    }
  },
}));

