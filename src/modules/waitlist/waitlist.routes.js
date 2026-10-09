const express = require('express');
const waitlistController = require('./waitlist.controller');
const { authenticate } = require('../../middleware/auth');
const { requireManagerOrStaff } = require('../../middleware/rbac');
const { validateBody } = require('../../middleware/validate');

const router = express.Router();

router.use(authenticate);
router.use(requireManagerOrStaff);

// POST /api/workshops/:id/waitlist
// GET /api/workshops/:id/waitlist
router.post('/:id/waitlist', validateBody(['attendeeName', 'attendeeEmail']), waitlistController.addToWaitlist);
router.get('/:id/waitlist', waitlistController.getWorkshopWaitlist);

module.exports = router;
