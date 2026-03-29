# Realist.ca Weekly Email Digest Workflow

## Overview
Automated weekly email to Realist.ca users with market intelligence and leaderboard stats.

## Prerequisites
1. GHL configured with `HIGHLEVEL_TOKEN` and `HIGHLEVEL_LOCATION_ID`
2. Realist database deployed with analyzed_deals table
3. API endpoint `/api/stats/weekly` live

## How It Works

### 1. Fetch Weekly Stats
```bash
# Call the Realist API
curl https://realist.ca/api/stats/weekly
```

Returns:
```json
{
  "thisWeek": {
    "dealsAnalyzed": 1247,
    "changeVsLastWeek": "+12%",
    "avgCapRate": 6.8,
    "avgCashOnCash": 12.3,
    "hottestCity": "Toronto"
  },
  "topAnalysts": [
    {"rank": 1, "name": "Alex", "deals": 47},
    {"rank": 2, "name": "Sarah", "deals": 31},
    {"rank": 3, "name": "Mike", "deals": 28}
  ]
}
```

### 2. Send Email via GHL
Use GHL automation or API to send to all users with `weekly_digest: true`.

## Email Template

```
Subject: 📊 Weekly Realist.ca Market Digest - [DATE]

Preheader: Your weekly dose of Canadian deal intelligence

---

Hi [FIRST_NAME],

Here's your weekly dose of Canadian investment intelligence from Realist.ca.

📈 This Week's Numbers:
• [X] deals analyzed ([+X%] vs last week)
• Average Cap Rate: [X]%
• Average Cash-on-Cash: [X]%
• Hottest City: [CITY]

🏆 Top Analysts This Week:
1. @[Name] - [X] deals
2. @[Name] - [X] deals  
3. @[Name] - [X] deals

[View Full Leaderboard →](https://realist.ca/leaderboard)

💡 Pro Tip: Deals with [X]%+ cap rates are currently trending in [CITY]. 

[Analyze Your Next Deal →](https://realist.ca/analyze)

---

The Realist Team
realist.ca | Canada's #1 Real Estate Investment Platform
```

## Cron Job Setup
```javascript
// Add to OpenClaw cron
{
  name: "weekly-realist-digest",
  schedule: { kind: "cron", expr: "0 9 * * 1", tz: "America/Toronto" },
  payload: { kind: "agentTurn", message: "Run Realist weekly email digest" },
  delivery: { mode: "announce" }
}
```

## Implementation Steps

### Option A: GHL Automation (Recommended)
1. Create GHL workflow "Weekly Realist Digest"
2. Use GHL API to fetch stats from Realist
3. Send to contact tag "Realist Users"

### Option B: Custom API
1. Build email template renderer
2. Fetch stats from `/api/stats/weekly`
3. Send via AWS SES / SendGrid / Postmark

### Option C: Hybrid
1. Create contact tag in GHL
2. Use GHL bulk email with merge fields
3. Populate merge fields via API webhook

## Files Needed
- `realist/server/email-digest.js` - API to generate email content
- `realist/scripts/weekly-digest.js` - Cron script to send emails
- Email template (above)
