const app = document.getElementById('app');
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let lastJourney = (() => { try { return JSON.parse(sessionStorage.getItem('coachJourney') || 'null'); } catch { return null; } })();
let lastTrainNumber = String(lastJourney?.trainNumber || '');
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
function stationTitle(j) {
  return j?.nextStation?.name || j?.nextStation?.code || 'Next station details';
}
function renderHome(error = '') {
  shell('<div class="page-head"><h1>Train search</h1><p>Enter your train number to fetch the latest status reported by RailKit.</p></div>' +
    '<section class="panel tracker-panel search-only-panel"><form id="track-form"><div class="field"><label for="train-number">Train number</label><input id="train-number" name="trainNumber" inputmode="numeric" autocomplete="off" maxlength="5" pattern="[0-9]{5}" placeholder="Enter 5-digit train number" value="' + esc(lastTrainNumber) + '" required></div><p id="form-error" class="error-text" role="alert">' + esc(error) + '</p><button id="track-button" class="btn primary wide large-btn" type="submit">Fetch Live Train Status <span>→</span></button></form></section>', 'TRAIN SEARCH');
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
  return '<section id="journey-result" class="journey-result"><div class="result-heading"><div><span class="tag ' + (j.live ? 'live' : '') + '">' + liveText + '</span><h2 class="train-name">' + valueText(j.trainName) + '</h2><p class="train-number-label">Train number ' + valueText(j.trainNumber) + '</p></div><button type="button" class="btn outline large-btn" id="refresh-button">↻ Refresh</button></div><div class="route-summary"><div class="station-block"><small>Source</small><b>' + sourceText + '</b></div><span class="route-arrow">→</span><div class="station-block right"><small>Destination</small><b>' + destText + '</b></div></div><div class="next-stop-live"><div class="next-kicker">NEXT HALT · RAILKIT</div><h3>' + valueText(next.name || next.code) + '</h3><div class="station-code">' + valueText(next.code) + '</div><div class="next-metrics"><div><small>Distance to halt</small><b>' + (distanceValue == null ? 'Not provided' : esc(Number(distanceValue).toLocaleString(undefined, {maximumFractionDigits:1}) + ' km')) + '</b></div><div><small>Platform</small><b>' + valueText(next.platform) + '</b></div><div><small>Arrival time</small><b>' + valueText(next.scheduledArrival) + '</b></div></div></div><div class="section-head compact"><div><h2>Current train status</h2><p>Values below are taken from the latest API response.</p></div></div><div class="live-details"><div class="data-row"><span>Current reported location</span><b class="data-emphasis">' + valueText(current.name) + (current.code ? ' (' + esc(current.code) + ')' : '') + '</b></div><div class="data-row"><span>Movement status</span><b>' + valueText(current.status || j.status) + '</b></div><div class="data-row"><span>Delay</span><b class="' + (j.delayMinutes > 0 ? 'delay' : '') + '">' + esc(delay) + '</b></div><!-- Optional provider metadata omitted from the focused live-status page --></div><button type="button" id="view-next-station" class="btn green large-btn wide view-next-btn">View Next Station <span>→</span></button><p class="data-note">Live position and estimates may change. Select Refresh to fetch a new response.</p></section>';
}
async function onTrack(event) {
  // Navigation is deferred until the API returns a valid journey.
  event.preventDefault();
  const input = document.getElementById('train-number');
  const error = document.getElementById('form-error');
  const button = document.getElementById('track-button');
  const trainNumber = input.value.trim();
  if (!/^\d{5}$/.test(trainNumber)) { error.textContent = 'Enter a valid 5-digit train number.'; return; }
  lastTrainNumber = trainNumber;
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
    '<section class="station-detail-hero"><div class="station-detail-eyebrow">UPCOMING HALT</div><div class="station-code-large">' + valueText(s.code) + '</div><h2>' + valueText(s.name || s.code) + '</h2><div class="station-detail-route"><span>' + valueText(j.trainName) + '</span><span>Train ' + valueText(j.trainNumber) + '</span></div><div class="station-detail-grid"><div class="station-metric"><span>Estimated arrival</span><b>' + valueText(s.scheduledArrival) + '</b></div><div class="station-metric"><span>Distance</span><b>' + (distance == null ? 'Not provided' : esc(Number(distance).toLocaleString(undefined,{maximumFractionDigits:1}) + ' km')) + '</b></div><div class="station-metric"><span>Platform</span><b>' + valueText(s.platform) + '</b></div></div></section><section class="panel station-detail-note"><p class="data-note">Station details are shown from the latest response. Fields not provided by RailKit are identified clearly.</p><button class="btn green wide large-btn" id="explore-stalls">Explore Stalls at This Station <span>→</span></button></section>';
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
  return menu.slice(0,3).map(item => esc(item.name || item.item || item.title || 'Menu item')).join(' · ');
}
function stallDistance(stall) {
  const value = stall.distance_km ?? stall.distanceKm ?? stall.distance;
  if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) || Number(value) < 0) return 'Distance not provided';
  return Number(value).toLocaleString(undefined,{maximumFractionDigits:2}) + ' km';
}
function renderStallCard(stall) {
  const id = String(stall.id ?? '');
  const category = stall.category || 'Category not provided';
  const platform = stall.platform_label || stall.platform || stall.location || 'Location not provided';
  const demo = stall.demo_label && !/^(real|verified|live)$/i.test(String(stall.demo_label).trim()) ? '<span class="demo-pill">' + esc(stall.demo_label) + '</span>' : '';
  return '<article class="stall-card"><div class="stall-card-top"><div class="stall-icon">' + esc(stall.emoji || '🥪') + '</div><div class="stall-card-main"><div class="stall-category">' + esc(category) + '</div><h3>' + valueText(stall.name) + '</h3><p>' + esc(stall.description || 'Description not provided') + '</p>' + demo + '</div></div><div class="stall-facts"><div><span>Platform / location</span><b>' + esc(platform) + '</b></div><div><span>Distance</span><b>' + esc(stallDistance(stall)) + '</b></div><div><span>Menu</span><b>' + menuPreview(stall) + '</b></div></div><button class="btn outline large-btn wide view-stall-btn" data-stall-id="' + esc(id) + '">View Stall Details <span>→</span></button></article>';
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
  if (!filtered.length) {
    host.innerHTML = '<section class="panel empty"><div class="big">☕</div><h3>' + (stalls.length ? 'No stalls in this category yet' : 'No stall listings yet') + '</h3><p>' + (stalls.length ? 'Try another category to see available listings at ' + esc(stationTitle(lastJourney)) + '.' : 'There are currently no stall records associated with ' + esc(stationTitle(lastJourney)) + '. Listings for other stations are not shown here.') + '</p><button class="btn outline large-btn" id="stalls-back-next">← Back to station details</button></section>';
    document.getElementById('stalls-back-next').onclick = () => goBack('next-station');
    return;
  }
  host.innerHTML = '<div class="stall-results-meta">' + filtered.length + ' matching listing' + (filtered.length === 1 ? '' : 's') + ' for this station</div><div class="station-stall-list">' + filtered.map(renderStallCard).join('') + '</div><p class="data-note">Listings marked Demo are sample records and are not verified vendors. Distances are shown only when present in the listing data.</p>';
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
    '<section class="station-stalls-heading"><div class="station-mini-code">' + valueText(s.code) + '</div><div><h2>' + valueText(s.name || s.code) + '</h2><p>Train ' + valueText(lastJourney.trainNumber) + ' · ' + valueText(lastJourney.trainName) + '</p></div></section><section class="listing-filter-panel"><h3>Browse by category</h3><p>Choose a category to filter the actual listings for this station.</p><div id="stall-category-filters"></div></section><div id="stalls-content"></div>', 'STATION STALLS');
  document.getElementById('page-back').onclick = () => goBack('next-station');
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
function renderStallDetails(id) {
  const stall = stallsById.get(String(id));
  if (!stall) {
    shell(pageHead('Stall details', 'Open a stall from the station listings to see its details.') + '<section class="panel empty"><div class="big">🥪</div><h3>Stall details unavailable</h3><p>Return to the selected station’s stall list and choose an available listing.</p><button class="btn green large-btn" id="details-back-list">← Back to station stalls</button></section>', 'STALL DETAILS');
    document.getElementById('page-back').onclick = () => goBack('station-stalls');
    document.getElementById('details-back-list').onclick = () => navigate('station-stalls');
    return;
  }
  const menu = menuItems(stall);
  const menuHtml = menu.length ? '<div class="detail-menu-list">' + menu.map(item => '<div class="detail-menu-item"><span>' + esc(item.name || item.item || item.title || 'Menu item') + '</span>' + (item.price !== undefined && item.price !== null && item.price !== '' ? '<b>' + esc(item.price) + '</b>' : '') + '</div>').join('') + '</div>' : '<div class="empty-menu">Menu details have not been provided for this stall.</div>';
  const station = lastJourney?.nextStation || {};
  const platform = stall.platform_label || stall.platform || stall.location || 'Location not provided';
  const html = pageHead('Stall details', 'Listing information for the selected station.') +
    '<section class="stall-detail-hero"><div class="stall-detail-icon">' + esc(stall.emoji || '🥪') + '</div><span class="stall-category">' + esc(stall.category || 'Category not provided') + '</span><h2>' + valueText(stall.name) + '</h2><p>' + esc(stall.description || 'Description not provided') + '</p>' + (stall.demo_label ? '<span class="demo-pill">' + esc(stall.demo_label) + '</span>' : '') + '</section><section class="panel stall-detail-panel"><h3>Location at station</h3><div class="data-row"><span>Station</span><b>' + valueText(stall.station_name || station.name || station.code) + '</b></div><div class="data-row"><span>Station code</span><b>' + valueText(station.code) + '</b></div><div class="data-row"><span>Platform / location</span><b>' + esc(platform) + '</b></div><div class="data-row"><span>Distance</span><b>' + esc(stallDistance(stall)) + '</b></div><h3 class="menu-heading">Menu</h3>' + menuHtml + '<div class="directions-note"><b>Finding this stall</b><p>Use the platform/location information above. Walking directions are not provided unless verified location or distance data is available in this listing.</p></div><button class="btn green wide large-btn" id="details-back-list">← Back to station stalls</button></section>';
  shell(html, 'STALL DETAILS');
  document.getElementById('page-back').onclick = () => goBack('station-stalls');
  document.getElementById('details-back-list').onclick = () => goBack('station-stalls');
}
function renderRoute() {
  const parts = routeParts();
  const route = parts[0] || 'search';
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