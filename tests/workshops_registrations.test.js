const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');

jest.setTimeout(30000);

describe('Workshops & Registrations Flow', () => {
  let managerToken = '';
  let staffToken = '';
  let testWorkshopId;

  beforeAll(async () => {
    // Authenticate manager & staff
    const managerRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nuwans@gmail.com', password: 'Password123!' });
    managerToken = managerRes.body.data.token;

    const staffRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nimalp@gmail.com', password: 'Password123!' });
    staffToken = staffRes.body.data.token;

    // Create a dedicated workshop with capacity = 1
    const uniqueCode = `CAP-${Date.now().toString().slice(-5)}`;
    const wsRes = await request(app)
      .post('/api/workshops')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        code: uniqueCode,
        title: 'Strict Capacity Test Workshop',
        instructor: 'Test Instructor',
        capacity: 1,
        location: 'Downtown Campus',
        startTime: new Date(Date.now() + 86400000).toISOString(),
      });

    testWorkshopId = wsRes.body.data.id;
  });

  describe('Finding workshops', () => {
    it('Filters workshops by seats available', async () => {
      const res = await request(app)
        .get('/api/workshops?seatsAvailable=true')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      for (const w of res.body.data) {
        expect(w.available_seats).toBeGreaterThan(0);
      }
    });

    it('Filters workshops by search keyword', async () => {
      const res = await request(app)
        .get('/api/workshops?search=React')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Registrations & Capacity Enforcement', () => {
    let registrationId;

    it('Staff can register an attendee for the last seat', async () => {
      const res = await request(app)
        .post(`/api/workshops/${testWorkshopId}/register`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          attendeeName: 'Lucky Attendee',
          attendeeEmail: 'lucky@example.com',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.registration.status).toBe('CONFIRMED');
      registrationId = res.body.data.registration.id;
    });

    it('Rejects registration when capacity is exceeded (409 Conflict)', async () => {
      const res = await request(app)
        .post(`/api/workshops/${testWorkshopId}/register`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          attendeeName: 'Overflow Attendee',
          attendeeEmail: 'overflow@example.com',
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/fully booked|full capacity/i);
    });

    it('Can queue attendee in waitlist when workshop is full', async () => {
      const res = await request(app)
        .post(`/api/workshops/${testWorkshopId}/waitlist`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          attendeeName: 'Waitlist Attendee',
          attendeeEmail: 'waitlist.person@example.com',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('WAITING');
    });

    it('Cancelling a registration frees the seat and promotes waitlisted attendee', async () => {
      const res = await request(app)
        .post(`/api/registrations/${registrationId}/cancel`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          cancellationReason: 'Sick with flu',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.cancelledRegistration.status).toBe('CANCELLED');
      expect(res.body.data.cancelledRegistration.cancelled_by).toBeDefined();

      // Check that the waitlist attendee got promoted automatically!
      expect(res.body.data.promotedWaitlistAttendee).toBeDefined();
      expect(res.body.data.promotedWaitlistAttendee.attendee_email).toBe('waitlist.person@example.com');
    });

    it('Preserves full history including cancelled registrations', async () => {
      const res = await request(app)
        .get(`/api/workshops/${testWorkshopId}/registrations`)
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      const list = res.body.data.registrations;
      expect(list.length).toBeGreaterThanOrEqual(2);

      const cancelledRecord = list.find((r) => r.id === registrationId);
      expect(cancelledRecord).toBeDefined();
      expect(cancelledRecord.status).toBe('CANCELLED');
      expect(cancelledRecord.cancelled_by_name).toBeDefined();
      expect(cancelledRecord.cancellation_reason).toBe('Sick with flu');
    });
  });
});
