const fs = require('fs');
const path = require('path');
const INTEL = path.join(__dirname, '..', 'data', 'latest-intel.json');
const HTML = path.join(__dirname, '..', 'index.html');
const STATE = path.join(__dirname, '..', 'data', 'dashboard-state.json');

function loadState() {
  if (fs.existsSync(STATE)) return JSON.parse(fs.readFileSync(STATE, 'utf8'));
  return null;
}

function saveState(s) {
  const d = path.dirname(STATE);
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(STATE, JSON.stringify(s, null, 2));
}

function mergeByKey(existing, incoming, key) {
  if (!incoming || !incoming.length) return existing || [];
  const seen = new Set((existing || []).map(i => i[key]));
  const fresh = incoming.filter(i => !seen.has(i[key]));
  fresh.forEach(i => { i.isNew = true; });
  (existing || []).forEach(i => { i.isNew = false; });
  return [...fresh, ...(existing || [])];
}

function run() {
  console.log('Updating dashboard...');
  if (!fs.existsSync(INTEL)) { console.log('No intel file.'); return; }
  const intel = JSON.parse(fs.readFileSync(INTEL, 'utf8'));
  if (!intel.fetched) { console.log('Fetch failed. Skip.'); return; }

  // Load existing state or extract from HTML
  let state = loadState();
  if (!state) {
    console.log('No state file. Initializing from HTML...');
    const html = fs.readFileSync(HTML, 'utf8');
    const m = html.match(/const DASHBOARD_DATA = ({[\s\S]*?});/);
    if (m) { try { state = eval('(' + m[1] + ')'); } catch (e) { state = {}; } }
    else state = {};
  }

  // Initialize arrays if missing
  state.threats = state.threats || [];
  state.vulns = state.vulns || [];
  state.financials = state.financials || [];
  state.breakingNews = state.breakingNews || [];
  state.execSummaries = state.execSummaries || [];
  state.changelog = state.changelog || [];
  state.fair = state.fair || [];
  state.actions = state.actions || [];

  // Merge threats, vulns, financials (dedup by key)
  if (intel.threats && intel.threats.length) {
    state.threats = mergeByKey(state.threats, intel.threats, 'name');
    console.log(`  Threats: +${intel.threats.filter(t => !state.threats.find(s => s.name === t.name && !s.isNew)).length || intel.threats.length}`);
  }
  if (intel.vulns && intel.vulns.length) {
    state.vulns = mergeByKey(state.vulns, intel.vulns, 'cve');
    console.log(`  Vulns merged`);
  }
  if (intel.financials && intel.financials.length) {
    state.financials = mergeByKey(state.financials, intel.financials, 'name');
    console.log(`  Financials merged`);
  }

  // Breaking News: APPEND new articles, keep last 30 days (max 90 articles)
  if (intel.breakingNews && intel.breakingNews.length) {
    // Add to front (newest first)
    state.breakingNews = [...intel.breakingNews, ...state.breakingNews];
    // Cap at 90 articles
    if (state.breakingNews.length > 90) state.breakingNews = state.breakingNews.slice(0, 90);
    console.log(`  Breaking News: +${intel.breakingNews.length} (total: ${state.breakingNews.length})`);
  }

  // Executive Summary: APPEND if present (weekly on Mondays)
  if (intel.execSummary) {
    // Check if we already have one for this date
    const exists = state.execSummaries.some(s => s.date === intel.execSummary.date);
    if (!exists) {
      state.execSummaries = [intel.execSummary, ...state.execSummaries];
      console.log(`  Exec Summary: NEW for ${intel.execSummary.date}`);
    } else {
      console.log(`  Exec Summary: already exists for ${intel.execSummary.date}`);
    }
  }

  // Changelog: prepend new entries
  if (intel.changelog && intel.changelog.length) {
    state.changelog = [...intel.changelog, ...state.changelog];
    // Cap at 200 entries
    if (state.changelog.length > 200) state.changelog = state.changelog.slice(0, 200);
  }

  // Update alert text if we have a summary
  if (intel.summary) state.alertText = intel.summary;
  if (intel.summary_en) state.alertText_en = intel.summary_en;

  // Timestamp
  state.lastUpdate = new Date().toISOString();

  // Write back to HTML
  let html = fs.readFileSync(HTML, 'utf8');
  const dataJson = JSON.stringify(state, null, 4).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
  html = html.replace(
    /const DASHBOARD_DATA = {[\s\S]*?};/,
    `const DASHBOARD_DATA = ${dataJson};`
  );

  // Update alert banner with latest summary
  if (intel.summary) {
    html = html.replace(
      /(<div class="alert-content">\s*<h3>)[^<]*(<\/h3>\s*<p>)[^<]*(<\/p>)/,
      `$1${(intel.summary || '').substring(0, 60)}...$2${intel.summary.replace(/"/g, '&quot;')}$3`
    );
  }

  fs.writeFileSync(HTML, html);
  saveState(state);
  console.log('Dashboard updated. State saved.');
  console.log(`  Total: ${state.threats.length} threats, ${state.vulns.length} vulns, ${state.breakingNews.length} news, ${state.execSummaries.length} exec reports`);
}

run();
