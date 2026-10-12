import { db } from 'hatchable';

export const access = 'user';
export const methods = ['GET', 'POST'];

function clean(value, max = 160) {
  return String(value ?? '').trim().replace(/[<>]/g, '').slice(0, max);
}

export default async function (req, res) {
  const userId = String(req.user.id);
  try {
    if (req.method === 'GET') {
      const result = await db.query(
        'SELECT vendor_name, contact, created_at, updated_at FROM vendor_profiles WHERE user_id = $1 LIMIT 1',
        [userId]
      );
      return res.json({ ok: true, profile: result.rows[0] || null });
    }
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed.' });
    const vendorName = clean(req.body?.vendorName, 120);
    const contact = clean(req.body?.contact, 80);
    if (vendorName.length < 2) return res.status(400).json({ ok: false, error: 'Enter the vendor or business name.' });
    if (contact.length < 7) return res.status(400).json({ ok: false, error: 'Enter a valid contact phone number or email.' });
    const result = await db.query(
      `INSERT INTO vendor_profiles (user_id, vendor_name, contact)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET vendor_name = EXCLUDED.vendor_name, contact = EXCLUDED.contact, updated_at = NOW()
       RETURNING vendor_name, contact, created_at, updated_at`,
      [userId, vendorName, contact]
    );
    await db.query(
      'UPDATE passenger_stalls SET vendor_name = $2, vendor_contact = $3, updated_at = NOW() WHERE owner_user_id = $1',
      [userId, vendorName, contact]
    );
    return res.json({ ok: true, profile: result.rows[0] });
  } catch (error) {
    console.error('Vendor profile operation failed', String(error?.message || error).slice(0, 180));
    return res.status(500).json({ ok: false, error: 'Vendor profile could not be saved.' });
  }
}