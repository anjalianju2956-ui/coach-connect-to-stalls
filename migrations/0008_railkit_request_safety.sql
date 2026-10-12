-- Persistent strict monthly RailKit request accounting (India calendar month).
CREATE TABLE IF NOT EXISTS railkit_monthly_usage (
  month_key TEXT PRIMARY KEY,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0 AND request_count <= 50),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cross-instance guard against duplicate live calls for the same train/service date.
CREATE TABLE IF NOT EXISTS railkit_request_locks (
  train_number TEXT NOT NULL,
  service_date TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (train_number, service_date)
);