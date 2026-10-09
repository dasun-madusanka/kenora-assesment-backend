const bcrypt = require('bcryptjs');
const { query } = require('../../config/db');
const { ApiError } = require('../../middleware/errorHandler');

const ALLOWED_ROLES = ['ADMIN', 'MANAGER', 'STAFF'];

/**
 * Creates a new user account with role assignment (Admin only)
 */
const createUser = async ({ name, email, password, role }, performedByUserId) => {
  if (!name || !email || !password || !role) {
    throw ApiError.badRequest('Name, email, password, and role are required');
  }

  const normalizedRole = role.toUpperCase();
  if (!ALLOWED_ROLES.includes(normalizedRole)) {
    throw ApiError.badRequest(`Invalid role "${role}". Allowed roles: ${ALLOWED_ROLES.join(', ')}`);
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Check if email already exists
  const existing = await query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
  if (existing.rows.length > 0) {
    throw ApiError.conflict(`A user with email "${normalizedEmail}" already exists`);
  }

  // Hash password with bcrypt
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const res = await query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, email, role, is_active, created_at`,
    [name.trim(), normalizedEmail, passwordHash, normalizedRole]
  );

  const newUser = res.rows[0];

  // Record audit log entry
  await query(
    `INSERT INTO audit_logs (action, entity_type, entity_id, performed_by, details)
     VALUES ('USER_CREATED', 'USER', $1, $2, $3)`,
    [
      newUser.id,
      performedByUserId,
      JSON.stringify({ name: newUser.name, email: newUser.email, role: newUser.role }),
    ]
  );

  return newUser;
};

/**
 * List all user accounts (Admin only)
 */
const getAllUsers = async () => {
  const res = await query(
    `SELECT id, name, email, role, is_active, created_at, updated_at
     FROM users
     ORDER BY created_at DESC`
  );
  return res.rows;
};

/**
 * Update user role (Admin only)
 */
const updateUserRole = async (userId, newRole, performedByUserId) => {
  const normalizedRole = newRole.toUpperCase();
  if (!ALLOWED_ROLES.includes(normalizedRole)) {
    throw ApiError.badRequest(`Invalid role "${newRole}". Allowed roles: ${ALLOWED_ROLES.join(', ')}`);
  }

  const existingRes = await query('SELECT id, name, email, role FROM users WHERE id = $1', [userId]);
  if (existingRes.rows.length === 0) {
    throw ApiError.notFound('User not found');
  }

  const oldUser = existingRes.rows[0];

  const updateRes = await query(
    `UPDATE users
     SET role = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING id, name, email, role, is_active, updated_at`,
    [normalizedRole, userId]
  );

  const updatedUser = updateRes.rows[0];

  // Record audit log entry
  await query(
    `INSERT INTO audit_logs (action, entity_type, entity_id, performed_by, details)
     VALUES ('ROLE_UPDATED', 'USER', $1, $2, $3)`,
    [
      userId,
      performedByUserId,
      JSON.stringify({ previous_role: oldUser.role, new_role: normalizedRole }),
    ]
  );

  return updatedUser;
};

module.exports = {
  createUser,
  getAllUsers,
  updateUserRole,
};
