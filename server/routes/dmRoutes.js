import express from 'express';
import {
  createOrGetDM,
  getMyDMs,
  getDMMessages,
  startDMByQuery,
  getAllUsers,
} from '../controllers/dmController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.post('/start', startDMByQuery);
router.get('/users', getAllUsers);
router.post('/:userId', createOrGetDM);
router.get('/mine', getMyDMs);
router.get('/:id/messages', getDMMessages);

export default router;
