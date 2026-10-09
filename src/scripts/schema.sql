-- ============================================================================
-- Workshop Registration Service - PostgreSQL Database Schema
-- Designed for strict role enforcement, transaction safety, and auditability
-- ============================================================================

-- Clean up existing tables if dropping schema (in correct dependency order)
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS waitlist CASCADE;
DROP TABLE IF EXISTS registrations CASCADE;
DROP TABLE IF EXISTS workshops CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 1. USERS TABLE
-- Roles strictly defined: ADMIN, MANAGER, STAFF
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('ADMIN', 'MANAGER', 'STAFF')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast user authentication lookups
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- 2. WORKSHOPS TABLE
-- Tracks workshop catalog, locations, instructors, date/time, capacity & status
CREATE TABLE workshops (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    title VARCHAR(200) NOT NULL,
    instructor VARCHAR(150) NOT NULL,
    location VARCHAR(120) NOT NULL DEFAULT 'Downtown Campus',
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    capacity INTEGER NOT NULL CHECK (capacity > 0),
    status VARCHAR(30) NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED')),
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for frequent filtering queries (date range, code, status)
CREATE INDEX idx_workshops_code ON workshops(code);
CREATE INDEX idx_workshops_start_time ON workshops(start_time);
CREATE INDEX idx_workshops_status ON workshops(status);
CREATE INDEX idx_workshops_location ON workshops(location);

-- 3. REGISTRATIONS TABLE
-- Attendees do not have logins; staff records name and email
-- When cancelled, record is NEVER deleted; freed seat is reflected by status
CREATE TABLE registrations (
    id SERIAL PRIMARY KEY,
    workshop_id INTEGER NOT NULL REFERENCES workshops(id) ON DELETE RESTRICT,
    attendee_name VARCHAR(150) NOT NULL,
    attendee_email VARCHAR(150) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN ('CONFIRMED', 'CANCELLED')),
    registered_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    registered_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cancelled_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for active seat counts and attendee lookup
CREATE INDEX idx_registrations_workshop_id ON registrations(workshop_id);
CREATE INDEX idx_registrations_status ON registrations(status);
CREATE INDEX idx_registrations_workshop_status ON registrations(workshop_id, status);
CREATE INDEX idx_registrations_attendee_email ON registrations(attendee_email);

-- 4. WAITLIST TABLE (Bonus feature: queuing when workshop reaches capacity)
CREATE TABLE waitlist (
    id SERIAL PRIMARY KEY,
    workshop_id INTEGER NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
    attendee_name VARCHAR(150) NOT NULL,
    attendee_email VARCHAR(150) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'WAITING' CHECK (status IN ('WAITING', 'PROMOTED', 'CANCELLED')),
    added_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    promoted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_waitlist_workshop_id ON waitlist(workshop_id);
CREATE INDEX idx_waitlist_status ON waitlist(status);

-- 5. AUDIT LOGS TABLE (Bonus feature: tracks who did what and when)
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    action VARCHAR(60) NOT NULL,
    entity_type VARCHAR(40) NOT NULL,
    entity_id INTEGER,
    performed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_performed_by ON audit_logs(performed_by);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
