-- Vendor-entered physical location details. Coach-area notes remain unverified unless a trusted station-layout dataset is integrated.
ALTER TABLE passenger_stalls ADD COLUMN IF NOT EXISTS location_description TEXT NOT NULL DEFAULT '';
ALTER TABLE passenger_stalls ADD COLUMN IF NOT EXISTS coach_area_label TEXT NOT NULL DEFAULT '';
ALTER TABLE passenger_stalls ADD COLUMN IF NOT EXISTS coach_area_verified BOOLEAN NOT NULL DEFAULT FALSE;

-- Existing sample platforms and coach labels were illustrative, not verified station data.
UPDATE passenger_stalls
SET platform_label = NULL,
    coach_location = '',
    location_description = 'Demo sample only; exact stall location is not verified.',
    coach_area_label = '',
    coach_area_verified = FALSE,
    latitude = NULL,
    longitude = NULL,
    updated_at = NOW()
WHERE owner_user_id IS NULL AND COALESCE(demo_label, '') <> '';