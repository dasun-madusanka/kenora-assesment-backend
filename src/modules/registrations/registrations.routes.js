const express = require('express');
const registrationsController = require('./registrations.controller');
const { authenticate } = require('../../middleware/auth');
const { requireManagerOrStaff } = require('../../middleware/rbac');
const { validateBody } = require('../../middleware/validate');

const router = express.Router();

// All registration routes require authentication
router.use(authenticate);

// Enforce strict access: Manager and Staff only (Admin is refused with 403)
router.use(requireManagerOrStaff);

// POST /api/workshops/:id/register (mounted at /api/workshops in workshops router OR directly here)
// POST /api/registrations/:id/cancel
router.post('/:id/cancel', registrationsController.cancelRegistration);

// GET /api/registrations/history - Global history of all registrations & cancellations
router.get('/history', registrationsController.getAllRegistrationsHistory);

module.exports = router;
