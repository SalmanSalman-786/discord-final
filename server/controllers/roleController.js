import Role from '../models/Role.js';
import Server from '../models/Server.js';
import Channel from '../models/Channel.js';

// @desc    Create a role in a server
// @route   POST /api/servers/:id/roles
// @access  Private (Owner or manage_channels)
export const createRole = async (req, res) => {
  try {
    const serverId = req.params.id;
    const { name, color, permissions } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Role name is required' });
    }

    const role = await Role.create({
      name,
      color: color || '#99aab5',
      permissions: permissions || [],
      server: serverId,
    });

    return res.status(201).json(role);
  } catch (error) {
    console.error('Create role error:', error);
    return res.status(500).json({ message: 'Server error creating role' });
  }
};

// @desc    Get all roles for a server
// @route   GET /api/servers/:id/roles
// @access  Private (Server members)
export const getServerRoles = async (req, res) => {
  try {
    const serverId = req.params.id;
    const roles = await Role.find({ server: serverId });
    return res.json(roles);
  } catch (error) {
    console.error('Get server roles error:', error);
    return res.status(500).json({ message: 'Server error fetching roles' });
  }
};

// @desc    Assign roles to a member
// @route   POST /api/servers/:id/members/:userId/roles
// @access  Private (Owner / Admin)
export const assignMemberRole = async (req, res) => {
  try {
    const { id: serverId, userId } = req.params;
    const { roleIds } = req.body; // Array of role IDs

    const server = await Server.findById(serverId);
    if (!server) {
      return res.status(404).json({ message: 'Server not found' });
    }

    const member = server.members.find(
      (m) => m.user.toString() === userId || m.user._id?.toString() === userId
    );

    if (!member) {
      return res.status(404).json({ message: 'Member not found in server' });
    }

    member.roles = roleIds || [];
    await server.save();

    const updatedServer = await Server.findById(serverId)
      .populate('owner', 'username email avatar status')
      .populate('members.user', 'username email avatar status')
      .populate('members.roles');

    return res.json(updatedServer);
  } catch (error) {
    console.error('Assign member role error:', error);
    return res.status(500).json({ message: 'Server error assigning role' });
  }
};

// @desc    Kick a member from server
// @route   DELETE /api/servers/:id/members/:userId
// @access  Private (kick_members permission or Owner)
export const kickMember = async (req, res) => {
  try {
    const { id: serverId, userId } = req.params;

    const server = await Server.findById(serverId);
    if (!server) {
      return res.status(404).json({ message: 'Server not found' });
    }

    if (server.owner.toString() === userId) {
      return res.status(400).json({ message: 'Cannot kick the server owner' });
    }

    server.members = server.members.filter(
      (m) => m.user.toString() !== userId && m.user._id?.toString() !== userId
    );

    await server.save();
    return res.json({ message: 'Member kicked successfully' });
  } catch (error) {
    console.error('Kick member error:', error);
    return res.status(500).json({ message: 'Server error kicking member' });
  }
};

// @desc    Delete a channel
// @route   DELETE /api/servers/:id/channels/:channelId
// @access  Private (manage_channels permission or Owner)
export const deleteChannel = async (req, res) => {
  try {
    const { id: serverId, channelId } = req.params;

    await Channel.findByIdAndDelete(channelId);

    const server = await Server.findById(serverId);
    if (server) {
      server.channels = server.channels.filter((c) => c.toString() !== channelId);
      await server.save();
    }

    return res.json({ message: 'Channel deleted successfully' });
  } catch (error) {
    console.error('Delete channel error:', error);
    return res.status(500).json({ message: 'Server error deleting channel' });
  }
};
