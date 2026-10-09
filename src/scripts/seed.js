const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

const seedDatabase = async () => {
  const client = await pool.connect();
  try {
    console.log('[Seeder] Starting database seeding...');
    await client.query('BEGIN');

    // Clean existing data in order
    await client.query('TRUNCATE audit_logs, waitlist, registrations, workshops, users RESTART IDENTITY CASCADE');

    // 1. Seed Staff Users (Admin, Manager, Staff)
    const passwordHash = await bcrypt.hash('Password123!', 10);
    const adminPasswordHash = await bcrypt.hash('AdminPass123!', 10);

    const usersRes = await client.query(
      `INSERT INTO users (name, email, password_hash, role) VALUES
       ('Alice Administrator', 'admin@communitytraining.org', $1, 'ADMIN'),
       ('Mark Programme Manager', 'manager@communitytraining.org', $2, 'MANAGER'),
       ('Sam Frontdesk Staff', 'staff@communitytraining.org', $3, 'STAFF')
       RETURNING id, name, email, role`,
      [adminPasswordHash, passwordHash, passwordHash]
    );

    const [admin, manager, staff] = usersRes.rows;
    console.log('[Seeder] Seeded 3 staff accounts (Admin, Manager, Staff).');

    // 2. Seed Workshops
    const now = new Date();
    const thisSaturday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + ((6 - now.getDay() + 7) % 7 || 7), 10, 0);
    const thisSunday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + ((7 - now.getDay() + 7) % 7 || 7), 14, 0);
    const nextTuesday = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
    const nextWednesday = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000);
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const sampleWorkshops = [
      {
        code: 'POT-101',
        title: 'Introductory Pottery & Wheel Throwing',
        instructor: 'Sarah Jenkins',
        location: 'Downtown Campus',
        description: 'Learn the fundamentals of clay shaping and wheel pottery in an engaging 2-hour session.',
        start_time: thisSaturday.toISOString(),
        end_time: new Date(thisSaturday.getTime() + 2 * 3600000).toISOString(),
        capacity: 10,
        status: 'SCHEDULED',
      },
      {
        code: 'COD-201',
        title: 'Full Stack React & Modern JavaScript',
        instructor: 'David Chen',
        location: 'North Hub',
        description: 'Practical coding workshop covering React hooks, state management, and modern component architecture.',
        start_time: nextTuesday.toISOString(),
        end_time: new Date(nextTuesday.getTime() + 3 * 3600000).toISOString(),
        capacity: 15,
        status: 'SCHEDULED',
      },
      {
        code: 'FIT-301',
        title: 'Community Yoga & Mobility Flow',
        instructor: 'Emma Watson',
        location: 'West End',
        description: 'Mindful stretching and functional mobility suitable for all fitness and age levels.',
        start_time: nextWednesday.toISOString(),
        end_time: new Date(nextWednesday.getTime() + 1.5 * 3600000).toISOString(),
        capacity: 8,
        status: 'SCHEDULED',
      },
      {
        code: 'POT-102',
        title: 'Exclusive Weekend Pottery Masterclass',
        instructor: 'Sarah Jenkins',
        location: 'Downtown Campus',
        description: 'Intensive hands-on masterclass limited to 2 seats for individualized coaching.',
        start_time: thisSunday.toISOString(),
        end_time: new Date(thisSunday.getTime() + 3 * 3600000).toISOString(),
        capacity: 2,
        status: 'SCHEDULED',
      },
      {
        code: 'FIT-302',
        title: 'High-Intensity Cardio & Core Circuit',
        instructor: 'Marcus Lee',
        location: 'North Hub',
        description: 'Past workshop session focused on aerobic endurance.',
        start_time: lastWeek.toISOString(),
        end_time: new Date(lastWeek.getTime() + 2 * 3600000).toISOString(),
        capacity: 12,
        status: 'COMPLETED',
      },
    ];

    const insertedWorkshops = [];
    for (const w of sampleWorkshops) {
      const res = await client.query(
        `INSERT INTO workshops (
          code, title, instructor, location, description, start_time, end_time, capacity, status, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id, code, title, capacity`,
        [w.code, w.title, w.instructor, w.location, w.description, w.start_time, w.end_time, w.capacity, w.status, manager.id]
      );
      insertedWorkshops.push(res.rows[0]);
    }

    const [pot101, cod201, fit301, pot102] = insertedWorkshops;
    console.log('[Seeder] Seeded 5 sample workshops across 3 community locations.');

    // 3. Seed Sample Registrations
    // For POT-101: 3 confirmed attendees, 1 cancelled attendee with full cancellation trail
    await client.query(
      `INSERT INTO registrations (
        workshop_id, attendee_name, attendee_email, status, registered_by, registered_at
      ) VALUES
       ($1, 'John Doe', 'john.doe@example.com', 'CONFIRMED', $2, NOW() - INTERVAL '2 days'),
       ($1, 'Jane Smith', 'jane.smith@example.com', 'CONFIRMED', $2, NOW() - INTERVAL '1 day'),
       ($1, 'Michael Brown', 'michael.brown@example.com', 'CONFIRMED', $3, NOW() - INTERVAL '5 hours')`,
      [pot101.id, staff.id, manager.id]
    );

    // Cancelled registration example (record is preserved, seat freed, metadata logged)
    await client.query(
      `INSERT INTO registrations (
        workshop_id, attendee_name, attendee_email, status, registered_by, registered_at,
        cancelled_by, cancelled_at, cancellation_reason
      ) VALUES
       ($1, 'Emily Clark', 'emily.clark@example.com', 'CANCELLED', $2, NOW() - INTERVAL '3 days',
        $3, NOW() - INTERVAL '1 day', 'Schedule conflict with work')`,
      [pot101.id, staff.id, staff.id]
    );

    // For POT-102: 1 confirmed attendee (Capacity is 2, so exactly 1 seat left)
    await client.query(
      `INSERT INTO registrations (
        workshop_id, attendee_name, attendee_email, status, registered_by, registered_at
      ) VALUES
       ($1, 'Robert Taylor', 'robert.taylor@example.com', 'CONFIRMED', $2, NOW() - INTERVAL '4 hours')`,
      [pot102.id, staff.id]
    );

    console.log('[Seeder] Seeded registrations (active confirmed & historical cancellations).');

    // 4. Seed Audit Logs
    await client.query(
      `INSERT INTO audit_logs (action, entity_type, entity_id, performed_by, details) VALUES
       ('USER_CREATED', 'USER', $1, $1, '{"role": "ADMIN", "email": "admin@communitytraining.org"}'),
       ('WORKSHOP_CREATED', 'WORKSHOP', $2, $3, '{"code": "POT-101", "capacity": 10}'),
       ('REGISTRATION_CANCELLED', 'REGISTRATION', 4, $4, '{"attendee": "Emily Clark", "reason": "Schedule conflict with work"}')`,
      [admin.id, pot101.id, manager.id, staff.id]
    );

    console.log('[Seeder] Seeded audit trail records.');

    await client.query('COMMIT');
    console.log('[Seeder] Database seeding finished successfully!');
    process.exit(0);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[Seeder] Seeding failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
};

seedDatabase();
