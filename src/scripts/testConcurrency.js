const { pool } = require('../config/db');
const registrationsService = require('../modules/registrations/registrations.service');

const runConcurrencyTest = async () => {
  console.log('Testing Workshop Registration Concurrency');

  try {
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
      console.error('POT-102 not found. Run "npm run seed" first.');
      process.exit(1);
    }

    const workshop = wsRes.rows[0];
    let availableSeatsToTest = workshop.capacity - workshop.active_count;

    if (availableSeatsToTest <= 0) {
      console.log('Resetting concurrent test records...');
      await pool.query(
        `DELETE FROM registrations WHERE workshop_id = $1 AND attendee_email LIKE 'concurrent%'`,
        [workshop.id]
      );
      const reCountRes = await pool.query(
        `SELECT COUNT(*)::int AS active_count FROM registrations WHERE workshop_id = $1 AND status = 'CONFIRMED'`,
        [workshop.id]
      );
      workshop.active_count = reCountRes.rows[0].active_count;
      availableSeatsToTest = workshop.capacity - workshop.active_count;
    }

    console.log(`Workshop: ${workshop.code} (${workshop.title})`);
    console.log(`Capacity: ${workshop.capacity}, Active: ${workshop.active_count}, Available: ${availableSeatsToTest}`);

    const staffRes = await pool.query(`SELECT id FROM users WHERE role = 'STAFF' LIMIT 1`);
    const staffId = staffRes.rows[0].id;

    const concurrentRequestsCount = 10;
    console.log(`Firing ${concurrentRequestsCount} simultaneous requests for ${availableSeatsToTest} open seat(s)...`);

    const promises = [];
    for (let i = 1; i <= concurrentRequestsCount; i++) {
      const attendeeName = `Concurrent Attendee ${i}`;
      const attendeeEmail = `concurrent.test.${Date.now()}.${i}@example.com`;

      const reqPromise = registrationsService
        .registerAttendee(workshop.id, { attendeeName, attendeeEmail }, staffId)
        .then(() => ({
          status: 'SUCCESS',
        }))
        .catch((error) => ({
          status: 'REJECTED',
          statusCode: error.statusCode,
          message: error.message,
        }));

      promises.push(reqPromise);
    }

    const results = await Promise.all(promises);

    const successes = results.filter((r) => r.status === 'SUCCESS');
    const rejections = results.filter((r) => r.status === 'REJECTED');

    console.log(`Results: ${successes.length} succeeded, ${rejections.length} rejected`);

    const finalCountRes = await pool.query(
      `SELECT COUNT(*)::int AS final_active_count 
       FROM registrations 
       WHERE workshop_id = $1 AND status = 'CONFIRMED'`,
      [workshop.id]
    );

    const finalCount = finalCountRes.rows[0].final_active_count;
    console.log(`Final confirmed count in DB: ${finalCount} / ${workshop.capacity}`);

    if (successes.length === availableSeatsToTest && finalCount === workshop.capacity) {
      console.log('PASS: Concurrency handled correctly. No over-registration.');
      process.exit(0);
    } else {
      console.error(`FAIL: Expected ${availableSeatsToTest} successes, got ${successes.length}`);
      process.exit(1);
    }
  } catch (err) {
    console.error('Error during concurrency test:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

runConcurrencyTest();
