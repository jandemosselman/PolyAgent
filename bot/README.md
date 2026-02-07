# Polymarket Resolution Checker Bot 🤖

Monitors Polymarket traders and sends Telegram notifications about win rate changes and new trades.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   - Edit `.env` file
   - Add trader addresses you want to monitor (comma-separated)

3. **Test locally:**
   ```bash
   npm run dev
   ```

4. **Run in production:**
   ```bash
   npm start
   ```

## Configuration

### Check Frequency
Edit `index.ts` to change how often the bot checks:

```typescript
// Every 5 minutes
cron.schedule('*/5 * * * *', runCheck)

// Every 10 minutes (default)
cron.schedule('*/10 * * * *', runCheck)

// Every 30 minutes
cron.schedule('*/30 * * * *', runCheck)
```

### Notification Triggers
In `resolution-checker.ts`:
- Win rate change > 1%
- 5+ new trades detected

## Deploy to Railway

1. Push code to GitHub
2. Create new project in Railway
3. Connect your GitHub repo
4. Set environment variables in Railway dashboard:
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID`
   - `MONITORED_TRADERS`
5. Deploy!

## Files

- `index.ts` - Main entry point, cron scheduler
- `resolution-checker.ts` - Fetches data and calculates stats
- `telegram-notifier.ts` - Sends Telegram notifications
- `stats-cache.json` - Stores historical data (auto-generated)
