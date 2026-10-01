import Server from '../models/Server.js';
import Channel from '../models/Channel.js';
import Role from '../models/Role.js';

export const checkPermission = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      let serverId = req.params.serverId || req.params.id;

      // If channelId is provided, find its server
      if (!serverId && req.params.channelId) {
        const channel = await Channel.findById(req.params.channelId);
        if (channel) {
          serverId = channel.server;
        }
      }

      if (!serverId && req.params.id) {
        // Check if id is a channel or server
        const channel = await Channel.findById(req.params.id);
        if (channel) {
          serverId = channel.server;
        } else {
          serverId = req.params.id;
        }
      }

      if (!serverId) {
        return res.status(400).json({ message: 'Server ID not identified' });
      }

      const server = await Server.findById(serverId);
      if (!server) {
        return res.status(404).json({ message: 'Server not found' });
      }

      const userId = req.user._id.toString();

      // 1. Owner and Server Admins bypass permission checks
      const isOwner = server.owner.toString() === userId;
      const isAdmin = server.admins && server.admins.some((a) => a.toString() === userId);

      if (isOwner || isAdmin) {
        req.server = server;
        return next();
      }

      // 2. Find member in server
      const member = server.members.find(
        (m) => m.user.toString() === userId || m.user._id?.toString() === userId
      );

      if (!member) {
        return res.status(403).json({ message: 'Access denied: You are not a member of this server' });
      }

      // If no roles or empty roles
      if (!member.roles || member.roles.length === 0) {
        return res.status(403).json({
          message: `Permission denied: Missing required permission "${requiredPermission}"`,
        });
      }

      // 3. Fetch member roles and check permissions
      const roles = await Role.find({ _id: { $in: member.roles } });
      const hasPermission = roles.some((role) =>
        role.permissions && role.permissions.includes(requiredPermission)
      );

      if (!hasPermission) {
        return res.status(403).json({
          message: `Permission denied: Missing required permission "${requiredPermission}"`,
        });
      }

      req.server = server;
      next();
    } catch (error) {
      console.error('Permission middleware error:', error);
      return res.status(500).json({ message: 'Server error checking permissions' });
    }
  };
};
