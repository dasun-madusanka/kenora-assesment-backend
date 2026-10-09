const express = require('express');
const authController = require('./auth.controller');
const { authenticate } = require('../../middleware/auth');
const { validateBody } = require('../../middleware/validate');

const router = express.Router();

router.post('/login', validateBody(['email', 'password']), authController.login);
router.get('/me', authenticate, authController.getMe);

module.exports = router;
