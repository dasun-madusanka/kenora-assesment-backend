const express = require('express');
const usersController = require('./users.controller');
const { authenticate } = require('../../middleware/auth');
const { requireAdmin } = require('../../middleware/rbac');
const { validateBody } = require('../../middleware/validate');

const router = express.Router();

router.use(authenticate);
router.use(requireAdmin);

router.post('/', validateBody(['name', 'email', 'password', 'role']), usersController.createUser);
router.get('/', usersController.getAllUsers);
router.patch('/:id/role', validateBody(['role']), usersController.updateUserRole);

module.exports = router;
