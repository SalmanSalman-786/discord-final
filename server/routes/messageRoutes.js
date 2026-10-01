import express from 'express';
import {
  updateMessage,
  deleteMessage,
  toggleReaction,
  createReply,
  getReplies,
  pinMessage,
  unpinMessage,
} from '../controllers/messageController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.patch('/:id', updateMessage);
router.delete('/:id', deleteMessage);
router.post('/:id/react', toggleReaction);
router.post('/:id/replies', createReply);
router.get('/:id/replies', getReplies);
router.post('/:id/pin', pinMessage);
router.post('/:id/unpin', unpinMessage);

export default router;


