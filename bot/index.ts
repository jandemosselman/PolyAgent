import 'dotenv/config'
import cron from 'node-cron'
import TelegramBot from 'node-telegram-bot-api'
import { performFullCheckCycle, getMonitoredConfigurations, initializeCopyTrades } from './copy-trade-manager.js'
import { notifyBotStarted } from './telegram-notifier.js'
import { startApiServer } from './api-server.js'

// Start API server FIRST so Railway health checks pass immediately
startApiServer()

// Initialize Telegram Bot
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || ''
const TELEGRAM_ENABLE_POLLING = process.env.TELEGRAM_ENABLE_POLLING === 'true'

let bot: TelegramBot | null = null
let currentCronJob: cron.ScheduledTask | null = null
let currentInterval = 10 // minutes
let maxGlobalTrades = 999999 // Stop when any run reaches this (effectively unlimited by default)
let isPaused = false

if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID && TELEGRAM_ENABLE_POLLING) {
  bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true })
  
  // Handle /home command - Detailed dashboard
  bot.onText(/\/home/, async (msg) => {
    const chatId = msg.chat.id.toString()
    
    if (chatId !== TELEGRAM_CHAT_ID) {
      console.log(`❌ Unauthorized command from chat ID: ${chatId}`)
      return
    }
    
    try {
      const { loadCopyTrades } = await import('./trade-storage.js')
      const runs = loadCopyTrades()
      const configs = getMonitoredConfigurations()
      
      // 🧹 MEMORY OPTIMIZATION: Calculate stats in single pass without creating copies
      let totalTrades = 0
      let totalOpen = 0
      let totalClosed = 0
      let totalWon = 0
      let totalLost = 0
      let totalPnL = 0
      let totalBudgetUsed = 0
      let totalBudgetAvailable = 0
      
      const runStats = runs.map(run => {
        // Single pass through trades - no filter copies
        let open = 0, closed = 0, won = 0, lost = 0, pnl = 0, openBudgetUsed = 0
        
        for (const t of run.trades) {
          if (t.status === 'open') {
            open++
            openBudgetUsed += t.amount || 0
          } else {
            closed++
            pnl += t.pnl || 0
            if (t.status === 'won') won++
            else if (t.status === 'lost') lost++
          }
        }
        
        const winRate = closed > 0 ? (won / closed * 100) : 0
        const budgetUsed = openBudgetUsed
        const budgetAvailable = run.initialBudget + pnl - budgetUsed
        
        totalTrades += run.trades.length
        totalOpen += open
        totalClosed += closed
        totalWon += won
        totalLost += lost
        totalPnL += pnl
        totalBudgetUsed += budgetUsed
        totalBudgetAvailable += budgetAvailable
        
        return {
          name: run.name,
          trades: run.trades.length,
          open,
          closed,
          won,
          lost,
          winRate,
          pnl,
          budgetAvailable,
          trader: run.traderAddress.substring(0, 8) + '...'
        }
      })
      
      const overallWinRate = totalClosed > 0 ? (totalWon / totalClosed * 100) : 0
      
      // Find run with most trades
      const maxTradeRun = runs.reduce((max, run) => 
        run.trades.length > max.trades.length ? run : max, 
        runs[0] || { trades: [], name: 'None' }
      )
      
      // Get memory info first
      const mem = process.memoryUsage()
      const rssMB = mem.rss / 1024 / 1024
      const railwayLimit = 512
      const memPercent = (rssMB / railwayLimit * 100).toFixed(1)
      const memStatus = rssMB > railwayLimit * 0.85 ? '🔴 CRITICAL' : rssMB > railwayLimit * 0.7 ? '⚠️ Warning' : '✅ Healthy'
      
      // MESSAGE 1: Summary
      const summary = `
🏠 *POLYAGENT DASHBOARD*

📊 *Overall Statistics*
━━━━━━━━━━━━━━━━━━━━
Total Runs: ${runs.length}
Total Trades: ${totalTrades.toLocaleString()}
  • Open: ${totalOpen.toLocaleString()}
  • Closed: ${totalClosed.toLocaleString()}
  • Won: ${totalWon.toLocaleString()} (${overallWinRate.toFixed(1)}%)
  • Lost: ${totalLost.toLocaleString()}

💰 *Budget Summary*
━━━━━━━━━━━━━━━━━━━━
Total P&L: ${totalPnL >= 0 ? '+' : ''}$${totalPnL.toFixed(2)}
Budget Used: $${totalBudgetUsed.toFixed(2)}
Available: $${totalBudgetAvailable.toFixed(2)}

⚙️ *Bot Settings*
━━━━━━━━━━━━━━━━━━━━
Status: ${isPaused ? '⏸️ PAUSED' : '▶️ Active'}
Interval: Every ${currentInterval} min
Trade Limit: ${maxGlobalTrades.toLocaleString()}
Largest Run: ${maxTradeRun.name} (${maxTradeRun.trades?.length || 0} trades)

�� *Memory*
━━━━━━━━━━━━━━━━━━━━
${memStatus}: ${rssMB.toFixed(0)} MB / ${railwayLimit} MB (${memPercent}%)
`.trim()
      
      await bot!.sendMessage(chatId, summary, { parse_mode: 'Markdown' })
      
      // MESSAGE 2+: Run details in batches (5 per message to avoid length limits)
      if (runStats.length > 0) {
        const batchSize = 5
        const batches = Math.ceil(runStats.length / batchSize)
        
        for (let batch = 0; batch < batches; batch++) {
          const start = batch * batchSize
          const end = Math.min(start + batchSize, runStats.length)
          const batchStats = runStats.slice(start, end)
          
          let details = `📋 *Run Details (${start + 1}-${end} of ${runStats.length})*
━━━━━━━━━━━━━━━━━━━━

`
          
          batchStats.forEach((stat, i) => {
            const runNum = start + i + 1
            details += `${runNum}. *${stat.name}*
`
            details += `   ${stat.trades} trades | ${stat.open} open | ${stat.closed} closed
`
            details += `   Win: ${stat.winRate.toFixed(1)}% | P&L: ${stat.pnl >= 0 ? '+' : ''}$${stat.pnl.toFixed(2)}
`
            details += `   Available: $${stat.budgetAvailable.toFixed(2)}

`
          })
          
          if (batch === batches - 1) {
            details += `━━━━━━━━━━━━━━━━━━━━

*Quick Commands:*
/refresh - Run check cycle now
/status - Show bot status
/pause - Pause automatic checks`
          }
          
          await bot!.sendMessage(chatId, details.trim(), { parse_mode: 'Markdown' })
        }
      } else {
        await bot!.sendMessage(chatId, `📋 *Run Details*
━━━━━━━━━━━━━━━━━━━━

No active runs yet.

*Quick Commands:*
/refresh - Run check cycle now
/status - Show bot status`, { parse_mode: 'Markdown' })
      }
    } catch (error: any) {
      await bot!.sendMessage(chatId, `❌ Error loading dashboard: ${error.message}`, { parse_mode: 'Markdown' })
      console.error('Error in /home command:', error)
    }
  })
  
  // Handle /checkall command
  bot.onText(/\/checkall/, async (msg) => {
    const chatId = msg.chat.id.toString()
    
    // Only respond to the configured chat ID
    if (chatId !== TELEGRAM_CHAT_ID) {
      console.log(`❌ Unauthorized command from chat ID: ${chatId}`)
      return
    }
    
    await bot!.sendMessage(chatId, '🔄 Starting manual check for all configurations...', { parse_mode: 'Markdown' })
    console.log('📱 Received /checkall command from Telegram')
    
    await runCheck()
    
    await bot!.sendMessage(chatId, '✅ Manual check completed!', { parse_mode: 'Markdown' })
  })
  
  // Handle /check command (with optional config number)
  bot.onText(/\/check(@\w+)?\s*(.*)/, async (msg, match) => {
    const chatId = msg.chat.id.toString()
    
    if (chatId !== TELEGRAM_CHAT_ID) return
    
    const configs = getMonitoredConfigurations()
    const input = match?.[2]?.trim() || ''
    
    // If no input, show list of configs
    if (!input) {
      const configList = configs.map((c, i) => `/check${i + 1} - ${c.name}`).join('\n')
      await bot!.sendMessage(chatId, `
📋 *Available Configurations*

${configList}

Usage: \`/check1\` or \`/check2\` etc.
Or use \`/checkall\` to check everything
      `.trim(), { parse_mode: 'Markdown' })
      return
    }
    
    // Try to parse as number
    const configNum = parseInt(input)
    if (!isNaN(configNum) && configNum > 0 && configNum <= configs.length) {
      const config = configs[configNum - 1]
      await bot!.sendMessage(chatId, `🔄 Checking *${config.name}*...`, { parse_mode: 'Markdown' })
      console.log(`📱 Received /check${configNum} command from Telegram`)
      
      try {
        await performFullCheckCycle(config)
        await bot!.sendMessage(chatId, `✅ Check completed for *${config.name}*`, { parse_mode: 'Markdown' })
      } catch (error: any) {
        await bot!.sendMessage(chatId, `❌ Error checking ${config.name}: ${error.message}`, { parse_mode: 'Markdown' })
      }
      return
    }
    
    await bot!.sendMessage(chatId, `❌ Invalid config number. Use /check to see available configs.`, { parse_mode: 'Markdown' })
  })
  
  // Handle /status command
  bot.onText(/\/status/, async (msg) => {
    const chatId = msg.chat.id.toString()
    
    if (chatId !== TELEGRAM_CHAT_ID) return
    
    const configs = getMonitoredConfigurations()
    const configList = configs.map((c, i) => `${i + 1}. ${c.name}`).join('\n')
    
    // Get memory stats
    const mem = process.memoryUsage()
    const rssMB = mem.rss / 1024 / 1024
    const railwayLimit = 512
    const memPercent = (rssMB / railwayLimit * 100).toFixed(1)
    const memStatus = rssMB > railwayLimit * 0.85 ? '🔴 CRITICAL' : rssMB > railwayLimit * 0.7 ? '⚠️ Warning' : '✅ Healthy'
    
    await bot!.sendMessage(chatId, `
🤖 *Bot Status*

Monitoring: *${configs.length} configuration(s)*

${configList}

⏰ Schedule: Every ${currentInterval} minute${currentInterval > 1 ? 's' : ''}
🛡️ Global limit: ${maxGlobalTrades.toLocaleString()} trades
⏸️ Status: ${isPaused ? '*PAUSED*' : '*Active*'}
🧠 Memory: ${memStatus} (${rssMB.toFixed(0)} MB / ${railwayLimit} MB)

*Commands:*
• /home - 🏠 Detailed dashboard
• /refresh - Manual full cycle
• /setinterval <min> - Change check interval
• /setmaxglobal <trades> - Set global trade limit
• /pause - Pause automatic checks
• /resume - Resume automatic checks
• /checkall - Check all configs
• /check1, /check2, etc - Check specific config
• /cleardata - Delete all data (requires confirmation)
• /cleanup - 🧹 Force memory cleanup
• /memory - 🧠 Check memory usage
• /status - Show this message
    `.trim(), { parse_mode: 'Markdown' })
  })
  
  // Handle /memory command - Show memory usage
  bot.onText(/\/memory/, async (msg) => {
    const chatId = msg.chat.id.toString()
    
    if (chatId !== TELEGRAM_CHAT_ID) return
    
    const used = process.memoryUsage()
    const totalMB = used.heapTotal / 1024 / 1024
    const usedMB = used.heapUsed / 1024 / 1024
    const externalMB = used.external / 1024 / 1024
    const rss = used.rss / 1024 / 1024
    
    // Railway free tier has 512MB limit
    const railwayLimit = 512
    const usagePercent = (rss / railwayLimit * 100).toFixed(1)
    const isWarning = rss > railwayLimit * 0.7 // 70% warning threshold
    const isCritical = rss > railwayLimit * 0.85 // 85% critical threshold
    
    let statusEmoji = '✅'
    let statusText = 'Healthy'
    if (isCritical) {
      statusEmoji = '🔴'
      statusText = 'CRITICAL - Close to OOM!'
    } else if (isWarning) {
      statusEmoji = '⚠️'
      statusText = 'Warning - High usage'
    }
    
    await bot!.sendMessage(chatId, `
🧠 *Memory Usage*

${statusEmoji} Status: *${statusText}*

📊 *Details:*
• RSS (Total): ${rss.toFixed(2)} MB
• Heap Used: ${usedMB.toFixed(2)} MB
• Heap Total: ${totalMB.toFixed(2)} MB
• External: ${externalMB.toFixed(2)} MB

🛡️ *Railway Limits:*
• Free Tier: ${railwayLimit} MB
• Current: ${usagePercent}% used
• Available: ${(railwayLimit - rss).toFixed(2)} MB

${isCritical ? '⚠️ *CRITICAL*: Consider lowering /setmaxglobal or clearing old data!' : ''}
${isWarning && !isCritical ? '💡 *Tip*: Monitor closely, may need to clear data soon' : ''}
    `.trim(), { parse_mode: 'Markdown' })
  })
  
  // Handle /refresh command - Full workflow for all configs
  bot.onText(/\/refresh/, async (msg) => {
    const chatId = msg.chat.id.toString()
    
    // Only respond to the configured chat ID
    if (chatId !== TELEGRAM_CHAT_ID) {
      console.log(`❌ Unauthorized command from chat ID: ${chatId}`)
      return
    }
    
    await bot!.sendMessage(chatId, '🔄 Starting full refresh cycle for all configurations...\n\n_Check resolutions → Scan for new trades → Check resolutions_', { parse_mode: 'Markdown' })
    console.log('📱 Received /refresh command from Telegram')
    
    await runCheck()
    
    await bot!.sendMessage(chatId, '✅ Full refresh cycle completed!', { parse_mode: 'Markdown' })
  })
  
  // Handle /setinterval command - Change automatic check interval
  bot.onText(/\/setinterval\s*(.*)/, async (msg, match) => {
    const chatId = msg.chat.id.toString()
    
    if (chatId !== TELEGRAM_CHAT_ID) {
      console.log(`❌ Unauthorized command from chat ID: ${chatId}`)
      return
    }
    
    const input = match?.[1]?.trim() || ''
    
    // If no input, show current interval and options
    if (!input) {
      await bot!.sendMessage(chatId, `
⏰ *Current Interval*: ${currentInterval} minutes

*Usage:* \`/setinterval <minutes>\`

*Examples:*
• \`/setinterval 5\` - Every 5 minutes
• \`/setinterval 10\` - Every 10 minutes
• \`/setinterval 15\` - Every 15 minutes
• \`/setinterval 30\` - Every 30 minutes
• \`/setinterval 60\` - Every hour

*Note:* Minimum 1 minute, maximum 1440 minutes (24 hours)
      `.trim(), { parse_mode: 'Markdown' })
      return
    }
    
    const minutes = parseInt(input)
    
    if (isNaN(minutes) || minutes < 1 || minutes > 1440) {
      await bot!.sendMessage(chatId, '❌ Invalid interval. Please enter a number between 1 and 1440 minutes.', { parse_mode: 'Markdown' })
      return
    }
    
    // Stop current cron job
    if (currentCronJob) {
      currentCronJob.stop()
      console.log(`⏹️ Stopped previous cron job (${currentInterval} minutes)`)
    }
    
    // Create new cron schedule
    const cronSchedule = `*/${minutes} * * * *`
    currentInterval = minutes
    currentCronJob = cron.schedule(cronSchedule, runCheck)
    
    await bot!.sendMessage(chatId, `✅ Interval updated to *${minutes} minute${minutes > 1 ? 's' : ''}*!\n\nNext check will run in ${minutes} minute${minutes > 1 ? 's' : ''}.`, { parse_mode: 'Markdown' })
    console.log(`✅ Cron interval updated to ${minutes} minutes (${cronSchedule})`)
  })
  
  // Handle /setmaxglobal command - Set max trades per run before auto-pause
  bot.onText(/\/setmaxglobal\s*(.*)/, async (msg, match) => {
    const chatId = msg.chat.id.toString()
    
    if (chatId !== TELEGRAM_CHAT_ID) {
      console.log(`❌ Unauthorized command from chat ID: ${chatId}`)
      return
    }
    
    const input = match?.[1]?.trim() || ''
    
    // If no input, show current limit
    if (!input) {
      await bot!.sendMessage(chatId, `
🛡️ *Global Trade Limit*: ${maxGlobalTrades.toLocaleString()} trades
⏸️ *Status*: ${isPaused ? 'PAUSED (limit reached)' : 'Active'}

When ANY run reaches this limit, automatic checks will pause to prevent overflow and save credits.

*Usage:* \`/setmaxglobal <number>\`

*Examples:*
• \`/setmaxglobal 5000\` - Pause at 5,000 trades
• \`/setmaxglobal 10000\` - Pause at 10,000 trades (default)
• \`/setmaxglobal 50000\` - Pause at 50,000 trades

*Commands:*
• \`/pause\` - Manually pause automatic checks
• \`/resume\` - Resume automatic checks
      `.trim(), { parse_mode: 'Markdown' })
      return
    }
    
    const limit = parseInt(input)
    
    if (isNaN(limit) || limit < 100) {
      await bot!.sendMessage(chatId, '❌ Invalid limit. Please enter a number of at least 100 trades.', { parse_mode: 'Markdown' })
      return
    }
    
    maxGlobalTrades = limit
    
    await bot!.sendMessage(chatId, `✅ Global trade limit set to *${limit.toLocaleString()} trades*!\n\nAutomatic checks will pause when any run reaches this limit.`, { parse_mode: 'Markdown' })
    console.log(`✅ Global trade limit updated to ${limit} trades`)
  })
  
  // Handle /pause command - Manually pause automatic checks
  bot.onText(/\/pause/, async (msg) => {
    const chatId = msg.chat.id.toString()
    
    if (chatId !== TELEGRAM_CHAT_ID) {
      console.log(`❌ Unauthorized command from chat ID: ${chatId}`)
      return
    }
    
    if (isPaused) {
      await bot!.sendMessage(chatId, '⏸️ Bot is already paused.', { parse_mode: 'Markdown' })
      return
    }
    
    isPaused = true
    await bot!.sendMessage(chatId, '⏸️ Automatic checks paused!\n\nUse `/resume` to continue or `/refresh` for manual checks.', { parse_mode: 'Markdown' })
    console.log('⏸️ Bot paused by user command')
  })
  
  // Handle /resume command - Resume automatic checks
  bot.onText(/\/resume/, async (msg) => {
    const chatId = msg.chat.id.toString()
    
    if (chatId !== TELEGRAM_CHAT_ID) {
      console.log(`❌ Unauthorized command from chat ID: ${chatId}`)
      return
    }
    
    if (!isPaused) {
      await bot!.sendMessage(chatId, '▶️ Bot is already running.', { parse_mode: 'Markdown' })
      return
    }
    
    isPaused = false
    await bot!.sendMessage(chatId, '▶️ Automatic checks resumed!\n\nBot will continue checking on schedule.', { parse_mode: 'Markdown' })
    console.log('▶️ Bot resumed by user command')
  })
  
  // Handle /cleardata command - Delete all stored trade data
  bot.onText(/\/cleardata/, async (msg) => {
    const chatId = msg.chat.id.toString()
    
    // Only respond to the configured chat ID
    if (chatId !== TELEGRAM_CHAT_ID) {
      console.log(`❌ Unauthorized command from chat ID: ${chatId}`)
      return
    }
    
    await bot!.sendMessage(chatId, '⚠️ *WARNING*: This will delete ALL stored trade data AND configurations!\n\nYou will need to add new copy trades from localhost.\n\nReply with `/cleardata confirm` to proceed.', { parse_mode: 'Markdown' })
  })
  
  // Handle /cleardata confirm
  bot.onText(/\/cleardata confirm/, async (msg) => {
    const chatId = msg.chat.id.toString()
    
    if (chatId !== TELEGRAM_CHAT_ID) {
      console.log(`❌ Unauthorized command from chat ID: ${chatId}`)
      return
    }
    
    await bot!.sendMessage(chatId, '🗑️ Deleting all data and configurations...', { parse_mode: 'Markdown' })
    console.log('📱 Received /cleardata confirm command from Telegram')
    
    try {
      // Step 1: Clear all trade data
      const { saveCopyTrades } = await import('./trade-storage.js')
      saveCopyTrades([])
      console.log('🗑️ All trade data deleted')
      
      // Step 2: Clear all configurations
      const { clearConfigurations } = await import('./copy-trade-manager.js')
      clearConfigurations()
      console.log('🗑️ All configurations deleted')
      
      await bot!.sendMessage(chatId, `✅ All data cleared!\n\n🆕 Clean slate ready!\n\n*Next steps:*\n1. Go to localhost\n2. Click "+ Add Copy Trade"\n3. It will automatically appear in the bot!\n4. Run /refresh to start collecting`, { parse_mode: 'Markdown' })
      console.log('✅ Complete clean slate created')
    } catch (error: any) {
      await bot!.sendMessage(chatId, `❌ Error clearing data: ${error.message}`, { parse_mode: 'Markdown' })
      console.error('❌ Error clearing data:', error)
    }
  })
  
  // Handle /cleanup command - Manual memory cleanup
  bot.onText(/\/cleanup/, async (msg) => {
    const chatId = msg.chat.id.toString()
    
    if (chatId !== TELEGRAM_CHAT_ID) {
      console.log(`❌ Unauthorized command from chat ID: ${chatId}`)
      return
    }
    
    try {
      const memBefore = process.memoryUsage()
      const rssBefore = memBefore.rss / 1024 / 1024
      
      console.log('🧹 Running manual memory cleanup...')
      
      // Clean stats cache
      const { cleanupStatsCache } = await import('./resolution-checker.js')
      const removed = cleanupStatsCache()
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc()
        console.log('🗑️ Forced garbage collection')
      }
      
      const memAfter = process.memoryUsage()
      const rssAfter = memAfter.rss / 1024 / 1024
      const saved = rssBefore - rssAfter
      
      await bot!.sendMessage(chatId, `
🧹 *Memory Cleanup Complete*

Orphaned stats removed: ${removed}
${global.gc ? '✅ Garbage collection forced\n' : '⚠️ GC not available (start with --expose-gc)\n'}
*Before:* ${rssBefore.toFixed(0)} MB
*After:* ${rssAfter.toFixed(0)} MB
*Freed:* ${saved >= 0 ? '+' : ''}${saved.toFixed(0)} MB

💡 To enable full GC on Railway:
Set start command to: \`node --expose-gc dist/index.js\`
      `.trim(), { parse_mode: 'Markdown' })
      
      console.log(`✅ Cleanup complete: ${rssBefore.toFixed(0)} MB → ${rssAfter.toFixed(0)} MB`)
    } catch (error: any) {
      await bot!.sendMessage(chatId, `❌ Cleanup error: ${error.message}`, { parse_mode: 'Markdown' })
      console.error('❌ Cleanup error:', error)
    }
  })
  
  console.log('✅ Telegram bot commands initialized (/refresh, /setinterval, /setmaxglobal, /pause, /resume, /cleardata, /cleanup, /status)')
} else if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID && !TELEGRAM_ENABLE_POLLING) {
  console.log('📵 Telegram command polling disabled (set TELEGRAM_ENABLE_POLLING=true to enable /commands)')
} else {
  console.log('⚠️  Telegram bot commands disabled (missing credentials)')
}

