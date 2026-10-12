-- Track which stations have had their default demo stalls seeded.
-- Existing demo stations are registered so ordinary page loads never recreate deleted rows.
CREATE TABLE IF NOT EXISTS demo_station_seed_registry (
  station_key TEXT PRIMARY KEY,
  station_name TEXT NOT NULL,
  seeded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  enabled BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO demo_station_seed_registry (station_key, station_name)
SELECT station_key, MAX(station_name)
FROM passenger_stalls
WHERE owner_user_id IS NULL AND COALESCE(demo_label, '') <> ''
GROUP BY station_key
ON CONFLICT (station_key) DO UPDATE SET station_name = EXCLUDED.station_name;

CREATE INDEX IF NOT EXISTS idx_demo_station_seed_registry_enabled
  ON demo_station_seed_registry(enabled, station_key);