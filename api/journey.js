import { config, db } from 'hatchable';

export const access = 'public';
export const methods = ['POST'];

function indiaDate() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return values.year + '-' + values.month + '-' + values.day;
}
function indiaMonth() { return indiaDate().slice(0, 7); }
function clean(value, max = 160) { return String(value ?? '').replace(/[<>]/g, '').trim().slice(0, max); }
function firstStation(data) {
  const info = Array.isArray(data.trainInfo) ? data.trainInfo[0] : (data.trainInfo || data.train || {});
  const source = data.source || info.source || {};
  const destination = data.destination || info.destination || {};
  return { info, source, destination };
}
function getNextHalt(data, current) {
  const direct = data.nextHalt || data.next_halt || data.nextStation || data.next_station;
  if (direct && (direct.stnName || direct.stationName || direct.name || direct.stnCode || direct.stationCode || direct.code)) return direct;
  const route = Array.isArray(data.route) ? data.route : [];
  const currentCode = String(current.stnCode || current.stationCode || current.code || '').toUpperCase();
  let currentIndex = currentCode ? route.findIndex(s => String(s.stnCode || s.stationCode || s.code || '').toUpperCase() === currentCode) : -1;
  if (currentIndex >= 0) {
    for (let i = currentIndex + 1; i < route.length; i++) {
      const stop = route[i];
      const status = String(stop.status || '').toLowerCase();
      if (stop.isHalt === false || /pass|passed|departed|arrived/.test(status)) continue;
      return stop;
    }
  }
  const upcoming = route.find(s => s.isHalt !== false && /upcoming|next|yet to come|scheduled/.test(String(s.status || '').toLowerCase()));
  return upcoming || null;
}
function stationTime(value) {
  if (value && typeof value === 'object') return clean(value.actual || value.expected || value.scheduled || value.time || '', 60);
  return clean(value || '', 60);
}
function normalize(payload, trainNumber, date) {
  if (!payload || payload.success !== true || !payload.data) {
    throw new Error(clean(payload?.error || payload?.message || 'RailKit did not return live train data.', 240));
  }
  const data = payload.data;
  const { info, source, destination } = firstStation(data);
  const current = data.currentLocation || data.current_location || {};
  const next = getNextHalt(data, current);
  if (!next) {
    const statusText = clean(data.statusText || data.statusNote || data.status || '');
    throw new Error(statusText ? 'RailKit status: ' + statusText + '. A next halt was not returned for this train.' : 'RailKit returned no next halt for this train. It may not be running or may have reached its destination.');
  }
  const nextCode = clean(next.stnCode || next.stationCode || next.code || next.station?.code, 12).toUpperCase();
  const nextName = clean(next.stnName || next.stationName || next.name || next.station?.name, 160);
  if (!nextName && !nextCode) throw new Error('RailKit did not provide the next station name or code.');
  const route = Array.isArray(data.route) ? data.route : [];
  const routeStop = route.find(s => String(s.stnCode || s.stationCode || s.code || '').toUpperCase() === nextCode) || next;
  const delayValue = data.delayMinutes ?? data.delay_minutes ?? current.delayMinutes ?? current.delay_minutes;
  const delay = Number(delayValue);
  const distanceValue = current.distanceToNextStationKm ?? current.distance_to_next_station_km ?? next.distanceToNextStationKm ?? next.distanceKm ?? next.distance;
  const distance = Number(distanceValue);
  return {
    trainNumber,
    trainName: clean(info.name || info.trainName || info.train_name || data.trainName || data.train_name || 'Train ' + trainNumber),
    journeyDate: date,
    live: data.isLive === true || String(data.status || '').toLowerCase() === 'running',
    status: clean(data.status || (data.isLive === true ? 'running' : 'status available'), 60),
    statusText: clean(data.statusText || data.statusNote || data.statusTextNote || '', 240),
    source: { name: clean(source.name || source.stationName || info.from_stn_name || info.sourceName || ''), code: clean(source.code || source.stnCode || info.from_stn_code || info.sourceCode || '').toUpperCase() },
    destination: { name: clean(destination.name || destination.stationName || info.to_stn_name || info.destName || ''), code: clean(destination.code || destination.stnCode || info.to_stn_code || info.destCode || '').toUpperCase() },
    currentLocation: {
      name: clean(current.stnName || current.stationName || current.name || current.currentLocation || ''),
      code: clean(current.stnCode || current.stationCode || current.code || '').toUpperCase(),
      status: clean(current.status || '', 60),
      distanceToNextStationKm: Number.isFinite(Number(current.distanceToNextStationKm)) ? Number(current.distanceToNextStationKm) : null
    },
    nextStation: {
      name: nextName || nextCode,
      code: nextCode,
      distanceKm: Number.isFinite(distance) && distance >= 0 ? distance : null,
      scheduledArrival: stationTime(routeStop.arrival || routeStop.arrivalTime || routeStop.arrival_time || ''),
      scheduledDeparture: stationTime(routeStop.departure || routeStop.departureTime || routeStop.departure_time || ''),
      platform: clean(routeStop.platform ?? routeStop.platformNumber ?? routeStop.platform_number ?? routeStop.platformNo ?? routeStop.platform_no ?? routeStop.platformName ?? routeStop.platform_name ?? next.platform ?? next.platformNumber ?? next.platform_number ?? next.platformName ?? next.platform_name ?? '', 30),
      platformSource: clean(routeStop.platform ?? routeStop.platformNumber ?? routeStop.platform_number ?? routeStop.platformNo ?? routeStop.platform_no ?? routeStop.platformName ?? routeStop.platform_name ?? next.platform ?? next.platformNumber ?? next.platform_number ?? next.platformName ?? next.platform_name ?? '') ? 'RailKit route response' : null,
      sequence: Number.isFinite(Number(routeStop.sequence)) ? Number(routeStop.sequence) : null
    },
    delayMinutes: Number.isFinite(delay) ? delay : null,
    lastUpdatedAt: clean(data.lastUpdatedAt || data.lastUpdated || data.last_update || data.lastUpdate || data.updatedAt || '', 100),
    provider: clean(data._provider || 'RailKit', 40),
    fetchedAt: new Date().toISOString()
  };
}

