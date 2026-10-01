import sanitizeHtml from 'sanitize-html';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Message from '../models/Message.js';
import Channel from '../models/Channel.js';
import Server from '../models/Server.js';
import DMChannel from '../models/DMChannel.js';
import { isUserServerMember } from '../controllers/serverController.js';

// Track online users: Map<userId, Set<socketId>>
const onlineUsers = new Map();

// Track typing fallback timers: Map<`${userId}_${channelId}`, TimeoutHandle>
const typingTimers = new Map();

// Track user message rate limits: Map<userId, Array<timestamp>>
const userMessageRateLimits = new Map();

// Track voice rooms: Map<channelId, Map<socketId, { socketId, userId, username, avatar }>>
const voiceRooms = new Map();

let ioInstance = null;

export const getIO = () => ioInstance;

const broadcastVoiceState = (io) => {
  const voiceStateMap = {};
  voiceRooms.forEach((room, channelId) => {
    voiceStateMap[channelId] = Array.from(room.values());
  });
  io.emit('voice_state_update', voiceStateMap);
};

const handleLeaveVoice = (io, socket) => {
  if (socket.currentVoiceChannel) {
    const channelId = socket.currentVoiceChannel;
    const room = voiceRooms.get(channelId);
    if (room) {
      room.delete(socket.id);
      if (room.size === 0) {
        voiceRooms.delete(channelId);
      } else {
        io.to(`voice_${channelId}`).emit('voice_user_left', {
          socketId: socket.id,
          userId: socket.user._id.toString(),
        });
      }
    }
    socket.leave(`voice_${channelId}`);
    socket.currentVoiceChannel = null;
    broadcastVoiceState(io);
  }
};

