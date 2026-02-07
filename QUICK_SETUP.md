# 🚀 Quick Setup - Get Railway URL

Follow these steps to enable bot sync:

## Step 1: Get Railway URL (5 minutes)

1. **Open Railway Dashboard**
   - Go to: https://railway.app/dashboard
   - Log in if needed

2. **Find Your Bot Project**
   - Look for "PolyAgent" or whatever you named it
   - Click on the project

3. **Select Bot Service**
   - You should see your bot service/deployment
   - Click on it

4. **Generate Public Domain**
   - Go to the **Settings** tab (top navigation)
   - Scroll down to **Networking** section
   - Click **Generate Domain** button
   - Wait a few seconds for Railway to create a URL
   - **Copy the URL** (example: `https://polyagent-production-abc123.up.railway.app`)

## Step 2: Update .env.local (1 minute)

1. **Open** `/Users/korneeldevos/Downloads/PolyAgent/.env.local`

2. **Replace** this line:
   ```
   RAILWAY_BOT_URL=https://your-railway-app.railway.app
   ```
   
3. **With your actual URL** (no trailing slash):
   ```
   RAILWAY_BOT_URL=https://polyagent-production-abc123.up.railway.app
   ```

4. **Save the file**

## Step 3: Restart Localhost (30 seconds)

1. **Stop the current dev server** (Ctrl+C in terminal)

2. **Start it again:**
   ```bash
   npm run dev
   ```

## Step 4: Enable Auto-Sync (Optional)

If you want the page to automatically sync when you open it:

1. **Open** `app/copy-simulator/page.tsx`
2. **Find line ~370** (search for "Auto-sync with bot on page load")
3. **Uncomment** the useEffect by removing `/*` and `*/`
4. **Save and refresh**

## Step 5: Test! (2 minutes)

1. **Test Railway API directly:**
   - Open in browser: `https://your-railway-url.up.railway.app/health`
   - Should see: `{"status":"ok","timestamp":"..."}`
   
2. **Test in localhost:**
   - Go to: http://localhost:3000/copy-simulator
   - Click **"🤖 Sync with Bot"** button (top right)
   - Should see success notification!

## ✅ You're Done!

Now your workflow is:
- **Close laptop** → Bot runs every 10 minutes automatically
- **Get Telegram notifications** → New trades, resolutions
- **Open laptop later** → Click "🤖 Sync with Bot" to see everything
- **Profit!** 📈

## 🔍 Troubleshooting

### Can't find "Generate Domain" button?
- Make sure you're in the bot service (not the project overview)
- Look in Settings → Networking section
- If you see "Public Networking is disabled", enable it first

### Railway URL returns 404?
- Wait 1-2 minutes for deployment to complete
- Check Railway logs for errors
- Make sure bot is running (should see "🌐 API server running on port 3000")

### Still getting errors in localhost?
- Did you restart `npm run dev` after changing .env.local?
- Check that RAILWAY_BOT_URL has NO trailing slash
- Check browser console for detailed error messages

Need more help? Check `SYNC_SETUP.md` for detailed docs!
