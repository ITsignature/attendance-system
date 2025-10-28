# Payroll Auto-Create Cron Job Setup

## Overview
Automatic payroll run creation system that creates monthly payroll runs for all active clients at the start of each month.

## Features
✅ Automatically creates payroll runs on the 1st of each month
✅ Creates runs for all active clients
✅ Skips if run already exists
✅ Uses default settings: Regular run type, Advanced tax calculation
✅ Includes all employees (all departments, all types)

## Configuration

### Environment Variable
Add this to your `.env` file:

```env
# Cron schedule for auto-creating payroll runs
# Default: 0 6 * * * (Daily at 6 AM)
# Format: minute hour day month weekday
PAYROLL_CRON_SCHEDULE=0 6 * * *

# Optional: API key for cron endpoint security
CRON_API_KEY=your-secure-random-key-here
```

### Cron Schedule Examples
```
0 6 * * *      # Daily at 6:00 AM
0 0 1 * *      # 1st of every month at midnight
0 6 1 * *      # 1st of every month at 6:00 AM
*/5 * * * *    # Every 5 minutes (for testing)
* * * * *      # Every minute (for testing only!)
```

## How It Works

1. **Scheduled Execution**: Cron job runs daily at 6 AM
2. **Month Detection**: Checks if current month payroll run exists
3. **Auto-Creation**: If it's a new month and no run exists → creates it
4. **Multi-Client**: Processes all active clients automatically
5. **Smart Skipping**: Skips clients that already have runs

## Testing

### Option 1: Manual Trigger (Recommended)
Test without waiting for cron schedule:

```bash
# Send POST request to manual trigger endpoint
curl -X POST http://localhost:5000/api/admin/trigger-payroll-cron

# Or use Postman/Thunder Client
POST http://localhost:5000/api/admin/trigger-payroll-cron
```

### Option 2: Test with Fast Cron
Temporarily set to run every minute:

```env
PAYROLL_CRON_SCHEDULE=* * * * *
```

**Remember to change back to production schedule after testing!**

### Option 3: Use Cron Endpoint
```bash
curl -X POST http://localhost:5000/api/payroll-runs/cron/auto-create \
  -H "x-cron-api-key: your-secure-cron-key-here"
```

## Logs
Watch server logs for cron execution:

```
⏰ CRON: Payroll auto-create job triggered at 2025-01-01T06:00:00.000Z
🤖 AUTO-CREATE: Starting auto-create for 2025-01
📊 Found 5 active clients
✅ CREATED Client A: MONTHLY_2025_01_REGULAR (150 employees)
⏭️  SKIPPED Client B: Run already exists (MONTHLY_2025_01_REGULAR)
📈 AUTO-CREATE SUMMARY:
   ✅ Created: 1
   ⏭️  Skipped: 4
   ❌ Errors: 0
```

## Production Deployment

### Recommended Schedule
```env
PAYROLL_CRON_SCHEDULE=0 6 1 * *
```
This runs on the 1st of each month at 6:00 AM

### Alternative: Use External Cron
If you prefer external cron (like Linux crontab or cloud scheduler):

1. Disable internal cron by not calling `startPayrollCronJobs()`
2. Set up external cron to call the API endpoint:

```bash
# In your system crontab
0 6 1 * * curl -X POST http://your-server/api/payroll-runs/cron/auto-create \
  -H "x-cron-api-key: your-key"
```

## Security

### API Key Protection
The cron endpoint is protected by API key. Set it in `.env`:

```env
CRON_API_KEY=generate-a-long-random-secure-key-here
```

Generate secure key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Monitoring

Check payroll runs dashboard to verify auto-creation:
- Frontend: Navigate to Payroll Runs page
- Backend: Check database `payroll_runs` table

## Troubleshooting

### Cron not running?
1. Check server logs for: `⏰ Cron job scheduled`
2. Verify `startPayrollCronJobs()` is called in server.js
3. Check cron schedule syntax

### Runs not being created?
1. Verify payroll periods exist for the current month
2. Check client status is 'active'
3. Look for error messages in logs

### Multiple runs created?
1. Check if cron is running multiple times
2. Verify no duplicate cron schedules
3. The system prevents duplicates, so this shouldn't happen

## Files Modified

1. `BackEnd/src/services/PayrollRunService.js` - Added `autoCreateMonthlyPayrollRuns()` method
2. `BackEnd/src/routes/payrollRunRoutes.js` - Added `/cron/auto-create` endpoint
3. `BackEnd/server.js` - Added cron scheduler and manual trigger endpoint

## Support

For issues, check:
1. Server console logs
2. Database `payroll_runs` table
3. Verify payroll periods exist
4. Ensure clients are active
