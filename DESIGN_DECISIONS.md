# Design Decisions & Architecture Notes

This document covers the technical choices, design trade-offs, and concurrency handling for the Workshop Registration Service.

---

## 1. Stack Choices and Rationale

- **Express.js with JavaScript**: 
  Lightweight and quick to set up for a 3-hour challenge. It gives direct control over middleware and routing without boilerplate overhead.
- **PostgreSQL (`pg` pool)**:
  Chosen because the application requires strict relational consistency, foreign key constraints, and reliable transactional locking to prevent overbooking.
- **JWT and bcryptjs**:
  Standard token-based auth for stateless API calls. Passwords are salted and hashed with bcrypt (cost factor 10).

---

## 2. Preventing Over-Registration (Concurrency Handling)

The biggest issue described by the client was race conditions when multiple staff members register attendees for the last available seat at the same time.

A standard check-then-insert pattern causes overbooking:
1. Request A reads remaining seats: 1 seat left.
2. Request B reads remaining seats: 1 seat left.
3. Both proceed to insert registrations. Workshop with 20 seats now has 21 registrations.

### Solution:
Every registration runs inside an explicit PostgreSQL transaction with row-level locking:
1. `BEGIN` transaction.
2. `SELECT capacity, status FROM workshops WHERE id = $1 FOR UPDATE`:
   This places an exclusive row-level lock on the workshop. Any competing registration request for the same workshop must wait until this transaction completes.
3. Count active registrations (`status = 'CONFIRMED'`) while holding the lock.
4. If active count >= capacity, rollback and return `409 Conflict`.
5. Otherwise, insert the registration, record the audit entry, and `COMMIT`.

A test script (`npm run test:concurrency`) simulates 10 concurrent booking requests trying to grab 1 remaining seat. Exactly 1 request succeeds and 9 are rejected, keeping total bookings strictly at capacity.

---

## 3. Access Control (RBAC)

The challenge requirements specify strict backend permission checks:
- **Admin**: Can only create staff accounts and assign roles. Denied access (403) from workshops and registrations.
- **Manager**: Can create/edit workshops, register/cancel attendees, and view workshops and history. Denied user management.
- **Staff**: Can register/cancel attendees and view workshops and history. Denied creating workshops or users.

Enforcement is implemented via middleware (`requireRole`, `requireAdmin`, `requireManager`, `requireManagerOrStaff`). If an account lacks permission, the server returns 403 Forbidden with a clear message.

---

## 4. Cancellation and Registration History

- Registrations are never hard-deleted.
- When an attendee cancels, `status` changes to `'CANCELLED'`, and the server records `cancelled_by` (staff ID), `cancelled_at` (timestamp), and optional `cancellation_reason`.
- Because the available seat count only includes `status = 'CONFIRMED'`, cancelling a registration instantly frees up the seat while maintaining complete audit history.

---

## 5. Trade-offs and Assumptions

- **Attendee accounts**: Attendees are registered by front desk staff over phone or in-person, so attendees do not have user accounts or passwords. We only store name and email.
- **Unique email per workshop**: An attendee can sign up for multiple workshops, but cannot register twice for the same workshop session while already having a confirmed seat.
- **Database locks vs Redis**: Chose PostgreSQL row-level locks over an external Redis distributed lock. PostgreSQL already provides ACID guarantees out of the box and avoids introducing extra operational infrastructure.

---

## 6. Bonus Features

- **Audit Trail**: Built an `audit_logs` table tracking user creation, role updates, workshop edits, registrations, and cancellations with timestamp and actor ID.
- **Waitlist Queue**: Added a `waitlist` table for full workshops. When a confirmed seat is cancelled, the transaction checks for waiting attendees and automatically promotes the earliest one.
