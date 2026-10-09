const { ApiError } = require('./errorHandler');

/**
 * Validates request body fields against a schema or required fields
 * @param {Array<string>} requiredFields - List of required field names in req.body
 */
const validateBody = (requiredFields) => {
  return (req, res, next) => {
    const missing = [];
    for (const field of requiredFields) {
      if (req.body[field] === undefined || req.body[field] === null || req.body[field] === '') {
        missing.push(field);
      }
    }

    if (missing.length > 0) {
      return next(
        ApiError.badRequest(`Missing required field(s): ${missing.join(', ')}`, {
          missingFields: missing,
        })
      );
    }

    next();
  };
};

module.exports = {
  validateBody,
};
