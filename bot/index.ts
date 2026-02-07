import 'dotenv/config'
import cron from 'node-cron'
import TelegramBot from 'node-telegram-bot-api'
import { performFullCheckCycle, getMonitoredConfigurations, initializeCopyTrades } from './copy-trade-manager.js'
import { notifyBotStarted } from './telegram-notifier.js'
import { startApiServer } from './api-server.js'

// Initialize Telegram Bot
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || ''

let bot: TelegramBot | null = null
let currentCronJob: cron.ScheduledTask | null = null
let currentInterval = 10 // minutes
let maxGlobalTrades = 10000 // Stop when any run reaches this
let isPaused = false

if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
  bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true })
  
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
    
    await bot!.sendMessage(chatId, `
🤖 *Bot Status*

Monitoring: *${configs.length} configuration(s)*

${configList}

⏰ Schedule: Every ${currentInterval} minute${currentInterval > 1 ? 's' : ''}
🛡️ Global limit: ${maxGlobalTrades.toLocaleString()} trades
⏸️ Status: ${isPaused ? '*PAUSED*' : '*Active*'}

*Commands:*
• /refresh - Manual full cycle
• /setinterval <min> - Change check interval
• /setmaxglobal <trades> - Set global trade limit
• /pause - Pause automatic checks
• /resume - Resume automatic checks
• /checkall - Check all configs
• /check1, /check2, etc - Check specific config
• /cleardata - Delete all data (requires confirmation)
• /status - Show this message
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
    
    await bot!.sendMessage(chatId, '⚠️ *WARNING*: This will delete ALL stored trade data!\n\nReply with `/cleardata confirm` to proceed.', { parse_mode: 'Markdown' })
  })
  
  // Handle /cleardata confirm
  bot.onText(/\/cleardata confirm/, async (msg) => {
    const chatId = msg.chat.id.toString()
    
    if (chatId !== TELEGRAM_CHAT_ID) {
      console.log(`❌ Unauthorized command from chat ID: ${chatId}`)
      return
    }
    
    await bot!.sendMessage(chatId, '🗑️ Deleting all stored trade data...', { parse_mode: 'Markdown' })
    console.log('📱 Received /cleardata confirm command from Telegram')
    
    try {
      // Clear the storage by reinitializing from configurations
      const { saveCopyTrades } = await import('./trade-storage.js')
      saveCopyTrades([])
      
      // Reinitialize from configurations
      initializeCopyTrades()
      
      await bot!.sendMessage(chatId, '✅ All trade data cleared! Fresh runs created from configurations.', { parse_mode: 'Markdown' })
      console.log('✅ Trade data cleared and reinitialized')
    } catch (error: any) {
      await bot!.sendMessage(chatId, `❌ Error clearing data: ${error.message}`, { parse_mode: 'Markdown' })
      console.error('❌ Error clearing data:', error)
    }
  })
  
  console.log('✅ Telegram bot commands initialized (/refresh, /setinterval, /setmaxglobal, /pause, /resume, /cleardata, /status)')
} else {
  console.log('⚠️  Telegram bot commands disabled (missing credentials)')
}

// Load configurations
const configurations = getMonitoredConfigurations()

if (configurations.length === 0) {
  console.error('⚠️  No configurations found!')
  console.error('Export your configurations from the Copy Simulator and save to configurations.json')
  console.error('')
  console.error('In your browser console on the Copy Simulator page, run:')
  console.error('copy(JSON.stringify(JSON.parse(localStorage.getItem("copyTrades") || "[]")))')
  console.error('Then paste the output into bot/configurations.json')
  process.exit(1)
}

// Initialize copy trade storage from configurations
initializeCopyTrades()

console.log(`📊 Monitoring ${configurations.length} configuration(s)`)
configurations.forEach((config, i) => {
  console.log(`   ${i + 1}. ${config.name} - ${config.traderAddress.slice(0, 10)}... (${config.minTriggerAmount >= 0 ? `$${config.minTriggerAmount}+` : 'any'} | ${(config.minPrice * 100).toFixed(0)}-${(config.maxPrice * 100).toFixed(0)}%)`)
})

// Start cron schedule with initial interval
currentCronJob = cron.schedule(`*/${currentInterval} * * * *`, runCheck)
console.log(`⏰ Cron job scheduled: Every ${currentInterval} minutes`)

async function runCheck() {
  const timestamp = new Date().toLocaleString('en-US', { 
    timeZone: 'Europe/Brussels',
    hour12: false 
  })
  console.log(`\n⏰ [${timestamp}] Running scheduled resolution check...`)
  
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
  
  for (const config of configurations) {
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

// Start API server
startApiServer()

// Notify bot started
notifyBotStarted(configurations.length)

// Run once on startup
console.log('🚀 Running initial check...\n')
runCheck()

console.log('🤖 Bot is running! Press Ctrl+C to stop.')
