const app = document.getElementById('app');
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let lastJourney = (() => { try { return JSON.parse(sessionStorage.getItem('coachJourney') || 'null'); } catch { return null; } })();
let lastTrainNumber = String(lastJourney?.trainNumber || '');
let lastCoachNumber = (() => { try { return String(sessionStorage.getItem('coachNumber') || '').toUpperCase(); } catch { return ''; } })();
function persistJourney(journey) {
  lastJourney = journey;
  lastTrainNumber = String(journey?.trainNumber || lastTrainNumber || '');
  try { sessionStorage.setItem('coachJourney', JSON.stringify(journey)); } catch { /* in-memory navigation still works */ }
}
let stallCache = new Map();
let stallsById = new Map();
let selectedStallCategory = 'all';

function routeName() { return (window.location.hash || '#search').slice(1).split('/')[0] || 'search'; }
function routeParts() { return (window.location.hash || '#search').slice(1).split('/'); }
function navigate(route) {
  if (routeName() === route) { renderRoute(); return; }
  history.pushState({ coachRoute: route }, '', '#' + route);
  renderRoute();
}
function goBack(fallback) {
  if (history.state && history.state.coachRoute) history.back();
  else navigate(fallback || 'live');
}
function shell(content, badge = 'COACH-CONNECT') {
  app.innerHTML = '<header class="top"><div class="brand"><span class="logo">↗</span><span>Coach-Connect</span></div><span class="tag header-tag">' + esc(badge) + '</span></header><main class="wrap">' + content + '<footer class="footer"><span>Coach-Connect · Rail passenger discovery</span><span>Live train details come from RailKit. Always follow railway announcements.</span></footer></main>';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function pageHead(title, subtitle, backLabel = '← Back') {
  return '<div class="page-head"><button type="button" class="back" id="page-back">' + esc(backLabel) + '</button><h1>' + esc(title) + '</h1><p>' + esc(subtitle) + '</p></div>';
}
function valueText(value, suffix = '') {
  if (value === null || value === undefined || value === '') return 'Not provided';
  return esc(value) + suffix;
}
function expectedPlatform(value) {
  return value === null || value === undefined || String(value).trim() === ''
    ? 'Platform information not available yet'
    : esc(String(value).trim());
}
function coachLabel() {
  return lastCoachNumber ? 'Coach ' + esc(lastCoachNumber) : 'Coach not provided';
}
function stationTitle(j) {
  return j?.nextStation?.name || j?.nextStation?.code || 'Next station details';
}
function renderHome(error = '') {
  shell('<div class="page-head"><h1>Train search</h1><p>Enter your train number to fetch the latest status reported by RailKit.</p></div>' +
    '<section class="panel tracker-panel search-only-panel"><form id="track-form"><div class="field"><label for="train-number">Train number</label><input id="train-number" name="trainNumber" inputmode="numeric" autocomplete="off" maxlength="5" pattern="[0-9]{5}" placeholder="Enter 5-digit train number" value="' + esc(lastTrainNumber) + '" required></div><div class="field"><label for="coach-number">Coach number</label><input id="coach-number" name="coachNumber" autocomplete="off" maxlength="5" pattern="[A-Za-z]{1,2}[0-9]{1,2}[A-Za-z]?" placeholder="e.g. S1, S2, B1, A1" value="' + esc(lastCoachNumber) + '" required></div><p class="form-hint">Enter the coach label printed on your coach, such as S1 or B1.</p><p id="form-error" class="error-text" role="alert">' + esc(error) + '</p><button id="track-button" class="btn primary wide large-btn" type="submit">Fetch Live Train Status <span>→</span></button></form></section>', 'TRAIN SEARCH');
  document.getElementById('track-form').addEventListener('submit', onTrack);
}
function renderJourney(j) {
  const current = j.currentLocation || {};
  const next = j.nextStation || {};
  const distanceValue = next.distanceKm ?? current.distanceToNextStationKm;
  const delay = j.delayMinutes == null ? 'Not provided' : (j.delayMinutes > 0 ? j.delayMinutes + ' min late' : j.delayMinutes < 0 ? Math.abs(j.delayMinutes) + ' min early' : 'On time');
  const sourceText = j.source?.name ? esc(j.source.name) + (j.source.code ? ' (' + esc(j.source.code) + ')' : '') : 'Not provided';
  const destText = j.destination?.name ? esc(j.destination.name) + (j.destination.code ? ' (' + esc(j.destination.code) + ')' : '') : 'Not provided';
  const liveText = j.live ? 'LIVE STATUS' : 'RAILKIT STATUS';
  return '<section id="journey-result" class="journey-result"><div class="result-heading"><div><span class="tag ' + (j.live ? 'live' : '') + '">' + liveText + '</span><h2 class="train-name">' + valueText(j.trainName) + '</h2><p class="train-number-label">Train number ' + valueText(j.trainNumber) + ' · ' + coachLabel() + '</p></div><button type="button" class="btn outline large-btn" id="refresh-button">↻ Refresh</button></div><div class="route-summary"><div class="station-block"><small>Source</small><b>' + sourceText + '</b></div><span class="route-arrow">→</span><div class="station-block right"><small>Destination</small><b>' + destText + '</b></div></div><div class="next-stop-live"><div class="next-kicker">NEXT HALT · RAILKIT</div><h3>' + valueText(next.name || next.code) + '</h3><div class="station-code">' + valueText(next.code) + '</div><div class="next-metrics"><div><small>Distance to halt</small><b>' + (distanceValue == null ? 'Not provided' : esc(Number(distanceValue).toLocaleString(undefined, {maximumFractionDigits:1}) + ' km')) + '</b></div><div><small>Expected Platform</small><b>' + expectedPlatform(next.platform) + '</b></div><div><small>Arrival time</small><b>' + valueText(next.scheduledArrival) + '</b></div></div></div><div class="section-head compact"><div><h2>Current train status</h2><p>Values below are taken from the latest API response.</p></div></div><div class="live-details"><div class="data-row"><span>Current reported location</span><b class="data-emphasis">' + valueText(current.name) + (current.code ? ' (' + esc(current.code) + ')' : '') + '</b></div><div class="data-row"><span>Movement status</span><b>' + valueText(current.status || j.status) + '</b></div><div class="data-row"><span>Delay</span><b class="' + (j.delayMinutes > 0 ? 'delay' : '') + '">' + esc(delay) + '</b></div><!-- Optional provider metadata omitted from the focused live-status page --></div><button type="button" id="view-next-station" class="btn green large-btn wide view-next-btn">View Next Station <span>→</span></button><p class="data-note">Live position and estimates may change. Select Refresh to fetch a new response.</p></section>';
}
async function onTrack(event) {
  // Navigation is deferred until the API returns a valid journey.
  event.preventDefault();
  const input = document.getElementById('train-number');
  const coachInput = document.getElementById('coach-number');
  const error = document.getElementById('form-error');
  const button = document.getElementById('track-button');
  const trainNumber = input.value.trim();
  const coachNumber = coachInput.value.trim().toUpperCase().replace(/\s+/g, '');
  if (!/^\d{5}$/.test(trainNumber)) { error.textContent = 'Enter a valid 5-digit train number.'; return; }
  if (!/^[A-Z]{1,2}\d{1,2}[A-Z]?$/.test(coachNumber)) { error.textContent = 'Enter a valid coach number, such as S1, S2, B1 or A1.'; return; }
  lastTrainNumber = trainNumber;
  lastCoachNumber = coachNumber;
  try { sessionStorage.setItem('coachNumber', coachNumber); } catch { /* current page state still works */ }
  error.textContent = '';
  button.disabled = true;
  button.textContent = 'Fetching live train status…';
  try {
    const response = await fetch('/api/journey', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trainNumber }) });
    const data = await response.json();
    if (!response.ok || data.ok !== true || !data.journey) throw new Error(data.error || 'Live status was not returned for this train.');
    if ((lastJourney?.nextStation?.code || lastJourney?.nextStation?.name) !== (data.journey.nextStation?.code || data.journey.nextStation?.name)) selectedStallCategory = 'all';
    persistJourney(data.journey);
    navigate('live');
  } catch (e) {
    error.textContent = e?.message || 'Could not fetch live train status. Try again.';
    button.disabled = false;
    button.innerHTML = 'Fetch Live Train Status <span>→</span>';
  }
}
async function requestRefresh() {
  if (!lastTrainNumber) return;
  const error = document.getElementById('live-error');
  const refresh = document.getElementById('refresh-button');
  if (refresh) { refresh.disabled = true; refresh.textContent = 'Refreshing…'; }
  if (error) error.textContent = '';
  try {
    const response = await fetch('/api/journey', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trainNumber: lastTrainNumber }) });
    const data = await response.json();
    if (!response.ok || data.ok !== true || !data.journey) throw new Error(data.error || 'Live status was not returned.');
    persistJourney(data.journey);
    renderLiveStatus();
  } catch (e) {
    const errorNow = document.getElementById('live-error');
    if (errorNow) errorNow.textContent = e?.message || 'Could not refresh live status.';
    const buttonNow = document.getElementById('refresh-button');
    if (buttonNow) { buttonNow.disabled = false; buttonNow.textContent = '↻ Refresh'; }
  }
}
function renderLiveStatus() {
  if (!lastJourney) {
    shell(pageHead('Live train status', 'Fetch a train from the search page to see its reported status.') +
      '<section class="panel empty"><div class="big">🚆</div><h3>No train status loaded</h3><p>Return to train search and fetch the latest status before opening this page.</p><button class="btn green large-btn" id="live-search-back">← Back to train search</button></section>', 'LIVE TRAIN STATUS');
    document.getElementById('page-back').onclick = () => goBack('search');
    document.getElementById('live-search-back').onclick = () => navigate('search');
    return;
  }
  shell(pageHead('Live train status', 'Latest train information returned by RailKit.') +
    renderJourney(lastJourney) +
    '<p id="live-error" class="error-text" role="alert" aria-live="polite"></p>', 'LIVE TRAIN STATUS');
  const back = document.getElementById('page-back');
  if (back) back.onclick = () => goBack('search');
  const refresh = document.getElementById('refresh-button');
  if (refresh) refresh.addEventListener('click', requestRefresh);
  const next = document.getElementById('view-next-station');
  if (next) next.addEventListener('click', () => navigate('next-station'));
}
function renderNextStation() {
  if (!lastJourney || !lastJourney.nextStation) {
    shell(pageHead('Next station details', 'Track a train first to load the next station returned by RailKit.') + '<section class="panel empty"><div class="big">🚆</div><h3>No live journey loaded</h3><p>Return to train tracking and fetch live data before opening station details.</p><button class="btn green large-btn" id="empty-back">← Back to live tracking</button></section>', 'NEXT STATION');
    document.getElementById('page-back').onclick = () => goBack('live');
    document.getElementById('empty-back').onclick = () => navigate('live');
    return;
  }
  const j = lastJourney, s = j.nextStation || {}, c = j.currentLocation || {};
  const distance = s.distanceKm ?? c.distanceToNextStationKm;
  const delay = j.delayMinutes == null ? null : (j.delayMinutes > 0 ? j.delayMinutes + ' min late' : j.delayMinutes < 0 ? Math.abs(j.delayMinutes) + ' min early' : 'On time');
  const html = pageHead('Next station details', 'Station information from the latest live response for your train.') +
    '<section class="station-detail-hero"><div class="station-detail-eyebrow">UPCOMING HALT</div><div class="station-code-large">' + valueText(s.code) + '</div><h2>' + valueText(s.name || s.code) + '</h2><div class="station-detail-route"><span>' + valueText(j.trainName) + '</span><span>Train ' + valueText(j.trainNumber) + ' · ' + coachLabel() + '</span></div><div class="station-detail-grid"><div class="station-metric"><span>Estimated arrival</span><b>' + valueText(s.scheduledArrival) + '</b></div><div class="station-metric"><span>Distance</span><b>' + (distance == null ? 'Not provided' : esc(Number(distance).toLocaleString(undefined,{maximumFractionDigits:1}) + ' km')) + '</b></div><div class="station-metric"><span>Expected Platform</span><b>' + expectedPlatform(s.platform) + '</b></div></div></section><section class="panel station-detail-note"><p class="data-note">Station details are shown from the latest response. Fields not provided by RailKit are identified clearly.</p><button class="btn green wide large-btn" id="explore-stalls">Explore Stalls at This Station <span>→</span></button></section>';
  shell(html, 'NEXT STATION');
  document.getElementById('page-back').onclick = () => goBack('live');
  document.getElementById('explore-stalls').onclick = () => navigate('station-stalls');
}
function stationCacheKey() {
  const s = lastJourney?.nextStation || {};
  return String(s.code || '').trim().toUpperCase() + '|' + String(s.name || '').trim().toUpperCase();
}
function stationQuery() {
  const s = lastJourney?.nextStation || {};
  return { stationKey: s.code || '', stationName: s.name || s.code || '' };
}
function getStalls() {
  const key = stationCacheKey();
  if (stallCache.has(key)) return stallCache.get(key);
  const {stationKey, stationName} = stationQuery();
  const promise = fetch('/api/stalls?stationKey=' + encodeURIComponent(stationKey) + '&stationName=' + encodeURIComponent(stationName))
    .then(async response => {
      const data = await response.json();
      if (!response.ok || data.ok !== true) throw new Error(data.error || 'Could not load stall listings.');
      return data.stalls || [];
    })
    .catch(error => { stallCache.delete(key); throw error; });
  stallCache.set(key, promise);
  return promise;
}
function menuItems(stall) {
  let menu = stall.menu_json ?? stall.menu ?? [];
  if (typeof menu === 'string') { try { menu = JSON.parse(menu); } catch { menu = []; } }
  if (!Array.isArray(menu)) menu = Array.isArray(menu?.items) ? menu.items : [];
  return menu.map(item => typeof item === 'string' ? {name:item} : item).filter(Boolean);
}
function menuPreview(stall) {
  const menu = menuItems(stall);
  if (!menu.length) return 'Menu not provided';
  return menu.slice(0,3).map(item => {
    const name = esc(item.name || item.item || item.title || 'Menu item');
    const price = item.price === null || item.price === undefined || item.price === '' ? 'Price not provided' : '₹' + esc(item.price);
    const stock = String(item.stock_status || item.stockStatus || '').toUpperCase();
    const stockText = stock === 'IN_STOCK' ? 'In Stock' : stock === 'OUT_OF_STOCK' ? 'Out of Stock' : 'Stock status not provided';
    return name + ' · ' + price + ' · ' + stockText;
  }).join(' | ');
}
function stallAvailability(stall) {
  const status = String(stall.stall_status || '').toLowerCase();
  return status === 'open' ? 'Open' : status === 'closed' ? 'Closed' : status === 'unavailable' ? 'Unavailable' : 'Availability not provided';
}
function stallDistance(stall) {
  const value = stall.distance_km ?? stall.distanceKm ?? stall.distance;
  if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) || Number(value) < 0) return 'Distance not provided';
  return Number(value).toLocaleString(undefined,{maximumFractionDigits:2}) + ' km';
}
function renderStallCard(stall) {
  const id = String(stall.id ?? '');
  const category = stall.category || 'Category not provided';
  const platform = stall.platform_label || 'Platform not provided';
  const station = (stall.station_name || 'Station not provided') + (stall.station_key ? ' (' + stall.station_key + ')' : '');
  const coachLocation = stall.coach_location || 'Coach-related location not provided';
  const coachMatch = lastCoachNumber && new RegExp('(^|[^A-Z0-9])' + lastCoachNumber + '([^A-Z0-9]|$)').test(String(coachLocation).toUpperCase());
  const matchNote = coachMatch ? '<span class="coach-match">Coach location mentions ' + esc(lastCoachNumber) + '</span>' : '';
  const status = stallAvailability(stall);
  const statusClass = String(stall.stall_status || '').toLowerCase() === 'open' ? 'status-open' : 'status-unknown';
  const demoBadge = stall.demo_label ? '<span class="stall-status status-unknown">DEMO · NOT VERIFIED</span>' : '';
  return '<article class="stall-card"><div class="stall-card-top"><div class="stall-icon">' + esc(stall.emoji || '🥪') + '</div><div class="stall-card-main"><div class="stall-category">' + esc(category) + '</div><h3>' + valueText(stall.name) + '</h3><p>' + esc(stall.description || 'Description not provided') + '</p>' + demoBadge + '<span class="stall-status ' + statusClass + '">' + esc(status) + '</span>' + matchNote + '</div></div><div class="stall-facts"><div><span>Station / code</span><b>' + esc(station) + '</b></div><div><span>Platform</span><b>' + esc(platform) + '</b></div><div><span>Coach location served</span><b>' + esc(coachLocation) + '</b></div><div><span>Menu, prices and stock</span><b>' + menuPreview(stall) + '</b></div></div><button class="btn outline large-btn wide view-stall-btn" data-stall-id="' + esc(id) + '">View Stall Details <span>→</span></button></article>';
}
const STALL_CATEGORIES = [
  { key: 'food', label: 'Food & Meals', icon: '🍛', hint: 'Meals and filling favourites' },
  { key: 'beverages', label: 'Tea & Beverages', icon: '☕', hint: 'Tea, coffee and drinks' },
  { key: 'snacks', label: 'Snacks & Quick Bites', icon: '🥪', hint: 'Quick bites for the journey' }
];
function stallCategoryKeys(stall) {
  const value = String(stall.category || '').toLowerCase();
  const keys = [];
  if (/food|meal|breakfast|lunch|dinner|restaurant|thali/.test(value)) keys.push('food');
  if (/tea|beverage|drink|coffee|juice|chai/.test(value)) keys.push('beverages');
  if (/snack|quick.?bite|bite|fast.?food|bakery|sweet|sweets/.test(value)) keys.push('snacks');
  return keys;
}
function filteredStalls(stalls) {
  return selectedStallCategory === 'all' ? stalls : stalls.filter(stall => stallCategoryKeys(stall).includes(selectedStallCategory));
}
function categoryTiles(stalls) {
  const supported = STALL_CATEGORIES.filter(category => stalls.some(stall => stallCategoryKeys(stall).includes(category.key)));
  if (!stalls.length) return '<p class="category-unavailable">Category filters will appear when stall listings are available.</p>';
  const allTile = '<button type="button" class="category-tile ' + (selectedStallCategory === 'all' ? 'active' : '') + '" data-category="all" aria-pressed="' + (selectedStallCategory === 'all') + '"><span class="category-emoji">✨</span><span class="category-tile-copy"><b>All stalls</b><small>' + stalls.length + ' available listing' + (stalls.length === 1 ? '' : 's') + '</small></span><span class="category-arrow">↗</span></button>';
  const categoryButtons = supported.map(category => {
    const count = stalls.filter(stall => stallCategoryKeys(stall).includes(category.key)).length;
    return '<button type="button" class="category-tile ' + (selectedStallCategory === category.key ? 'active' : '') + '" data-category="' + category.key + '" aria-pressed="' + (selectedStallCategory === category.key) + '"><span class="category-emoji">' + category.icon + '</span><span class="category-tile-copy"><b>' + category.label + '</b><small>' + count + ' available listing' + (count === 1 ? '' : 's') + '</small></span><span class="category-arrow">↗</span></button>';
  }).join('');
  return '<div class="category-grid">' + allTile + categoryButtons + '</div>';
}
function renderPreviewCard(stall) {
  return '';
}
function renderDiscoverSection() {
  return '';
}
function wireCategoryTiles(host, stalls, target) {
  if (!host) return;
  host.innerHTML = categoryTiles(stalls);
  host.querySelectorAll('[data-category]').forEach(button => button.addEventListener('click', () => {
    selectedStallCategory = button.dataset.category;
    if (target === 'home') updateHomeDiscovery(stalls);
    else updateStationStalls(stalls);
  }));
}
function updateHomeDiscovery(stalls) {
  // Home-page discovery is intentionally disabled; stalls belong to the Station Stalls route.
}
function loadHomeDiscovery() {
  // Stall requests are made only after the passenger explicitly opens Station Stalls.
}

