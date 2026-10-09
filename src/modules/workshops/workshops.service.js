const { query } = require('../../config/db');
const { ApiError } = require('../../middleware/errorHandler');

const ALLOWED_STATUSES = ['SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED'];

/**
 * Retrieves workshops with multi-criteria filtering:
 * - date range (from / to)
 * - status
 * - seatsAvailable (only workshops with capacity > active_registrations)
 * - search keyword (code, title, instructor, location)
 */
const getWorkshops = async (filters = {}) => {
  const { from, to, status, seatsAvailable, search } = filters;

  let sql = `
    SELECT 
      w.id,
      w.code,
      w.title,
      w.instructor,
      w.location,
      w.description,
      w.start_time,
      w.end_time,
      w.capacity,
      w.status,
      w.created_at,
      w.updated_at,
      u.name AS created_by_name,
      COALESCE(r.active_count, 0)::int AS active_registrations,
      (w.capacity - COALESCE(r.active_count, 0))::int AS available_seats,
      COALESCE(wl.waitlist_count, 0)::int AS waitlist_count
    FROM workshops w
    LEFT JOIN users u ON w.created_by = u.id
    LEFT JOIN (
      SELECT workshop_id, COUNT(*) AS active_count
      FROM registrations
      WHERE status = 'CONFIRMED'
      GROUP BY workshop_id
    ) r ON w.id = r.workshop_id
    LEFT JOIN (
      SELECT workshop_id, COUNT(*) AS waitlist_count
      FROM waitlist
      WHERE status = 'WAITING'
      GROUP BY workshop_id
    ) wl ON w.id = wl.workshop_id
    WHERE 1=1
  `;

  const params = [];
  let paramIdx = 1;

  if (status) {
    sql += ` AND w.status = $${paramIdx++}`;
    params.push(status.toUpperCase());
  }

  if (from) {
    sql += ` AND w.start_time >= $${paramIdx++}`;
    params.push(new Date(from).toISOString());
  }

  if (to) {
    sql += ` AND w.start_time <= $${paramIdx++}`;
    params.push(new Date(to).toISOString());
  }

  if (search) {
    sql += ` AND (
      w.code ILIKE $${paramIdx} OR 
      w.title ILIKE $${paramIdx} OR 
      w.instructor ILIKE $${paramIdx} OR
      w.location ILIKE $${paramIdx}
    )`;
    params.push(`%${search.trim()}%`);
    paramIdx++;
  }

  if (seatsAvailable === 'true' || seatsAvailable === true) {
    sql += ` AND (w.capacity - COALESCE(r.active_count, 0)) > 0`;
  }

  sql += ` ORDER BY w.start_time ASC`;

  const res = await query(sql, params);
  return res.rows;
};

/**
 * Retrieves a single workshop by ID including registration counts
 */
const getWorkshopById = async (workshopId) => {
  const sql = `
    SELECT 
      w.id,
      w.code,
      w.title,
      w.instructor,
      w.location,
      w.description,
      w.start_time,
      w.end_time,
      w.capacity,
      w.status,
      w.created_at,
      w.updated_at,
      u.name AS created_by_name,
      COALESCE(r.active_count, 0)::int AS active_registrations,
      (w.capacity - COALESCE(r.active_count, 0))::int AS available_seats,
      COALESCE(wl.waitlist_count, 0)::int AS waitlist_count
    FROM workshops w
    LEFT JOIN users u ON w.created_by = u.id
    LEFT JOIN (
      SELECT workshop_id, COUNT(*) AS active_count
      FROM registrations
      WHERE status = 'CONFIRMED'
      GROUP BY workshop_id
    ) r ON w.id = r.workshop_id
    LEFT JOIN (
      SELECT workshop_id, COUNT(*) AS waitlist_count
      FROM waitlist
      WHERE status = 'WAITING'
      GROUP BY workshop_id
    ) wl ON w.id = wl.workshop_id
    WHERE w.id = $1
  `;

  const res = await query(sql, [workshopId]);
  if (res.rows.length === 0) {
    throw ApiError.notFound(`Workshop with ID ${workshopId} not found`);
  }
  return res.rows[0];
};

/**
 * Creates a new workshop (Manager only)
 */