export default async function(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST to track a train.' });
  const trainNumber = String(req.body?.trainNumber || '').trim();
  if (!/^\d{5}$/.test(trainNumber)) return res.status(400).json({ error: 'Enter a valid 5-digit train number.' });

  const apiKey = await config.get('RAILKIT_API_KEY');
  if (!apiKey || !String(apiKey).trim()) {
    return res.status(503).json({ error: 'Live tracking is not configured yet. Add your RailKit API key in Hatchable → Coach-Connect Passenger → Setup, then try again.' });
  }

  const date = indiaDate();
  const monthKey = date.slice(0, 7);
  // A fresh cached response costs no RailKit request. Cache is intentionally short-lived for live status.
  const cachedResult = await db.query(
    "SELECT response_json FROM train_lookup_cache WHERE train_number=$1 AND service_date=$2 AND fetched_at > NOW() - INTERVAL '2 minutes' LIMIT 1",
    [trainNumber, date]
  );
  if (cachedResult.rows[0]?.response_json) {
    const cachedJourney = cachedResult.rows[0].response_json;
    if (cachedJourney?.nextStation) return res.json({ ok: true, journey: cachedJourney, cached: true });
  }
  // Recover a stale in-flight marker after a crashed/terminated request, then claim this train/date.
  await db.query(
    "DELETE FROM railkit_request_locks WHERE train_number=$1 AND service_date=$2 AND started_at < NOW() - INTERVAL '60 seconds'",
    [trainNumber, date]
  );
  const lock = await db.query(
    'INSERT INTO railkit_request_locks(train_number,service_date,started_at) VALUES($1,$2,NOW()) ON CONFLICT(train_number,service_date) DO NOTHING RETURNING train_number',
    [trainNumber, date]
  );
  if (!lock.rows.length) {
    const racedCache = await db.query(
      "SELECT response_json FROM train_lookup_cache WHERE train_number=$1 AND service_date=$2 AND fetched_at > NOW() - INTERVAL '2 minutes' LIMIT 1",
      [trainNumber, date]
    );
    if (racedCache.rows[0]?.response_json?.nextStation) return res.json({ ok: true, journey: racedCache.rows[0].response_json, cached: true });
    return res.status(409).json({ error: 'A live status request for this train is already in progress. Wait briefly before trying again.' });
  }
  const usage = await db.query(
    'INSERT INTO railkit_monthly_usage(month_key,request_count,updated_at) VALUES($1,1,NOW()) ON CONFLICT(month_key) DO UPDATE SET request_count=railkit_monthly_usage.request_count+1,updated_at=NOW() WHERE railkit_monthly_usage.request_count < 50 RETURNING request_count',
    [monthKey]
  );
  if (!usage.rows.length) {
    await db.query('DELETE FROM railkit_request_locks WHERE train_number=$1 AND service_date=$2', [trainNumber, date]);
    return res.status(429).json({ error: 'Coach-Connect has reached its strict 50-request RailKit limit for this month. Cached status remains available briefly; try again next month.' });
  }
  const path = '/api/v2/trains/' + encodeURIComponent(trainNumber) + '/live/' + encodeURIComponent(date);
  const url = 'https://api.railkit.in' + path;
  try {
    // Match the official RailKit SDK request signature, using Web Crypto so this hosted
    // runtime does not need an npm install. The RailKit API key stays server-side.
    const timestamp = String(Date.now());
    const nonceBytes = crypto.getRandomValues(new Uint8Array(32));
    const nonce = Array.from(nonceBytes, b => b.toString(16).padStart(2, '0')).join('');
    const emptyPayloadHash = await crypto.subtle.digest('SHA-256', new Uint8Array());
    const payloadHash = Array.from(new Uint8Array(emptyPayloadHash), b => b.toString(16).padStart(2, '0')).join('');
    const signingSecret = '97c56e08b27b161124f88acd4f24d1bd50f48075f11dc23b9ea6c0bc9b2f8794';
    const signingKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(signingSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const canonical = ['GET', path, timestamp, nonce, payloadHash, String(apiKey).trim()].join('\n');
    const signatureBytes = await crypto.subtle.sign('HMAC', signingKey, new TextEncoder().encode(canonical));
    const signature = Array.from(new Uint8Array(signatureBytes), b => b.toString(16).padStart(2, '0')).join('');
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'x-api-key': String(apiKey).trim(),
        'x-irctc-sdk-ts': timestamp,
        'x-irctc-sdk-nonce': nonce,
        'x-irctc-sdk-payload-sha256': payloadHash,
        'x-irctc-sdk-signature': signature,
        'x-irctc-sdk-version': '1'
      },
      signal: AbortSignal.timeout(15000)
    });
    let payload;
    try { payload = await response.json(); } catch { return res.status(502).json({ error: 'RailKit returned an unreadable response. Check the API service and key.' }); }
    if (!response.ok) {
      const providerMessage = clean(payload?.error || payload?.message || '', 220);
      if (response.status === 401 || response.status === 403) return res.status(502).json({ error: 'RailKit rejected the API key. Check the key in Hatchable Setup.' });
      if (response.status === 429) return res.status(429).json({ error: 'RailKit request quota or rate limit reached. Try later or check your RailKit plan.' });
      if (response.status === 404) return res.status(404).json({ error: providerMessage || 'Train not found for today, or RailKit has no live record for it.' });
      return res.status(502).json({ error: providerMessage || 'RailKit could not return this train status. Try again later.' });
    }
    let journey;
    try { journey = normalize(payload, trainNumber, date); }
    catch (e) { return res.status(422).json({ error: clean(e?.message || 'RailKit did not return a next station.', 260) }); }
    try {
      await db.query(
        'INSERT INTO train_lookup_cache(train_number,service_date,response_json,fetched_at) VALUES($1,$2,$3::jsonb,NOW()) ON CONFLICT(train_number) DO UPDATE SET service_date=EXCLUDED.service_date,response_json=EXCLUDED.response_json,fetched_at=NOW()',
        [trainNumber, date, JSON.stringify(journey)]
      );
    } catch (cacheError) {
      console.error('RailKit cache write failed', clean(cacheError?.message || cacheError, 160));
    }
    return res.json({ ok: true, journey, cached: false, monthlyRequestCount: usage.rows[0].request_count });
  } catch (e) {
    console.error('RailKit live tracking failed', clean(e?.message || e, 180));
    if (e?.name === 'TimeoutError' || e?.name === 'AbortError') return res.status(504).json({ error: 'RailKit timed out. Try again in a little while.' });
    return res.status(502).json({ error: 'Could not reach RailKit. Check the network or try again later.' });
  } finally {
    try { await db.query('DELETE FROM railkit_request_locks WHERE train_number=$1 AND service_date=$2', [trainNumber, date]); }
    catch (cleanupError) { console.error('RailKit request lock cleanup failed', clean(cleanupError?.message || cleanupError, 160)); }
  }
}