function updateStationStalls(stalls) {
  stallsById = new Map(stalls.map(stall => [String(stall.id), stall]));
  wireCategoryTiles(document.getElementById('stall-category-filters'), stalls, 'list');
  const host = document.getElementById('stalls-content');
  if (!host) return;
  const filtered = filteredStalls(stalls);
  const filterPanel = document.querySelector('.listing-filter-panel');
  if (filterPanel) filterPanel.hidden = stalls.length === 0;
  if (!filtered.length) {
    host.innerHTML = '<section class="panel empty"><div class="big">☕</div><h3>' + (stalls.length ? 'No stalls in this category yet' : 'No stall listings yet') + '</h3><p>' + (stalls.length ? 'Try another category to see available listings at ' + esc(stationTitle(lastJourney)) + '.' : 'There are currently no stall records associated with ' + esc(stationTitle(lastJourney)) + '. Listings for other stations are not shown here.') + '</p><button class="btn outline large-btn" id="stalls-back-next">← Back to station details</button></section>';
    document.getElementById('stalls-back-next').onclick = () => goBack('next-station');
    return;
  }
  host.innerHTML = '<div class="stall-results-meta">' + filtered.length + ' matching listing' + (filtered.length === 1 ? '' : 's') + ' for this station</div><div class="station-stall-list">' + filtered.map(renderStallCard).join('') + '</div><p class="data-note">Only published vendor registrations are listed. Coach labels are vendor-provided locations and do not guarantee exact physical proximity.</p>';
  host.querySelectorAll('.view-stall-btn').forEach(button => button.addEventListener('click', () => navigate('stall-details/' + encodeURIComponent(button.dataset.stallId))));
}

