const express = require('express');
const workshopsController = require('./workshops.controller');
const registrationsController = require('../registrations/registrations.controller');
const waitlistController = require('../waitlist/waitlist.controller');
const { authenticate } = require('../../middleware/auth');
const { requireManager, requireManagerOrStaff } = require('../../middleware/rbac');
const { validateBody } = require('../../middleware/validate');

const router = express.Router();

router.use(authenticate);

router.get('/', requireManagerOrStaff, workshopsController.getWorkshops);
router.get('/:id', requireManagerOrStaff, workshopsController.getWorkshopById);

router.post(
  '/',
  requireManager,
  validateBody(['code', 'title', 'instructor', 'startTime', 'capacity']),
  workshopsController.createWorkshop
);

router.put('/:id', requireManager, workshopsController.updateWorkshop);
router.patch('/:id', requireManager, workshopsController.updateWorkshop);

router.post(
  '/:id/register',
  requireManagerOrStaff,
  validateBody(['attendeeName', 'attendeeEmail']),
  registrationsController.registerAttendee
);

router.get('/:id/registrations', requireManagerOrStaff, registrationsController.getWorkshopRegistrations);

router.post(
  '/:id/waitlist',
  requireManagerOrStaff,
  validateBody(['attendeeName', 'attendeeEmail']),
  waitlistController.addToWaitlist
);
router.get('/:id/waitlist', requireManagerOrStaff, waitlistController.getWorkshopWaitlist);

module.exports = router;
