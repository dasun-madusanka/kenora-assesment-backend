# Workshop Registration Service - Design & Architecture Notes

A one-page summary of technical choices, architecture decisions, concurrency handling, and trade-offs.

---

## 1. Stack Choices and Why

- **Backend: Express.js (Node.js)**
  Express was chosen because it is lightweight, fast to configure, and allows direct control over middleware for authentication and role-based access control without heavyweight framework boilerplate.
- **Database: PostgreSQL (Neon Serverless)**
  The core requirement of this challenge is strict capacity enforcement under concurrent phone bookings. PostgreSQL provides ACID transactions, reliable row-level locking (`FOR UPDATE`), and foreign-key integrity.
- **Frontend: React, TypeScript, Vite, Tailwind CSS**
  Vite provides an instant development and build setup. TypeScript catches API contract mismatches early. Tailwind CSS enables a clean, uncluttered, and responsive UI suited for front-desk staff with zero technical training.
- **Authentication: JWT + bcryptjs**
  Stateless token-based authentication with bcrypt-hashed passwords (cost factor 10). It eliminates session store complexity while allowing clean role authorization headers on every request.

---

## 2. Design Decisions

- **Strict Role-Based Access Control (RBAC) at API Level**:
  Rather than just hiding buttons in the UI, permissions are strictly checked in backend middleware (`requireRole`). An Admin attempting to register an attendee or a Staff member attempting to add a workshop receives an immediate `403 Forbidden`.
- **Soft Deletion & Cancellation Tracking**:
  When an attendee cancels, records are never purged from the database. Instead, `status` changes to `CANCELLED`, and the database captures `cancelled_by` (staff ID), `cancelled_at`, and an optional reason. This keeps active capacity accurate while preserving an unbroken audit trail.
- **Stateless Frontend with Context**:
  Auth state lives in a lightweight React context backed by `localStorage` for session persistence across page refreshes. Role-based view guards keep the interface focused on what the logged-in staff member needs.

---

## 3. How You Prevent Over-Registration

The client highlighted Saturday morning chaos where multiple staff members register attendees for the last remaining seat at the exact same time.

A regular `SELECT count ... INSERT` pattern produces a race condition where multiple requests see 1 seat remaining and both insert, causing overbooking.

To guarantee zero overbooking:
1. Every registration executes inside an atomic PostgreSQL transaction (`BEGIN ... COMMIT`).
2. The transaction locks the target workshop row immediately:
   `SELECT capacity, status FROM workshops WHERE id = $1 FOR UPDATE`
   Any concurrent request for the same workshop must wait in line for this lock to release.
3. While holding the lock, the transaction counts confirmed active registrations (`status = 'CONFIRMED'`).
4. If active count >= capacity, the transaction rolls back and returns a `409 Conflict` error ("Workshop is fully booked").
5. If seats remain, it inserts the registration record and commits.

This was verified with a concurrency test script (`npm run test:concurrency`) running 10 simultaneous requests for 1 remaining seat. Exactly 1 request succeeds and 9 are rejected, keeping active registrations strictly within capacity.

---

## 4. Trade-offs

- **PostgreSQL Row Locks vs Redis Distributed Locks**:
  Redis locks (like Redlock) can be useful in massive multi-region distributed setups. However, for a community training centre with ~15 staff across 3 locations, PostgreSQL row-level locks give identical safety guarantees with zero external infrastructure dependencies or operational overhead.
- **Local Storage JWT vs HTTP-Only Cookies**:
  HTTP-only cookies provide better XSS protection in enterprise applications. For this challenge, JWT in `localStorage` was chosen for speed of implementation and clean decoupled CORS communication between separate frontend and backend hosting domains.
- **Lightweight Forms vs Heavy Form Libraries**:
  Used standard React controlled state with custom regex validations instead of Formik or React Hook Form to keep dependency size small and code straightforward to read.

---

## 5. Assumptions Made

- **Attendees do not have accounts**: Front desk staff take registrations over the phone or at reception. Attendees only provide a name and email address. They do not log into the system.
- **One active seat per attendee per workshop**: An attendee cannot hold duplicate active registrations for the same workshop session, but can register for different workshops.
- **Community centre locations**: A community centre with three locations needs location tracking per workshop (`Downtown Campus`, `North Hub`, `West End`).

---

## 6. Anything You Skipped

- **Email Delivery / SMTP Integration**: Notifications (such as email confirmations or cancellation receipts) are logged to the console/audit records rather than dispatched via third-party email providers (SendGrid/AWS SES) to avoid external credentials.
- **Attendee Self-Service Portal & Payments**: Focused strictly on the staff front-desk portal as specified in the business context, skipping payment gateway integration and attendee account self-management.
- **Automated Password Reset Flow**: Skipped self-service email-based password reset tokens since Administrators directly manage and provision staff accounts.

---

## 7. Bonus Features Implemented

- **Audit Trail**: Created an `audit_logs` table tracking user creation, role modifications, workshop updates, and registration status changes with timestamps and user IDs.
- **Automated Waitlist Queue**: When a workshop reaches full capacity, staff can place attendees on a waitlist. Cancelling a confirmed registration automatically promotes the next eligible waitlisted attendee.
