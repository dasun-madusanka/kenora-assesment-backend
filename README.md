# Workshop Registration Service - Backend

Express and PostgreSQL backend for the community workshop registration system.

## Live Deployment (Render)
- Live API URL: `https://kenora-assesment-backend.onrender.com/api`
- Health check: `https://kenora-assesment-backend.onrender.com/api/health`

> **Note on Render Free Tier**: Because the backend is hosted on a free Render tier, the instance will spin down into sleep mode after periods of inactivity. The first request may take around 30 to 50 seconds to complete while the instance wakes up.

## Setup Instructions

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
Create a `.env` file from `.env.example`:
```bash
cp .env.example .env
```
Default config:
```env
PORT=5000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=kenora_workshop_db
DB_USER=postgres
DB_PASSWORD=1234
JWT_SECRET=dev_secret_key_workshop_2026
JWT_EXPIRES_IN=7d
```

### 3. Database setup
Make sure PostgreSQL is running and the database exists, then run:
```bash
# Run migrations
npm run migrate

# Seed sample users and workshops
npm run seed
```

### 4. Run the server
```bash
# Development (with nodemon)
npm run dev

# Production
npm start
```
API runs on `http://localhost:5000`.

---

## Seeded Accounts

| Role | Email | Password | Access |
|---|---|---|---|
| Admin | kamal@gmail.com | AdminPass123! | User accounts and role management only |
| Manager | nuwans@gmail.com | Password123! | Create/edit workshops, registrations, history |
| Staff | nimalp@gmail.com | Password123! | Registrations and workshop/history viewing |

Note: Backend enforces access control strictly. Any forbidden role access returns 403 Forbidden.

---

## Tests

```bash
# Run integration tests
npm test

# Run concurrency race condition test
npm run test:concurrency
```

---

## API Summary

- **Auth**
  - `POST /api/auth/login` - User login
  - `GET /api/auth/me` - Current logged in user
- **Users (Admin only)**
  - `GET /api/users` - List all staff
  - `POST /api/users` - Create user and assign role
  - `PATCH /api/users/:id/role` - Update user role
- **Workshops (Manager and Staff)**
  - `GET /api/workshops` - List workshops (supports `?seatsAvailable=true`, `?from=`, `?to=`, `?search=`, `?status=`)
  - `GET /api/workshops/:id` - Workshop details
  - `POST /api/workshops` - Create workshop (Manager only)
  - `PUT /api/workshops/:id` - Update workshop (Manager only)
- **Registrations (Manager and Staff)**
  - `POST /api/workshops/:id/register` - Register attendee (atomic with row lock)
  - `POST /api/registrations/:id/cancel` - Cancel registration (frees seat, keeps record)
  - `GET /api/workshops/:id/registrations` - Workshop registration history
  - `GET /api/registrations/history` - Global registration history
- **Bonus features**
  - `POST /api/workshops/:id/waitlist` - Add attendee to waitlist
  - `GET /api/workshops/:id/waitlist` - View waitlist
  - `GET /api/audit-logs` - View audit logs (Admin and Manager)
