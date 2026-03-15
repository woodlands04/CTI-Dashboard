/**
 * update-dashboard.js
 * 
 * Reads the latest intelligence from data/latest-intel.json,
 * merges it with existing dashboard data, and updates index.html.
 * 
 * This ensures the dashboard is a "living document" that accumulates
 * historical findings while highlighting new ones.
 */

const fs = require('fs');
const path = require('path');

const INTEL_PATH = path.join(__dirname, '..', 'data', 'latest-intel.json');
const HTML_PATH = path.join(__dirname, '..', 'index.html');
const STATE_PATH = path.join(__dirname, '..', 'data', 'dashboard-state.json');

function loadState() {
  if (fs.existsSync(STATE_PATH)) {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
  }
  return null;
}

function saveState(state) {
  const dataDir = path.dirname(STATE_PATH);
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function mergeArrays(existing, incoming, keyField) {
  if (!incoming || incoming.length === 0) return existing;
  
  const existingKeys = new Set(existing.map(item => item[keyField]));
  const newItems = incoming.filter(item => !existingKeys.has(item[keyField]));
  
  // Mark new items
  newItems.forEach(item => { item.isNew = true; });
  
  // Remove isNew flag from old items (older than 48h would be handled by date check in real impl)
  existing.forEach(item => { item.isNew = false; });
  
  return [...newItems, ...existing];
}

function updateDashboard() {
  console.log('📊 Updating dashboard...');

  // Load latest intel
  if (!fs.existsSync(INTEL_PATH)) {
    console.log('⚠️  No intel file found. Skipping update.');
    return;
  }

  const intel = JSON.parse(fs.readFileSync(INTEL_PATH, 'utf8'));

  if (!intel.fetched) {
    console.log('⚠️  Intel fetch was unsuccessful. Skipping merge.');
    return;
  }

  // Load existing state or use current HTML data
  let state = loadState();
  
  if (!state) {
    console.log('📝 No existing state. Initializing from current dashboard data.');
    // Extract DASHBOARD_DATA from HTML as initial state
    const html = fs.readFileSync(HTML_PATH, 'utf8');
    const match = html.match(/const DASHBOARD_DATA = ({[\s\S]*?});/);
    if (match) {
      try {
        // Use eval in a controlled way to parse the JS object literal
        state = eval('(' + match[1] + ')');
      } catch (e) {
        console.error('Could not parse existing dashboard data:', e.message);
        state = { threats: [], vulns: [], financials: [], fair: [], actions: [], changelog: [] };
      }
    } else {
      state = { threats: [], vulns: [], financials: [], fair: [], actions: [], changelog: [] };
    }
  }

  // Merge new data
  if (intel.threats && intel.threats.length > 0) {
    state.threats = mergeArrays(state.threats || [], intel.threats, 'name');
    console.log(`   Merged ${intel.threats.length} threat(s)`);
  }

  if (intel.vulns && intel.vulns.length > 0) {
    state.vulns = mergeArrays(state.vulns || [], intel.vulns, 'cve');
    console.log(`   Merged ${intel.vulns.length} vulnerability/ies`);
  }

  if (intel.financials && intel.financials.length > 0) {
    state.financials = mergeArrays(state.financials || [], intel.financials, 'name');
    console.log(`   Merged ${intel.financials.length} financial item(s)`);
  }

  // Append changelog entries
  if (intel.changelog && intel.changelog.length > 0) {
    state.changelog = [...intel.changelog, ...(state.changelog || [])];
    console.log(`   Added ${intel.changelog.length} changelog entries`);
  }

  // Update timestamp
  state.lastUpdate = new Date().toISOString();

  // Update stats
  const critCount = (state.threats || []).filter(t => t.severity === 'crit').length;
  const cveCount = (state.vulns || []).length;

  // Update alert banner if there's a new summary
  const alertText = intel.summary || state.alertText || '';

  // Read HTML template
  let html = fs.readFileSync(HTML_PATH, 'utf8');

  // Replace DASHBOARD_DATA in HTML
  const dataJson = JSON.stringify(state, null, 6)
    .replace(/</g, '\\u003c')  // Escape for safe embedding in <script>
    .replace(/>/g, '\\u003e');

  html = html.replace(
    /const DASHBOARD_DATA = {[\s\S]*?};/,
    `const DASHBOARD_DATA = ${dataJson};`
  );

  // Update alert banner text if we have a new summary
  if (intel.summary) {
    html = html.replace(
      /(<div class="alert-content">\s*<h3>)[^<]*(\/h3>)\s*<p>[^<]*(<\/p>)/,
      `$1Aktuelle Bedrohungslage<$2\n        <p>${intel.summary.replace(/"/g, '&quot;')}$3`
    );
  }

  // Write updated HTML
  fs.writeFileSync(HTML_PATH, html);
  console.log(`✅ Dashboard HTML updated`);

  // Save state for next run
  saveState(state);
  console.log(`💾 State saved for next update cycle`);
}

updateDashboard();
