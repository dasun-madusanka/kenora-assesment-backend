const auditService = require('./audit.service');

const getAuditLogs = async (req, res, next) => {
  try {
    const { action, entityType, from, to } = req.query;
    const logs = await auditService.getAuditLogs({ action, entityType, from, to });
    res.status(200).json({
      success: true,
      count: logs.length,
      data: logs,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAuditLogs,
};
