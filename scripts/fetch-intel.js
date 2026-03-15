const fs = require('fs');
const path = require('path');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
  console.log('No API key configured. Skipping fetch.');
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'latest-intel.json'), JSON.stringify({
    fetched: false,
    timestamp: new Date().toISOString(),
    reason: 'No API key configured'
  }, null, 2));
  process.exit(0);
}

const SYSTEM_PROMPT = `You are a Senior CTI Analyst. Search for the latest cybersecurity incidents from the past 24 hours. Respond with ONLY valid JSON (no markdown, no backticks) in this structure:
{"timestamp":"ISO","threats":[{"name":"","vector":"","actor":"","velocity":"","severity":"crit|high|med","tag":"KRITISCH|NEU|","isNew":true}],"vulns":[{"cve":"","name":"","sectors":"","cvss":"","cvssClass":"crit|high|med","exploit":"","urgency":1,"status":"","isNew":true}],"financials":[{"name":"","elm":"","market":"","insurance":"","systemic":"","systemicClass":"systemic-high|systemic-med","isNew":true}],"changelog":[{"date":"YYYY-MM-DD","text":""}],"summary":"3 sentences"}`;

async function fetchIntel() {
  console.log('Fetching latest cyber threat intelligence...');
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        system: SYSTEM_PROMPT,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{
          role: 'user',
          content: `Search for the latest cybersecurity incidents and threats from the past 24 hours. Today is ${new Date().toISOString().split('T')[0]}. Search CISA, BSI, The Hacker News, SecurityWeek, BleepingComputer. Return JSON only.`
        }]
      })
    });
    if (!response.ok) throw new Error(`API ${response.status} ${response.statusText}`);
    const data = await response.json();
    const text = data.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
    let intel;
    try {
      intel = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim());
    } catch (e) {
      intel = { parseError: true, rawText: text, threats: [], vulns: [], financials: [], changelog: [], summary: 'Parse error' };
    }
    intel.fetched = true;
    intel.fetchTimestamp = new Date().toISOString();
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'latest-intel.json'), JSON.stringify(intel, null, 2));
    console.log(`Done. Threats: ${intel.threats?.length || 0}, Vulns: ${intel.vulns?.length || 0}`);
  } catch (error) {
    console.error('Error:', error.message);
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'latest-intel.json'), JSON.stringify({
      fetched: false, timestamp: new Date().toISOString(), error: error.message
    }, null, 2));
  }
}

fetchIntel();
