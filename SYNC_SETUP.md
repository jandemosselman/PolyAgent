# 🤖 Bot Sync Setup Guide

## What We Just Built

The bot now has a full API server running alongside the Telegram bot! This allows your localhost to sync data with the Railway bot so you can see all the trades it found while your laptop was closed.

## Setup Steps

### 1. Get Your Railway App URL

1. Go to https://railway.app/dashboard
2. Click on your PolyAgent project
3. Click on the bot service
4. Go to the **Settings** tab
5. Look for **Public Networking** section
6. Click **Generate Domain** (if you haven't already)
7. Copy the URL (something like: `https://polyagent-production.up.railway.app`)

### 2. Update .env.local

Replace the placeholder URL in `.env.local`:

```bash
RAILWAY_BOT_URL=https://your-actual-railway-url.railway.app
```

**Important:** Don't include a trailing slash!

### 3. Restart Your Localhost

```bash
npm run dev
```

## How It Works

### 🤖 Railway Bot (24/7)
- Runs every 10 minutes
- Checks resolutions → Scans for new trades → Checks resolutions again
- Stores all trades in `copy-trades-data.json`
- Sends Telegram notifications
- Exposes API at `/api/copy-trades`

### 💻 Localhost (When You Open It)
- **Auto-syncs on page load**: Fetches latest data from Railway bot
- **Manual sync button**: "🤖 Sync with Bot" in the top-right
- **Merges data**: Railway bot is source of truth for automated checks
- **Manual buttons still work**: You can still manually refresh/check resolutions

### 🔄 Sync Flow

```
Railway Bot → API Server → Localhost API Proxy → Browser
    ↓             ↓              ↓                  ↓
JSON File    Express API    Next.js Route     React State
```

## API Endpoints

### Railway Bot API
- `GET /api/copy-trades` - Fetch all copy trade runs
- `POST /api/copy-trades` - Update runs (for future bidirectional sync)
- `GET /health` - Health check

### Localhost API Proxy
- `GET /api/bot-sync` - Fetch from Railway (proxies to Railway bot)
- `POST /api/bot-sync` - Push to Railway (for future feature)

## Testing

### 1. Check Railway Logs

In Railway dashboard:
- Click on your bot service
- Go to **Deployments** tab
- Click on the latest deployment
- Check logs for:
  - `🌐 API server running on port 3000`
  - `🤖 Bot is running! Press Ctrl+C to stop.`

### 2. Test API Endpoint

Visit in browser (replace with your URL):
```
https://your-railway-url.railway.app/api/copy-trades
```

Should return JSON:
```json
{
  "success": true,
  "data": [...]
}
```

### 3. Test Localhost Sync

1. Open localhost: http://localhost:3000/copy-simulator
2. Watch console for: `🤖 Auto-syncing with Railway bot on page load...`
3. Should see: `✅ Synced with bot: X run(s) updated`
4. Or manually click "🤖 Sync with Bot" button

## Workflow

### Daily Use:
1. **Close laptop** - Railway bot runs automatically every 10 minutes
2. **Get Telegram notifications** - New trades, resolutions, stats
3. **Open laptop hours later** - Localhost auto-syncs on page load
4. **See all new trades** - As if you were pressing buttons all day!

### If You Want Fresh Data:
- Click "🤖 Sync with Bot" button anytime
- Localhost will fetch latest from Railway

## Troubleshooting

### "Sync failed: RAILWAY_BOT_URL not configured"
- Make sure you set `RAILWAY_BOT_URL` in `.env.local`
- Restart `npm run dev` after changing env vars

### "Sync failed: Failed to fetch from bot"
- Check Railway logs - is bot running?
- Test the URL in browser: `https://your-url.railway.app/health`
- Make sure Railway app is deployed (check dashboard)

### "Received 0 run(s) from bot"
- Bot might not have run yet (wait 10 minutes)
- Or no configurations were created yet
- Check Railway logs for errors

### Bot not finding trades
- Make sure you exported configurations using "🤖 Export for Bot" button
- Check Railway environment variables have `MONITORED_CONFIGS`
- Check bot logs for: `📊 Monitoring X configuration(s)`

## Next Steps (Future Enhancements)

- [ ] Bidirectional sync (localhost manual changes → Railway)
- [ ] Real-time sync with webhooks instead of polling
- [ ] Sync stats cache for faster performance
- [ ] Add authentication to API endpoints
- [ ] Compress old trade data for storage optimization

## Files Created/Modified

### New Files:
- `bot/api-server.ts` - Express API server for the bot
- `bot/trade-storage.ts` - Persistent storage management
- `bot/trade-scanner.ts` - New trade detection
- `bot/trade-resolver.ts` - Resolution checking
- `bot/copy-trade-manager.ts` - Main orchestration
- `app/api/bot-sync/route.ts` - Next.js API proxy

### Modified Files:
- `bot/index.ts` - Starts API server alongside bot
- `app/copy-simulator/page.tsx` - Added sync functionality
- `.env.local` - Added RAILWAY_BOT_URL

Enjoy your fully automated copy trading bot! 🚀
