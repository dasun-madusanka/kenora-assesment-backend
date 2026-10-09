const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../../config/env');
const { query } = require('../../config/db');
const { ApiError } = require('../../middleware/errorHandler');

const login = async (email, password) => {
  if (!email || !password) {
    throw ApiError.badRequest('Email and password are required');
  }

  const normalizedEmail = email.trim().toLowerCase();
  const res = await query(
    'SELECT id, name, email, password_hash, role, is_active FROM users WHERE email = $1',
    [normalizedEmail]
  );

  if (res.rows.length === 0) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  const user = res.rows[0];

  if (!user.is_active) {
    throw ApiError.unauthorized('Account has been deactivated');
  }

  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  const payload = {
    id: user.id,
    role: user.role,
    email: user.email,
    name: user.name,
  };

  const token = jwt.sign(payload, config.JWT.secret, {
    expiresIn: config.JWT.expiresIn,
  });

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  };
};

module.exports = {
  login,
};
