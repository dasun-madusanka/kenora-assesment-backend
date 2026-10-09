const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { query } = require('../config/db');
const { ApiError } = require('./errorHandler');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(ApiError.unauthorized('Authentication token missing'));
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, config.JWT.secret);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return next(ApiError.unauthorized('Token has expired'));
      }
      return next(ApiError.unauthorized('Invalid token'));
    }

    const resUser = await query(
      'SELECT id, name, email, role, is_active FROM users WHERE id = $1',
      [decoded.id]
    );

    if (resUser.rows.length === 0) {
      return next(ApiError.unauthorized('User not found'));
    }

    const user = resUser.rows[0];
    if (!user.is_active) {
      return next(ApiError.unauthorized('Account is deactivated'));
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
