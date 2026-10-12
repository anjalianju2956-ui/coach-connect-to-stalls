-- Idempotent vendor stall creation: repeated delivery of one registration request
-- must not create multiple rows. Distinct requests can still create same-name stalls.
ALTER TABLE passenger_stalls ADD COLUMN IF NOT EXISTS create_request_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS passenger_stalls_owner_create_request_unique
  ON passenger_stalls (owner_user_id, create_request_id)
  WHERE create_request_id IS NOT NULL;