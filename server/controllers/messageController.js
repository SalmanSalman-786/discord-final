import sanitizeHtml from 'sanitize-html';
import Message from '../models/Message.js';
import Channel from '../models/Channel.js';
import Server from '../models/Server.js';
import User from '../models/User.js';
import ReadState from '../models/ReadState.js';
import { isUserServerMember } from './serverController.js';
import { getIO } from '../sockets/socketHandler.js';

// @desc    Get paginated messages for a channel (most recent first)
// @route   GET /api/channels/:id/messages
// @access  Private (Server Members only)
export const getMessages = async (req, res) => {
  try {
    const channelId = req.params.id;

    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }

    const server = await Server.findById(channel.server);
    if (!server) {
      return res.status(404).json({ message: 'Server not found' });
    }

    // Membership check
    if (!isUserServerMember(server, req.user._id)) {
      return res.status(403).json({ message: 'Access denied: You are not a member of this server' });
    }

    // Pagination query parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const query = { channel: channelId, parentMessage: null };
    const totalMessages = await Message.countDocuments(query);
    const totalPages = Math.ceil(totalMessages / limit) || 1;

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('author', 'username email avatar status');

    return res.json({
      messages,
      page,
      limit,
      totalMessages,
      totalPages,
    });
  } catch (error) {
    console.error('Get messages error:', error);
    return res.status(500).json({ message: 'Server error fetching messages' });
  }
};

// @desc    Post a new message in a channel
// @route   POST /api/channels/:id/messages
// @access  Private (Server Members only)
export const createMessage = async (req, res) => {
  try {
    const channelId = req.params.id;
    const { content, attachments } = req.body;

    if (!content && (!attachments || attachments.length === 0)) {
      return res.status(400).json({ message: 'Message content or attachments required' });
    }

    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }

    const server = await Server.findById(channel.server);
    if (!server) {
      return res.status(404).json({ message: 'Server not found' });
    }

    // Membership check
    if (!isUserServerMember(server, req.user._id)) {
      return res.status(403).json({ message: 'Access denied: You are not a member of this server' });
    }

    // Mute check
    const member = server.members.find(
      (m) => m.user.toString() === req.user._id.toString() || m.user._id?.toString() === req.user._id.toString()
    );
    if (member && member.mutedUntil && new Date(member.mutedUntil) > new Date()) {
      return res.status(403).json({
        message: `You are muted until ${new Date(member.mutedUntil).toLocaleTimeString()}`,
        mutedUntil: member.mutedUntil,
      });
    }

    // Sanitize & length limit content (max 2000 chars)
    let cleanContent = content ? content.slice(0, 2000) : '';
    if (cleanContent) {
      cleanContent = sanitizeHtml(cleanContent, {
        allowedTags: [],
        allowedAttributes: {},
      });
    }

    // Parse @username mentions
    let mentions = [];
    if (cleanContent) {
      const matches = cleanContent.match(/@([a-zA-Z0-9_]+)/g);
      if (matches) {
        const usernames = Array.from(new Set(matches.map((m) => m.substring(1))));
        const foundUsers = await User.find({ username: { $in: usernames } });
        mentions = foundUsers.map((u) => u._id);
      }
    }

    const message = await Message.create({
      content: cleanContent,
      author: req.user._id,
      channel: channelId,
      attachments: attachments || [],
      mentions,
    });

    const populatedMessage = await Message.findById(message._id).populate(
      'author',
      'username email avatar status'
    );

    const io = getIO();
    if (io) {
      io.to(channelId).emit('new_message', populatedMessage);
      if (mentions.length > 0) {
        mentions.forEach((targetUserId) => {
          const targetIdStr = targetUserId.toString();
          if (targetIdStr !== req.user._id.toString()) {
            io.to(targetIdStr).emit('mention', {
              messageId: message._id,
              channelId,
              author: req.user.username,
              content: message.content,
            });
          }
        });
      }
    }

    return res.status(201).json(populatedMessage);
  } catch (error) {
    console.error('Create message error:', error);
    return res.status(500).json({ message: 'Server error creating message' });
  }
};

