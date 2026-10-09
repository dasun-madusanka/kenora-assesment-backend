const { ApiError } = require('./errorHandler');

/**
 * Role-Based Access Control (RBAC) middleware factory.
 * Enforces strict role checks and returns 403 Forbidden if user lacks permission.
 *
 * Requirements Matrix:
 * - Admin: ONLY manage accounts & roles (refused on workshops & registrations)
 * - Manager: manage workshops, register/cancel attendees, view workshops/history
 * - Staff: register/cancel attendees, view workshops/history
 * 
 * @param {...string} allowedRoles - List of authorized roles ('ADMIN', 'MANAGER', 'STAFF')
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized('User must be authenticated before checking roles'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        ApiError.forbidden(
          `Access denied. Role "${req.user.role}" does not have permission for this resource.`
        )
      );
    }

    next();
  };
};

// Convenience helpers matching assessment permissions table:
// 1. Create user accounts & set roles: Admin only
const requireAdmin = requireRole('ADMIN');

// 2. Add & edit workshops: Manager only
const requireManager = requireRole('MANAGER');

// 3. Register & cancel attendees + View workshops & registrations: Manager and Staff only (Admin explicitly disallowed!)
const requireManagerOrStaff = requireRole('MANAGER', 'STAFF');

module.exports = {
  requireRole,
  requireAdmin,
  requireManager,
  requireManagerOrStaff,
};
