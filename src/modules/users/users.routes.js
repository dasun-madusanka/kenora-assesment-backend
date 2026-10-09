const express = require('express');
const usersController = require('./users.controller');
const { authenticate } = require('../../middleware/auth');
const { requireAdmin } = require('../../middleware/rbac');
const { validateBody } = require('../../middleware/validate');

const router = express.Router();

// All user management routes require valid token AND ADMIN role
router.use(authenticate);
router.use(requireAdmin);

// POST /api/users - Create new user account & assign role
router.post('/', validateBody(['name', 'email', 'password', 'role']), usersController.createUser);

// GET /api/users - View all staff accounts & roles
router.get('/', usersController.getAllUsers);

// PATCH /api/users/:id/role - Update user role
router.patch('/:id/role', validateBody(['role']), usersController.updateUserRole);

module.exports = router;
