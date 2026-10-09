const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

const seedDatabase = async () => {
  const client = await pool.connect();
  try {
    console.log('[Seeder] Starting database seeding...');
    await client.query('BEGIN');

    await client.query('TRUNCATE audit_logs, waitlist, registrations, workshops, users RESTART IDENTITY CASCADE');

    const passwordHash = await bcrypt.hash('Password123!', 10);
    const adminPasswordHash = await bcrypt.hash('AdminPass123!', 10);

    const usersRes = await client.query(
      `INSERT INTO users (name, email, password_hash, role) VALUES
       ('Kamal Admin', 'kamal@gmail.com', $1, 'ADMIN'),
       ('Nuwan Sameera', 'nuwans@gmail.com', $2, 'MANAGER'),
       ('Nimal Perera', 'nimalp@gmail.com', $3, 'STAFF')
       RETURNING id, name, email, role`,
      [adminPasswordHash, passwordHash, passwordHash]
    );

    const [admin, manager, staff] = usersRes.rows;
    console.log('[Seeder] Seeded staff accounts (Admin, Manager, Staff).');

    const now = new Date();
    const thisSaturday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + ((6 - now.getDay() + 7) % 7 || 7), 10, 0);
    const thisSunday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + ((7 - now.getDay() + 7) % 7 || 7), 14, 0);
    const nextTuesday = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
    const nextWednesday = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000);
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const sampleWorkshops = [
      {
        code: 'POT-101',
        title: 'Introductory CS',
        instructor: 'Nimali Silva',
        location: 'University of Moratuwa',
        description: 'Learn the fundamentals of computercience in 3h.',
        start_time: thisSaturday.toISOString(),
        end_time: new Date(thisSaturday.getTime() + 2 * 3600000).toISOString(),
        capacity: 10,
        status: 'SCHEDULED',
      },
      {
        code: 'COD-201',
        title: 'Full Stack React & Postgres Workshop',
        instructor: 'Amila Perera',
        location: 'University of Kelaniya',
        description: 'Practical coding workshop covering React basics and Postgres.',
        start_time: nextTuesday.toISOString(),
        end_time: new Date(nextTuesday.getTime() + 3 * 3600000).toISOString(),
        capacity: 15,
        status: 'SCHEDULED',
      },
      {
        code: 'FIT-301',
        title: 'Quality Assurance Workshop',
        instructor: 'Kamani Silva',
        location: 'University of Wayamba',
        description: 'Hands-on workshop on software testing and quality assurance practices.',
        start_time: nextWednesday.toISOString(),
        end_time: new Date(nextWednesday.getTime() + 1.5 * 3600000).toISOString(),
        capacity: 8,
        status: 'SCHEDULED',
      },
      {
        code: 'POT-102',
        title: 'Cybersecurity Masterclass',
        instructor: 'Janith Perera',
        location: 'Mt. Lavinia',
        description: 'In-depth workshop on cybersecurity principles, threats, and best practices.',
        start_time: thisSunday.toISOString(),
        end_time: new Date(thisSunday.getTime() + 3 * 3600000).toISOString(),
        capacity: 2,
        status: 'SCHEDULED',
      },
      {
        code: 'FIT-302',
        title: 'Devops and Cloud Infrastructure Workshop',
        instructor: 'Sunil Perera',
        location: 'University of Peradeniya',
        description: 'Hands-on workshop covering DevOps practices and cloud infrastructure management.',
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
    await client.query(
      `INSERT INTO registrations (
        workshop_id, attendee_name, attendee_email, status, registered_by, registered_at
      ) VALUES
       ($1, 'Saman Perera', 'saman.perera@gmail.com', 'CONFIRMED', $2, NOW() - INTERVAL '2 days'),
       ($1, 'Nuwani Silva', 'nuwani.silva@gmail.com', 'CONFIRMED', $2, NOW() - INTERVAL '1 day'),
       ($1, 'Kasun Perera', 'kasun.perera@gmail.com', 'CONFIRMED', $3, NOW() - INTERVAL '5 hours')`,
      [pot101.id, staff.id, manager.id]
    );

    await client.query(
      `INSERT INTO registrations (
        workshop_id, attendee_name, attendee_email, status, registered_by, registered_at,
        cancelled_by, cancelled_at, cancellation_reason
      ) VALUES
       ($1, 'Sudesh Kumar', 'sudesh.kumar@gmail.com', 'CANCELLED', $2, NOW() - INTERVAL '3 days',
        $3, NOW() - INTERVAL '1 day', 'Schedule conflict with work')`,
      [pot101.id, staff.id, staff.id]
    );

    await client.query(
      `INSERT INTO registrations (
        workshop_id, attendee_name, attendee_email, status, registered_by, registered_at
      ) VALUES
       ($1, 'Anil Perera', 'anil.perera@gmail.com', 'CONFIRMED', $2, NOW() - INTERVAL '4 hours')`,
      [pot102.id, staff.id]
    );

    await client.query(
      `INSERT INTO audit_logs (action, entity_type, entity_id, performed_by, details) VALUES
       ('USER_CREATED', 'USER', $1, $1, '{"role": "ADMIN", "email": "admin@communitytraining.org"}'),
       ('WORKSHOP_CREATED', 'WORKSHOP', $2, $3, '{"code": "POT-101", "capacity": 10}'),
       ('REGISTRATION_CANCELLED', 'REGISTRATION', 4, $4, '{"attendee": "Emily Clark", "reason": "Schedule conflict with work"}')`,
      [admin.id, pot101.id, manager.id, staff.id]
    );

    await client.query('COMMIT');
    console.log('[Seeder] Database seeding finished successfully.');
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
