const express = require('express');
const registrationsController = require('./registrations.controller');
const { authenticate } = require('../../middleware/auth');
const { requireManagerOrStaff } = require('../../middleware/rbac');

const router = express.Router();

router.use(authenticate);
router.use(requireManagerOrStaff);

router.post('/:id/cancel', registrationsController.cancelRegistration);
router.get('/history', registrationsController.getAllRegistrationsHistory);

module.exports = router;
