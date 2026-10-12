import { db } from 'hatchable';

export const access = 'public';
export const methods = ['GET'];

function clean(value, max = 160) {
  return String(value ?? '').trim().replace(/[<>]/g, '').slice(0, max);
}

export default async function (req, res) {
  const stationKey = clean(req.query?.stationKey, 32);
  const stationName = clean(req.query?.stationName, 160);
  if (!stationKey && !stationName) {
    return res.status(400).json({ ok: false, error: 'A station code or station name is required.' });
  }
  try {
    // Exact station association only. Prefer the API-provided station code/key,
    // while also supporting older listings whose station_key stores the station name.
    const result = await db.query(
      "SELECT id, name, category, station_key, station_name, platform_label, description, demo_label, menu_json, emoji FROM passenger_stalls WHERE is_active = TRUE AND (UPPER(station_key) = UPPER($1) OR UPPER(station_key) = UPPER($2) OR UPPER(station_name) = UPPER($2)) ORDER BY name ASC LIMIT 50",
      [stationKey, stationName]
    );
    return res.json({ ok: true, station: { key: stationKey, name: stationName }, count: result.rows.length, stalls: result.rows });
  } catch (error) {
    console.error('Station stall lookup failed', String(error?.message || error).slice(0, 180));
    return res.status(500).json({ ok: false, error: 'Station stall listings could not be loaded.' });
  }
}