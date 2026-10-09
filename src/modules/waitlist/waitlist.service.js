const { query } = require('../../config/db');
const { ApiError } = require('../../middleware/errorHandler');

const addToWaitlist = async (workshopId, { attendeeName, attendeeEmail }, staffUserId) => {
  if (!attendeeName || !attendeeEmail) {
    throw ApiError.badRequest('Attendee name and attendee email are required');
  }

  const normalizedEmail = attendeeEmail.trim().toLowerCase();
  const trimmedName = attendeeName.trim();

  const workshopRes = await query('SELECT id, code, title, status FROM workshops WHERE id = $1', [workshopId]);
  if (workshopRes.rows.length === 0) {
    throw ApiError.notFound(`Workshop with ID ${workshopId} not found`);
  }

  const workshop = workshopRes.rows[0];
  if (workshop.status === 'CANCELLED' || workshop.status === 'COMPLETED') {
    throw ApiError.badRequest(`Cannot join waitlist for a ${workshop.status.toLowerCase()} workshop`);
  }

  const activeReg = await query(
    `SELECT id FROM registrations WHERE workshop_id = $1 AND attendee_email = $2 AND status = 'CONFIRMED'`,
    [workshopId, normalizedEmail]
  );
  if (activeReg.rows.length > 0) {
    throw ApiError.conflict('Attendee is already registered with a confirmed seat');
  }

  const existingWaitlist = await query(
    `SELECT id FROM waitlist WHERE workshop_id = $1 AND attendee_email = $2 AND status = 'WAITING'`,
    [workshopId, normalizedEmail]
  );
  if (existingWaitlist.rows.length > 0) {
    throw ApiError.conflict('Attendee is already on the waitlist for this workshop');
  }

  const res = await query(
    `INSERT INTO waitlist (workshop_id, attendee_name, attendee_email, status, added_by)
     VALUES ($1, $2, $3, 'WAITING', $4)
     RETURNING *`,
    [workshopId, trimmedName, normalizedEmail, staffUserId]
  );

  const entry = res.rows[0];

  await query(
    `INSERT INTO audit_logs (action, entity_type, entity_id, performed_by, details)
     VALUES ('WAITLIST_JOINED', 'WAITLIST', $1, $2, $3)`,
    [
      entry.id,
      staffUserId,
      JSON.stringify({ workshop_id: workshopId, attendee_email: normalizedEmail }),
    ]
  );

  return entry;
};

const getWorkshopWaitlist = async (workshopId) => {
  const workshopCheck = await query('SELECT id, title FROM workshops WHERE id = $1', [workshopId]);
  if (workshopCheck.rows.length === 0) {
    throw ApiError.notFound(`Workshop with ID ${workshopId} not found`);
  }

  const res = await query(
    `SELECT 
       wl.id,
       wl.workshop_id,
       wl.attendee_name,
       wl.attendee_email,
       wl.status,
       wl.created_at,
       wl.promoted_at,
       u.name AS added_by_name
     FROM waitlist wl
     LEFT JOIN users u ON wl.added_by = u.id
     WHERE wl.workshop_id = $1
     ORDER BY wl.created_at ASC`,
    [workshopId]
  );

  return {
    workshop: workshopCheck.rows[0],
    waitlist: res.rows,
  };
};

module.exports = {
  addToWaitlist,
  getWorkshopWaitlist,
};
