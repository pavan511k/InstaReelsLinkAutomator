-- Migration: Create dm_templates table for Pro users
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS dm_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  dm_config jsonb NOT NULL DEFAULT '{}',
  trigger_config jsonb NOT NULL DEFAULT '{}',
  settings_config jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE dm_templates ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own templates
CREATE POLICY "Users can manage own templates"
  ON dm_templates FOR ALL
  USING (auth.uid() = user_id);
