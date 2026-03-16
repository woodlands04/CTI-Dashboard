const fs = require('fs');
const path = require('path');
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
  console.log('No API key. Skipping.');
  const d = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, 'latest-intel.json'), JSON.stringify({ fetched: false, timestamp: new Date().toISOString() }, null, 2));
  process.exit(0);
}

const today = new Date().toISOString().split('T')[0];
const isMonday = new Date().getDay() === 1;

const SYS = `You are a Senior CTI Analyst for Woodlands Advisory GmbH. Produce a BILINGUAL (DE+EN) intelligence update. Every text field MUST have both a German key and an English _en key. Today: ${today}.

Respond with ONLY valid JSON (no markdown fences):
{
  "timestamp":"${new Date().toISOString()}",
  "threats":[{"name":"Name","vector":"DE","vector_en":"EN","actor":"DE","actor_en":"EN","velocity":"DE","velocity_en":"EN","severity":"crit|high|med","tag":"KRITISCH|NEU|","tag_en":"CRITICAL|NEW|","isNew":true}],
  "vulns":[{"cve":"CVE-...","name":"Product","sectors":"DE","sectors_en":"EN","cvss":"9.8","cvssClass":"crit|high|med","exploit":"DE","exploit_en":"EN","urgency":10,"status":"DE","status_en":"EN","isNew":true}],
  "financials":[{"name":"Name","elm":"$XXM","market":"DE","market_en":"EN","insurance":"DE","insurance_en":"EN","systemic":"DE","systemic_en":"EN","systemicClass":"systemic-high|systemic-med"}],
  "breakingNews":[{"date":"${today}","category":"Ransomware|Supply Chain|APT|Regulatory|Data Breach|Zero-Day","title":"DE","title_en":"EN","summary":"DE 2-3 sentences","summary_en":"EN 2-3 sentences","impact":"DE","impact_en":"EN"}],
  ${isMonday ? '"execSummary":{"date":"' + today + '","title":"DE","title_en":"EN","level":"KRITISCH|HOCH|MITTEL","levelClass":"crit|high|med","body":"DE 5-8 sentences","body_en":"EN 5-8 sentences","sources":"Sources"},' : ''}
  "changelog":[{"date":"${today}","text":"[TAG] DE","text_en":"[TAG] EN"}],
  "summary":"DE 3 sentences","summary_en":"EN 3 sentences"
}

RULES: Generate exactly 3 breaking news articles (different categories each). ${isMonday ? 'Generate a weekly executive summary for last week.' : ''} Focus on German/EU Mittelstand. Include NIS2/DORA/DSGVO implications. FAIR framework for financial estimates. EVERY field must have DE+EN.`;

async function run() {
  console.log(`Fetching bilingual CTI (${today}, Monday=${isMonday})...`);
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514', max_tokens: 8000, system: SYS,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: `Search CISA KEV, BSI, Hacker News, SecurityWeek, BleepingComputer, Bloomberg for cybersecurity incidents in the past 24h. Generate 3 bilingual breaking news articles.${isMonday ? ' Plus a weekly executive summary.' : ''} Return JSON only.` }]
      })
    });
    if (!r.ok) throw new Error(`API ${r.status}`);
    const data = await r.json();
    const txt = data.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
    let intel;
    try { intel = JSON.parse(txt.replace(/```json\n?|\n?```/g, '').trim()); }
    catch (e) {
      const m = txt.match(/\{[\s\S]*\}/);
      intel = m ? JSON.parse(m[0]) : { parseError: true, threats: [], vulns: [], financials: [], breakingNews: [], changelog: [] };
    }
    // Ensure _en fallbacks
    (intel.threats || []).forEach(t => { ['vector','actor','velocity','tag'].forEach(k => { if (!t[k+'_en']) t[k+'_en'] = t[k]; }); });
    (intel.vulns || []).forEach(v => { ['sectors','exploit','status'].forEach(k => { if (!v[k+'_en']) v[k+'_en'] = v[k]; }); });
    (intel.breakingNews || []).forEach(n => { ['title','summary','impact'].forEach(k => { if (!n[k+'_en']) n[k+'_en'] = n[k]; }); });
    (intel.changelog || []).forEach(c => { if (!c.text_en) c.text_en = c.text; });
    if (!intel.summary_en) intel.summary_en = intel.summary || '';
    if (intel.execSummary && !intel.execSummary.title_en) intel.execSummary.title_en = intel.execSummary.title;
    if (intel.execSummary && !intel.execSummary.body_en) intel.execSummary.body_en = intel.execSummary.body;
    intel.fetched = true; intel.fetchTimestamp = new Date().toISOString(); intel.bilingual = true;
    const d = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, 'latest-intel.json'), JSON.stringify(intel, null, 2));
    const ad = path.join(d, 'archive');
    if (!fs.existsSync(ad)) fs.mkdirSync(ad, { recursive: true });
    fs.writeFileSync(path.join(ad, `intel-${today}.json`), JSON.stringify(intel, null, 2));
    console.log(`Done! Threats:${intel.threats?.length||0} Vulns:${intel.vulns?.length||0} News:${intel.breakingNews?.length||0} Exec:${intel.execSummary?'YES':'no'}`);
  } catch (e) {
    console.error('Error:', e.message);
    const d = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, 'latest-intel.json'), JSON.stringify({ fetched: false, timestamp: new Date().toISOString(), error: e.message }, null, 2));
  }
}
run();
