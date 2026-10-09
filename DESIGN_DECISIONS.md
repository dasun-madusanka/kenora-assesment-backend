# Architecture & Design Decisions

This document details the architectural choices, data integrity strategies, and technical rationale for the **Workshop Registration Service** backend.

---

## 1. Stack Choices & Rationale

- **Express.js (Node.js)**:
  - Lightweight, unopinionated, and battle-tested HTTP framework.
  - Asynchronous event-driven I/O ideal for handling concurrent I/O-bound web requests.
  - Allows clean modular separation (Controllers, Services, Routes, Middlewares) without unnecessary framework bloat.
- **PostgreSQL (`pg` Connection Pool)**:
  - ACID-compliant relational database engine.
  - Strong support for row-level locking (`SELECT ... FOR UPDATE`), serializable transactions, and check constraints (`CHECK (capacity > 0)`).
  - Native JSONB support enables flexible audit log diff storage without sacrificing relational schema integrity.
- **JSON Web Tokens (JWT) & bcrypt**:
  - Stateless authentication allows decoupled frontend client requests.
  - Bcrypt (salt rounds: 10) provides secure one-way password hashing for staff accounts.

---

## 2. Preventing Over-Registration Under Concurrency

The core requirement highlighted by the client:
> *"Last Saturday 24 people turned up for a workshop with 20 seats. Two of us had each promised the last seats on the phone at the same time."*

### Why naive checks fail:
A simple read-then-write approach (`SELECT COUNT(*) -> if count < capacity -> INSERT`) suffers from a **time-of-check to time-of-use (TOCTOU)** race condition. If two staff members click "Register" simultaneously, both queries observe 1 seat available and both insert, resulting in 21 registrations for a 20-seat room.

### The Solution: Pessimistic Row Locking (`SELECT ... FOR UPDATE`)
All registration requests are executed within an atomic database transaction:
1. `BEGIN`: Starts transaction.
2. `SELECT capacity, status FROM workshops WHERE id = $1 FOR UPDATE`:
   - Acquires an exclusive row-level lock on the workshop record.
   - Any concurrent registration transaction for the same workshop is placed in a database wait queue until this lock is released.
3. `SELECT COUNT(*)::int FROM registrations WHERE workshop_id = $1 AND status = 'CONFIRMED'`:
   - Evaluates the accurate active count while holding the exclusive lock.
4. **Capacity Gate**:
   - If `active_count >= capacity`, rolls back transaction and responds with `409 Conflict: Workshop is fully booked`.
5. `INSERT INTO registrations (...) VALUES (...) RETURNING *`:
   - Records the confirmed seat.
6. `COMMIT`: Releases the lock. The next queued request reads the updated count immediately.

This guarantees zero over-registration even under heavy parallel load, verified by `npm run test:concurrency`.

---

## 3. Access Control & Strict Permission Enforcement

The assessment matrix defines three distinct roles:

| Action | Admin | Manager | Staff |
|---|---|---|---|
| Create user accounts & set roles | **YES** | NO | NO |
| Add & edit workshops | NO | **YES** | NO |
| Register & cancel attendees | NO | **YES** | **YES** |
| View workshops, registrations & history | NO | **YES** | **YES** |

### Implementation:
- Enforcement is handled by `src/middleware/rbac.js`.
- If an unauthorized role accesses a route (e.g. Admin attempting to view workshops, or Staff attempting to create a workshop), the backend immediately rejects the request with HTTP **`403 Forbidden`**.

---

## 4. Cancellation & Registration History

- **No Hard Deletes**: The client requirement explicitly dictates that records must never be deleted.
- When an attendee cancels:
  - `status` is transitioned from `'CONFIRMED'` to `'CANCELLED'`.
  - The seat is immediately freed because active seat count calculations filter strictly on `status = 'CONFIRMED'`.
  - `cancelled_by` (staff user ID), `cancelled_at` (timestamp), and optional `cancellation_reason` are permanently preserved.
  - History endpoints (`GET /api/workshops/:id/registrations` and `GET /api/registrations/history`) display the complete audit of who booked or cancelled and when.

---

## 5. Bonus Initiatives Implemented

1. **Audit Trail (`audit_logs`)**:
   - Records administrative events: user creation, role changes, workshop edits, registrations, and cancellations.
   - Includes timestamp, actor ID/name, entity type, and structured payload.
2. **Waitlist Queueing (`waitlist`)**:
   - When a workshop is full, staff can queue attendees in FIFO order (`POST /api/workshops/:id/waitlist`).
   - When an existing registration is cancelled, the system automatically checks for waitlisted attendees and promotes the earliest one to a confirmed seat.

---

## 6. Trade-offs & Assumptions

- **Attendees do not have logins**: Attendees are entered as name and email by staff over the phone or in person. Email uniqueness is scoped per workshop (an attendee cannot have duplicate active seats in the same session, but may attend multiple distinct workshops).
- **In-Memory vs. Database Transactions**: Handled exclusively via PostgreSQL transactions rather than in-memory locks (like Redis or mutexes) to ensure multi-instance server compatibility and full ACID durability.
