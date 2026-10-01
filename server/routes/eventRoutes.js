import express from 'express';
import {
  createEvent,
  getServerEvents,
  updateEvent,
  deleteEvent,
  toggleInterested,
} from '../controllers/eventController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router({ mergeParams: true });

router.use(protect);

// Routes with :serverId (when mounted as /api/servers/:serverId/events)
router.route('/').post(createEvent).get(getServerEvents);

export default router;
