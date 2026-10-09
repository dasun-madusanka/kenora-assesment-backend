const express = require('express');
const auditController = require('./audit.controller');
const { authenticate } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/rbac');

const router = express.Router();

router.use(authenticate);
router.use(requireRole('ADMIN', 'MANAGER'));

router.get('/', auditController.getAuditLogs);

module.exports = router;
