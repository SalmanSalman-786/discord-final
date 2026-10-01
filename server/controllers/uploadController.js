import { isCloudinaryConfigured } from '../middleware/upload.js';
import cloudinary from '../config/cloudinary.js';

// @desc    Upload attachment files (Images / Documents)
// @route   POST /api/upload
// @access  Private
export const uploadFiles = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No files provided' });
    }

    const fileObjects = [];

    for (const file of req.files) {
      let url = file.path || file.secure_url;
      const mimetype = file.mimetype || 'image/png';
      const originalname = file.originalname || 'attachment';

      if (!url && file.buffer) {
        if (isCloudinaryConfigured) {
          const uploadResult = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
              { folder: 'discord-clone-attachments', resource_type: 'auto' },
              (error, result) => {
                if (error) reject(error);
                else resolve(result);
              }
            );
            uploadStream.end(file.buffer);
          });
          url = uploadResult.secure_url;
        } else {
          // Fallback data-URL encoding for testing without Cloudinary account
          const base64Data = file.buffer.toString('base64');
          url = `data:${mimetype};base64,${base64Data}`;
        }
      }

      fileObjects.push({
        url: url || file.secure_url || file.path,
        type: mimetype,
        filename: originalname,
      });
    }

    return res.status(200).json(fileObjects);
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ message: error.message || 'File upload failed' });
  }
};
