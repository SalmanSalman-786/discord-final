import Channel from '../models/Channel.js';
import Server from '../models/Server.js';
import { isUserServerMember } from './serverController.js';

// @desc    Create a new channel in a server
// @route   POST /api/servers/:id/channels
// @access  Private (Server Members only)
export const createChannel = async (req, res) => {
  try {
    const serverId = req.params.id;
    const { name, type } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Channel name is required' });
    }

    const server = await Server.findById(serverId);
    if (!server) {
      return res.status(404).json({ message: 'Server not found' });
    }

    // Membership check
    if (!isUserServerMember(server, req.user._id)) {
      return res.status(403).json({ message: 'Access denied: You are not a member of this server' });
    }

    const channel = await Channel.create({
      name: name.toLowerCase().replace(/\s+/g, '-'),
      type: type || 'text',
      server: serverId,
    });

    server.channels.push(channel._id);
    await server.save();

    return res.status(201).json(channel);
  } catch (error) {
    console.error('Create channel error:', error);
    return res.status(500).json({ message: 'Server error creating channel' });
  }
};

// @desc    Get all channels of a server
// @route   GET /api/servers/:id/channels
// @access  Private (Server Members only)
export const getChannels = async (req, res) => {
  try {
    const serverId = req.params.id;
    const server = await Server.findById(serverId);

    if (!server) {
      return res.status(404).json({ message: 'Server not found' });
    }

    // Membership check
    if (!isUserServerMember(server, req.user._id)) {
      return res.status(403).json({ message: 'Access denied: You are not a member of this server' });
    }

    const channels = await Channel.find({ server: serverId });
    return res.json(channels);
  } catch (error) {
    console.error('Get channels error:', error);
    return res.status(500).json({ message: 'Server error fetching channels' });
  }
};
