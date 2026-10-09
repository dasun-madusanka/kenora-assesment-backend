const { getClient, query } = require('../../config/db');
const { ApiError } = require('../../middleware/errorHandler');

const registerAttendee = async (workshopId, { attendeeName, attendeeEmail }, staffUserId) => {
  if (!attendeeName || !attendeeEmail) {
    throw ApiError.badRequest('Attendee name and email are required');
  }

  const normalizedEmail = attendeeEmail.trim().toLowerCase();
  const trimmedName = attendeeName.trim();

  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Lock workshop row to prevent concurrent overbooking
    const workshopRes = await client.query(
      `SELECT id, code, title, capacity, status 
       FROM workshops 
       WHERE id = $1 
       FOR UPDATE`,
      [workshopId]
    );

    if (workshopRes.rows.length === 0) {
      await client.query('ROLLBACK');
      throw ApiError.notFound(`Workshop with ID ${workshopId} not found`);
    }

    const workshop = workshopRes.rows[0];

    if (workshop.status === 'CANCELLED') {
      await client.query('ROLLBACK');
      throw ApiError.badRequest('Cannot register for a cancelled workshop');
    }

    if (workshop.status === 'COMPLETED') {
      await client.query('ROLLBACK');
      throw ApiError.badRequest('Cannot register for a completed workshop');
    }

    // Check if attendee is already registered
    const duplicateCheck = await client.query(
      `SELECT id FROM registrations 
       WHERE workshop_id = $1 AND attendee_email = $2 AND status = 'CONFIRMED'`,
      [workshopId, normalizedEmail]
    );

    if (duplicateCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      throw ApiError.conflict(`Attendee with email "${normalizedEmail}" is already registered`);
    }

    // Count confirmed bookings while holding lock
    const countRes = await client.query(
      `SELECT COUNT(*)::int AS active_count 
       FROM registrations 
       WHERE workshop_id = $1 AND status = 'CONFIRMED'`,
      [workshopId]
    );

    const activeCount = countRes.rows[0].active_count;

    if (activeCount >= workshop.capacity) {
      await client.query('ROLLBACK');
      throw ApiError.conflict(
        `Workshop "${workshop.title}" is fully booked (${activeCount}/${workshop.capacity} seats taken).`,
        { capacity: workshop.capacity, activeCount }
      );
    }

    const insertRes = await client.query(
      `INSERT INTO registrations (
        workshop_id, attendee_name, attendee_email, status, registered_by, registered_at
      )
      VALUES ($1, $2, $3, 'CONFIRMED', $4, NOW())
      RETURNING *`,
      [workshopId, trimmedName, normalizedEmail, staffUserId]
    );

    const registration = insertRes.rows[0];

    await client.query(
      `INSERT INTO audit_logs (action, entity_type, entity_id, performed_by, details)
       VALUES ('REGISTRATION_CREATED', 'REGISTRATION', $1, $2, $3)`,
      [
        registration.id,
        staffUserId,
        JSON.stringify({
          workshop_id: workshopId,
          attendee_email: normalizedEmail,
        }),
      ]
    );

    await client.query('COMMIT');

    return {
      registration,
      workshop: {
        id: workshop.id,
        code: workshop.code,
        title: workshop.title,
        capacity: workshop.capacity,
        activeRegistrations: activeCount + 1,
        remainingSeats: workshop.capacity - (activeCount + 1),
      },
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const cancelRegistration = async (registrationId, cancellationReason, staffUserId) => {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const regRes = await client.query(
      `SELECT r.*, w.title as workshop_title, w.capacity
       FROM registrations r
       JOIN workshops w ON r.workshop_id = w.id
       WHERE r.id = $1
       FOR UPDATE OF r`,
      [registrationId]
    );

    if (regRes.rows.length === 0) {
      await client.query('ROLLBACK');
      throw ApiError.notFound(`Registration with ID ${registrationId} not found`);
    }

    const reg = regRes.rows[0];

    if (reg.status === 'CANCELLED') {
      await client.query('ROLLBACK');
      throw ApiError.badRequest('Registration is already cancelled');
    }

    // Keep record but mark cancelled
    const updateRes = await client.query(
      `UPDATE registrations
       SET status = 'CANCELLED',
           cancelled_by = $1,
           cancelled_at = NOW(),
           cancellation_reason = $2,
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [staffUserId, cancellationReason || null, registrationId]
    );

    const cancelledRegistration = updateRes.rows[0];

    await client.query(
      `INSERT INTO audit_logs (action, entity_type, entity_id, performed_by, details)
       VALUES ('REGISTRATION_CANCELLED', 'REGISTRATION', $1, $2, $3)`,
      [
        registrationId,
        staffUserId,
        JSON.stringify({
          workshop_id: reg.workshop_id,
          attendee_email: reg.attendee_email,
          reason: cancellationReason || null,
        }),
      ]
    );

    // If waitlist has waiting attendees, promote the earliest one
    let promotedAttendee = null;
    const waitlistRes = await client.query(
      `SELECT * FROM waitlist 
       WHERE workshop_id = $1 AND status = 'WAITING' 
       ORDER BY created_at ASC 
       LIMIT 1 
       FOR UPDATE`,
      [reg.workshop_id]
    );

    if (waitlistRes.rows.length > 0) {
      const waitlistEntry = waitlistRes.rows[0];

      await client.query(
        `UPDATE waitlist 
         SET status = 'PROMOTED', promoted_at = NOW() 
         WHERE id = $1`,
        [waitlistEntry.id]
      );

      const promoRegRes = await client.query(
        `INSERT INTO registrations (
          workshop_id, attendee_name, attendee_email, status, registered_by, registered_at
        )
        VALUES ($1, $2, $3, 'CONFIRMED', $4, NOW())
        RETURNING *`,
        [reg.workshop_id, waitlistEntry.attendee_name, waitlistEntry.attendee_email, staffUserId]
      );

      promotedAttendee = promoRegRes.rows[0];

      await client.query(
        `INSERT INTO audit_logs (action, entity_type, entity_id, performed_by, details)
         VALUES ('WAITLIST_PROMOTED', 'REGISTRATION', $1, $2, $3)`,
        [
          promotedAttendee.id,
          staffUserId,
          JSON.stringify({
            waitlist_id: waitlistEntry.id,
            workshop_id: reg.workshop_id,
            attendee_email: waitlistEntry.attendee_email,
          }),
        ]
      );
    }

    await client.query('COMMIT');

    return {
      cancelledRegistration,
      promotedWaitlistAttendee: promotedAttendee,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const getWorkshopRegistrations = async (workshopId) => {
  const workshopCheck = await query('SELECT id, title, capacity FROM workshops WHERE id = $1', [workshopId]);
  if (workshopCheck.rows.length === 0) {
    throw ApiError.notFound(`Workshop with ID ${workshopId} not found`);
  }

  const sql = `
    SELECT 
      r.id,
      r.workshop_id,
      r.attendee_name,
      r.attendee_email,
      r.status,
      r.registered_at,
      r.registered_by,
      u_reg.name AS registered_by_name,
      u_reg.role AS registered_by_role,
      r.cancelled_at,
      r.cancelled_by,
      u_canc.name AS cancelled_by_name,
      u_canc.role AS cancelled_by_role,
      r.cancellation_reason,
      r.created_at,
      r.updated_at
    FROM registrations r
    LEFT JOIN users u_reg ON r.registered_by = u_reg.id
    LEFT JOIN users u_canc ON r.cancelled_by = u_canc.id
    WHERE r.workshop_id = $1
    ORDER BY r.created_at DESC
  `;

  const res = await query(sql, [workshopId]);
  return {
    workshop: workshopCheck.rows[0],
    registrations: res.rows,
  };
};

const getAllRegistrationsHistory = async (filters = {}) => {
  const { status, search } = filters;
  let sql = `
    SELECT 
      r.id,
      r.workshop_id,
      w.code AS workshop_code,
      w.title AS workshop_title,
      r.attendee_name,
      r.attendee_email,
      r.status,
      r.registered_at,
      u_reg.name AS registered_by_name,
      r.cancelled_at,
      u_canc.name AS cancelled_by_name,
      r.cancellation_reason
    FROM registrations r
    JOIN workshops w ON r.workshop_id = w.id
    LEFT JOIN users u_reg ON r.registered_by = u_reg.id
    LEFT JOIN users u_canc ON r.cancelled_by = u_canc.id
    WHERE 1=1
  `;

  const params = [];
  let paramIdx = 1;

  if (status) {
    sql += ` AND r.status = $${paramIdx++}`;
    params.push(status.toUpperCase());
  }

  if (search) {
    sql += ` AND (
      r.attendee_name ILIKE $${paramIdx} OR 
      r.attendee_email ILIKE $${paramIdx} OR
      w.title ILIKE $${paramIdx} OR
      w.code ILIKE $${paramIdx}
    )`;
    params.push(`%${search.trim()}%`);
    paramIdx++;
  }

  sql += ` ORDER BY r.created_at DESC`;

  const res = await query(sql, params);
  return res.rows;
};

module.exports = {
  registerAttendee,
  cancelRegistration,
  getWorkshopRegistrations,
  getAllRegistrationsHistory,
};
