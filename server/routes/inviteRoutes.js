import express from 'express';
import {
  getMyPendingInvites,
  acceptInvite,
  declineInvite,
} from '../controllers/inviteController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/mine', getMyPendingInvites);
router.post('/:id/accept', acceptInvite);
router.post('/:id/decline', declineInvite);

export default router;
