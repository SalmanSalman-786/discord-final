import express from 'express';
import { uploadFiles } from '../controllers/uploadController.js';
import { upload } from '../middleware/upload.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.post('/', upload.array('files', 5), uploadFiles);

export default router;
