-- Explicit sample-only stall records for the existing passenger_stalls table.
-- These are not verified vendors; keep the demo label visible in the UI.
INSERT INTO passenger_stalls (id, name, category, station_key, station_name, platform_label, description, demo_label, menu_json, emoji, is_active)
VALUES ('demo-brc-tea', 'Sample Tea & Snacks Stall', 'Tea & Snacks', 'BRC', 'Vadodara Junction', 'Sample location — verify at station', 'Sample listing for testing the station-stall discovery flow. Vendor details are not verified.', 'DEMO LISTING · NOT VERIFIED', '[{"name":"Tea"},{"name":"Coffee"},{"name":"Snack item"}]'::jsonb, '☕', TRUE)
ON CONFLICT (id) DO NOTHING;
INSERT INTO passenger_stalls (id, name, category, station_key, station_name, platform_label, description, demo_label, menu_json, emoji, is_active)
VALUES ('demo-brc-meals', 'Sample Meals Corner', 'Meals', 'BRC', 'Vadodara Junction', 'Sample location — verify at station', 'Sample listing for testing menu and stall details. This is not a verified vendor.', 'DEMO LISTING · NOT VERIFIED', '[{"name":"Meal item"},{"name":"Snack item"}]'::jsonb, '🍱', TRUE)
ON CONFLICT (id) DO NOTHING;
INSERT INTO passenger_stalls (id, name, category, station_key, station_name, platform_label, description, demo_label, menu_json, emoji, is_active)
VALUES ('demo-brc-essentials', 'Sample Essentials Kiosk', 'Travel Essentials', 'BRC', 'Vadodara Junction', 'Sample location — verify at station', 'Sample listing for testing the station-specific stall details page. Not a verified vendor.', 'DEMO LISTING · NOT VERIFIED', '[{"name":"Water"},{"name":"Travel essential"}]'::jsonb, '🧃', TRUE)
ON CONFLICT (id) DO NOTHING;