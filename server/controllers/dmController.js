import DMChannel from '../models/DMChannel.js';
import Message from '../models/Message.js';
import User from '../models/User.js';

// @desc    Create or get existing DM channel with a user
// @route   POST /api/dms/:userId
// @access  Private
export const createOrGetDM = async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    const currentUserId = req.user._id;

    if (targetUserId === currentUserId.toString()) {
      return res.status(400).json({ message: 'Cannot create a DM with yourself' });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ message: 'Target user not found' });
    }

    // Check existing DMChannel with both participants
    let dmChannel = await DMChannel.findOne({
      participants: { $all: [currentUserId, targetUserId] },
    }).populate('participants', 'username email avatar status');

    if (!dmChannel) {
      dmChannel = await DMChannel.create({
        participants: [currentUserId, targetUserId],
      });

      dmChannel = await DMChannel.findById(dmChannel._id).populate(
        'participants',
        'username email avatar status'
      );
    }

    return res.status(200).json(dmChannel);
  } catch (error) {
    console.error('Create or get DM error:', error);
    return res.status(500).json({ message: 'Server error opening DM channel' });
  }
};

// @desc    Get user's DM channels
// @route   GET /api/dms/mine
// @access  Private
export const getMyDMs = async (req, res) => {
  try {
    const dms = await DMChannel.find({
      participants: req.user._id,
    })
      .sort({ updatedAt: -1 })
      .populate('participants', 'username email avatar status');

    return res.json(dms);
  } catch (error) {
    console.error('Get my DMs error:', error);
    return res.status(500).json({ message: 'Server error fetching DMs' });
  }
};

// @desc    Get messages for a DM channel
// @route   GET /api/dms/:id/messages
// @access  Private
export const getDMMessages = async (req, res) => {
  try {
    const dmChannelId = req.params.id;

    const dmChannel = await DMChannel.findById(dmChannelId);
    if (!dmChannel) {
      return res.status(404).json({ message: 'DM channel not found' });
    }

    // Check participant authorization
    const isParticipant = dmChannel.participants.some(
      (p) => p.toString() === req.user._id.toString()
    );

    if (!isParticipant) {
      return res.status(403).json({ message: 'Access denied to this DM channel' });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const totalMessages = await Message.countDocuments({ channel: dmChannelId });
    const totalPages = Math.ceil(totalMessages / limit) || 1;

    const messages = await Message.find({ channel: dmChannelId })
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
    console.error('Get DM messages error:', error);
    return res.status(500).json({ message: 'Server error fetching DM messages' });
  }
};

// @desc    Start DM by email or username
// @route   POST /api/dms/start
// @access  Private
export const startDMByQuery = async (req, res) => {
  try {
    const { query } = req.body;
    if (!query || !query.trim()) {
      return res.status(400).json({ message: 'Email or username is required' });
    }

    const cleanQuery = query.trim();
    const targetUser = await User.findOne({
      $or: [
        { email: { $regex: new RegExp(`^${cleanQuery}$`, 'i') } },
        { username: { $regex: new RegExp(`^${cleanQuery}$`, 'i') } },
      ],
    });

    if (!targetUser) {
      return res.status(404).json({ message: 'User not found with that email or username' });
    }

    const currentUserId = req.user._id;
    if (targetUser._id.toString() === currentUserId.toString()) {
      return res.status(400).json({ message: 'Cannot create a DM with yourself' });
    }

    let dmChannel = await DMChannel.findOne({
      participants: { $all: [currentUserId, targetUser._id] },
    }).populate('participants', 'username email avatar status');

    if (!dmChannel) {
      dmChannel = await DMChannel.create({
        participants: [currentUserId, targetUser._id],
      });
      dmChannel = await DMChannel.findById(dmChannel._id).populate(
        'participants',
        'username email avatar status'
      );
    }

    return res.status(200).json(dmChannel);
  } catch (error) {
    console.error('Start DM by query error:', error);
    return res.status(500).json({ message: 'Server error starting DM' });
  }
};

// @desc    Get all registered users (excluding current user)
// @route   GET /api/dms/users
// @access  Private
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user._id } })
      .select('username email avatar status')
      .sort({ username: 1 });

    return res.json(users);
  } catch (error) {
    console.error('Get all users error:', error);
    return res.status(500).json({ message: 'Server error fetching users' });
  }
};
