/**
 * Workshop Registration Service - Concurrency Test Script
 * 
 * Verifies that concurrent registration requests trying to claim the last remaining
 * seat are serialized correctly by PostgreSQL row-level locks ('SELECT ... FOR UPDATE')
 * and that ZERO over-registration occurs.
 */

const { pool } = require('../config/db');
const registrationsService = require('../modules/registrations/registrations.service');

const runConcurrencyTest = async () => {
  console.log('================================================================');
  console.log('🚀 RUNNING WORKSHOP CAPACITY CONCURRENCY RACE CONDITION TEST');
  console.log('================================================================');

  try {
    // 1. Get workshop POT-102
    const wsRes = await pool.query(
      `SELECT w.id, w.code, w.title, w.capacity,
              COALESCE(r.active_count, 0)::int AS active_count
       FROM workshops w
       LEFT JOIN (
         SELECT workshop_id, COUNT(*) AS active_count
         FROM registrations
         WHERE status = 'CONFIRMED'
         GROUP BY workshop_id
       ) r ON w.id = r.workshop_id
       WHERE w.code = 'POT-102'`
    );

    if (wsRes.rows.length === 0) {
      console.error('❌ POT-102 not found. Please run "npm run seed" first.');
      process.exit(1);
    }

    const workshop = wsRes.rows[0];
    const initialSeatsLeft = workshop.capacity - workshop.active_count;
    console.log(`[Target Workshop] Code: ${workshop.code} | Title: "${workshop.title}"`);
    console.log(`[Initial State] Capacity: ${workshop.capacity} | Active Bookings: ${workshop.active_count} | Available Seats: ${initialSeatsLeft}`);

    if (initialSeatsLeft <= 0) {
      console.log('Resetting workshop to have 1 available seat for testing...');
      await pool.query(
        `DELETE FROM registrations WHERE workshop_id = $1 AND attendee_email LIKE 'concurrent%'`,
        [workshop.id]
      );
    }

    // 2. Get a staff user ID to perform registrations
    const staffRes = await pool.query(`SELECT id FROM users WHERE role = 'STAFF' LIMIT 1`);
    const staffId = staffRes.rows[0].id;

    // 3. Prepare 10 simultaneous registration attempts
    const concurrentRequestsCount = 10;
    console.log(`\n⚡ Launching ${concurrentRequestsCount} SIMULTANEOUS registration requests for ${initialSeatsLeft} remaining seat...`);

    const promises = [];
    for (let i = 1; i <= concurrentRequestsCount; i++) {
      const attendeeName = `Concurrent Attendee ${i}`;
      const attendeeEmail = `concurrent.test.${Date.now()}.${i}@example.com`;

      const requestPromise = registrationsService
        .registerAttendee(workshop.id, { attendeeName, attendeeEmail }, staffId)
        .then((result) => ({
          requestId: i,
          status: 'SUCCESS',
          email: attendeeEmail,
          message: 'Seat confirmed',
        }))
        .catch((error) => ({
          requestId: i,
          status: 'REJECTED',
          email: attendeeEmail,
          statusCode: error.statusCode,
          message: error.message,
        }));

      promises.push(requestPromise);
    }

    const results = await Promise.all(promises);

    // 4. Analyze Results
    const successes = results.filter((r) => r.status === 'SUCCESS');
    const rejections = results.filter((r) => r.status === 'REJECTED');

    console.log('\n--- Request Results Summary ---');
    console.log(`Total Requests:    ${results.length}`);
    console.log(`Successful (201):  ${successes.length}`);
    console.log(`Rejected (409):    ${rejections.length}`);

    // 5. Query DB directly for ground-truth count
    const finalCountRes = await pool.query(
      `SELECT COUNT(*)::int AS final_active_count 
       FROM registrations 
       WHERE workshop_id = $1 AND status = 'CONFIRMED'`,
      [workshop.id]
    );

    const finalCount = finalCountRes.rows[0].final_active_count;
    console.log(`\n[Database Ground Truth] Final Confirmed Seats: ${finalCount} / ${workshop.capacity}`);

    // 6. Verification Assertions
    if (successes.length === initialSeatsLeft && finalCount === workshop.capacity) {
      console.log('\n✅ PASS: Concurrency test succeeded without overbooking!');
      console.log('   Pessimistic row locking successfully serialized simultaneous transactions.');
      console.log('   The capacity rule was strictly upheld.');
    } else {
      console.error('\n❌ FAIL: Capacity violation detected!');
      console.error(`   Expected exactly ${initialSeatsLeft} success, got ${successes.length}.`);
      process.exit(1);
    }

    process.exit(0);
  } catch (err) {
    console.error('Unexpected error during concurrency test:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

runConcurrencyTest();
