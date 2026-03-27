const mongoose = require('mongoose');

const measurementSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    measurements: {
      shoulder_width: String,
      chest: String,
      waist: String,
      hips: String,
      arm_length: String,
      leg_length: String,
      inseam: String,
      neck: String,
    },
    calibration: {
      type: { type: String },
      value: Number,
      unit: String,
    },
    notes: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Measurement', measurementSchema);
