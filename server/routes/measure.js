import { Router } from 'express';
import multer from 'multer';
import { requireAuth, measureLimiter } from '../middleware/auth.js';
import { callPythonMeasure } from '../services/pythonClient.js';

const router = Router();

// Configure Multer for in-memory image handling
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    cb(allowed.includes(file.mimetype) ? null : new Error('Invalid image type'), allowed.includes(file.mimetype));
  },
});

/**
 * @route POST /api/v1/measure
 * @desc Primary endpoint for uploading images and receiving AI body measurements
 * @access Private (JWT + HMAC internal bridge)
 */
router.post(
  '/',
  requireAuth,
  measureLimiter,
  upload.single('image'),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image provided' });
    }

    let calibration;
    try {
      // Expecting calibrationData passed as a JSON string in FormData
      calibration = JSON.parse(req.body.calibrationData || '{}');
      if (!calibration.type || !calibration.value) {
        throw new Error('Missing calibration type or value');
      }
    } catch (e) {
      return res.status(400).json({ success: false, error: `Invalid calibrationData: ${e.message}` });
    }

    try {
      const result = await callPythonMeasure(
        req.file.buffer,
        req.file.mimetype,
        calibration,
        req.body.gender || 'n'
      );

      res.json({ 
        success: true, 
        measurements: result,
        metadata: {
          timestamp: new Date().toISOString(),
          processing_ms: result.processing_ms
        }
      });
    } catch (err) {
      const status = err.response?.status || 502;
      const msg = err.response?.data?.detail || err.message;
      res.status(status).json({ success: false, error: msg });
    }
  }
);

export default router;
