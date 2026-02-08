# 🛡️ Railway Persistent Volume Setup

## Why You Need This

Railway's filesystem is **ephemeral** (temporary) by default:
- ❌ When bot crashes/restarts → ALL files deleted
- ❌ Your trade data gets wiped
- ❌ Back to square one

**Persistent Volume = External hard drive that survives crashes!**

---

## 📋 Step-by-Step Setup

### 1. Go to Railway Dashboard
Visit: https://railway.app/project/your-project-id

### 2. Add a Volume
1. Click on your **PolyAgent** service
2. Go to **"Variables"** tab
3. Scroll down to **"Volumes"** section
4. Click **"+ New Volume"**

### 3. Configure Volume
**Mount Path:** `/data`
**Volume Name:** `polyagent-storage` (or any name you like)

Click **"Add"**

### 4. Deploy
Railway will automatically redeploy with the volume mounted.

---

## ✅ Verification

After deployment, check in Telegram:

```
/home
```

Look at the Railway logs (at startup):
```
💾 Storage location: /data/copy-trades-data.json
🛡️ Persistent: YES (Railway Volume)
```

If you see that, you're protected! 🎉

---

## 🧪 Test It

1. Let bot collect some trades
2. Manually trigger a crash (or wait for one)
3. After restart, run `/home`
4. Your data should still be there! ✅

---

## 💡 What This Protects Against

- ✅ Out of Memory (OOM) crashes
- ✅ Manual restarts/redeploys
- ✅ Railway platform issues
- ✅ Code updates/pushes
- ✅ Any bot restart

**Your trade data is now PERMANENT!**

---

## 📊 Volume Limits

**Railway Free Tier:**
- ✅ Volumes are FREE
- ✅ Storage limit: ~1GB
- ✅ More than enough for trade data

**Estimated capacity:**
- ~100,000 trades before filling 1GB
- You'll hit memory limit (512MB RAM) long before storage limit

---

## 🔧 Troubleshooting

**"Volume not mounting"**
- Check mount path is exactly `/data`
- Redeploy after adding volume

**"Still losing data"**
- Check logs for: `Persistent: YES`
- If it says `NO`, volume isn't mounted correctly

**"Permission denied"**
- Railway handles permissions automatically
- If you see this, contact Railway support

---

## 🚀 Next Steps

After adding volume:
1. Redeploy completes (~2 min)
2. Run `/cleardata confirm` for fresh start with persistent storage
3. Run `/refresh` to collect data
4. Run `/memory` to monitor RAM usage
5. Check `/home` regularly for stats

Your bot is now crash-proof! 🛡️
