const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { query } = require('../config/db');
const { ApiError } = require('./errorHandler');

/**
 * Authentication middleware: verifies JWT and attaches authenticated user to req.user
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(ApiError.unauthorized('Authentication token missing or malformed'));
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, config.JWT.secret);
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return next(ApiError.unauthorized('Token has expired'));
      }
      return next(ApiError.unauthorized('Invalid authentication token'));
    }

    // Verify user exists in database and is active
    const userResult = await query(
      'SELECT id, name, email, role, is_active FROM users WHERE id = $1',
      [decoded.id]
    );

    if (userResult.rows.length === 0) {
      return next(ApiError.unauthorized('User associated with token no longer exists'));
    }

    const user = userResult.rows[0];
    if (!user.is_active) {
      return next(ApiError.unauthorized('Account has been deactivated'));
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  authenticate,
};
