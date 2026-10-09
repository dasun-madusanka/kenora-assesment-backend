const express = require('express');
const workshopsController = require('./workshops.controller');
const { authenticate } = require('../../middleware/auth');
const { requireManager, requireManagerOrStaff } = require('../../middleware/rbac');
const { validateBody } = require('../../middleware/validate');

const router = express.Router();

// All workshop routes require authentication
router.use(authenticate);

// View workshops catalogue: Manager & Staff only (Admin strictly refused with 403)
router.get('/', requireManagerOrStaff, workshopsController.getWorkshops);
router.get('/:id', requireManagerOrStaff, workshopsController.getWorkshopById);

// Add & edit workshops: Manager only (Admin & Staff strictly refused with 403)
router.post(
  '/',
  requireManager,
  validateBody(['code', 'title', 'instructor', 'startTime', 'capacity']),
  workshopsController.createWorkshop
);

const registrationsController = require('../registrations/registrations.controller');

router.put('/:id', requireManager, workshopsController.updateWorkshop);
router.patch('/:id', requireManager, workshopsController.updateWorkshop);

// Registrations for a workshop: Manager & Staff only (Admin refused with 403)
router.post(
  '/:id/register',
  requireManagerOrStaff,
  validateBody(['attendeeName', 'attendeeEmail']),
  registrationsController.registerAttendee
);

router.get('/:id/registrations', requireManagerOrStaff, registrationsController.getWorkshopRegistrations);

module.exports = router;
