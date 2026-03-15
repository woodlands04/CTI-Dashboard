const fs = require('fs');
const path = require('path');

const INTEL_PATH = path.join(__dirname, '..', 'data', 'latest-intel.json');
const HTML_PATH = path.join(__dirname, '..', 'index.html');

function updateDashboard() {
  console.log('Updating dashboard...');
  if (!fs.existsSync(INTEL_PATH)) {
    console.log('No intel file found. Skipping.');
    return;
  }
  const intel = JSON.parse(fs.readFileSync(INTEL_PATH, 'utf8'));
  if (!intel.fetched) {
    console.log('Intel fetch was unsuccessful. Skipping merge.');
    return;
  }
  let html = fs.readFileSync(HTML_PATH, 'utf8');
  const match = html.match(/const DASHBOARD_DATA = ({[\s\S]*?});/);
  if (!match) {
    console.log('Could not find DASHBOARD_DATA in HTML. Skipping.');
    return;
  }
  let state;
  try { state = eval('(' + match[1] + ')'); } catch (e) { console.error('Parse error:', e.message); return; }
  if (intel.threats && intel.threats.length > 0) {
    const existing = new Set((state.threats || []).map(t => t.name));
    const newOnes = intel.threats.filter(t => !existing.has(t.name));
    newOnes.forEach(t => { t.isNew = true; });
    state.threats = [...newOnes, ...(state.threats || [])];
    console.log(`  Merged ${newOnes.length} new threat(s)`);
  }
  if (intel.vulns && intel.vulns.length > 0) {
    const existing = new Set((state.vulns || []).map(v => v.cve));
    const newOnes = intel.vulns.filter(v => !existing.has(v.cve));
    state.vulns = [...newOnes, ...(state.vulns || [])];
    console.log(`  Merged ${newOnes.length} new vuln(s)`);
  }
  if (intel.changelog && intel.changelog.length > 0) {
    state.changelog = [...intel.changelog, ...(state.changelog || [])];
  }
  state.lastUpdate = new Date().toISOString();
  const dataJson = JSON.stringify(state, null, 6).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
  html = html.replace(/const DASHBOARD_DATA = {[\s\S]*?};/, `const DASHBOARD_DATA = ${dataJson};`);
  fs.writeFileSync(HTML_PATH, html);
  console.log('Dashboard HTML updated.');
}

updateDashboard();
