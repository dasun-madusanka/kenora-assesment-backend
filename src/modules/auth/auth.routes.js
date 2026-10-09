const express = require('express');
const authController = require('./auth.controller');
const { authenticate } = require('../../middleware/auth');
const { validateBody } = require('../../middleware/validate');

const router = express.Router();

// Public: user login (Admin, Manager, Staff)
router.post('/login', validateBody(['email', 'password']), authController.login);

// Authenticated: get current user context
router.get('/me', authenticate, authController.getMe);

module.exports = router;
