/**
 * fetch-intel.js
 * 
 * Fetches the latest Cyber Threat Intelligence from multiple sources
 * using the Anthropic API with web search capability.
 * 
 * Outputs: data/latest-intel.json
 */

const fs = require('fs');
const path = require('path');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
  console.error('ERROR: ANTHROPIC_API_KEY not set. Skipping fetch.');
  // Write empty update so the pipeline doesn't fail
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'latest-intel.json'), JSON.stringify({ 
    fetched: false, 
    timestamp: new Date().toISOString(),
    reason: 'No API key configured'
  }, null, 2));
  process.exit(0);
}

const SYSTEM_PROMPT = `You are a Senior Cyber Threat Intelligence (CTI) Analyst. Your task is to search for the latest cybersecurity incidents, vulnerabilities, and threat intelligence from the past 24 hours.

Search for:
1. New CVEs added to CISA's Known Exploited Vulnerabilities catalog
2. New CISA Emergency Directives or Advisories
3. Major data breaches or ransomware attacks
4. Supply chain attacks
5. Nation-state cyber operations
6. Critical vulnerabilities in enterprise software
7. Financial impact of recent cyber incidents on stock markets

You MUST respond with ONLY valid JSON (no markdown, no backticks, no preamble) in this exact structure:
{
  "timestamp": "ISO 8601 timestamp",
  "threats": [
    {
      "name": "Threat name",
      "vector": "Attack vector description",
      "actor": "Threat actor and motivation",
      "velocity": "Spread assessment",
      "severity": "crit|high|med",
      "tag": "KRITISCH|NEU|UPDATE|",
      "isNew": true
    }
  ],
  "vulns": [
    {
      "cve": "CVE-XXXX-XXXXX",
      "name": "Product name",
      "sectors": "Affected sectors",
      "cvss": "Score",
      "cvssClass": "crit|high|med",
      "exploit": "Exploitation status",
      "urgency": 1-10,
      "status": "Current status",
      "isNew": true
    }
  ],
  "financials": [
    {
      "name": "Incident name",
      "elm": "Estimated Loss Magnitude",
      "market": "Market impact",
      "insurance": "Insurance implications",
      "systemic": "Risk level",
      "systemicClass": "systemic-high|systemic-med",
      "isNew": true
    }
  ],
  "changelog": [
    {
      "date": "YYYY-MM-DD",
      "text": "[TAG] Description of finding"
    }
  ],
  "summary": "3-sentence executive summary of the most critical findings"
}

If you find no new significant threats, return the JSON with empty arrays and a summary noting the stable threat landscape.`;

async function fetchIntel() {
  console.log('🔍 Fetching latest cyber threat intelligence...');
  console.log(`   Timestamp: ${new Date().toISOString()}`);

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
        tools: [
          {
            type: 'web_search_20250305',
            name: 'web_search'
          }
        ],
        messages: [
          {
            role: 'user',
            content: `Search for the latest cybersecurity incidents and threats from the past 24 hours. Today's date is ${new Date().toISOString().split('T')[0]}. 

Search specifically for:
- CISA advisories and emergency directives published today or yesterday
- New entries in the CISA Known Exploited Vulnerabilities catalog
- Major cyber attacks reported on The Hacker News, SecurityWeek, BleepingComputer, KrebsOnSecurity
- BSI (German Federal Office for Information Security) warnings
- Bloomberg/Reuters reports on financial impact of cyber incidents
- Any new supply chain attacks or zero-day exploits

Return your findings as the specified JSON structure.`
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Extract text content from response
    const textContent = data.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n');

    // Parse JSON from response (strip any markdown fences if present)
    const cleanJson = textContent.replace(/```json\n?|\n?```/g, '').trim();
    
    let intel;
    try {
      intel = JSON.parse(cleanJson);
    } catch (parseErr) {
      console.warn('⚠️  Could not parse JSON response. Saving raw text.');
      intel = {
        fetched: true,
        parseError: true,
        rawText: textContent,
        timestamp: new Date().toISOString(),
        threats: [],
        vulns: [],
        financials: [],
        changelog: [],
        summary: 'Parse error - manual review required'
      };
    }

    intel.fetched = true;
    intel.fetchTimestamp = new Date().toISOString();

    // Write to data directory
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    
    const outputPath = path.join(dataDir, 'latest-intel.json');
    fs.writeFileSync(outputPath, JSON.stringify(intel, null, 2));
    
    // Also keep a daily archive
    const archiveDir = path.join(dataDir, 'archive');
    if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });
    const dateStr = new Date().toISOString().split('T')[0];
    fs.writeFileSync(
      path.join(archiveDir, `intel-${dateStr}.json`),
      JSON.stringify(intel, null, 2)
    );

    console.log(`✅ Intelligence fetched successfully`);
    console.log(`   Threats: ${intel.threats?.length || 0}`);
    console.log(`   Vulnerabilities: ${intel.vulns?.length || 0}`);
    console.log(`   Financial items: ${intel.financials?.length || 0}`);
    console.log(`   Saved to: ${outputPath}`);

  } catch (error) {
    console.error('❌ Error fetching intelligence:', error.message);
    
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'latest-intel.json'), JSON.stringify({
      fetched: false,
      timestamp: new Date().toISOString(),
      error: error.message,
      threats: [],
      vulns: [],
      financials: [],
      changelog: []
    }, null, 2));
  }
}

fetchIntel();