// @desc    Update a message
// @route   PATCH /api/messages/:id
// @access  Private (Author only)
export const updateMessage = async (req, res) => {
  try {
    const messageId = req.params.id;
    const { content } = req.body;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    if (message.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only message author can edit this message' });
    }

    message.content = content || '';
    message.edited = true;
    await message.save();

    const populated = await Message.findById(message._id).populate('author', 'username email avatar status');

    const io = getIO();
    if (io) {
      io.to(message.channel.toString()).emit('message_updated', populated);
    }

    return res.json(populated);
  } catch (error) {
    console.error('Update message error:', error);
    return res.status(500).json({ message: 'Server error updating message' });
  }
};

// @desc    Delete a message
// @route   DELETE /api/messages/:id
// @access  Private (Author or server owner/permission)
export const deleteMessage = async (req, res) => {
  try {
    const messageId = req.params.id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    const isAuthor = message.author.toString() === req.user._id.toString();
    if (!isAuthor) {
      const channel = await Channel.findById(message.channel);
      if (channel) {
        const server = await Server.findById(channel.server);
        const isOwner = server?.owner.toString() === req.user._id.toString();
        if (!isOwner) {
          return res.status(403).json({ message: 'Not authorized to delete this message' });
        }
      } else {
        return res.status(403).json({ message: 'Not authorized to delete this message' });
      }
    }

    const channelId = message.channel.toString();
    await Message.findByIdAndDelete(messageId);

    const io = getIO();
    if (io) {
      io.to(channelId).emit('message_deleted', { messageId, channelId });
    }

    return res.json({ message: 'Message deleted', messageId });
  } catch (error) {
    console.error('Delete message error:', error);
    return res.status(500).json({ message: 'Server error deleting message' });
  }
};

