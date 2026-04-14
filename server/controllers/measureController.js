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
    let imageBuffer = null;
    if (req.file) {
      imageBuffer = await sharp(req.file.buffer)
        .resize(1280, 720, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer()
        .catch(() => req.file.buffer);
    }

    if (!imageBuffer) {
      return res.status(400).json({ success: false, message: 'Image must be provided for AI measurement' });
    }

    // Call Python FastAPI
    const formData = new FormData();
    const blob = new Blob([imageBuffer], { type: 'image/jpeg' });
    formData.append('image', blob, 'upload.jpg');
    formData.append('calibrationData', JSON.stringify(calibration));
    if (userId) formData.append('userId', userId);
    if (notes) formData.append('notes', notes);

    const pyResponse = await fetch('http://127.0.0.1:8000/api/v1/measure', {
      method: 'POST',
      body: formData
    });

    if (!pyResponse.ok) {
      throw new Error(`Python API returned ${pyResponse.statusText}`);
    }

    const pyData = await pyResponse.json();
    const jobId = pyData.data.job_id;

    // Poll python API for job completion
    let finalMeasurements = null;
    let confidence = 0;
    
    // Attempt polling for up to 15 seconds
    for (let i = 0; i < 15; i++) {
        await new Promise(r => setTimeout(r, 1000));
        const pollRes = await fetch(`http://127.0.0.1:8000/api/v1/measure/${jobId}`);
        const pollData = await pollRes.json();
        
        if (pollData.data?.status === 'done' || pollData.data?.measurements) {
            finalMeasurements = pollData.data.measurements;
            confidence = pollData.confidence || 0.90;
            break;
        } else if (pollData.data?.status === 'failed') {
            throw new Error('Python AI Engine failed to detect pose in image.');
        }
    }

    if (!finalMeasurements) {
      throw new Error('Timeout waiting for python measurement engine.');
    }

    // Save to DB if user is provided
    let savedMeasurement = null;
    if (userId) {
      savedMeasurement = await Measurement.create({
        user: userId,
        measurements: finalMeasurements,
        calibration,
        notes
      });
    }

    res.json({
      success: true,
      measurements: finalMeasurements,
      savedMeasurement,
      processingId: imageId,
      confidence
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error processing measurement: ' + error.message });
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

