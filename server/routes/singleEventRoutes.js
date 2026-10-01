import express from 'express';
import {
  updateEvent,
  deleteEvent,
  toggleInterested,
} from '../controllers/eventController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.route('/:eventId').patch(updateEvent).delete(deleteEvent);
router.post('/:eventId/interested', toggleInterested);

export default router;
