-- Run ALL of this in Supabase SQL Editor
-- Safe to run multiple times (IF NOT EXISTS prevents errors)

-- Core fields
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Prospect';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS temperature TEXT DEFAULT 'Warm';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS tags TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS birthday DATE;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS referred_by TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_contacted TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Campaign tracking
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS failed_count INTEGER DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS body TEXT;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_contacts_category    ON contacts(category);
CREATE INDEX IF NOT EXISTS idx_contacts_temperature ON contacts(temperature);
CREATE INDEX IF NOT EXISTS idx_contacts_status      ON contacts(status);
CREATE INDEX IF NOT EXISTS idx_contacts_email       ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_created_at  ON contacts(created_at DESC);
