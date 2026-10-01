import mongoose from 'mongoose';
import Server from '../models/Server.js';
import Channel from '../models/Channel.js';
import Message from '../models/Message.js';

// Helper to check if a user is a member of a server
export const isUserServerMember = (server, userId) => {
  if (!server || !server.members) return false;
  const uid = userId.toString();
  return server.members.some((m) => m.user.toString() === uid || m.user._id?.toString() === uid);
};

// @desc    Create a new server
// @route   POST /api/servers
// @access  Private
export const createServer = async (req, res) => {
  try {
    const { name, icon } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Server name is required' });
    }

    // 1. Create server instance with owner as initial member
    const server = new Server({
      name,
      icon: icon || '',
      owner: req.user._id,
      members: [{ user: req.user._id, roles: [] }],
      channels: [],
    });

    await server.save();

    // 2. Create default "general" text channel and "General Voice" voice channel
    const defaultTextChannel = await Channel.create({
      name: 'general',
      type: 'text',
      server: server._id,
    });

    const defaultVoiceChannel = await Channel.create({
      name: 'General Voice',
      type: 'voice',
      server: server._id,
    });

    // 3. Link channels to server
    server.channels.push(defaultTextChannel._id, defaultVoiceChannel._id);
    await server.save();

    const populatedServer = await Server.findById(server._id)
      .populate('owner', 'username email avatar status')
      .populate('channels');

    return res.status(201).json(populatedServer);
  } catch (error) {
    console.error('Create server error:', error);
    return res.status(500).json({ message: 'Server error creating server' });
  }
};

// @desc    Get all servers logged in user belongs to
// @route   GET /api/servers/mine
// @access  Private
export const getMyServers = async (req, res) => {
  try {
    const servers = await Server.find({
      'members.user': req.user._id,
    })
      .populate('owner', 'username email avatar status')
      .populate('admins', 'username email avatar status')
      .populate('members.user', 'username email avatar status')
      .populate('channels');

    return res.json(servers);
  } catch (error) {
    console.error('Get my servers error:', error);
    return res.status(500).json({ message: 'Server error fetching user servers' });
  }
};

// @desc    Join a server
// @route   POST /api/servers/:id/join
// @access  Private
export const joinServer = async (req, res) => {
  try {
    const param = req.params.id;
    let server = null;

    if (mongoose.Types.ObjectId.isValid(param)) {
      server = await Server.findById(param);
    }
    if (!server) {
      server = await Server.findOne({ inviteCode: param });
    }

    if (!server) {
      return res.status(404).json({ message: 'Server not found. Please check the Server ID or Invite Code.' });
    }

    // Check if user is banned
    if (server.bannedUsers && server.bannedUsers.some((b) => b.toString() === req.user._id.toString())) {
      return res.status(403).json({ message: 'You are banned from this server' });
    }

    // Check if already a member
    const isMember = isUserServerMember(server, req.user._id);

    if (!isMember) {
      server.members.push({ user: req.user._id, roles: [] });
      await server.save();
    }

    const updatedServer = await Server.findById(server._id)
      .populate('owner', 'username email avatar status')
      .populate('channels')
      .populate('members.user', 'username email avatar status');

    return res.json(updatedServer);
  } catch (error) {
    console.error('Join server error:', error);
    return res.status(500).json({ message: 'Server error joining server' });
  }
};

// @desc    Delete a server (Owner only)
// @route   DELETE /api/servers/:id
// @access  Private (Owner only)
export const deleteServer = async (req, res) => {
  try {
    const serverId = req.params.id;
    if (!serverId || !mongoose.Types.ObjectId.isValid(serverId)) {
      return res.status(400).json({ message: 'Invalid server ID' });
    }

    const server = await Server.findById(serverId);
    if (!server) {
      return res.status(404).json({ message: 'Server not found' });
    }

    if (server.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the server owner can delete this server' });
    }

    const channels = await Channel.find({ server: serverId });
    const channelIds = channels.map((c) => c._id);

    await Message.deleteMany({ channel: { $in: channelIds } });
    await Channel.deleteMany({ server: serverId });
    await Server.findByIdAndDelete(serverId);

    return res.json({ message: 'Server deleted successfully' });
  } catch (error) {
    console.error('Delete server error:', error);
    return res.status(500).json({ message: 'Server error deleting server' });
  }
};

// @desc    Add a Server Admin (WhatsApp style)
// @route   POST /api/servers/:id/admins/:userId
// @access  Private (Owner or Admin)
export const addServerAdmin = async (req, res) => {
  try {
    const serverId = req.params.id;
    const targetUserId = req.params.userId;

    const server = await Server.findById(serverId);
    if (!server) {
      return res.status(404).json({ message: 'Server not found' });
    }

    const currentUserId = req.user._id.toString();
    const isOwner = server.owner.toString() === currentUserId;
    const isAdmin = server.admins && server.admins.some((a) => a.toString() === currentUserId);

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Only server owner or admins can make a user an admin' });
    }

    if (!server.admins) {
      server.admins = [];
    }

    const alreadyAdmin = server.admins.some((a) => a.toString() === targetUserId);
    if (!alreadyAdmin) {
      server.admins.push(targetUserId);
      await server.save();
    }

    const updatedServer = await Server.findById(serverId)
      .populate('owner', 'username email avatar status')
      .populate('admins', 'username email avatar status')
      .populate('members.user', 'username email avatar status')
      .populate('channels');

    return res.json({ message: 'User added as Server Admin', server: updatedServer });
  } catch (error) {
    console.error('Add server admin error:', error);
    return res.status(500).json({ message: 'Server error adding admin' });
  }
};

// @desc    Remove a Server Admin (WhatsApp style)
// @route   DELETE /api/servers/:id/admins/:userId
// @access  Private (Owner only)
export const removeServerAdmin = async (req, res) => {
  try {
    const serverId = req.params.id;
    const targetUserId = req.params.userId;

    const server = await Server.findById(serverId);
    if (!server) {
      return res.status(404).json({ message: 'Server not found' });
    }

    const currentUserId = req.user._id.toString();
    const isOwner = server.owner.toString() === currentUserId;

    if (!isOwner) {
      return res.status(403).json({ message: 'Only the server owner can remove an admin' });
    }

    if (server.admins) {
      server.admins = server.admins.filter((a) => a.toString() !== targetUserId);
      await server.save();
    }

    const updatedServer = await Server.findById(serverId)
      .populate('owner', 'username email avatar status')
      .populate('admins', 'username email avatar status')
      .populate('members.user', 'username email avatar status')
      .populate('channels');

    return res.json({ message: 'Admin privileges removed from user', server: updatedServer });
  } catch (error) {
    console.error('Remove server admin error:', error);
    return res.status(500).json({ message: 'Server error removing admin' });
  }
};