// @desc    Toggle emoji reaction on a message
// @route   POST /api/messages/:id/react
// @access  Private
export const toggleReaction = async (req, res) => {
  try {
    const messageId = req.params.id;
    const { emoji } = req.body;

    if (!emoji) {
      return res.status(400).json({ message: 'Emoji is required' });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    const userId = req.user._id.toString();
    if (!message.reactions) {
      message.reactions = [];
    }

    let reactionEntry = message.reactions.find((r) => r.emoji === emoji);

    if (!reactionEntry) {
      message.reactions.push({
        emoji,
        users: [req.user._id],
      });
    } else {
      const userIndex = reactionEntry.users.findIndex(
        (u) => u.toString() === userId
      );

      if (userIndex !== -1) {
        reactionEntry.users.splice(userIndex, 1);
        if (reactionEntry.users.length === 0) {
          message.reactions = message.reactions.filter((r) => r.emoji !== emoji);
        }
      } else {
        reactionEntry.users.push(req.user._id);
      }
    }

    await message.save();

    const io = getIO();
    if (io) {
      io.to(message.channel.toString()).emit('message_reaction_updated', {
        messageId: message._id,
        reactions: message.reactions,
      });
    }

    return res.json({ messageId: message._id, reactions: message.reactions });
  } catch (error) {
    console.error('Toggle reaction error:', error);
    return res.status(500).json({ message: 'Server error toggling reaction' });
  }
};

// @desc    Post a reply to a message (thread)
// @route   POST /api/messages/:id/replies
// @access  Private
export const createReply = async (req, res) => {
  try {
    const parentId = req.params.id;
    const { content, attachments } = req.body;

    if (!content && (!attachments || attachments.length === 0)) {
      return res.status(400).json({ message: 'Reply content or attachments required' });
    }

    const parentMessage = await Message.findById(parentId);
    if (!parentMessage) {
      return res.status(404).json({ message: 'Parent message not found' });
    }

    const reply = await Message.create({
      content: content || '',
      author: req.user._id,
      channel: parentMessage.channel,
      attachments: attachments || [],
      parentMessage: parentMessage._id,
    });

    const updatedParent = await Message.findByIdAndUpdate(
      parentMessage._id,
      { $inc: { replyCount: 1 } },
      { new: true }
    );

    const populatedReply = await Message.findById(reply._id).populate(
      'author',
      'username email avatar status'
    );

    const io = getIO();
    if (io) {
      io.to(parentMessage.channel.toString()).emit('new_reply', {
        parentMessageId: parentMessage._id,
        reply: populatedReply,
        replyCount: updatedParent.replyCount,
      });
    }

    return res.status(201).json(populatedReply);
  } catch (error) {
    console.error('Create reply error:', error);
    return res.status(500).json({ message: 'Server error creating reply' });
  }
};

// @desc    Get thread replies for a message (oldest first)
// @route   GET /api/messages/:id/replies
// @access  Private
export const getReplies = async (req, res) => {
  try {
    const parentId = req.params.id;

    const parentMessage = await Message.findById(parentId);
    if (!parentMessage) {
      return res.status(404).json({ message: 'Parent message not found' });
    }

    const replies = await Message.find({ parentMessage: parentId })
      .sort({ createdAt: 1 })
      .populate('author', 'username email avatar status');

    return res.json(replies);
  } catch (error) {
    console.error('Get replies error:', error);
    return res.status(500).json({ message: 'Server error fetching replies' });
  }
};

// @desc    Pin a message
// @route   POST /api/messages/:id/pin
// @access  Private
export const pinMessage = async (req, res) => {
  try {
    const messageId = req.params.id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    message.pinned = true;
    await message.save();

    const io = getIO();
    if (io) {
      io.to(message.channel.toString()).emit('message_pinned', {
        messageId: message._id,
        channelId: message.channel,
        pinned: true,
      });
    }

    return res.json({ messageId: message._id, pinned: true });
  } catch (error) {
    console.error('Pin message error:', error);
    return res.status(500).json({ message: 'Server error pinning message' });
  }
};

// @desc    Unpin a message
// @route   POST /api/messages/:id/unpin
// @access  Private
export const unpinMessage = async (req, res) => {
  try {
    const messageId = req.params.id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    message.pinned = false;
    await message.save();

    const io = getIO();
    if (io) {
      io.to(message.channel.toString()).emit('message_unpinned', {
        messageId: message._id,
        channelId: message.channel,
        pinned: false,
      });
    }

    return res.json({ messageId: message._id, pinned: false });
  } catch (error) {
    console.error('Unpin message error:', error);
    return res.status(500).json({ message: 'Server error unpinning message' });
  }
};

// @desc    Get pinned messages for a channel
// @route   GET /api/channels/:id/pins
// @access  Private
export const getPinnedMessages = async (req, res) => {
  try {
    const channelId = req.params.id;

    const pinnedMessages = await Message.find({ channel: channelId, pinned: true })
      .sort({ createdAt: -1 })
      .populate('author', 'username email avatar status');

    return res.json(pinnedMessages);
  } catch (error) {
    console.error('Get pinned messages error:', error);
    return res.status(500).json({ message: 'Server error fetching pinned messages' });
  }
};

// @desc    Search messages in a channel by content regex
// @route   GET /api/channels/:id/search
// @access  Private
export const searchMessages = async (req, res) => {
  try {
    const channelId = req.params.id;
    const { q } = req.query;

    if (!q || !q.trim()) {
      return res.json([]);
    }

    const regex = new RegExp(q.trim(), 'i');
    const results = await Message.find({
      channel: channelId,
      parentMessage: null,
      content: { $regex: regex },
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('author', 'username email avatar status');

    return res.json(results);
  } catch (error) {
    console.error('Search messages error:', error);
    return res.status(500).json({ message: 'Server error searching messages' });
  }
};

// @desc    Mark a channel as read for current user
// @route   POST /api/channels/:id/read
// @access  Private
export const markChannelRead = async (req, res) => {
  try {
    const channelId = req.params.id;
    const userId = req.user._id;

    const latestMessage = await Message.findOne({ channel: channelId }).sort({ createdAt: -1 });

    const readState = await ReadState.findOneAndUpdate(
      { user: userId, channel: channelId },
      { lastReadMessageId: latestMessage ? latestMessage._id : null },
      { upsert: true, new: true }
    );

    return res.json(readState);
  } catch (error) {
    console.error('Mark channel read error:', error);
    return res.status(500).json({ message: 'Server error marking channel read' });
  }
};

// @desc    Get all read states for current user
// @route   GET /api/channels/read-states
// @access  Private
export const getReadStates = async (req, res) => {
  try {
    const userId = req.user._id;
    const readStates = await ReadState.find({ user: userId });
    return res.json(readStates);
  } catch (error) {
    console.error('Get read states error:', error);
    return res.status(500).json({ message: 'Server error fetching read states' });
  }
};