// Load configurations
const configurations = getMonitoredConfigurations()

if (configurations.length === 0) {
  console.log('⚠️  No configurations found yet - waiting for sync from localhost')
  console.log('💡 In localhost:')
  console.log('   1. Create copy trades')
  console.log('   2. Click "🤖 Export for Bot"')
  console.log('   3. Configurations will sync automatically!')
  console.log('')
} else {
  // Initialize copy trade storage from configurations
  initializeCopyTrades()

  console.log(`📊 Monitoring ${configurations.length} configuration(s)`)
  configurations.forEach((config, i) => {
    console.log(`   ${i + 1}. ${config.name} - ${config.traderAddress.slice(0, 10)}... (${config.minTriggerAmount >= 0 ? `$${config.minTriggerAmount}+` : 'any'} | ${(config.minPrice * 100).toFixed(0)}-${(config.maxPrice * 100).toFixed(0)}%)`)
  })
}

// Start cron schedule with initial interval
currentCronJob = cron.schedule(`*/${currentInterval} * * * *`, runCheck)
console.log(`⏰ Cron job scheduled: Every ${currentInterval} minutes`)

async function runCheck() {
  // Skip if no configurations
  const currentConfigs = getMonitoredConfigurations()
  if (currentConfigs.length === 0) {
    console.log('⏭️  Skipping check - no configurations loaded yet')
    return
  }
  
  const timestamp = new Date().toLocaleString('en-US', { 
    timeZone: 'Europe/Brussels',
    hour12: false 
  })
  console.log(`\n⏰ [${timestamp}] Running scheduled resolution check...`)
  
  // 🧹 MEMORY CLEANUP: Clean stats cache every check
  try {
    const { cleanupStatsCache } = await import('./resolution-checker.js')
    cleanupStatsCache()
  } catch (error) {
    console.error('Error cleaning stats cache:', error)
  }
  
  // Check if paused
  if (isPaused) {
    console.log('⏸️ Bot is paused, skipping check')
    return
  }
  
  // Check if any run has reached the global trade limit
  const { loadCopyTrades } = await import('./trade-storage.js')
  const runs = loadCopyTrades()
  const maxTradeRun = runs.reduce((max, run) => 
    run.trades.length > max.trades.length ? run : max, 
    runs[0] || { trades: [] }
  )
  
  if (maxTradeRun && maxTradeRun.trades.length >= maxGlobalTrades) {
    isPaused = true
    console.log(`🛡️ Global trade limit reached! Run "${maxTradeRun.name}" has ${maxTradeRun.trades.length} trades (limit: ${maxGlobalTrades})`)
    console.log('⏸️ Automatic checks paused to prevent overflow')
    
    // Send Telegram notification
    if (bot && TELEGRAM_CHAT_ID) {
      await bot.sendMessage(TELEGRAM_CHAT_ID, `
🛡️ *GLOBAL TRADE LIMIT REACHED*

Run: *${maxTradeRun.name}*
Trades: *${maxTradeRun.trades.length.toLocaleString()}* / ${maxGlobalTrades.toLocaleString()}

⏸️ Automatic checks have been paused to prevent overflow and save credits.

*Options:*
• \`/resume\` - Resume automatic checks (if you want to continue)
• \`/setmaxglobal <number>\` - Increase the limit
• \`/refresh\` - Run manual checks (still works while paused)
      `.trim(), { parse_mode: 'Markdown' })
    }
    return
  }
  
  for (const config of currentConfigs) {
    try {
      await performFullCheckCycle(config)
      
      // Wait 3 seconds between configs to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 3000))
    } catch (error: any) {
      console.error(`❌ Error checking config ${config.name}:`, error.message)
    }
  }
  
  console.log('✅ Finished checking all configurations\n')
}

// Notify bot started
const initialConfigs = getMonitoredConfigurations()
if (initialConfigs.length > 0) {
  notifyBotStarted(initialConfigs.length)
  
  // Run once on startup if we have configs
  console.log('🚀 Running initial check...\n')
  runCheck()
} else {
  console.log('⏭️  Skipping initial check - waiting for configurations from localhost\n')
}

console.log('🤖 Bot is running! Waiting for configurations...')

