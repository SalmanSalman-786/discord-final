import mongoose from 'mongoose';
import Server from '../models/Server.js';
import AuditLog from '../models/AuditLog.js';

// @desc    Kick a member from server
// @route   DELETE /api/servers/:id/members/:userId
// @access  Private (kick_members permission or Owner)
export const kickMember = async (req, res) => {
  try {
    const { id: serverId, userId } = req.params;
    const { reason } = req.body || {};

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid target user ID' });
    }

    const server = await Server.findById(serverId);
    if (!server) {
      return res.status(404).json({ message: 'Server not found' });
    }

    if (server.owner.toString() === userId) {
      return res.status(400).json({ message: 'Cannot kick the server owner' });
    }

    const initialCount = server.members.length;
    server.members = server.members.filter(
      (m) => m.user.toString() !== userId && m.user._id?.toString() !== userId
    );

    if (server.members.length === initialCount) {
      return res.status(404).json({ message: 'User is not a member of this server' });
    }

    await server.save();

    // Log to audit log
    await AuditLog.create({
      server: serverId,
      actor: req.user._id,
      action: 'KICK',
      target: userId,
      reason: reason || '',
    });

    const updatedServer = await Server.findById(serverId)
      .populate('owner', 'username email avatar status')
      .populate('members.user', 'username email avatar status')
      .populate('members.roles')
      .populate('channels');

    return res.json({ message: 'Member kicked successfully', server: updatedServer });
  } catch (error) {
    console.error('Kick member error:', error);
    return res.status(500).json({ message: 'Server error kicking member' });
  }
};

// @desc    Ban a user from server
// @route   POST /api/servers/:id/bans/:userId
// @access  Private (ban_members permission or Owner)
export const banUser = async (req, res) => {
  try {
    const { id: serverId, userId } = req.params;
    const { reason } = req.body || {};

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid target user ID' });
    }

    const server = await Server.findById(serverId);
    if (!server) {
      return res.status(404).json({ message: 'Server not found' });
    }

    if (server.owner.toString() === userId) {
      return res.status(400).json({ message: 'Cannot ban the server owner' });
    }

    // Remove from members if present
    server.members = server.members.filter(
      (m) => m.user.toString() !== userId && m.user._id?.toString() !== userId
    );

    // Add to bannedUsers if not already present
    if (!server.bannedUsers) server.bannedUsers = [];
    const isBanned = server.bannedUsers.some((b) => b.toString() === userId);
    if (!isBanned) {
      server.bannedUsers.push(userId);
    }

    await server.save();

    // Log to audit log
    await AuditLog.create({
      server: serverId,
      actor: req.user._id,
      action: 'BAN',
      target: userId,
      reason: reason || '',
    });

    const updatedServer = await Server.findById(serverId)
      .populate('owner', 'username email avatar status')
      .populate('members.user', 'username email avatar status')
      .populate('members.roles')
      .populate('channels');

    return res.json({ message: 'User banned successfully', server: updatedServer });
  } catch (error) {
    console.error('Ban user error:', error);
    return res.status(500).json({ message: 'Server error banning user' });
  }
};

// @desc    Unban a user from server
// @route   DELETE /api/servers/:id/bans/:userId
// @access  Private (ban_members permission or Owner)
export const unbanUser = async (req, res) => {
  try {
    const { id: serverId, userId } = req.params;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid target user ID' });
    }

    const server = await Server.findById(serverId);
    if (!server) {
      return res.status(404).json({ message: 'Server not found' });
    }

    if (server.bannedUsers) {
      server.bannedUsers = server.bannedUsers.filter((b) => b.toString() !== userId);
    }

    await server.save();

    // Log to audit log
    await AuditLog.create({
      server: serverId,
      actor: req.user._id,
      action: 'UNBAN',
      target: userId,
    });

    return res.json({ message: 'User unbanned successfully' });
  } catch (error) {
    console.error('Unban user error:', error);
    return res.status(500).json({ message: 'Server error unbanning user' });
  }
};

// @desc    Mute a member in server
// @route   POST /api/servers/:id/members/:userId/mute
// @access  Private (mute_members permission or Owner)
export const muteMember = async (req, res) => {
  try {
    const { id: serverId, userId } = req.params;
    const { durationMinutes, reason } = req.body || {};

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid target user ID' });
    }

    const server = await Server.findById(serverId);
    if (!server) {
      return res.status(404).json({ message: 'Server not found' });
    }

    if (server.owner.toString() === userId) {
      return res.status(400).json({ message: 'Cannot mute the server owner' });
    }

    const member = server.members.find(
      (m) => m.user.toString() === userId || m.user._id?.toString() === userId
    );

    if (!member) {
      return res.status(404).json({ message: 'Member not found in server' });
    }

    const mins = parseInt(durationMinutes, 10);
    let mutedUntil = null;
    let action = 'UNMUTE';

    if (!isNaN(mins) && mins > 0) {
      mutedUntil = new Date(Date.now() + mins * 60 * 1000);
      action = 'MUTE';
    }

    member.mutedUntil = mutedUntil;
    await server.save();

    // Log to audit log
    await AuditLog.create({
      server: serverId,
      actor: req.user._id,
      action,
      target: userId,
      reason: reason || (action === 'MUTE' ? `Muted for ${mins} minutes` : 'Unmuted'),
    });

    const updatedServer = await Server.findById(serverId)
      .populate('owner', 'username email avatar status')
      .populate('members.user', 'username email avatar status')
      .populate('members.roles')
      .populate('channels');

    return res.json({
      message: action === 'MUTE' ? `Member muted until ${mutedUntil}` : 'Member unmuted',
      server: updatedServer,
      mutedUntil,
    });
  } catch (error) {
    console.error('Mute member error:', error);
    return res.status(500).json({ message: 'Server error muting member' });
  }
};

// @desc    Get audit logs for a server
// @route   GET /api/servers/:id/audit-log
// @access  Private (Server members)
export const getAuditLog = async (req, res) => {
  try {
    const serverId = req.params.id;

    if (!serverId || !mongoose.Types.ObjectId.isValid(serverId)) {
      return res.status(400).json({ message: 'Invalid server ID' });
    }

    const server = await Server.findById(serverId);
    if (!server) {
      return res.status(404).json({ message: 'Server not found' });
    }

    const logs = await AuditLog.find({ server: serverId })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('actor', 'username avatar email')
      .populate('target', 'username avatar email');

    return res.json(logs);
  } catch (error) {
    console.error('Get audit log error:', error);
    return res.status(500).json({ message: 'Server error fetching audit log' });
  }
};
