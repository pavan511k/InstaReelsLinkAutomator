-- Migration: Create data_deletion_requests table for Meta compliance
-- Tracks data deletion requests per Meta Platform Terms Section 3(d)(i)
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS data_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_scoped_user_id text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  confirmation_code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  requested_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  details jsonb DEFAULT '{}'
);

-- No RLS needed — this is accessed by webhooks (server-side only)
-- and by the status check endpoint (public, uses confirmation_code)
