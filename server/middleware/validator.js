const { body, validationResult } = require('express-validator');

// Generic function to handle validation results
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }

  const extractedErrors = [];
  errors.array().map(err => extractedErrors.push({ [err.path]: err.msg }));

  return res.status(422).json({
    success: false,
    message: 'Validation failed: Out of range or missing values',
    errors: extractedErrors,
  });
};

// Calibration data validation for /measure
const calibrationValidator = [
  body('calibrationData')
    .custom((value) => {
      try {
        const data = typeof value === 'string' ? JSON.parse(value) : value;
        
        if (!data || (!data.type && !data.value)) {
          throw new Error('At least one calibration reference (height or object) is required');
        }

        if (data.type === 'height') {
          if (data.value < 50 || data.value > 250) {
            throw new Error('Height must be between 50 and 250 cm');
          }
        } else if (data.type === 'reference') {
          if (!data.value || data.value <= 0) {
            throw new Error('Reference object dimensions must be greater than 0');
          }
        } else {
          throw new Error('Valid calibration type (height or reference) is required');
        }

        return true;
      } catch (err) {
        throw new Error(err.message || 'Invalid calibration data format');
      }
    }),
  validate
];

// Measurement validation for /recommendations and /users
const measurementValidator = [
  // Validation for height (mostly for user creation)
  body('height')
    .optional()
    .isFloat({ min: 50, max: 250 })
    .withMessage('Height must be between 50 and 250 cm'),

  // Validation for measurement object fields
  body('measurements.chest')
    .optional()
    .custom((value) => {
      const val = parseFloat(String(value).split(' ')[0]);
      if (val < 50 || val > 200) throw new Error('Chest measurement must be between 50 and 200 cm');
      return true;
    }),
  
  body('measurements.waist')
    .optional()
    .custom((value) => {
      const val = parseFloat(String(value).split(' ')[0]);
      if (val < 40 || val > 200) throw new Error('Waist measurement must be between 40 and 200 cm');
      return true;
    }),

  body('measurements.hips')
    .optional()
    .custom((value) => {
      const val = parseFloat(String(value).split(' ')[0]);
      if (val < 50 || val > 200) throw new Error('Hips measurement must be between 50 and 200 cm');
      return true;
    }),

  validate
];

module.exports = {
  calibrationValidator,
  measurementValidator
};
