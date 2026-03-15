# 🛡️ Cyber-Financial Intelligence Dashboard

A self-updating, GitHub Pages-hosted Cyber Threat Intelligence dashboard that automatically refreshes daily with the latest threat data using the Anthropic Claude API with web search.

![Dashboard Preview](https://img.shields.io/badge/Status-Live-brightgreen) ![Auto Update](https://img.shields.io/badge/Updates-Daily%2007%3A00%20UTC-blue) ![License](https://img.shields.io/badge/License-MIT-yellow)

## Features

- **🔄 Auto-updating**: GitHub Actions workflow fetches new threat intelligence daily at 07:00 UTC
- **📊 Multi-dimensional analysis**: Threats, vulnerabilities, financial impact, and actionable insights
- **💰 FAIR Framework**: Quantitative risk analysis with annualized loss estimates
- **🏦 Financial module**: Market volatility signals, insurance implications, systemic risk assessment
- **📋 Living Document**: Historical findings preserved; new items marked with `[NEU]` / `[KRITISCH]`
- **🌐 Zero dependencies**: Pure HTML/CSS/JS — no build step needed

## Quick Start

### 1. Fork or clone this repository

```bash
git clone https://github.com/YOUR_USERNAME/cti-dashboard.git
cd cti-dashboard
```

### 2. Add your Anthropic API key

Go to **Settings → Secrets and variables → Actions → New repository secret**:

| Secret Name | Value |
|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic API key (`sk-ant-...`) |

> The API key is used by the daily workflow to call Claude with web search for the latest threat intelligence. Without it, the dashboard still works but won't auto-update with new data.

### 3. Enable GitHub Pages

Go to **Settings → Pages**:
- **Source**: GitHub Actions
- The workflow will auto-deploy after each update

### 4. Trigger the first update

Go to **Actions → "Update CTI Dashboard"** → **Run workflow**

Your dashboard will be live at:  
`https://YOUR_USERNAME.github.io/cti-dashboard/`

## Architecture

```
cti-dashboard/
├── index.html                  # Main dashboard (self-contained HTML)
├── package.json                # Project config
├── scripts/
│   ├── fetch-intel.js          # Calls Claude API + web search for latest CTI
│   └── update-dashboard.js     # Merges new intel into index.html
├── data/
│   ├── latest-intel.json       # Most recent fetch result
│   ├── dashboard-state.json    # Accumulated state across updates
│   └── archive/                # Daily snapshots (intel-YYYY-MM-DD.json)
└── .github/
    └── workflows/
        └── update-dashboard.yml  # Daily cron + manual trigger
```

### How the update cycle works

```
07:00 UTC Daily (or manual trigger)
        │
        ▼
┌─────────────────┐
│  fetch-intel.js  │  Calls Claude API with web_search tool
│                  │  Searches: CISA, BSI, Hacker News, SecurityWeek,
│                  │  KrebsOnSecurity, Bloomberg, Reuters
└────────┬────────┘
         │  Outputs: data/latest-intel.json
         ▼
┌──────────────────────┐
│  update-dashboard.js  │  Merges new findings into existing state
│                       │  Marks new items with isNew flag
│                       │  Updates DASHBOARD_DATA in index.html
└────────┬─────────────┘
         │
         ▼
┌─────────────────┐
│  Git commit +   │  Auto-commits changes
│  GitHub Pages   │  Deploys updated dashboard
│  deploy         │
└─────────────────┘
```

## Data Sources

The daily fetch searches these sources via Claude's web search:

| Source | Type |
|---|---|
| CISA KEV Catalog | Exploited vulnerabilities |
| CISA Advisories / EDs | Emergency directives |
| BSI (DE) | German federal security advisories |
| The Hacker News | Breaking cybersecurity news |
| SecurityWeek | Enterprise security reporting |
| KrebsOnSecurity | Investigative cyber journalism |
| Bloomberg / Reuters | Financial impact reporting |
| IBM X-Force | Threat intelligence reports |

## Manual Update

To trigger an update outside the daily schedule:

```bash
# Set your API key
export ANTHROPIC_API_KEY=sk-ant-...

# Fetch latest intel
npm run fetch

# Update the dashboard HTML
npm run update
```

Or via GitHub: **Actions → Update CTI Dashboard → Run workflow**

## Customization

### Change update frequency

Edit `.github/workflows/update-dashboard.yml`:

```yaml
schedule:
  - cron: '0 */6 * * *'  # Every 6 hours
```

### Add custom data sources

Edit `scripts/fetch-intel.js` and modify the search prompts to include your preferred sources.

### Modify dashboard styling

All CSS is in `index.html` using CSS custom properties. Change the `:root` variables to adjust the theme.

## Cost Estimate

The daily update uses approximately:
- **1 Claude Sonnet API call** with web search (~2000-4000 output tokens)
- **Estimated cost**: ~$0.02–0.05 per update → ~$0.60–1.50/month

## Compliance Note

This dashboard references regulatory frameworks including DORA, NIS2, and GDPR. Financial estimates use the FAIR (Factor Analysis of Information Risk) methodology. All ELM values are Monte Carlo-based estimates with broad confidence intervals.

**This is not financial or legal advice.**

## License

MIT — see [LICENSE](LICENSE)
