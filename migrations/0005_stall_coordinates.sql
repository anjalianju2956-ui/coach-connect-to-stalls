-- Store only vendor-entered or otherwise validated exact stall coordinates.
ALTER TABLE passenger_stalls ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE passenger_stalls ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;