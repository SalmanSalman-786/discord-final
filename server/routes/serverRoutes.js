import express from 'express';
import {
  createServer,
  getMyServers,
  joinServer,
  deleteServer,
  addServerAdmin,
  removeServerAdmin,
} from '../controllers/serverController.js';
import { sendEmailInvite } from '../controllers/inviteController.js';
import { createChannel, getChannels } from '../controllers/channelController.js';
import {
  createRole,
  getServerRoles,
  assignMemberRole,
  deleteChannel,
} from '../controllers/roleController.js';
import {
  kickMember,
  banUser,
  unbanUser,
  muteMember,
  getAuditLog,
} from '../controllers/moderationController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

router.use(protect);

router.post('/', createServer);
router.get('/mine', getMyServers);
router.post('/:id/join', joinServer);
router.post('/:id/invite-email', sendEmailInvite);
router.delete('/:id', deleteServer);

// WhatsApp-style Server Admins
router.post('/:id/admins/:userId', addServerAdmin);
router.delete('/:id/admins/:userId', removeServerAdmin);

// Server channels
router.post('/:id/channels', checkPermission('manage_channels'), createChannel);
router.get('/:id/channels', getChannels);
router.delete('/:id/channels/:channelId', checkPermission('manage_channels'), deleteChannel);

// Roles & Permissions
router.post('/:id/roles', checkPermission('manage_channels'), createRole);
router.get('/:id/roles', getServerRoles);
router.post('/:id/members/:userId/roles', checkPermission('manage_channels'), assignMemberRole);

// Moderation & Audit Log
router.delete('/:id/members/:userId', checkPermission('kick_members'), kickMember);
router.post('/:id/bans/:userId', checkPermission('ban_members'), banUser);
router.delete('/:id/bans/:userId', checkPermission('ban_members'), unbanUser);
router.post('/:id/members/:userId/mute', checkPermission('mute_members'), muteMember);
router.get('/:id/audit-log', getAuditLog);

export default router;
