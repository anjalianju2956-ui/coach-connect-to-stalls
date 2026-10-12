import { db } from 'hatchable';

export const access = 'user';
export const methods = ['GET', 'POST', 'PUT', 'DELETE'];

class ValidationError extends Error {}
function clean(value, max = 180) {
  return String(value ?? '').trim().replace(/[<>]/g, '').slice(0, max);
}
function validStatus(value) {
  return ['open', 'closed', 'unavailable'].includes(String(value || '').toLowerCase());
}
function normalizeMenu(value, allowEmpty = false) {
  if (!Array.isArray(value)) throw new ValidationError('Add at least one menu item with price and stock status.');
  if (!value.length && !allowEmpty) throw new ValidationError('Add at least one menu item with price and stock status.');
  if (value.length > 100) throw new ValidationError('A stall can have at most 100 menu items.');
  return value.map(item => {
    const name = clean(item?.name || item?.item || item?.title, 100);
    const price = Number(item?.price);
    const stockStatus = String(item?.stock_status || item?.stockStatus || '').toUpperCase();
    if (!name) throw new ValidationError('Every menu item needs a name.');
    if (item?.price === '' || item?.price == null || !Number.isFinite(price) || price < 0 || price > 1000000) throw new ValidationError('Enter a valid non-negative price for every menu item.');
    if (!['IN_STOCK', 'OUT_OF_STOCK'].includes(stockStatus)) throw new ValidationError('Choose In Stock or Out of Stock for every menu item.');
    return { id: clean(item?.id, 80) || crypto.randomUUID(), name, price, stock_status: stockStatus };
  });
}
function normalizeFields(body, profile, existing = {}) {
  const name = clean(body?.name ?? existing.name, 120);
  const category = clean(body?.category ?? existing.category, 80);
  const stationName = clean(body?.stationName ?? body?.station_name ?? existing.station_name, 160);
  const stationCode = clean(body?.stationCode ?? body?.station_key ?? existing.station_key, 20).toUpperCase();
  const platform = clean(body?.platformLabel ?? body?.platform_label ?? existing.platform_label, 40);
  const coachLocation = clean(body?.coachLocation ?? body?.coach_location ?? existing.coach_location, 100);
  const directions = clean(body?.directions ?? existing.directions, 500);
  const description = clean(body?.description ?? existing.description, 500);
  const stallStatus = String(body?.stallStatus ?? body?.stall_status ?? existing.stall_status ?? 'unavailable').toLowerCase();
  const publicationStatus = String(body?.publicationStatus ?? body?.publication_status ?? existing.publication_status ?? 'draft').toLowerCase();
  if (name.length < 2) throw new ValidationError('Enter a stall name.');
  if (!category) throw new ValidationError('Choose a stall category.');
  if (!stationName || !stationCode) throw new ValidationError('Enter both station name and station code.');
  if (!platform) throw new ValidationError('Enter the stall platform number.');
  if (!coachLocation) throw new ValidationError('Enter the coach number or coach-side location this stall serves.');
  if (!validStatus(stallStatus)) throw new ValidationError('Choose Open, Closed, or Unavailable.');
  if (!['draft', 'published'].includes(publicationStatus)) throw new ValidationError('Choose Draft or Published.');
  if (publicationStatus === 'published' && (!profile?.vendor_name || !profile?.contact)) {
    throw new ValidationError('Complete vendor name and contact details before publishing.');
  }
  return {
    name, category, station_name: stationName, station_key: stationCode,
    platform_label: platform, coach_location: coachLocation, directions, description,
    stall_status: stallStatus, publication_status: publicationStatus,
    vendor_name: profile.vendor_name, vendor_contact: profile.contact
  };
}
async function getProfile(userId) {
  const result = await db.query('SELECT vendor_name, contact FROM vendor_profiles WHERE user_id = $1 LIMIT 1', [userId]);
  return result.rows[0] || null;
}
export default async function (req, res) {
  const userId = String(req.user.id);
  try {
    const profile = await getProfile(userId);
    if (!profile) return res.status(403).json({ ok: false, error: 'Create your vendor profile before managing stalls.' });
    if (req.method === 'GET') {
      const result = await db.query(
        `SELECT id, name, category, station_key, station_name, platform_label, description,
                demo_label, menu_json, emoji, is_active, vendor_name, vendor_contact,
                coach_location, directions, stall_status, publication_status, created_at, updated_at
         FROM passenger_stalls WHERE owner_user_id = $1 ORDER BY updated_at DESC, created_at DESC LIMIT 100`,
        [userId]
      );
      return res.json({ ok: true, stalls: result.rows });
    }
    if (req.method === 'POST') {
      const fields = normalizeFields(req.body, profile);
      const menu = normalizeMenu(req.body?.menuItems ?? req.body?.menu_json);
      if (fields.publication_status === 'published' && !menu.length) throw new ValidationError('Add at least one menu item before publishing.');
      const id = crypto.randomUUID();
      const result = await db.query(
        `INSERT INTO passenger_stalls
          (id, name, category, station_key, station_name, platform_label, description, demo_label,
           menu_json, emoji, is_active, owner_user_id, vendor_name, vendor_contact, coach_location,
           directions, stall_status, publication_status, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'',$8::jsonb,'🥪',TRUE,$9,$10,$11,$12,$13,$14,$15,NOW())
         RETURNING id, name, category, station_key, station_name, platform_label, description,
                   menu_json, emoji, is_active, vendor_name, vendor_contact, coach_location,
                   directions, stall_status, publication_status, created_at, updated_at`,
        [id, fields.name, fields.category, fields.station_key, fields.station_name, fields.platform_label,
         fields.description, JSON.stringify(menu), userId, fields.vendor_name, fields.vendor_contact,
         fields.coach_location, fields.directions, fields.stall_status, fields.publication_status]
      );
      return res.status(201).json({ ok: true, stall: result.rows[0] });
    }
    const stallId = clean(req.body?.id, 100);
    if (!stallId) return res.status(400).json({ ok: false, error: 'A stall ID is required.' });
    const existingResult = await db.query(
      'SELECT * FROM passenger_stalls WHERE id = $1 AND owner_user_id = $2 LIMIT 1',
      [stallId, userId]
    );
    const existing = existingResult.rows[0];
    if (!existing) return res.status(404).json({ ok: false, error: 'Stall not found for this vendor.' });
    if (req.method === 'DELETE') {
      await db.query('DELETE FROM passenger_stalls WHERE id = $1 AND owner_user_id = $2', [stallId, userId]);
      return res.json({ ok: true, deleted: true });
    }
    if (req.method !== 'PUT') return res.status(405).json({ ok: false, error: 'Method not allowed.' });
    const fields = normalizeFields(req.body, profile, existing);
    const menu = req.body?.menuItems !== undefined ? normalizeMenu(req.body.menuItems, true) : (Array.isArray(existing.menu_json) ? existing.menu_json : []);
    if (fields.publication_status === 'published' && !menu.length) throw new ValidationError('Add at least one menu item before publishing.');
    const result = await db.query(
      `UPDATE passenger_stalls SET name=$3, category=$4, station_key=$5, station_name=$6,
        platform_label=$7, description=$8, menu_json=$9::jsonb, vendor_name=$10, vendor_contact=$11,
        coach_location=$12, directions=$13, stall_status=$14, publication_status=$15,
        is_active=TRUE, demo_label='', updated_at=NOW()
       WHERE id=$1 AND owner_user_id=$2
       RETURNING id, name, category, station_key, station_name, platform_label, description,
                 menu_json, emoji, is_active, vendor_name, vendor_contact, coach_location,
                 directions, stall_status, publication_status, created_at, updated_at`,
      [stallId, userId, fields.name, fields.category, fields.station_key, fields.station_name,
       fields.platform_label, fields.description, JSON.stringify(menu), fields.vendor_name,
       fields.vendor_contact, fields.coach_location, fields.directions, fields.stall_status,
       fields.publication_status]
    );
    return res.json({ ok: true, stall: result.rows[0] });
  } catch (error) {
    if (error instanceof ValidationError) return res.status(400).json({ ok: false, error: clean(error.message, 240) });
    console.error('Vendor stall operation failed', String(error?.message || error).slice(0, 180));
    return res.status(500).json({ ok: false, error: 'Stall could not be saved.' });
  }
}