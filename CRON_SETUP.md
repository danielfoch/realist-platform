# Cron Job Setup for Realist.ca

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