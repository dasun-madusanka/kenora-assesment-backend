const { ApiError } = require('./errorHandler');

const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized('User not authenticated'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        ApiError.forbidden(`Access denied for role ${req.user.role}`)
      );
    }

    next();
  };
};

const requireAdmin = requireRole('ADMIN');
const requireManager = requireRole('MANAGER');
const requireManagerOrStaff = requireRole('MANAGER', 'STAFF');

module.exports = {
  requireRole,
  requireAdmin,
  requireManager,
  requireManagerOrStaff,
};
