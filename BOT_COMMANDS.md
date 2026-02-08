# 🤖 PolyAgent Bot - Complete Command Reference

## 📱 Quick Start

**First time setup:**
1. `/cleardata confirm` - Clear old data (if needed)
2. `/home` - View dashboard
3. `/setinterval 10` - Set check interval (optional)
4. `/refresh` - Run first check manually

---

## 🏠 Main Commands

### `/home`
**Detailed Dashboard Overview**
Shows everything at a glance:
- Overall statistics (total trades, win rate, P&L)
- Budget summary
- Bot status and settings
- Individual run details

**Example output:**
```
🏠 POLYAGENT DASHBOARD

📊 Overall Statistics
Total Runs: 5
Total Trades: 1,234
  • Open: 567
  • Closed: 667
  • Won: 400 (60.0%)
  • Lost: 267

💰 Budget Summary
Total P&L: +$123.45
Budget Used: $567.00
Available: $456.55

⚙️ Bot Settings
Status: ▶️ Active
Interval: Every 10 min
Trade Limit: 10,000
Largest Run: Trader One (800 trades)

📋 Run Details
1. Trader One
   800 trades | 300 open | 500 closed
   Win Rate: 62.0% | P&L: +$89.12
   Available: $211.12
...
```

---

## 🔄 Trading Commands

### `/refresh`
**Manual Full Check Cycle**
Runs complete workflow for ALL configurations:
1. Check resolutions on open trades
2. Scan for new trades
3. Check resolutions again

Use this to:
- Trigger immediate check
- Test if bot is working
- Works even when paused

**Example:**
```
/refresh
```

### `/checkall`
**Check All Configs (Resolution Only)**
Only checks if open trades have resolved.
Faster than `/refresh` (no scanning).

### `/check1`, `/check2`, `/check3`, etc.
**Check Specific Config**
Run full cycle for just one configuration.

**Examples:**
```
/check1    → Check first config
/check2    → Check second config
```

Without number shows list:
```
/check
→ Shows: 1. Trader One, 2. Trader Two, etc.
```

---

## ⚙️ Bot Settings

### `/setinterval <minutes>`
**Change Automatic Check Frequency**

**View current:**
```
/setinterval
→ Shows: Current interval and examples
```

**Set new interval:**
```
/setinterval 5     → Every 5 minutes (testing)
/setinterval 10    → Every 10 minutes (default)
/setinterval 15    → Every 15 minutes (normal)
/setinterval 30    → Every 30 minutes (slow traders)
/setinterval 60    → Every hour (very slow)
```

**Range:** 1-1440 minutes (24 hours max)

### `/setmaxglobal <trades>`
**Set Global Trade Limit**
Bot auto-pauses when ANY run reaches this limit.

**View current:**
```
/setmaxglobal
→ Shows: Current limit and status
```

**Set new limit:**
```
/setmaxglobal 5000     → Stop at 5,000 trades
/setmaxglobal 10000    → Stop at 10,000 (default)
/setmaxglobal 50000    → Stop at 50,000 trades
```

**Why?** Prevents overflow and saves API credits!

### `/pause`
**Pause Automatic Checks**
Stops scheduled checks. Manual `/refresh` still works.

**Use when:**
- Testing something
- Want to stop temporarily
- Bot reached trade limit

### `/resume`
**Resume Automatic Checks**
Restarts scheduled checks after pausing.

---

## 🗑️ Data Management

### `/cleardata`
**Delete ALL Stored Trade Data**
Safety confirmation required!

**Usage:**
```
/cleardata              → Shows warning
/cleardata confirm      → Actually deletes
```

**What happens:**
1. Deletes copy-trades-data.json
2. Creates fresh empty runs from configurations
3. All trade history LOST (can't undo!)

**When to use:**
- Starting fresh with clean data
- After changing configurations
- Testing/debugging

---

## ℹ️ Info Commands

### `/status`
**Bot Status Summary**
Quick overview:
- Number of monitored configs
- Current schedule
- Global trade limit
- Paused/Active status
- Full command list

### `/home`
**Detailed Dashboard**
(See above for full details)

---

## 🚨 Common Workflows

### Fresh Start
```
1. /cleardata confirm   → Delete old data
2. /home                → Verify empty runs created
3. /setinterval 10      → Set check frequency
4. /refresh             → First scan
5. /home                → See new trades
```

### Quick Check
```
1. /home                → See current state
2. /refresh             → Update now
3. /home                → See changes
```

### Adjust for Active Trader
```
1. /setinterval 5       → Check more frequently
2. /setmaxglobal 50000  → Increase limit
3. /home                → Monitor growth
```

### Pause for Analysis
```
1. /pause               → Stop automatic checks
2. /home                → Review data
3. [Analyze in localhost]
4. /resume              → Continue when ready
```

### Emergency Stop
```
1. /pause               → Stop immediately
2. /setmaxglobal 1000   → Set low limit
3. /cleardata confirm   → Start over (optional)
```

---

## 💡 Tips

**Best Practices:**
- Use `/home` regularly to monitor progress
- Set appropriate interval based on trader activity
- Use `/pause` before making changes
- `/refresh` for immediate results
- Check Railway logs for detailed debugging

**Performance:**
- Faster interval = more API calls = higher costs
- 10-15 minutes is good balance
- Use `/setmaxglobal` to prevent runaway growth

**Troubleshooting:**
- `/home` shows no trades? Try `/refresh`
- Bot paused? Check `/home` for limit status
- Wrong data? Use `/cleardata confirm`
- Check Railway logs for errors

---

## 📊 Command Summary Table

| Command | What It Does | When to Use |
|---------|--------------|-------------|
| `/home` | Dashboard overview | Check status anytime |
| `/refresh` | Manual full check | Get updates now |
| `/status` | Quick bot info | See settings |
| `/setinterval <min>` | Change frequency | Adjust to trader activity |
| `/setmaxglobal <n>` | Set trade limit | Prevent overflow |
| `/pause` | Stop auto-checks | Temporary halt |
| `/resume` | Restart auto-checks | Continue after pause |
| `/cleardata confirm` | Delete all data | Fresh start |
| `/checkall` | Check all (resolutions only) | Quick resolution check |
| `/check1`, `/check2`, etc | Check specific config | Test one trader |

---

## 🆘 Need Help?

**Check these first:**
1. `/home` - See what's happening
2. Railway logs - Detailed error messages
3. Localhost sync - Use "🤖 Sync with Bot" button

**Common Issues:**
- **No trades found?** Trader may not have activity in last 2000 trades
- **Wrong results?** Budget or filters might be wrong in configurations
- **Bot stopped?** Check if paused or hit trade limit with `/home`
- **Data mismatch?** Try `/cleardata confirm` for fresh start

---

**Last Updated:** February 8, 2026
**Bot Version:** 2.0 with Full Copy Trading Simulation
