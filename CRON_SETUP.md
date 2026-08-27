# Cron Job Setup for Realist.ca

## Live Deal Room Sweep (reminders, auto-schedule, recording ingest)

Every 30 minutes. Idempotent — safe to run more often. Handles: 24h reminder
emails, auto-scheduling next Monday's session, Google Meet recording ingest
from Drive, and (when `DEAL_ROOM_AUTO_SEND_REPLAY=true`) the replay email
blast after ingest.

```bash
*/30 * * * * curl -s -X POST -H "x-api-key: $DEAL_DESK_API_KEY" https://realist.ca/api/deal-room/sweep
```

Requires env: `DEAL_DESK_API_KEY`, `DEAL_ROOM_MEET_URL`,
`DEAL_ROOM_GOOGLE_SA_JSON`, `DEAL_ROOM_DRIVE_FOLDER_ID` (share the Google
"Meet Recordings" folder with the service-account email). Manual ingest run:
`npm run deal-room:ingest`.

## Meetup Pro Event Sync

The always-on server runs this every six hours. An external scheduler can call
the same idempotent endpoint after deployments or as a reliability fallback:

```bash
17 */6 * * * curl -s -X POST -H "x-api-key: $EVENTS_CRON_API_KEY" https://realist.ca/api/integrations/meetup/sync
```

An event administrator must first open `/admin/events` and select **Connect
Meetup**. Required deployment secrets: `MEETUP_CLIENT_ID`,
`MEETUP_CLIENT_SECRET`, `MEETUP_PRO_NETWORK_URLNAME`,
`MEETUP_OAUTH_STATE_SECRET`, `MEETUP_TOKEN_ENCRYPTION_KEY`, and either
`EVENTS_CRON_API_KEY` or `DEAL_DESK_API_KEY`.

## Podcast RSS Refresh

The always-on server refreshes the Omny feed at 5:10am Toronto time every
Tuesday and Friday, ten minutes after the scheduled release. Episode pages,
homepage playback, topic-specific research links, and the podcast sitemap all
read the same cached feed. A failed refresh keeps the last known-good feed.

The RSS refresh requires no API key. Keep the Express worker continuously
running; a serverless-only frontend will not run this scheduler reliably.

After each scheduled refresh, the worker also checks the eight newest public
Omny clip records for a publisher transcript. When one exists, Realist imports
it privately and, when `ANTHROPIC_API_KEY` is configured, creates a
transcript-grounded editorial draft. It never auto-publishes the AI draft. An
administrator reviews and publishes the summary, takeaways, and FAQ from
`/admin/research`; the raw transcript is never exposed by a public endpoint.

Apply `migrations/0019_podcast_episode_enrichments.sql` before enabling this
step. If the publisher has not enabled a transcript in Omny, an administrator
can paste the publisher transcript into the same Research screen. For an
external reliability check, call:

```bash
15 5 * * 2,5 curl -s -X POST -H "x-api-key: $PODCAST_ENRICHMENT_API_KEY" https://realist.ca/api/integrations/podcast/enrichments/sync
```

## Monthly Motivated-Listing Dataset

Starting on the 2nd of each month, the always-on server checks every six hours
until it has a complete capture for all ten scheduled provinces and a published
monthly report. Every successful run stores one minimal observation per unique
flagged listing for that month, then rebuilds province/city aggregates and the
article. A partial upstream capture is retained for diagnosis but is not
published as a national report; the next check retries it.

Apply `migrations/0018_distress_listing_observations.sql` before enabling the
job. The scheduler requires working `CREA_DDF_USERNAME` and
`CREA_DDF_PASSWORD` credentials and a continuously running Express worker.
Administrators can run or repair a capture with
`POST /api/admin/distress-report/generate` and `{ "month": "YYYY-MM" }`.
The public dashboard reads aggregate cohort metrics from
`GET /api/distress-market-intelligence`; it never exposes full listing remarks.

## Monthly Market Update Automation

To set up automatic monthly market updates:

### Option 1: System Cron (Linux/Mac)
```bash
# Run on the 1st of every month at 2 AM
0 2 1 * * cd /path/to/realist-platform && npm run monthly-update >> /var/log/realist-monthly-update.log 2>&1
```

### Option 2: Node.js Scheduler (PM2)
```bash
# Install PM2
npm install -g pm2

# Create ecosystem.config.js
module.exports = {
  apps: [{
    name: 'realist-monthly-update',
    script: 'npm',
    args: 'run monthly-update',
    cron_restart: '0 2 1 * *',
    autorestart: false,
    env: {
      NODE_ENV: 'production'
    }
  }]
};

# Start with PM2
pm2 start ecosystem.config.js
```

### Option 3: Replit Cron
Replit doesn't support traditional cron jobs. Use:
1. **Replit's built-in scheduler** (if available)
2. **External cron service** like cron-job.org
3. **Self-hosted scheduler** using node-cron within the app

## Database Seeding

### Initial Setup
```bash
# Run migrations first
npm run migrate

# Seed with comprehensive data
npm run seed:comprehensive

# Seed with content (blog posts & guides)
npm run seed:content
```

### Testing the Monthly Update
```bash
# Test the monthly update script
npm run monthly-update
```

## Environment Variables

Ensure these environment variables are set:
```bash
DATABASE_URL=postgresql://user:password@host:5432/realist
NODE_ENV=production
```

## Monitoring

Check logs:
```bash
# System cron logs
tail -f /var/log/realist-monthly-update.log

# PM2 logs
pm2 logs realist-monthly-update
```

## Troubleshooting

### Database Connection Issues
1. Check DATABASE_URL is correct
2. Ensure PostgreSQL is running
3. Verify database user permissions

### Script Execution Issues
1. Check Node.js version (>= 18.0.0)
2. Verify all dependencies are installed
3. Check file permissions

### Content Generation Issues
1. Ensure rent_pulse table has data
2. Check blog_posts and guides tables exist
3. Verify API endpoints are accessible
