const { ApiError } = require('./errorHandler');

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
