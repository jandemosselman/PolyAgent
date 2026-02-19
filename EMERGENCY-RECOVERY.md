# 🚨 Emergency Recovery Guide

## Problem: Railway Bot Out of Memory

The Railway bot stopped because the `copy-trades-data.json` file grew too large (likely 50,000+ trades causing 25MB+ file size).

## Quick Fix (Run NOW)

### Option 1: Moderate Cleanup (RECOMMENDED)
Keeps all runs but limits to 1000 trades each:

```bash
cd /Users/korneeldevos/Downloads/PolyAgent
node emergency-cleanup.js
```

### Option 2: Aggressive Cleanup (If still failing)
Removes ALL inactive runs and limits to 500 trades:

```bash
cd /Users/korneeldevos/Downloads/PolyAgent
node aggressive-cleanup.js
```

## After Cleanup

1. Go to Railway dashboard: https://railway.app
2. Find your PolyAgent project
3. Click "Restart" button
4. Bot should come back online!

## Prevention (Already Added)

The bot now has **automatic pruning**:
- Max 2000 trades per run
- Auto-trims on every save
- Prevents this from happening again

## What Happened?

When you imported those huge configs (52,994 trades from "Trader Four Complete"), the file size exploded:

- Before: ~2 MB (manageable)
- After import: ~25+ MB (Railway crashed)

Railway's free tier has memory limits, and massive JSON files can cause:
- Out of memory errors
- Slow bot responses
- Crashes on startup

## Best Practices Going Forward

1. ✅ **Import to localhost only** - Use imported data for analysis, don't sync to Railway
2. ✅ **Automatic pruning enabled** - Bot now keeps max 2000 trades per run
3. ✅ **Delete old inactive runs** - Clean up runs you're not using anymore
4. ✅ **Monitor file size** - Check Railway logs for warnings

## How to Check Railway Logs

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# View logs
railway logs
```

## Emergency Contact

If bot is still down after cleanup:
1. Check Railway dashboard for error messages
2. Try restarting Railway service
3. Check /data volume size in Railway settings
4. Consider upgrading Railway plan if needed
