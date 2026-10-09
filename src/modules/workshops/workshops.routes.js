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

router.put('/:id', requireManager, workshopsController.updateWorkshop);
router.patch('/:id', requireManager, workshopsController.updateWorkshop);

module.exports = router;
