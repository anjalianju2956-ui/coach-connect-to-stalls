import { db, auth } from 'hatchable';

export const access = 'public';
export const methods = ['GET'];

const DEMO_LABEL = 'DEMO · SAMPLE ONLY · NOT VERIFIED';
const TEMPLATES = [
  { slug:'tea-snacks', name:'Sample Tea & Snacks Stall', category:'beverages', emoji:'☕', status:'open', menu:[['Tea',15,'IN_STOCK'],['Coffee',25,'IN_STOCK'],['Biscuits',10,'OUT_OF_STOCK']] },
  { slug:'meals-corner', name:'Sample Meals Corner', category:'food', emoji:'🍱', status:'open', menu:[['Idli plate',40,'IN_STOCK'],['Veg meal',90,'OUT_OF_STOCK']] },
  { slug:'essentials', name:'Sample Essentials Kiosk', category:'groceries', emoji:'🧃', status:'unavailable', menu:[['Water bottle',20,'IN_STOCK'],['Tissues',15,'IN_STOCK']] },
  { slug:'coffee-counter', name:'Sample Coffee Counter', category:'beverages', emoji:'☕', status:'closed', menu:[['Filter coffee',30,'IN_STOCK'],['Hot chocolate',45,'OUT_OF_STOCK']] },
  { slug:'south-indian-bites', name:'Sample South Indian Bites', category:'snacks', emoji:'🥪', status:'open', menu:[['Idli (2 pcs)',35,'IN_STOCK'],['Vada',20,'OUT_OF_STOCK']] }
];

function clean(value, max = 160) {
  return String(value ?? '').trim().replace(/[<>]/g, '').slice(0, max);
}
function stationSlug(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'UNKNOWN';
}
async function seedStationIfFirstVisit(stationKey, stationName) {
  const state = await db.query(
    'SELECT station_key FROM demo_station_seed_registry WHERE station_key = $1 AND enabled = TRUE LIMIT 1',
    [stationKey]
  );
  if (state.rows.length) return { seeded: false, reason: 'already_seeded' };

  // If legacy demo rows exist without a registry row, register the station instead
  // of creating another set. This also prevents refreshes from restoring deleted rows.
  const legacy = await db.query(
    "SELECT COUNT(*)::int AS count FROM passenger_stalls WHERE station_key = $1 AND owner_user_id IS NULL AND COALESCE(demo_label, '') <> ''",
    [stationKey]
  );
  if (Number(legacy.rows[0]?.count || 0) > 0) {
    await db.query(
      'INSERT INTO demo_station_seed_registry(station_key, station_name) VALUES($1,$2) ON CONFLICT(station_key) DO NOTHING',
      [stationKey, stationName]
    );
    return { seeded: false, reason: 'legacy_demo_rows_registered' };
  }

  const keySlug = stationSlug(stationKey);
  for (let i = 0; i < TEMPLATES.length; i++) {
    const t = TEMPLATES[i];
    const id = 'demo-' + keySlug.toLowerCase() + '-' + t.slug;
    const menu = t.menu.map((m, j) => ({
      id: keySlug.toLowerCase() + '-' + t.slug + '-' + (j + 1),
      name: m[0], price: m[1], stock_status: m[2]
    }));
    await db.query(
      `INSERT INTO passenger_stalls
        (id,name,category,station_key,station_name,platform_label,description,demo_label,menu_json,emoji,is_active,
         owner_user_id,vendor_name,vendor_contact,coach_location,location_description,coach_area_label,coach_area_verified,
         directions,latitude,longitude,stall_status,publication_status,updated_at)
       VALUES($1,$2,$3,$4,$5,NULL,$6,$7,$8::jsonb,$9,TRUE,NULL,'','','',$10,'',FALSE,$11,NULL,NULL,$12,'published',NOW())
       ON CONFLICT(id) DO NOTHING`,
      [id,t.name,t.category,stationKey,stationName,
       'DEMO DATA ONLY — fictional sample, not a real or verified business.',DEMO_LABEL,
       JSON.stringify(menu),t.emoji,'Demo sample only; exact stall location and coach-side area are not verified.',
       'Demo location only; exact stall position is not verified.',t.status]
    );
  }
  await db.query(
    'INSERT INTO demo_station_seed_registry(station_key, station_name) VALUES($1,$2) ON CONFLICT(station_key) DO NOTHING',
    [stationKey, stationName]
  );
  return { seeded: true, count: TEMPLATES.length };
}

export default async function (req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Use GET to view station stalls.' });
  await auth.getUser(req);
  const rawKey = clean(req.query?.stationKey, 32).toUpperCase();
  const stationName = clean(req.query?.stationName, 160);
  if (!rawKey && !stationName) {
    return res.status(400).json({ ok: false, error: 'A station code or station name is required.' });
  }
  const stationKey = rawKey || stationSlug(stationName);
  const resolvedName = stationName || stationKey;
  try {
    await seedStationIfFirstVisit(stationKey, resolvedName);
    const result = await db.query(
      `SELECT id, name, category, station_key, station_name, platform_label, description,
              vendor_name, vendor_contact, coach_location, location_description, coach_area_label, coach_area_verified,
              directions, latitude, longitude, stall_status, publication_status, demo_label, menu_json, emoji, updated_at
       FROM passenger_stalls
       WHERE is_active = TRUE
         AND publication_status = 'published'
         AND ((COALESCE(demo_label, '') = '' AND owner_user_id IS NOT NULL)
              OR (COALESCE(demo_label, '') <> '' AND owner_user_id IS NULL))
         AND (CASE WHEN $1 <> '' THEN UPPER(station_key) = UPPER($1) ELSE UPPER(station_name) = UPPER($2) END)
       ORDER BY name ASC LIMIT 100`,
      [rawKey, resolvedName]
    );
    return res.json({
      ok: true,
      station: { key: stationKey, name: resolvedName },
      count: result.rows.length,
      stalls: result.rows
    });
  } catch (error) {
    console.error('Station stall lookup failed', String(error?.message || error).slice(0, 180));
    return res.status(500).json({ ok: false, error: 'Station stall listings could not be loaded.' });
  }
}