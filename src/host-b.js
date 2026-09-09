import { createClient } from './transport.js';
const client = createClient();
const $ = id => document.getElementById(id);
let current = null;
const cacheKey = id => `neuralbridge-host-b-preferences:${id}`;
function show(entry, text) { $('preferences').textContent = JSON.stringify(entry?.preferences || {}, null, 2); $('status').textContent = text; }
$('sync').addEventListener('click', async () => {
  $('target').disabled = true; current = null; const id = $('profile-id').value.trim();
  try { current = await client.getProfile(id); localStorage.setItem(cacheKey(id), JSON.stringify(current)); show(current, `Fetched version ${current.version}. Local interaction check required.`); $('target').disabled = false; }
  catch (error) { if (error.status) localStorage.removeItem(cacheKey(id)); show(null, error.message); }
});
$('offline').addEventListener('click', () => {
  current = null; $('target').disabled = true;
  try { const entry = JSON.parse(localStorage.getItem(cacheKey($('profile-id').value.trim()))); show(entry, entry ? 'Cached preferences only. Offline authorization is unknown; local validation unavailable.' : 'No cached preferences.'); }
  catch { show(null, 'Cache unavailable.'); }
});
$('profile-id').addEventListener('input', () => { current = null; $('target').disabled = true; });
$('target').addEventListener('click', async event => {
  if (!event.isTrusted || !current) return;
  const checked = current; $('target').disabled = true;
  try {
    const latest = await client.getProfile(checked.id);
    if (latest.version !== checked.version) { current = null; show(latest, 'Profile changed. Fetch again and repeat the local check.'); return; }
    show(latest, `Host B interaction locally validated for version ${latest.version} by your target activation. Device calibration has not been transferred.`);
  } catch (error) { current = null; localStorage.removeItem(cacheKey(checked.id)); show(null, error.message); }
});
