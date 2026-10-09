# Workshop Registration Service — Backend API

Production-ready backend API built with **Express.js** and **PostgreSQL** for managing community workshop scheduling, strict staff access control, and atomic registration capacity.

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js**: v18+ (tested on v23)
- **PostgreSQL**: v14+ (tested on v16)

### 2. Installation
```bash
cd kenora-assesment-backend
npm install
```

### 3. Environment Setup
Copy the `.env.example` file to `.env` and verify your PostgreSQL credentials:
```bash
cp .env.example .env
```
Default `.env` configuration:
```env
PORT=5000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=kenora_workshop_db
DB_USER=postgres
DB_PASSWORD=1234
JWT_SECRET=super_secret_jwt_key_workshop_registration_2026_dev
JWT_EXPIRES_IN=7d
```

### 4. Database Setup & Seeding
Run the database migration to create the tables, indexes, and constraints, then seed sample data:
```bash
# 1. Run migrations
npm run migrate

# 2. Seed default staff accounts, workshops, and sample registrations
npm run seed
```

### 5. Start the Server
```bash
# Production mode
npm start

# Development mode (with auto-reload)
npm run dev
```
The API will be available at: **`http://localhost:5000`**  
Health check: **`http://localhost:5000/api/health`**

---

## 👥 Seeded Credentials (Dev-Only)

All passwords are pre-configured in the database seeder:

| Role | Email | Password | Allowed Capabilities |
|---|---|---|---|
| **Admin** | `admin@communitytraining.org` | `AdminPass123!` | Create user accounts, set/change staff roles |
| **Manager** | `manager@communitytraining.org` | `Password123!` | Add/edit workshops, register/cancel attendees, view workshops & history |
| **Staff** | `staff@communitytraining.org` | `Password123!` | Register/cancel attendees, view workshops & registration history |

> **Note on Access Control**: Per assessment guidelines, access rules are strictly enforced on the backend. Any action not permitted for a role returns `403 Forbidden` (e.g. Admins cannot view or manage workshops, Staff cannot add workshops).

---

## 🧪 Testing & Concurrency Verification

### Run Automated Test Suite (Jest + Supertest)
Runs full integration tests covering authentication, strict RBAC matrices, workshop filtering, booking, and cancellations:
```bash
npm test
```

### Run Concurrency Stress Test
Simulates **10 simultaneous registration requests** competing for the **1 remaining seat** on workshop `POT-102`:
```bash
npm run test:concurrency
```
**Outcome**: Exactly 1 request succeeds (201), 9 are rejected (409 Conflict), and database active bookings remain exactly at capacity without overbooking.

---

## 📡 API Reference Summary

### Authentication (`/api/auth`)
- `POST /api/auth/login` — Public login for Admin, Manager, and Staff. Returns JWT.
- `GET /api/auth/me` — Authenticated profile and role check.

### User Management (`/api/users`) — *Admin Only*
- `GET /api/users` — List all staff accounts and roles.
- `POST /api/users` — Create staff account and assign role (`ADMIN`, `MANAGER`, `STAFF`).
- `PATCH /api/users/:id/role` — Update an account's role.

### Workshop Catalogue (`/api/workshops`)
- `GET /api/workshops` — *Manager & Staff* — List workshops. Supports query params:
  - `?seatsAvailable=true` — Filter workshops with open seats.
  - `?from=YYYY-MM-DD&to=YYYY-MM-DD` — Filter by date range.
  - `?status=SCHEDULED` — Filter by status.
  - `?search=keyword` — Search title, code, instructor, or location.
- `GET /api/workshops/:id` — *Manager & Staff* — Workshop details with active & remaining seats.
- `POST /api/workshops` — *Manager Only* — Schedule a new workshop.
- `PUT /api/workshops/:id` / `PATCH /api/workshops/:id` — *Manager Only* — Edit workshop details.

### Registrations (`/api/workshops/:id/register` & `/api/registrations`) — *Manager & Staff*
- `POST /api/workshops/:id/register` — Register attendee (`attendeeName`, `attendeeEmail`). Concurrency-locked.
- `POST /api/registrations/:id/cancel` — Cancel registration. Frees seat, retains record, and logs audit.
- `GET /api/workshops/:id/registrations` — Full registration and cancellation history for a workshop.
- `GET /api/registrations/history` — Global registration history log across all workshops.

### Bonus Features: Waitlist & Audit Logs
- `POST /api/workshops/:id/waitlist` — *Manager & Staff* — Queue attendee when workshop is full.
- `GET /api/workshops/:id/waitlist` — *Manager & Staff* — View FIFO queue of waitlisted attendees.
- `GET /api/audit-logs` — *Admin & Manager* — Audit trail of system changes (who did what and when).