export const initSockets = (io) => {
  ioInstance = io;
  // Socket Authentication Middleware

  io.use(async (socket, next) => {
    try {
      let token = socket.handshake.auth?.token;
      if (!token && socket.handshake.headers?.authorization) {
        const parts = socket.handshake.headers.authorization.split(' ');
        if (parts.length === 2) token = parts[1];
      }

      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secretkey123');
      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.user = user;
      next();
    } catch (err) {
      console.error('Socket auth failed:', err.message);
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.user._id.toString();

    // Add user to onlineUsers map
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId).add(socket.id);

    // Update DB status to 'online'
    try {
      await User.findByIdAndUpdate(userId, { status: 'online' });
    } catch (err) {
      console.error('Error updating DB online status:', err.message);
    }

    // Join personal room for mentions
    socket.join(userId);

    // Broadcast updated presence to all clients
    io.emit('presence_update', Array.from(onlineUsers.keys()));


    // Join text/DM channel room
    socket.on('join_channel', (channelId) => {
      if (socket.currentChannel) {
        socket.leave(socket.currentChannel);
      }
      if (channelId) {
        socket.join(channelId);
        socket.currentChannel = channelId;
      }
    });

    // Handle typing_start
    socket.on('typing_start', ({ channelId }) => {
      if (!channelId) return;
      const key = `${userId}_${channelId}`;

      if (typingTimers.has(key)) {
        clearTimeout(typingTimers.get(key));
      }

      socket.to(channelId).emit('user_typing', {
        userId,
        username: socket.user.username,
        channelId,
      });

      const timer = setTimeout(() => {
        typingTimers.delete(key);
        socket.to(channelId).emit('user_stopped_typing', {
          userId,
          channelId,
        });
      }, 5000);

      typingTimers.set(key, timer);
    });

    // Handle typing_stop
    socket.on('typing_stop', ({ channelId }) => {
      if (!channelId) return;
      const key = `${userId}_${channelId}`;

      if (typingTimers.has(key)) {
        clearTimeout(typingTimers.get(key));
        typingTimers.delete(key);
      }

      socket.to(channelId).emit('user_stopped_typing', {
        userId,
        channelId,
      });
    });

    // Handle WebRTC Voice Channel Events
    socket.on('join_voice_channel', ({ channelId }) => {
      if (!channelId) return;

      handleLeaveVoice(io, socket);

      socket.currentVoiceChannel = channelId;
      socket.join(`voice_${channelId}`);

      if (!voiceRooms.has(channelId)) {
        voiceRooms.set(channelId, new Map());
      }

      const room = voiceRooms.get(channelId);
      const existingUsers = Array.from(room.values());

      const currentUserObj = {
        socketId: socket.id,
        userId,
        username: socket.user.username,
        avatar: socket.user.avatar,
      };

      room.set(socket.id, currentUserObj);

      socket.emit('voice_room_users', existingUsers);
      socket.to(`voice_${channelId}`).emit('voice_user_joined', currentUserObj);
      broadcastVoiceState(io);
    });

    socket.on('leave_voice_channel', () => {
      handleLeaveVoice(io, socket);
    });

    // Relaying WebRTC Signaling Messages
    socket.on('voice_offer', ({ targetSocketId, offer }) => {
      io.to(targetSocketId).emit('voice_offer', {
        senderSocketId: socket.id,
        offer,
      });
    });

    socket.on('voice_answer', ({ targetSocketId, answer }) => {
      io.to(targetSocketId).emit('voice_answer', {
        senderSocketId: socket.id,
        answer,
      });
    });

    socket.on('voice_ice_candidate', ({ targetSocketId, candidate }) => {
      io.to(targetSocketId).emit('voice_ice_candidate', {
        senderSocketId: socket.id,
        candidate,
      });
    });

    // Handle send_message
    socket.on('send_message', async (data) => {
      try {
        const { channelId, content, attachments } = data;
        if (!channelId || (!content && (!attachments || attachments.length === 0))) {
          return;
        }

        // Rate limiting check: max 5 messages in 3 seconds per user
        const now = Date.now();
        const timestamps = (userMessageRateLimits.get(userId) || []).filter((t) => now - t < 3000);
        if (timestamps.length >= 5) {
          socket.emit('rate_limited', {
            message: 'You are sending messages too fast! Please slow down.',
          });
          return;
        }
        timestamps.push(now);
        userMessageRateLimits.set(userId, timestamps);

        // Sanitize & length limit content (max 2000 chars)
        let cleanContent = content ? content.slice(0, 2000) : '';
        if (cleanContent) {
          cleanContent = sanitizeHtml(cleanContent, {
            allowedTags: [],
            allowedAttributes: {},
          });
        }

        const key = `${userId}_${channelId}`;
        if (typingTimers.has(key)) {
          clearTimeout(typingTimers.get(key));
          typingTimers.delete(key);
        }
        socket.to(channelId).emit('user_stopped_typing', {
          userId,
          channelId,
        });

        let isAuthorized = false;

        const serverChannel = await Channel.findById(channelId);
        if (serverChannel) {
          const server = await Server.findById(serverChannel.server);
          if (server && isUserServerMember(server, socket.user._id)) {
            const member = server.members.find(
              (m) => m.user.toString() === socket.user._id.toString() || m.user._id?.toString() === socket.user._id.toString()
            );
            if (member && member.mutedUntil && new Date(member.mutedUntil) > new Date()) {
              socket.emit('error_message', {
                message: `You are muted until ${new Date(member.mutedUntil).toLocaleTimeString()}`,
              });
              return;
            }
            isAuthorized = true;
          }
        } else {
          const dmChannel = await DMChannel.findById(channelId);
          if (dmChannel) {
            const isParticipant = dmChannel.participants.some(
              (p) => p.toString() === socket.user._id.toString()
            );
            if (isParticipant) {
              isAuthorized = true;
            }
          }
        }

        if (!isAuthorized) {
          console.error('Unauthorized socket message attempt by user:', socket.user.username);
          return;
        }

        // Parse @username mentions
        let mentions = [];
        if (cleanContent) {
          const matches = cleanContent.match(/@([a-zA-Z0-9_]+)/g);
          if (matches) {
            const usernames = Array.from(
              new Set(matches.map((m) => m.substring(1)))
            );
            const foundUsers = await User.find({ username: { $in: usernames } });
            mentions = foundUsers.map((u) => u._id);
          }
        }

        const message = await Message.create({
          content: cleanContent || '',
          author: socket.user._id,
          channel: channelId,
          attachments: attachments || [],
          mentions,
        });

        const populatedMessage = await Message.findById(message._id).populate(
          'author',
          'username email avatar status'
        );

        io.to(channelId).emit('new_message', populatedMessage);

        // Emit "mention" event to personal rooms of mentioned users
        if (mentions.length > 0) {
          mentions.forEach((targetUserId) => {
            const targetIdStr = targetUserId.toString();
            if (targetIdStr !== userId) {
              io.to(targetIdStr).emit('mention', {
                messageId: message._id,
                channelId,
                author: socket.user.username,
                content: message.content,
              });
            }
          });
        }
      } catch (err) {

        console.error('Socket send_message error:', err.message);
      }
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      handleLeaveVoice(io, socket);

      if (socket.currentChannel) {
        const key = `${userId}_${socket.currentChannel}`;
        if (typingTimers.has(key)) {
          clearTimeout(typingTimers.get(key));
          typingTimers.delete(key);
        }
        socket.to(socket.currentChannel).emit('user_stopped_typing', {
          userId,
          channelId: socket.currentChannel,
        });
      }

      const userSockets = onlineUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          onlineUsers.delete(userId);
          try {
            await User.findByIdAndUpdate(userId, { status: 'offline' });
          } catch (err) {
            console.error('Error updating DB offline status:', err.message);
          }
        }
      }

      io.emit('presence_update', Array.from(onlineUsers.keys()));
    });
  });
};
