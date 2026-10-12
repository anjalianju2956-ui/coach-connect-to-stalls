import { db } from 'hatchable';

export const access = 'user';
export const methods = ['POST', 'PUT', 'DELETE'];

class ValidationError extends Error {}
function clean(value, max = 120) {
  return String(value ?? '').trim().replace(/[<>]/g, '').slice(0, max);
}
function parseMenu(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; } }
  return [];
}
function normalizeItem(body, previous = {}) {
  const name = clean(body?.name ?? previous.name, 100);
  const rawPrice = body?.price ?? previous.price;
  const price = Number(rawPrice);
  const stockStatus = String(body?.stockStatus ?? body?.stock_status ?? previous.stock_status ?? '').toUpperCase();
  if (!name) throw new ValidationError('Enter a menu item name.');
  if (rawPrice === '' || rawPrice == null || !Number.isFinite(price) || price < 0 || price > 1000000) throw new ValidationError('Enter a valid non-negative price.');
  if (!['IN_STOCK', 'OUT_OF_STOCK'].includes(stockStatus)) throw new ValidationError('Choose In Stock or Out of Stock.');
  return { id: previous.id || crypto.randomUUID(), name, price, stock_status: stockStatus };
}
export default async function (req, res) {
  const userId = String(req.user.id);
  try {
    const stallId = clean(req.body?.stallId ?? req.body?.stall_id, 100);
    if (!stallId) return res.status(400).json({ ok: false, error: 'A stall ID is required.' });
    const found = await db.query(
      'SELECT menu_json FROM passenger_stalls WHERE id = $1 AND owner_user_id = $2 AND is_active = TRUE LIMIT 1',
      [stallId, userId]
    );
    if (!found.rows[0]) return res.status(404).json({ ok: false, error: 'Stall not found for this vendor.' });
    const menu = parseMenu(found.rows[0].menu_json);
    let updated;
    if (req.method === 'POST') {
      if (menu.length >= 100) throw new ValidationError('A stall can have at most 100 menu items.');
      updated = [...menu, normalizeItem(req.body)];
    } else {
      const itemId = clean(req.body?.itemId ?? req.body?.item_id, 100);
      if (!itemId) return res.status(400).json({ ok: false, error: 'A menu item ID is required.' });
      const index = menu.findIndex(item => String(item.id) === itemId);
      if (index < 0) return res.status(404).json({ ok: false, error: 'Menu item not found for this stall.' });
      if (req.method === 'PUT') {
        updated = menu.slice();
        updated[index] = normalizeItem(req.body, menu[index]);
      } else if (req.method === 'DELETE') {
        updated = menu.filter(item => String(item.id) !== itemId);
      } else return res.status(405).json({ ok: false, error: 'Method not allowed.' });
    }
    await db.query(
      'UPDATE passenger_stalls SET menu_json = $3::jsonb, updated_at = NOW() WHERE id = $1 AND owner_user_id = $2',
      [stallId, userId, JSON.stringify(updated)]
    );
    return res.json({ ok: true, menuItems: updated });
  } catch (error) {
    if (error instanceof ValidationError) return res.status(400).json({ ok: false, error: clean(error.message, 240) });
    console.error('Vendor menu operation failed', String(error?.message || error).slice(0, 180));
    return res.status(500).json({ ok: false, error: 'Menu item could not be saved.' });
  }
}