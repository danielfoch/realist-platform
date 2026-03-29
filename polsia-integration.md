# Polsia AI Integration for Realist.ca

## Overview
Connect Polsia (AI inference on Replit) with Realist.ca to power recommendations, market insights, and the data flywheel.

## Architecture
```
Realist.ca (Replit)
    ↓ (deal data)
Polsia AI (Replit)
    ↓ (insights/webhook)
OpenClaw Agent
    ↓ (action)
User/CRM
```

## Setup Steps

### 1. Polsia Configuration
- Replit: https://replit.com/@[polsia-repo]
- Environment: `POLSIA_API_KEY`, `POLSIA_WEBHOOK_URL`
- Model: GPT-4 or Claude for market analysis

### 2. Data Pipeline
```javascript
// Realist sends data to Polsia
POST https://[polsia-replit].replit.run/api/analyze
{
  "type": "market_insights",
  "data": {
    "recent_deals": [...],
    "city": "Toronto",
    "metric": "cap_rate"
  }
}
```

### 3. Webhook Handler
```javascript
// OpenClaw receives insights
app.post("/webhooks/polsia", async (req, res) => {
  const { insights, recommendations, alerts } = req.body;
  
  // Store in database
  // Send to user if high-priority
  // Trigger CRM actions
});
```

## API Endpoints

### POST /api/inference/send-data
Sends deal data to Polsia for analysis.

### GET /api/recommendations?user_id=123
Returns AI-powered recommendations based on user's deal history.

### POST /webhooks/polsia
Receives insights from Polsia.

## Recommendation Types

| Type | Trigger | Action |
|------|---------|--------|
| market_alert | Cap rate changes >0.3% | Notify users interested in city |
| deal_match | New deals match user prefs | Email/CRM notification |
| benchmark_warning | User below market avg | Tips/education content |
| trend_early | Emerging market pattern | Blog content opportunity |

## Implementation

### Step 1: Add to Realist Backend
```javascript
// src/polsia-client.js
export async function sendToPolsia(data) {
  const response = await fetch(`${POLSIA_URL}/api/analyze`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${POLSIA_API_KEY}` },
    body: JSON.stringify(data)
  });
  return response.json();
}
```

### Step 2: Create Webhook Handler
```javascript
// src/webhooks/polsia.js
app.post('/webhooks/polsia', async (req, res) => {
  const { type, insights, city } = req.body;
  
  // Store in ai_insights table
  // Trigger actions based on type
});
```

### Step 3: OpenClaw Integration
```javascript
// Cron job to check for new insights
cron.add({
  name: 'check-polsia-insights',
  schedule: { kind: 'every', everyMs: 3600000 }, // hourly
  payload: { kind: 'agentTurn', message: 'Check Polsia insights and act' }
});
```

## Environment Variables
```
POLSIA_API_KEY=sk_...
POLSIA_WEBHOOK_URL=https://realist.ca/webhooks/polsia
POLSIA_URL=https://[polsia-project].replit.app
```

## Files to Create
- `realist/server/polsia-client.js` - Send data to Polsia
- `realist/server/webhooks/polsia.js` - Receive insights
- `realist/db/polsia-insights.sql` - Store AI insights
- `realist/scripts/check-insights.js` - OpenClaw cron script