const createWorkshop = async (data, userId) => {
  const { code, title, instructor, location, description, startTime, endTime, capacity, status } = data;

  if (!code || !title || !instructor || !startTime || capacity === undefined) {
    throw ApiError.badRequest('Code, title, instructor, startTime, and capacity are required');
  }

  const parsedCapacity = parseInt(capacity, 10);
  if (isNaN(parsedCapacity) || parsedCapacity <= 0) {
    throw ApiError.badRequest('Capacity must be a positive integer greater than 0');
  }

  const normalizedCode = code.trim().toUpperCase();
  const existingCode = await query('SELECT id FROM workshops WHERE code = $1', [normalizedCode]);
  if (existingCode.rows.length > 0) {
    throw ApiError.conflict(`Workshop code "${normalizedCode}" already exists`);
  }

  const workshopStatus = status ? status.toUpperCase() : 'SCHEDULED';
  if (!ALLOWED_STATUSES.includes(workshopStatus)) {
    throw ApiError.badRequest(`Invalid status. Allowed values: ${ALLOWED_STATUSES.join(', ')}`);
  }

  const res = await query(
    `INSERT INTO workshops (
      code, title, instructor, location, description, start_time, end_time, capacity, status, created_by
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *`,
    [
      normalizedCode,
      title.trim(),
      instructor.trim(),
      location ? location.trim() : 'Downtown Campus',
      description ? description.trim() : null,
      new Date(startTime).toISOString(),
      endTime ? new Date(endTime).toISOString() : null,
      parsedCapacity,
      workshopStatus,
      userId,
    ]
  );

  const newWorkshop = res.rows[0];

  // Audit log entry
  await query(
    `INSERT INTO audit_logs (action, entity_type, entity_id, performed_by, details)
     VALUES ('WORKSHOP_CREATED', 'WORKSHOP', $1, $2, $3)`,
    [newWorkshop.id, userId, JSON.stringify({ code: newWorkshop.code, title: newWorkshop.title, capacity: newWorkshop.capacity })]
  );

  return newWorkshop;
};

/**
 * Updates an existing workshop (Manager only)
 */
const updateWorkshop = async (workshopId, data, userId) => {
  const existingRes = await query('SELECT * FROM workshops WHERE id = $1', [workshopId]);
  if (existingRes.rows.length === 0) {
    throw ApiError.notFound(`Workshop with ID ${workshopId} not found`);
  }

  const existing = existingRes.rows[0];

  let newCapacity = existing.capacity;
  if (data.capacity !== undefined) {
    newCapacity = parseInt(data.capacity, 10);
    if (isNaN(newCapacity) || newCapacity <= 0) {
      throw ApiError.badRequest('Capacity must be a positive integer');
    }

    // Safety rule: Capacity cannot be set below currently active registrations
    const activeRes = await query(
      `SELECT COUNT(*)::int AS active_count FROM registrations WHERE workshop_id = $1 AND status = 'CONFIRMED'`,
      [workshopId]
    );
    const activeCount = activeRes.rows[0].active_count;
    if (newCapacity < activeCount) {
      throw ApiError.badRequest(
        `Cannot reduce capacity to ${newCapacity}; there are currently ${activeCount} active registrations.`
      );
    }
  }

  let newStatus = existing.status;
  if (data.status) {
    newStatus = data.status.toUpperCase();
    if (!ALLOWED_STATUSES.includes(newStatus)) {
      throw ApiError.badRequest(`Invalid status. Allowed values: ${ALLOWED_STATUSES.join(', ')}`);
    }
  }

  let newCode = existing.code;
  if (data.code && data.code.trim().toUpperCase() !== existing.code) {
    newCode = data.code.trim().toUpperCase();
    const duplicate = await query('SELECT id FROM workshops WHERE code = $1 AND id != $2', [newCode, workshopId]);
    if (duplicate.rows.length > 0) {
      throw ApiError.conflict(`Workshop code "${newCode}" is already in use by another workshop`);
    }
  }

  const title = data.title !== undefined ? data.title.trim() : existing.title;
  const instructor = data.instructor !== undefined ? data.instructor.trim() : existing.instructor;
  const location = data.location !== undefined ? data.location.trim() : existing.location;
  const description = data.description !== undefined ? data.description.trim() : existing.description;
  const startTime = data.startTime ? new Date(data.startTime).toISOString() : existing.start_time;
  const endTime = data.endTime !== undefined ? (data.endTime ? new Date(data.endTime).toISOString() : null) : existing.end_time;

  const res = await query(
    `UPDATE workshops
     SET code = $1, title = $2, instructor = $3, location = $4, description = $5,
         start_time = $6, end_time = $7, capacity = $8, status = $9, updated_at = NOW()
     WHERE id = $10
     RETURNING *`,
    [newCode, title, instructor, location, description, startTime, endTime, newCapacity, newStatus, workshopId]
  );

  const updatedWorkshop = res.rows[0];

  // Audit log entry
  await query(
    `INSERT INTO audit_logs (action, entity_type, entity_id, performed_by, details)
     VALUES ('WORKSHOP_UPDATED', 'WORKSHOP', $1, $2, $3)`,
    [
      workshopId,
      userId,
      JSON.stringify({
        changes: data,
      }),
    ]
  );

  return updatedWorkshop;
};

module.exports = {
  getWorkshops,
  getWorkshopById,
  createWorkshop,
  updateWorkshop,
};
