-- Migration: Add 'Pending' to reservation_status enum
-- Must be committed before 'Pending' can be used as a column default in subsequent migrations (PostgreSQL 55P04).
ALTER TYPE public.reservation_status ADD VALUE IF NOT EXISTS 'Pending';