function renderStationStalls() {
  if (!lastJourney?.nextStation) {
    shell(pageHead('Station stalls', 'A live next station is needed to filter stall listings.') + '<section class="panel empty"><div class="big">📍</div><h3>No station selected</h3><p>Track a train first, then explore stalls at the next station.</p><button class="btn green large-btn" id="empty-back">← Back to live tracking</button></section>', 'STATION STALLS');
    document.getElementById('page-back').onclick = () => goBack('next-station');
    document.getElementById('empty-back').onclick = () => navigate('live');
    return;
  }
  const s = lastJourney.nextStation;
  shell(pageHead('Stalls at ' + (s.name || s.code || 'your next station'), 'Only listings associated with this station are shown.') +
    '<section class="station-stalls-heading"><div class="station-mini-code">' + valueText(s.code) + '</div><div><h2>' + valueText(s.name || s.code) + '</h2><p>Train ' + valueText(lastJourney.trainNumber) + ' · ' + valueText(lastJourney.trainName) + ' · ' + coachLabel() + '</p></div></section><section class="listing-filter-panel"><h3>Browse by category</h3><p>Choose a category to filter the actual listings for this station.</p><div id="stall-category-filters"></div><button type="button" class="btn outline large-btn" id="refresh-stalls">↻ Refresh listings</button></section><div id="stalls-content"></div>', 'STATION STALLS');
  document.getElementById('page-back').onclick = () => goBack('next-station');
  document.getElementById('refresh-stalls').onclick = () => {
    stallCache.delete(stationCacheKey());
    renderStationStalls();
  };
  getStalls().then(stalls => {
    if (routeName() !== 'station-stalls') return;
    updateStationStalls(stalls);
  }).catch(error => {
    if (routeName() !== 'station-stalls') return;
    const host = document.getElementById('stalls-content');
    if (host) host.innerHTML = '<section class="panel empty"><div class="big">⚠</div><h3>Could not load stalls</h3><p>' + esc(error.message || 'Please try again later.') + '</p><button class="btn outline large-btn" id="stalls-back-next">← Back to station details</button></section>';
    const back = document.getElementById('stalls-back-next');
    if (back) back.onclick = () => goBack('next-station');
  });
}
function validStallCoordinates(stall) {
  const rawLat = stall?.latitude ?? stall?.lat;
  const rawLng = stall?.longitude ?? stall?.lng;
  if (rawLat === '' || rawLat == null || rawLng === '' || rawLng == null) return null;
  const latitude = Number(rawLat), longitude = Number(rawLng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}
function mapsDestination(stall, station = {}) {
  const coordinates = validStallCoordinates(stall);
  if (coordinates) return { destination: coordinates.latitude + ',' + coordinates.longitude, exact: true };
  const stationName = stall?.station_name || station.name || station.code || '';
  const stationCode = stall?.station_key || station.code || '';
  const stationLabel = stationName + (stationCode ? ' (' + stationCode + ')' : '');
  const parts = [
    stall?.name,
    stationLabel,
    stall?.platform_label ? 'Platform ' + stall.platform_label : '',
    stall?.coach_location,
    stall?.description && !stall?.demo_label ? stall.description : '',
    stall?.directions
  ].map(v => String(v || '').trim()).filter(Boolean);
  return { destination: parts.join(', '), exact: false };
}
function openGoogleMapsDirections(stall, station = {}) {
  const destination = mapsDestination(stall, station);
  if (!destination.destination) return;
  const base = 'https://www.google.com/maps/dir/?api=1&destination=' +
    encodeURIComponent(destination.destination) + '&travelmode=walking';
  // Open synchronously from the click to avoid popup blockers during the GPS prompt.
  const mapTab = window.open('about:blank', '_blank');
  if (mapTab) {
    try { mapTab.opener = null; } catch { /* browser may protect opener */ }
  }
  const navigateMaps = url => {
    if (mapTab && !mapTab.closed) {
      try { mapTab.location.replace(url); return; } catch { /* fall through if the tab is unavailable */ }
    }
    window.location.assign(url);
  };
  if (!navigator.geolocation?.getCurrentPosition) {
    navigateMaps(base);
    return;
  }
  navigator.geolocation.getCurrentPosition(
    position => {
      const origin = Number(position.coords.latitude) + ',' + Number(position.coords.longitude);
      navigateMaps(base + '&origin=' + encodeURIComponent(origin));
    },
    () => navigateMaps(base),
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
  );
}

function renderStallDetails(id) {
  const stall = stallsById.get(String(id));
  if (!stall) {
    shell(pageHead('Stall details', 'Open a stall from the station listings to see its details.') + '<section class="panel empty"><div class="big">🥪</div><h3>Stall details unavailable</h3><p>Return to the selected station’s stall list and choose an available listing.</p><button class="btn green large-btn" id="details-back-list">← Back to station stalls</button></section>', 'STALL DETAILS');
    document.getElementById('page-back').onclick = () => goBack('station-stalls');
    document.getElementById('details-back-list').onclick = () => navigate('station-stalls');
    return;
  }
  const menu = menuItems(stall);
  const menuHtml = menu.length ? '<div class="detail-menu-list">' + menu.map(item => { const stock = String(item.stock_status || item.stockStatus || '').toUpperCase(); const stockText = stock === 'IN_STOCK' ? 'In Stock' : stock === 'OUT_OF_STOCK' ? 'Out of Stock' : 'Stock status not provided'; return '<div class="detail-menu-item"><span>' + esc(item.name || item.item || item.title || 'Menu item') + '<small>' + stockText + '</small></span><b>' + (item.price !== undefined && item.price !== null && item.price !== '' ? '₹' + esc(item.price) : 'Price not provided') + '</b></div>'; }).join('') + '</div>' : '<div class="empty-menu">Menu details have not been provided for this stall.</div>';
  const station = lastJourney?.nextStation || {};
  const platform = stall.platform_label || 'Platform not provided';
  const savedDirections = stall.directions && !/sample directions only; verify on site/i.test(String(stall.directions))
    ? stall.directions
    : (stall.demo_label ? 'Sample location only. Exact stall position is not verified.' : (stall.description || 'No detailed stall directions have been saved.'));
  const demoBanner = stall.demo_label ? '<div class="data-note"><b>DEMO DATA — NOT A VERIFIED VENDOR.</b> Names, locations, menu items and prices are illustrative examples only.</div>' : '';
  const html = pageHead('Stall details', 'Listing information for the selected station.') +
    demoBanner + '<section class="stall-detail-hero"><div class="stall-detail-icon">' + esc(stall.emoji || '🥪') + '</div><span class="stall-category">' + esc(stall.category || 'Category not provided') + '</span><h2>' + valueText(stall.name) + '</h2><p>' + esc(stall.description || 'Description not provided') + '</p><span class="stall-status">' + esc(stallAvailability(stall)) + '</span></section><section class="panel stall-detail-panel"><h3>Location at station</h3><div class="data-row"><span>Station</span><b>' + valueText(stall.station_name || station.name || station.code) + '</b></div><div class="data-row"><span>Station code</span><b>' + valueText(stall.station_key || station.code) + '</b></div><div class="data-row"><span>Platform</span><b>' + esc(platform) + '</b></div><div class="data-row"><span>Coach location served</span><b>' + valueText(stall.coach_location) + '</b></div><div class="data-row"><span>Vendor</span><b>' + valueText(stall.vendor_name) + '</b></div><div class="data-row"><span>Contact</span><b>' + valueText(stall.vendor_contact) + '</b></div><h3 class="menu-heading">Full menu</h3>' + menuHtml + '<div class="directions-note"><b>Location / directions</b><p>' + esc(savedDirections) + '</p></div>' + (validStallCoordinates(stall) ? '<div class="data-note"><b>Exact coordinates saved</b> · ' + esc(stall.latitude + ', ' + stall.longitude) + '</div>' : '<div class="data-note"><b>Station-level directions only.</b> Exact stall coordinates are not saved, so Google Maps may not know the stall’s precise position.</div>') + '<button class="btn green wide large-btn maps-directions-btn" id="google-maps-directions">Get Directions on Google Maps ↗</button><button class="btn outline wide large-btn" id="details-back-list">← Back to station stalls</button></section>';
  shell(html, 'STALL DETAILS');
  document.getElementById('page-back').onclick = () => goBack('station-stalls');
  document.getElementById('details-back-list').onclick = () => goBack('station-stalls');
  document.getElementById('google-maps-directions').onclick = () => openGoogleMapsDirections(stall, station);
}
let vendorProfile = null;
let vendorStalls = [];
let vendorEditingId = '';

async function vendorRequest(url, options = {}) {
  const response = await fetch(url, options);
  let data = {};
  try { data = await response.json(); } catch { /* handled below */ }
  if (!response.ok || data.ok !== true) throw new Error(data.error || (response.status === 401 ? 'Please sign in to use the vendor portal.' : 'The vendor request could not be completed.'));
  return data;
}
function vendorJsonOptions(method, body) {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}
function vendorSignInPage() {
  shell(pageHead('Vendor sign in', 'Sign in with your email to register and manage your own station stalls.') +
    '<section class="panel vendor-auth-panel"><div class="big">🔐</div><h2>Vendor access</h2><p>Stall registration, prices, stock and availability are saved to the shared Coach-Connect database.</p><a class="btn green wide large-btn" href="/login?next=%2F%23vendor">Sign in or create vendor account →</a></section>', 'VENDOR PORTAL');
  const back = document.getElementById('page-back');
  if (back) back.onclick = () => navigate('search');
}
function renderVendorMenuItem(stall, item) {
  const stallId = esc(stall.id);
  const itemId = esc(item.id || '');
  const stock = String(item.stock_status || item.stockStatus || '').toUpperCase();
  return '<form class="vendor-menu-edit" data-stall-id="' + stallId + '" data-item-id="' + itemId + '"><label>Item name<input name="menuName" required maxlength="100" value="' + esc(item.name || '') + '"></label><label>Price (₹)<input name="menuPrice" required type="number" min="0" max="1000000" step="0.01" value="' + esc(item.price ?? '') + '"></label><label>Stock status<select name="menuStock" required><option value="IN_STOCK" ' + (stock === 'IN_STOCK' ? 'selected' : '') + '>In Stock</option><option value="OUT_OF_STOCK" ' + (stock === 'OUT_OF_STOCK' ? 'selected' : '') + '>Out of Stock</option></select></label><div class="vendor-menu-actions"><button type="submit" class="btn outline">Save item</button><button type="button" class="btn danger vendor-delete-menu" data-stall-id="' + stallId + '" data-item-id="' + itemId + '">Delete item</button></div></form>';
}
function renderVendorStallCard(stall) {
  const menu = menuItems(stall);
  const menuHtml = menu.length ? menu.map(item => renderVendorMenuItem(stall, item)).join('') : '<p class="vendor-empty-menu">No menu items. Add an item with a price and stock status below.</p>';
  const publication = String(stall.publication_status || 'draft');
  return '<article class="panel vendor-stall-card"><div class="vendor-stall-title"><div><span class="stall-category">' + esc(stall.category) + '</span><h3>' + esc(stall.name) + '</h3><p>' + esc(stall.station_name) + ' (' + esc(stall.station_key) + ') · Platform ' + esc(stall.platform_label) + '</p></div><span class="vendor-pub-status">' + esc(publication === 'published' ? 'Published' : 'Draft') + '</span></div><div class="vendor-stall-facts"><span>Coach location: <b>' + esc(stall.coach_location || 'Not provided') + '</b></span><span>Stall status: <b>' + esc(stallAvailability(stall)) + '</b></span></div><div class="vendor-stall-actions"><button type="button" class="btn outline vendor-edit-stall" data-stall-id="' + esc(stall.id) + '">Edit stall details</button><button type="button" class="btn danger vendor-delete-stall" data-stall-id="' + esc(stall.id) + '">Delete stall</button></div><h4>Menu and stock</h4><div class="vendor-menu-list">' + menuHtml + '</div><form class="vendor-menu-add" data-stall-id="' + esc(stall.id) + '"><h4>Add menu item</h4><label>Item name<input name="menuName" required maxlength="100" placeholder="e.g. Tea"></label><label>Price (₹)<input name="menuPrice" required type="number" min="0" max="1000000" step="0.01" placeholder="e.g. 15"></label><label>Stock status<select name="menuStock" required><option value="IN_STOCK">In Stock</option><option value="OUT_OF_STOCK">Out of Stock</option></select></label><button type="submit" class="btn green">Add item</button></form></article>';
}
function bindVendorDashboard() {
  const back = document.getElementById('page-back');
  if (back) back.onclick = () => navigate('search');
  const signout = document.getElementById('vendor-signout');
  if (signout) signout.onclick = async () => { try { await window.hatchable.auth.signOut(); } finally { vendorProfile = null; vendorStalls = []; vendorSignInPage(); } };
  const profileForm = document.getElementById('vendor-profile-form');
  if (profileForm) profileForm.addEventListener('submit', async event => {
    event.preventDefault();
    const button = profileForm.querySelector('button[type=submit]');
    button.disabled = true; button.textContent = 'Saving profile…';
    const form = new FormData(profileForm);
    try {
      await vendorRequest('/api/vendor/profile', vendorJsonOptions('POST', { vendorName: form.get('vendorName'), contact: form.get('contact') }));
      await renderVendorDashboard();
    } catch (error) { const note = document.getElementById('vendor-message'); if (note) note.textContent = error.message; button.disabled = false; button.textContent = 'Save vendor profile'; }
  });
  const stallForm = document.getElementById('vendor-stall-form');
  if (stallForm) stallForm.addEventListener('submit', async event => {
    event.preventDefault();
    const button = stallForm.querySelector('button[type=submit]');
    const form = new FormData(stallForm);
    const editId = String(form.get('stallId') || '');
    const existing = vendorStalls.find(stall => String(stall.id) === editId);
    const menuItemsToSave = existing ? menuItems(existing) : [{
      name: form.get('menuItemName'), price: form.get('menuPrice'), stock_status: form.get('menuStock')
    }];
    if (!existing && !String(form.get('menuItemName') || '').trim()) {
      const note = document.getElementById('vendor-message'); if (note) note.textContent = 'Add the first menu item, its price, and its stock status.';
      return;
    }
    const payload = {
      name: form.get('name'), category: form.get('category'), stationName: form.get('stationName'),
      stationCode: form.get('stationCode'), platformLabel: form.get('platformLabel'),
      coachLocation: form.get('coachLocation'), description: form.get('description'), directions: form.get('directions'),
      stallStatus: form.get('stallStatus'), publicationStatus: form.get('publicationStatus'), menuItems: menuItemsToSave
    };
    button.disabled = true; button.textContent = editId ? 'Saving changes…' : 'Registering stall…';
    try {
      await vendorRequest('/api/vendor/stalls', vendorJsonOptions(editId ? 'PUT' : 'POST', editId ? { ...payload, id: editId } : payload));
      vendorEditingId = '';
      await renderVendorDashboard();
    } catch (error) {
      const note = document.getElementById('vendor-message'); if (note) note.textContent = error.message;
      button.disabled = false; button.textContent = editId ? 'Save stall changes' : 'Save stall';
    }
  });
  const cancel = document.getElementById('vendor-cancel-edit');
  if (cancel) cancel.onclick = () => { vendorEditingId = ''; renderVendorDashboard(); };
  document.querySelectorAll('.vendor-edit-stall').forEach(button => button.onclick = () => {
    vendorEditingId = button.dataset.stallId;
    renderVendorDashboard();
    const form = document.getElementById('vendor-stall-form');
    if (form) form.scrollIntoView({behavior:'smooth',block:'start'});
  });
  document.querySelectorAll('.vendor-delete-stall').forEach(button => button.onclick = async () => {
    const stall = vendorStalls.find(item => String(item.id) === button.dataset.stallId);
    if (!stall || !confirm('Delete "' + stall.name + '" and its menu? This cannot be undone.')) return;
    button.disabled = true;
    try { await vendorRequest('/api/vendor/stalls', vendorJsonOptions('DELETE', {id:stall.id})); vendorEditingId = ''; await renderVendorDashboard(); }
    catch (error) { alert(error.message); button.disabled = false; }
  });
  document.querySelectorAll('.vendor-menu-add').forEach(formEl => formEl.addEventListener('submit', async event => {
    event.preventDefault();
    const form = new FormData(formEl);
    const button = formEl.querySelector('button[type=submit]');
    button.disabled = true;
    try {
      await vendorRequest('/api/vendor/stalls/menu', vendorJsonOptions('POST', {stallId:formEl.dataset.stallId,name:form.get('menuName'),price:form.get('menuPrice'),stockStatus:form.get('menuStock')}));
      await renderVendorDashboard();
    } catch (error) { const note = document.getElementById('vendor-message'); if (note) note.textContent = error.message; button.disabled = false; }
  }));
  document.querySelectorAll('.vendor-menu-edit').forEach(formEl => formEl.addEventListener('submit', async event => {
    event.preventDefault();
    const form = new FormData(formEl);
    const button = formEl.querySelector('button[type=submit]');
    button.disabled = true;
    try {
      await vendorRequest('/api/vendor/stalls/menu', vendorJsonOptions('PUT', {stallId:formEl.dataset.stallId,itemId:formEl.dataset.itemId,name:form.get('menuName'),price:form.get('menuPrice'),stockStatus:form.get('menuStock')}));
      await renderVendorDashboard();
    } catch (error) { const note = document.getElementById('vendor-message'); if (note) note.textContent = error.message; button.disabled = false; }
  }));
  document.querySelectorAll('.vendor-delete-menu').forEach(button => button.onclick = async () => {
    if (!confirm('Delete this menu item?')) return;
    button.disabled = true;
    try { await vendorRequest('/api/vendor/stalls/menu', vendorJsonOptions('DELETE', {stallId:button.dataset.stallId,itemId:button.dataset.itemId})); await renderVendorDashboard(); }
    catch (error) { const note = document.getElementById('vendor-message'); if (note) note.textContent = error.message; button.disabled = false; }
  });
}
async function renderVendorDashboard() {
  if (!window.hatchable?.auth) { vendorSignInPage(); return; }
  shell(pageHead('Vendor dashboard', 'Manage your stall registrations, menu prices, stock and availability.') +
    '<section class="panel vendor-loading"><p>Checking vendor account…</p></section>', 'VENDOR PORTAL');
  let session;
  try { session = await window.hatchable.auth.getSession(); }
  catch (_) { vendorSignInPage(); return; }
  if (!session?.user) { vendorSignInPage(); return; }
  try {
    const profileData = await vendorRequest('/api/vendor/profile');
    if (routeName() !== 'vendor') return;
    vendorProfile = profileData.profile;
    if (!vendorProfile) {
      shell(pageHead('Register vendor profile', 'Set up your authenticated vendor profile before registering stalls.') +
        '<section class="panel vendor-profile-panel"><form id="vendor-profile-form"><div class="field"><label for="vendor-name">Vendor / business name</label><input id="vendor-name" name="vendorName" required minlength="2" maxlength="120" placeholder="Business name"></div><div class="field"><label for="vendor-contact">Contact phone or email</label><input id="vendor-contact" name="contact" required minlength="7" maxlength="80" placeholder="Phone number or email"></div><p id="vendor-message" class="error-text" role="alert"></p><button type="submit" class="btn green large-btn">Save vendor profile</button></form></section>', 'VENDOR PORTAL');
      bindVendorDashboard();
      return;
    }
    const stallsData = await vendorRequest('/api/vendor/stalls');
    if (routeName() !== 'vendor') return;
    vendorStalls = stallsData.stalls || [];
    const editing = vendorStalls.find(stall => String(stall.id) === vendorEditingId);
    const current = editing || {};
    const profile = vendorProfile;
    const categories = [{value:'food',label:'Food & Meals'},{value:'beverages',label:'Tea & Beverages'},{value:'snacks',label:'Snacks & Quick Bites'},{value:'groceries',label:'Groceries / Essentials'},{value:'other',label:'Other'}];
    const categoryOptions = categories.map(item => '<option value="' + item.value + '" ' + (current.category === item.value ? 'selected' : '') + '>' + item.label + '</option>').join('');
    const stallForm = '<section class="panel vendor-stall-form-panel"><div class="vendor-section-title"><div><h2>' + (editing ? 'Edit stall' : 'Register a stall') + '</h2><p>Published stalls become visible to passengers at the exact registered station.</p></div></div><form id="vendor-stall-form"><input type="hidden" name="stallId" value="' + esc(current.id || '') + '"><div class="vendor-form-grid"><div class="field"><label for="vendor-owner-name">Vendor / business name</label><input id="vendor-owner-name" name="vendorName" required readonly value="' + esc(profile.vendor_name) + '"></div><div class="field"><label for="vendor-owner-contact">Vendor contact</label><input id="vendor-owner-contact" name="vendorContact" required readonly value="' + esc(profile.contact) + '"></div><div class="field"><label for="vendor-stall-name">Stall name</label><input id="vendor-stall-name" name="name" required maxlength="120" value="' + esc(current.name || '') + '"></div><div class="field"><label for="vendor-stall-category">Category</label><select id="vendor-stall-category" name="category" required><option value="">Choose category</option>' + categoryOptions + '</select></div><div class="field"><label for="vendor-station-name">Station name</label><input id="vendor-station-name" name="stationName" required maxlength="160" value="' + esc(current.station_name || '') + '"></div><div class="field"><label for="vendor-station-code">Station code</label><input id="vendor-station-code" name="stationCode" required maxlength="20" value="' + esc(current.station_key || '') + '"></div><div class="field"><label for="vendor-platform">Platform number</label><input id="vendor-platform" name="platformLabel" required maxlength="40" value="' + esc(current.platform_label || '') + '"></div><div class="field"><label for="vendor-coach-location">Coach number / coach-side location served</label><input id="vendor-coach-location" name="coachLocation" required maxlength="100" placeholder="e.g. S1 side, coach S1, near coach entry" value="' + esc(current.coach_location || '') + '"></div><div class="field"><label for="vendor-description">Stall description</label><input id="vendor-description" name="description" maxlength="500" value="' + esc(current.description || '') + '"></div><div class="field"><label for="vendor-directions">Location / directions (if known)</label><input id="vendor-directions" name="directions" maxlength="500" placeholder="Vendor-provided directions; do not guess" value="' + esc(current.directions || '') + '"></div><div class="field"><label for="vendor-stall-status">Stall availability</label><select id="vendor-stall-status" name="stallStatus"><option value="unavailable" ' + (!current.stall_status || current.stall_status === 'unavailable' ? 'selected' : '') + '>Unavailable / not confirmed</option><option value="open" ' + (current.stall_status === 'open' ? 'selected' : '') + '>Open</option><option value="closed" ' + (current.stall_status === 'closed' ? 'selected' : '') + '>Closed</option></select></div><div class="field"><label for="vendor-publication">Passenger visibility</label><select id="vendor-publication" name="publicationStatus"><option value="draft" ' + (!current.publication_status || current.publication_status === 'draft' ? 'selected' : '') + '>Save as draft</option><option value="published" ' + (current.publication_status === 'published' ? 'selected' : '') + '>Publish to passengers</option></select></div></div>' +
      (!editing ? '<fieldset class="vendor-first-menu"><legend>First menu item (required)</legend><div class="vendor-form-grid"><div class="field"><label for="vendor-first-menu-name">Item name</label><input id="vendor-first-menu-name" name="menuItemName" required maxlength="100" placeholder="e.g. Tea"></div><div class="field"><label for="vendor-first-menu-price">Price (₹)</label><input id="vendor-first-menu-price" name="menuPrice" required type="number" min="0" max="1000000" step="0.01" placeholder="e.g. 15"></div><div class="field"><label for="vendor-first-menu-stock">Stock status</label><select id="vendor-first-menu-stock" name="menuStock"><option value="IN_STOCK">In Stock</option><option value="OUT_OF_STOCK">Out of Stock</option></select></div></div></fieldset>' : '<p class="form-hint">Manage menu items below. Existing menu and stock values will be preserved when you save stall details.</p>') +
      '<p id="vendor-message" class="error-text" role="alert"></p><div class="vendor-form-actions"><button type="submit" class="btn green large-btn">' + (editing ? 'Save stall changes' : 'Save stall') + '</button>' + (editing ? '<button type="button" class="btn outline large-btn" id="vendor-cancel-edit">Cancel edit</button>' : '') + '</div></form></section>';
    const stallList = vendorStalls.length ? vendorStalls.map(renderVendorStallCard).join('') : '<section class="panel empty"><div class="big">🥪</div><h3>No stalls registered yet</h3><p>Register your first stall above. It will appear to passengers only when published.</p></section>';
    shell(pageHead('Vendor dashboard', 'Manage your stall registrations, menu prices, stock and availability.') +
      '<section class="panel vendor-profile-summary"><div><span class="eyebrow">SIGNED IN VENDOR</span><h2>' + esc(profile.vendor_name) + '</h2><p>' + esc(profile.contact) + '</p></div><button type="button" id="vendor-signout" class="btn outline">Sign out</button></section>' +
      stallForm + '<section class="vendor-list-section"><div class="vendor-section-title"><div><h2>Your stalls</h2><p>Only records owned by this signed-in vendor are shown here.</p></div><span class="vendor-count">' + vendorStalls.length + '</span></div><p id="vendor-message-list" class="error-text" role="alert"></p>' + stallList + '</section>' +
      '<section class="panel vendor-profile-panel"><h3>Vendor profile</h3><form id="vendor-profile-form"><div class="vendor-form-grid"><div class="field"><label for="vendor-name">Vendor / business name</label><input id="vendor-name" name="vendorName" required minlength="2" maxlength="120" value="' + esc(profile.vendor_name) + '"></div><div class="field"><label for="vendor-contact">Contact phone or email</label><input id="vendor-contact" name="contact" required minlength="7" maxlength="80" value="' + esc(profile.contact) + '"></div></div><button type="submit" class="btn outline large-btn">Save vendor profile</button></form></section>', 'VENDOR PORTAL');
    bindVendorDashboard();
  } catch (error) {
    if (routeName() !== 'vendor') return;
    shell(pageHead('Vendor dashboard', 'Your stall management is protected by your sign-in.') +
      '<section class="panel empty"><div class="big">⚠</div><h3>Could not load vendor data</h3><p>' + esc(error.message || 'Please try again.') + '</p><button class="btn outline large-btn" id="vendor-retry">Try again</button><a class="btn green large-btn" href="/login?next=%2F%23vendor">Sign in</a></section>', 'VENDOR PORTAL');
    document.getElementById('page-back').onclick = () => navigate('search');
    document.getElementById('vendor-retry').onclick = () => renderVendorDashboard();
  }
}

function renderRoute() {
  const parts = routeParts();
  const route = parts[0] || 'search';
  if (route === 'vendor') { window.location.replace('/vendor.html'); return; }
  if (route === 'search') return renderHome();
  if (route === 'live') return renderLiveStatus();
  if (route === 'next-station') return renderNextStation();
  if (route === 'station-stalls') return renderStationStalls();
  if (route === 'stall-details') return renderStallDetails(decodeURIComponent(parts.slice(1).join('/') || ''));
  navigate('search');
}
window.addEventListener('popstate', renderRoute);
window.addEventListener('hashchange', renderRoute);
renderRoute();