const express = require('express');
const cors = require('cors');
const multer = require('multer');
const sharp = require('sharp');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { z } = require('zod');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const app = express();

// Security headers
app.use(helmet());
app.use(express.json({ limit: '10mb' }));

// CORS config
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'];
app.use(cors({ 
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) callback(null, true);
        else callback(new Error('Not allowed by CORS'));
    }
}));

// Rate limiting: 20 measurements per 15 minutes per IP
const measureLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many requests, please try again later' },
});

// Input validation schema
const CalibrationSchema = z.object({
  type: z.enum(['height', 'reference']),
  value: z.number().positive().max(300),
  unit: z.enum(['cm', 'inches']),
  referenceObject: z.enum(['phone', 'card', 'a4', 'custom']).optional(),
});

// Multer config
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG, PNG, and WebP images allowed'));
  },
});

// Mongoose connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bodyfit')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

const measureController = require('./controllers/measureController');

// Routes
app.post('/api/v2/measure', measureLimiter, upload.single('image'), measureController.processMeasurementV2);
app.post('/api/v2/recommend', measureLimiter, measureController.getRecommendationsV2);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ success: true, status: 'healthy', version: '2.0.0' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server v2 running on :${PORT}`));

module.exports = app;
