const app = document.getElementById('app');
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let lastTrainNumber = '';
let lastJourney = null;
function shell(content) {
  app.innerHTML = '<header class="top"><div class="brand"><span class="logo">↗</span>Coach-Connect</div><span class="tag">LIVE TRAIN STATUS</span></header><main class="wrap">' + content + '<footer class="footer"><span>Coach-Connect · Live status provided by RailKit</span><span>Always follow official railway announcements and station displays.</span></footer></main>';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function renderHome(error = '') {
  shell('<section class="hero"><div><div class="eyebrow">Live railway information</div><h1>Find your train’s<br><em>next station.</em></h1><p>Enter a train number to fetch its current reported location, next halt, distance, delay, and latest status from RailKit.</p><div class="feature-strip"><span>↗ Live API data</span><span>◎ Current location</span><span>⌁ Next halt</span></div></div><div class="hero-illustration"><div class="orbit"><div class="train-tile"><div class="emoji">🚆</div><b>Live train tracker</b><small>Train number → Next station</small></div></div></div></section><div class="section-head"><div><h2>Track a train</h2><p>One train number. The latest status available from RailKit.</p></div></div><section class="panel tracker-panel"><form id="track-form"><div class="field"><label for="train-number">Train number</label><input id="train-number" name="trainNumber" inputmode="numeric" autocomplete="off" maxlength="5" pattern="[0-9]{5}" placeholder="Enter 5-digit train number e.g. 12951" value="' + esc(lastTrainNumber) + '" required><small>We’ll use today’s date in Indian Standard Time. No GPS or coach details needed.</small></div><p id="form-error" class="error-text" role="alert">' + esc(error) + '</p><button id="track-button" class="btn primary" type="submit">⌁ Fetch live train status <span>→</span></button><div class="loading-bar hidden" id="loading" role="status"><span class="spinner"></span>Requesting live data from RailKit…</div></form></section>' + (lastJourney ? renderJourney(lastJourney) : '') );
  document.getElementById('track-form').addEventListener('submit', onTrack);
}
function renderJourney(j) {
  const liveText = j.live ? 'LIVE STATUS' : 'RAILKIT STATUS';
  const liveClass = j.live ? 'tag live' : 'tag';
  const sourceText = j.source?.name ? esc(j.source.name) + (j.source.code ? ' (' + esc(j.source.code) + ')' : '') : 'Not provided by RailKit';
  const destText = j.destination?.name ? esc(j.destination.name) + (j.destination.code ? ' (' + esc(j.destination.code) + ')' : '') : 'Not provided by RailKit';
  const current = j.currentLocation || {};
  const next = j.nextStation || {};
  const distance = next.distanceKm != null ? Number(next.distanceKm).toLocaleString(undefined, { maximumFractionDigits: 1 }) + ' km' : (current.distanceToNextStationKm != null ? Number(current.distanceToNextStationKm).toLocaleString(undefined, { maximumFractionDigits: 1 }) + ' km' : 'Not provided');
  const delay = j.delayMinutes == null ? 'Not provided' : (j.delayMinutes > 0 ? j.delayMinutes + ' min late' : j.delayMinutes < 0 ? Math.abs(j.delayMinutes) + ' min early' : 'On time');
  const updated = j.lastUpdatedAt || j.fetchedAt || '';
  const updatedText = updated ? esc(updated) : 'Not provided by RailKit';
  return '<section id="journey-result" class="journey-result"><div class="result-heading"><div><span class="' + liveClass + '">' + liveText + '</span><h2>' + esc(j.trainName) + '</h2><p>Train number ' + esc(j.trainNumber) + '</p></div><button type="button" class="btn outline" id="refresh-button">↻ Refresh</button></div><div class="route-summary"><div class="station-block"><small>Source</small><b>' + sourceText + '</b></div><span class="route-arrow">→</span><div class="station-block right"><small>Destination</small><b>' + destText + '</b></div></div><div class="next-stop-live"><div class="next-kicker">NEXT HALT · RAILKIT</div><h3>' + esc(next.name || 'Next station not returned') + '</h3><div class="station-code">' + esc(next.code || 'Station code unavailable') + '</div><div class="next-metrics"><div><small>Distance to halt</small><b>' + esc(distance) + '</b></div><div><small>Platform</small><b>' + esc(next.platform || 'Not provided') + '</b></div><div><small>Arrival time</small><b>' + esc(next.scheduledArrival || 'Not provided') + '</b></div></div></div><div class="section-head compact"><div><h2>Current train status</h2><p>Details returned by the live tracking service.</p></div></div><div class="live-details"><div class="data-row"><span>Current reported location</span><b>' + esc(current.name || 'Not provided by RailKit') + (current.code ? ' (' + esc(current.code) + ')' : '') + '</b></div><div class="data-row"><span>Movement status</span><b>' + esc(current.status || j.status || 'Not provided') + '</b></div><div class="data-row"><span>Delay</span><b class="' + (j.delayMinutes > 0 ? 'delay' : '') + '">' + esc(delay) + '</b></div><div class="data-row"><span>Train status text</span><b>' + esc(j.statusText || j.status || 'Not provided') + '</b></div><div class="data-row"><span>RailKit last updated</span><b>' + updatedText + '</b></div></div><p class="data-note">This is the latest response fetched from RailKit, not a guaranteed second-by-second GPS feed. Use Refresh to request new data.</p></section>';
}
async function onTrack(event) {
  event.preventDefault();
  const input = document.getElementById('train-number');
  const error = document.getElementById('form-error');
  const button = document.getElementById('track-button');
  const loading = document.getElementById('loading');
  const trainNumber = input.value.trim();
  if (!/^\d{5}$/.test(trainNumber)) { error.textContent = 'Enter a valid 5-digit train number.'; return; }
  lastTrainNumber = trainNumber;
  error.textContent = '';
  button.disabled = true;
  loading.classList.remove('hidden');
  document.getElementById('journey-result')?.remove();
  try {
    const response = await fetch('/api/journey', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trainNumber }) });
    const data = await response.json();
    if (!response.ok || data.ok !== true || !data.journey) throw new Error(data.error || 'Live status was not returned for this train.');
    lastJourney = data.journey;
    const result = document.createElement('div');
    result.innerHTML = renderJourney(lastJourney);
    document.querySelector('.tracker-panel').insertAdjacentElement('afterend', result.firstElementChild);
    document.getElementById('refresh-button').addEventListener('click', () => requestRefresh());
  } catch (e) {
    error.textContent = e?.message || 'Could not fetch live train status. Try again.';
  } finally {
    button.disabled = false;
    loading.classList.add('hidden');
  }
}
async function requestRefresh() {
  if (!lastTrainNumber) return;
  const error = document.getElementById('form-error');
  const refresh = document.getElementById('refresh-button');
  if (refresh) { refresh.disabled = true; refresh.textContent = 'Fetching…'; }
  error.textContent = '';
  try {
    const response = await fetch('/api/journey', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trainNumber: lastTrainNumber }) });
    const data = await response.json();
    if (!response.ok || data.ok !== true || !data.journey) throw new Error(data.error || 'Live status was not returned.');
    lastJourney = data.journey;
    const holder = document.createElement('div'); holder.innerHTML = renderJourney(lastJourney);
    document.getElementById('journey-result')?.replaceWith(holder.firstElementChild);
    document.getElementById('refresh-button').addEventListener('click', requestRefresh);
  } catch (e) {
    error.textContent = e?.message || 'Could not refresh live status.';
  } finally {
    const b = document.getElementById('refresh-button'); if (b) { b.disabled = false; b.textContent = '↻ Refresh'; }
  }
}
renderHome();