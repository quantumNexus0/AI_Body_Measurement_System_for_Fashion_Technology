const express = require('express');
const router = express.Router();
const userController = require('../../controllers/userController');
const measureController = require('../../controllers/measureController');
const { calibrationValidator, measurementValidator } = require('../../middleware/validator');
const multer = require('multer');

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }
});

// Enhanced Health check for v1
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: 'v1',
    model_loaded: true, // Placeholder for actual model state
    uptime: Math.floor(process.uptime()) + 's',
    timestamp: new Date().toISOString()
  });
});

// Users
router.post('/users', measurementValidator, userController.createUser);
router.get('/users/:id', userController.getUser);

// Measurements
router.post('/measure', upload.single('image'), calibrationValidator, measureController.processMeasurement);
router.get('/progress/:userId', measureController.getUserProgress);

// Recommendations (Mocked logic)
router.post('/recommendations', measurementValidator, measureController.getRecommendations);

module.exports = router;
