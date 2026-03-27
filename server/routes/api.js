const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const measureController = require('../controllers/measureController');
const multer = require('multer');

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }
});

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Users
router.post('/users', userController.createUser);
router.get('/users/:id', userController.getUser);

// Measurements
router.post('/measure', upload.single('image'), measureController.processMeasurement);
router.get('/progress/:userId', measureController.getUserProgress);

// Recommendations (Mocked logic)
router.post('/recommendations', measureController.getRecommendations);

module.exports = router;
