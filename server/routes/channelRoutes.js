import express from 'express';
import {
  getMessages,
  createMessage,
  getPinnedMessages,
  searchMessages,
  markChannelRead,
  getReadStates,
} from '../controllers/messageController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/read-states', getReadStates);
router.post('/:id/read', markChannelRead);
router.get('/:id/messages', getMessages);
router.post('/:id/messages', checkPermission('send_messages'), createMessage);
router.get('/:id/pins', getPinnedMessages);
router.get('/:id/search', searchMessages);

export default router;

