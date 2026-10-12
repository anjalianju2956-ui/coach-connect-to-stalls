import { db } from 'hatchable';

export const access = 'admin';
export const methods = ['POST'];

const DEMO_LABEL = 'DEMO · SAMPLE ONLY · NOT VERIFIED';
const stations = [{"key":"BRC","name":"Vadodara Junction"},{"key":"SBC","name":"KSR Bengaluru City Junction"},{"key":"MYS","name":"Mysuru Junction"},{"key":"MAS","name":"Chennai Central"},{"key":"NDLS","name":"New Delhi Railway Station"}];
const templates = [{"slug":"tea-snacks","name":"Sample Tea & Snacks Stall","category":"beverages","emoji":"☕","status":"open","menu":[["Tea",15,"IN_STOCK"],["Coffee",25,"IN_STOCK"],["Biscuits",10,"OUT_OF_STOCK"]],"coach":"S1-side area"},{"slug":"meals-corner","name":"Sample Meals Corner","category":"food","emoji":"🍱","status":"open","menu":[["Idli plate",40,"IN_STOCK"],["Veg meal",90,"OUT_OF_STOCK"]],"coach":"B1-side area"},{"slug":"essentials","name":"Sample Essentials Kiosk","category":"groceries","emoji":"🧃","status":"unavailable","menu":[["Water bottle",20,"IN_STOCK"],["Tissues",15,"IN_STOCK"]],"coach":"A1-side area"},{"slug":"coffee-counter","name":"Sample Coffee Counter","category":"beverages","emoji":"☕","status":"closed","menu":[["Filter coffee",30,"IN_STOCK"],["Hot chocolate",45,"OUT_OF_STOCK"]],"coach":"general coach-side area"},{"slug":"south-indian-bites","name":"Sample South Indian Bites","category":"snacks","emoji":"🥪","status":"open","menu":[["Idli (2 pcs)",35,"IN_STOCK"],["Vada",20,"OUT_OF_STOCK"]],"coach":"S2-side area"},{"slug":"juice-snacks","name":"Sample Juice & Snacks","category":"snacks","emoji":"🥤","status":"unavailable","menu":[["Lemon juice",25,"IN_STOCK"],["Fruit cup",50,"OUT_OF_STOCK"]],"coach":"B2-side area"}];
const records = stations.flatMap(station => templates.map((t, i) => ({
  id: `demo-${station.key.toLowerCase()}-${t.slug}`,
  name: t.name,
  category: t.category,
  station_key: station.key,
  station_name: station.name,
  platform_label: `Sample Platform ${i + 1}`,
  description: 'DEMO DATA ONLY — fictional sample, not a real or verified business.',
  coach_location: `Sample: ${t.coach} (not verified)`,
  directions: 'Sample directions only; verify on site.',
  emoji: t.emoji,
  stall_status: t.status,
  menu: t.menu.map((m, j) => ({ id: `${station.key.toLowerCase()}-${t.slug}-${j + 1}`, name: m[0], price: m[1], stock_status: m[2] }))
})));

export default async function(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Use POST to intentionally seed the demo dataset.' });
  try {
    let createdOrUpdated = 0;
    for (const s of records) {
      const result = await db.query(
        `INSERT INTO passenger_stalls
          (id,name,category,station_key,station_name,platform_label,description,demo_label,menu_json,emoji,is_active,
           owner_user_id,vendor_name,vendor_contact,coach_location,directions,stall_status,publication_status,updated_at)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,TRUE,NULL,'','',$11,$12,$13,'published',NOW())
         ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,category=EXCLUDED.category,station_key=EXCLUDED.station_key,
           station_name=EXCLUDED.station_name,platform_label=EXCLUDED.platform_label,description=EXCLUDED.description,
           demo_label=EXCLUDED.demo_label,menu_json=EXCLUDED.menu_json,emoji=EXCLUDED.emoji,is_active=TRUE,
           coach_location=EXCLUDED.coach_location,directions=EXCLUDED.directions,stall_status=EXCLUDED.stall_status,
           publication_status='published',updated_at=NOW()
         WHERE passenger_stalls.owner_user_id IS NULL AND COALESCE(passenger_stalls.demo_label,'') <> ''
         RETURNING id`,
        [s.id,s.name,s.category,s.station_key,s.station_name,s.platform_label,s.description,DEMO_LABEL,
         JSON.stringify(s.menu),s.emoji,s.coach_location,s.directions,s.stall_status]
      );
      createdOrUpdated += result.rows.length;
    }
    const counts = await db.query(
      `SELECT station_key AS "stationCode", station_name AS "stationName", COUNT(*)::int AS "demoCount"
       FROM passenger_stalls
       WHERE owner_user_id IS NULL AND demo_label = $1 AND station_key = ANY($2::text[])
       GROUP BY station_key, station_name ORDER BY station_name`,
      [DEMO_LABEL, stations.map(s => s.key)]
    );
    const perStation = stations.map(s => ({
      stationCode: s.key,
      stationName: s.name,
      expected: templates.length,
      actual: Number(counts.rows.find(r => r.stationCode === s.key)?.demoCount || 0)
    }));
    return res.json({
      ok: true,
      operation: 'intentional_demo_seed',
      stationCount: stations.length,
      stations: perStation,
      expectedTotal: records.length,
      createdOrUpdated,
      totalDemoCount: perStation.reduce((sum, s) => sum + s.actual, 0),
      note: 'Page loads never run the seed. Deleted sample rows return only after this explicit admin operation. Sample IDs are stable, so repeated runs do not create duplicates.'
    });
  } catch (error) {
    console.error('Demo stall seed failed', String(error?.message || error).slice(0, 180));
    return res.status(500).json({ ok: false, error: 'Demo stalls could not be seeded.' });
  }
}