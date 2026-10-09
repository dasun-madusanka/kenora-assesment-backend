const { query } = require('../../config/db');

const getAuditLogs = async (filters = {}) => {
  const { action, entityType, from, to } = filters;

  let sql = `
    SELECT 
      a.id,
      a.action,
      a.entity_type,
      a.entity_id,
      a.performed_by,
      u.name AS performed_by_name,
      u.role AS performed_by_role,
      a.details,
      a.created_at
    FROM audit_logs a
    LEFT JOIN users u ON a.performed_by = u.id
    WHERE 1=1
  `;

  const params = [];
  let paramIdx = 1;

  if (action) {
    sql += ` AND a.action = $${paramIdx++}`;
    params.push(action.toUpperCase());
  }

  if (entityType) {
    sql += ` AND a.entity_type = $${paramIdx++}`;
    params.push(entityType.toUpperCase());
  }

  if (from) {
    sql += ` AND a.created_at >= $${paramIdx++}`;
    params.push(new Date(from).toISOString());
  }

  if (to) {
    sql += ` AND a.created_at <= $${paramIdx++}`;
    params.push(new Date(to).toISOString());
  }

  sql += ` ORDER BY a.created_at DESC LIMIT 200`;

  const res = await query(sql, params);
  return res.rows;
};

module.exports = {
  getAuditLogs,
};
