const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');

jest.setTimeout(30000);

describe('Authentication & Strict Role-Based Access Control (RBAC)', () => {
  let adminToken = '';
  let managerToken = '';
  let staffToken = '';

  beforeAll(async () => {
    // 1. Log in Admin
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'kamal@gmail.com', password: 'AdminPass123!' });
    adminToken = adminRes.body.data.token;

    // 2. Log in Manager
    const managerRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nuwans@gmail.com', password: 'Password123!' });
    managerToken = managerRes.body.data.token;

    // 3. Log in Staff
    const staffRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nimalp@gmail.com', password: 'Password123!' });
    staffToken = staffRes.body.data.token;
  });

  describe('Permission: Create user accounts & set roles', () => {
    it('Admin CAN create a user account', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'New Frontdesk Member',
          email: `teststaff.${Date.now()}@communitytraining.org`,
          password: 'Password123!',
          role: 'STAFF',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.role).toBe('STAFF');
    });

    it('Manager CANNOT create a user account (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          name: 'Manager Created User',
          email: 'manager.user@example.com',
          password: 'Password123!',
          role: 'STAFF',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('Staff CANNOT create a user account (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          name: 'Staff Created User',
          email: 'staff.user@example.com',
          password: 'Password123!',
          role: 'STAFF',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Permission: Add & edit workshops', () => {
    it('Manager CAN create a workshop', async () => {
      const testCode = `TEST-${Date.now().toString().slice(-4)}`;
      const res = await request(app)
        .post('/api/workshops')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          code: testCode,
          title: 'Jest Test Workshop',
          instructor: 'Jest Instructor',
          capacity: 10,
          startTime: new Date().toISOString(),
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.code).toBe(testCode);
    });

    it('Admin CANNOT create a workshop (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/workshops')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: `ADM-${Date.now().toString().slice(-4)}`,
          title: 'Admin Created Workshop',
          instructor: 'Admin Instructor',
          capacity: 5,
          startTime: new Date().toISOString(),
        });

      expect(res.status).toBe(403);
    });

    it('Staff CANNOT create a workshop (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/workshops')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          code: `STF-${Date.now().toString().slice(-4)}`,
          title: 'Staff Created Workshop',
          instructor: 'Staff Instructor',
          capacity: 5,
          startTime: new Date().toISOString(),
        });

      expect(res.status).toBe(403);
    });
  });

  describe('Permission: View workshops & registrations', () => {
    it('Manager CAN view workshops catalogue', async () => {
      const res = await request(app)
        .get('/api/workshops')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('Staff CAN view workshops catalogue', async () => {
      const res = await request(app)
        .get('/api/workshops')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('Admin CANNOT view workshops catalogue (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/workshops')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
    });
  });
});
