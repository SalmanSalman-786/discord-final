import mongoose from 'mongoose';
import Server from '../models/Server.js';
import User from '../models/User.js';
import ServerInvite from '../models/ServerInvite.js';
import { getIO } from '../sockets/socketHandler.js';

// @desc    Send server invite to email
// @route   POST /api/servers/:id/invite-email
// @access  Private
export const sendEmailInvite = async (req, res) => {
  try {
    const serverId = req.params.id;
    const { email } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({ message: 'Email address is required' });
    }

    const cleanEmail = email.trim().toLowerCase();

    const server = await Server.findById(serverId);
    if (!server) {
      return res.status(404).json({ message: 'Server not found' });
    }

    // Find recipient user if registered
    const recipientUser = await User.findOne({ email: cleanEmail });

    // Check if recipient is already a member
    if (recipientUser) {
      const isAlreadyMember = server.members.some(
        (m) => m.user.toString() === recipientUser._id.toString()
      );
      if (isAlreadyMember) {
        return res.status(400).json({ message: `${recipientUser.username} is already a member of this server` });
      }
    }

    // Check for existing pending invite
    const existingInvite = await ServerInvite.findOne({
      server: serverId,
      recipientEmail: cleanEmail,
      status: 'pending',
    });

    if (existingInvite) {
      return res.status(400).json({ message: `An invite to ${cleanEmail} is already pending` });
    }

    const invite = await ServerInvite.create({
      server: serverId,
      sender: req.user._id,
      recipientEmail: cleanEmail,
      recipientUser: recipientUser ? recipientUser._id : null,
      status: 'pending',
    });

    const populatedInvite = await ServerInvite.findById(invite._id)
      .populate('server', 'name icon owner')
      .populate('sender', 'username avatar');

    // Socket notification to target user if online
    if (recipientUser) {
      const io = getIO();
      if (io) {
        io.to(recipientUser._id.toString()).emit('server_invite_received', populatedInvite);
      }
    }

    return res.status(201).json({
      message: `Invite sent successfully to ${cleanEmail}!`,
      invite: populatedInvite,
    });
  } catch (error) {
    console.error('Send email invite error:', error);
    return res.status(500).json({ message: 'Server error sending invite' });
  }
};

// @desc    Get pending invites for logged-in user
// @route   GET /api/invites/mine
// @access  Private
export const getMyPendingInvites = async (req, res) => {
  try {
    const userEmail = req.user.email ? req.user.email.toLowerCase() : '';

    const invites = await ServerInvite.find({
      $or: [
        { recipientEmail: userEmail },
        { recipientUser: req.user._id },
      ],
      status: 'pending',
    })
      .populate('server', 'name icon owner members')
      .populate('sender', 'username avatar');

    return res.json(invites);
  } catch (error) {
    console.error('Get my pending invites error:', error);
    return res.status(500).json({ message: 'Server error fetching pending invites' });
  }
};

// @desc    Accept server invite
// @route   POST /api/invites/:id/accept
// @access  Private
export const acceptInvite = async (req, res) => {
  try {
    const inviteId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(inviteId)) {
      return res.status(400).json({ message: 'Invalid invite ID' });
    }

    const invite = await ServerInvite.findById(inviteId);
    if (!invite || invite.status !== 'pending') {
      return res.status(404).json({ message: 'Invite not found or already processed' });
    }

    const server = await Server.findById(invite.server);
    if (!server) {
      return res.status(404).json({ message: 'Server no longer exists' });
    }

    // Add user to server members if not already
    const isAlreadyMember = server.members.some(
      (m) => m.user.toString() === req.user._id.toString()
    );

    if (!isAlreadyMember) {
      server.members.push({ user: req.user._id, roles: [] });
      await server.save();
    }

    invite.status = 'accepted';
    invite.recipientUser = req.user._id;
    await invite.save();

    const populatedServer = await Server.findById(server._id)
      .populate('owner', 'username email avatar status')
      .populate('channels')
      .populate('members.user', 'username email avatar status');

    return res.json({
      message: `Joined ${server.name}!`,
      server: populatedServer,
    });
  } catch (error) {
    console.error('Accept invite error:', error);
    return res.status(500).json({ message: 'Server error accepting invite' });
  }
};

// @desc    Decline server invite
// @route   POST /api/invites/:id/decline
// @access  Private
export const declineInvite = async (req, res) => {
  try {
    const inviteId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(inviteId)) {
      return res.status(400).json({ message: 'Invalid invite ID' });
    }

    const invite = await ServerInvite.findById(inviteId);
    if (invite) {
      invite.status = 'declined';
      await invite.save();
    }

    return res.json({ message: 'Invite declined' });
  } catch (error) {
    console.error('Decline invite error:', error);
    return res.status(500).json({ message: 'Server error declining invite' });
  }
};
