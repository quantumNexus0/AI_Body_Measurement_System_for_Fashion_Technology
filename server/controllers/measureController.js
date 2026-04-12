const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const Measurement = require('../models/Measurement');

exports.processMeasurement = async (req, res) => {
  try {
    const { calibrationData, userId, notes } = req.body;
    
    // calibrationData is validated and potentially parsed by middleware logic
    // but here we ensure it's a valid object
    let calibration;
    try {
      calibration = typeof calibrationData === 'string' ? JSON.parse(calibrationData) : calibrationData;
    } catch (e) {
      return res.status(400).json({ success: false, message: 'Invalid calibration data format' });
    }

    if (!calibration) {
      return res.status(422).json({ success: false, message: 'Calibration data is required' });
    }

    const imageId = uuidv4();

    // Process image if provided, for real setup this might go to an ML model microservice
    if (req.file) {
      await sharp(req.file.buffer)
        .resize(1280, 720, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer()
        .catch(() => req.file.buffer);
    }

    // Generate mock measurements for now
    const mockMeasurements = simulateBodyMeasurements(calibration);

    // Save to DB if user is provided
    let savedMeasurement = null;
    if (userId) {
      savedMeasurement = await Measurement.create({
        user: userId,
        measurements: mockMeasurements,
        calibration,
        notes
      });
    }

    res.json({
      success: true,
      measurements: mockMeasurements,
      savedMeasurement,
      processingId: imageId
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error processing measurement' });
  }
};

exports.getUserProgress = async (req, res) => {
  try {
    const measurements = await Measurement.find({ user: req.params.userId }).sort({ createdAt: -1 });
    res.json({ success: true, data: measurements });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getRecommendations = async (req, res) => {
  try {
    const { measurements } = req.body;
    
    if (!measurements) {
      return res.status(400).json({ success: false, message: 'Measurements are required' });
    }

    // Parse measurements
    const getVal = (val) => parseFloat(String(val).split(' ')[0]) || 0;
    const chest = getVal(measurements.chest);
    const waist = getVal(measurements.waist);
    const shoulder = getVal(measurements.shoulder_width);
    const inseam = getVal(measurements.inseam);
    
    // Size determination functions
    const getShirtSize = (c) => {
      if (c < 90) return 'S';
      if (c < 100) return 'M';
      if (c < 110) return 'L';
      if (c < 120) return 'XL';
      return 'XXL';
    };
    
    const getPantsSize = (w) => Math.round(w / 2.54).toString(); // inches
    const getSuitSize = (c) => Math.round(c / 2.54).toString() + 'R';

    const shirtSize = getShirtSize(chest);
    const pantsSize = getPantsSize(waist);
    const suitSize = getSuitSize(chest);

    // Fetch from DB
    const ClothingItem = require('../models/ClothingItem');
    const items = await ClothingItem.find({});

    const recommendations = items.map(item => {
      let recSize = 'M';
      let confidence = 85 + Math.floor(Math.random() * 12); // Mock 85-96% confidence

      if (item.category === 'shirts') recSize = shirtSize;
      if (item.category === 'pants') recSize = pantsSize;
      if (item.category === 'jackets' || item.category === 'suits') recSize = suitSize;

      // Fit adjustment
      if (item.fit === 'Slim') {
        if (item.category === 'pants') recSize = (parseInt(recSize) - 1).toString();
        else if (item.category === 'shirts') {
          const sizeMap = { 'XS': 'XS', 'S': 'XS', 'M': 'S', 'L': 'M', 'XL': 'L', 'XXL': 'XL' };
          recSize = sizeMap[recSize] || recSize;
        }
      }

      // Convert mongoose doc to plain object and add extra fields
      return {
        id: item._id,
        name: item.name,
        category: item.category,
        brand: item.brand,
        sizes: item.sizes,
        price: item.price,
        image: item.image,
        fit: item.fit,
        material: item.material,
        rating: item.rating,
        reviews: item.reviews,
        recommendedSize: recSize,
        confidence
      };
    });

    res.json({ success: true, count: recommendations.length, data: recommendations });
  } catch (error) {
    console.error('Recommendation Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Simulate body measurements
function simulateBodyMeasurements(calibrationData) {
  const unit = calibrationData.unit;
  let baseValues;

  if (unit === 'cm') {
    baseValues = {
      shoulder_width: 45 + Math.random() * 10,
      chest: 90 + Math.random() * 20,
      waist: 75 + Math.random() * 15,
      hips: 95 + Math.random() * 15,
      arm_length: 60 + Math.random() * 10,
      leg_length: 90 + Math.random() * 15,
      inseam: 75 + Math.random() * 10,
      neck: 35 + Math.random() * 5
    };
  } else {
    baseValues = {
      shoulder_width: 17 + Math.random() * 4,
      chest: 35 + Math.random() * 8,
      waist: 29 + Math.random() * 6,
      hips: 37 + Math.random() * 6,
      arm_length: 24 + Math.random() * 4,
      leg_length: 35 + Math.random() * 6,
      inseam: 29 + Math.random() * 4,
      neck: 14 + Math.random() * 2
    };
  }

  if (calibrationData.type === 'height') {
    const scaleFactor = calibrationData.value / (unit === 'cm' ? 170 : 67);
    Object.keys(baseValues).forEach(key => {
      baseValues[key] *= scaleFactor;
    });
  }

  const measurements = {};
  Object.keys(baseValues).forEach(key => {
    measurements[key] = `${Math.round(baseValues[key] * 10) / 10} ${unit}`;
  });

  return measurements;
}
