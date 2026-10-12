-- Shared vendor ownership and passenger-visible stall/menu fields.
-- Existing demo records remain drafts and are not shown as available vendor listings.
ALTER TABLE passenger_stalls ADD COLUMN IF NOT EXISTS owner_user_id TEXT;
ALTER TABLE passenger_stalls ADD COLUMN IF NOT EXISTS vendor_name TEXT NOT NULL DEFAULT '';
ALTER TABLE passenger_stalls ADD COLUMN IF NOT EXISTS vendor_contact TEXT NOT NULL DEFAULT '';
ALTER TABLE passenger_stalls ADD COLUMN IF NOT EXISTS coach_location TEXT NOT NULL DEFAULT '';
ALTER TABLE passenger_stalls ADD COLUMN IF NOT EXISTS directions TEXT NOT NULL DEFAULT '';
ALTER TABLE passenger_stalls ADD COLUMN IF NOT EXISTS stall_status TEXT NOT NULL DEFAULT 'unavailable';
ALTER TABLE passenger_stalls ADD COLUMN IF NOT EXISTS publication_status TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE passenger_stalls ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE passenger_stalls
SET publication_status = 'draft',
    stall_status = 'unavailable',
    updated_at = NOW()
WHERE owner_user_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_passenger_stalls_owner
  ON passenger_stalls(owner_user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_passenger_stalls_station_published
  ON passenger_stalls(station_key, publication_status, is_active);

CREATE TABLE IF NOT EXISTS vendor_profiles (
  user_id TEXT PRIMARY KEY,
  vendor_name TEXT NOT NULL,
  contact TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);