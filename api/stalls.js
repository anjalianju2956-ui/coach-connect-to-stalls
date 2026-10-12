import { db, auth } from 'hatchable';

export const access = 'public';
export const methods = ['GET'];

function clean(value, max = 160) {
  return String(value ?? '').trim().replace(/[<>]/g, '').slice(0, max);
}

export default async function (req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Use GET to view station stalls.' });
  // Public read-only catalogue by design; signed-in users are still passengers here.
  await auth.getUser(req);
  const stationKey = clean(req.query?.stationKey, 32).toUpperCase();
  const stationName = clean(req.query?.stationName, 160);
  if (!stationKey && !stationName) {
    return res.status(400).json({ ok: false, error: 'A station code or station name is required.' });
  }
  try {
    // Exact station association only. Unpublished drafts, legacy demo rows,
    // deactivated stalls, and rows without a real vendor owner stay hidden.
    const result = await db.query(
      `SELECT id, name, category, station_key, station_name, platform_label, description,
              vendor_name, vendor_contact, coach_location, directions, stall_status,
              publication_status, menu_json, emoji, updated_at
       FROM passenger_stalls
       WHERE is_active = TRUE
         AND publication_status = 'published'
         AND COALESCE(demo_label, '') = ''
         AND owner_user_id IS NOT NULL
         AND (UPPER(station_key) = UPPER($1) OR UPPER(station_name) = UPPER($2))
       ORDER BY name ASC LIMIT 100`,
      [stationKey, stationName]
    );
    return res.json({ ok: true, station: { key: stationKey, name: stationName }, count: result.rows.length, stalls: result.rows });
  } catch (error) {
    console.error('Station stall lookup failed', String(error?.message || error).slice(0, 180));
    return res.status(500).json({ ok: false, error: 'Station stall listings could not be loaded.' });
  }
}