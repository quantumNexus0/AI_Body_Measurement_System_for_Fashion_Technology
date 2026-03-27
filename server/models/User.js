const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    // Adding optional fields for progress/recommendation use cases
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
    },
    height: {
      value: Number,
      unit: { type: String, enum: ['cm', 'in'] }
    },
    weight: {
      value: Number,
      unit: { type: String, enum: ['kg', 'lbs'] }
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
