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

Schedule: Every 10 minutes

Commands:
• /checkall - Check all configs
• /check1, /check2, etc - Check specific config
• /status - Show this message
    `.trim(), { parse_mode: 'Markdown' })
  })
  
  console.log('✅ Telegram bot commands initialized (/checkall, /status)')
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

// Cron schedule - Every 10 minutes (change as needed)
// '*/5 * * * *'   = Every 5 minutes
// '*/10 * * * *'  = Every 10 minutes (CURRENT)
// '*/30 * * * *'  = Every 30 minutes
// '0 * * * *'     = Every hour
cron.schedule('*/10 * * * *', runCheck)

async function runCheck() {
  const timestamp = new Date().toLocaleString('en-US', { 
    timeZone: 'Europe/Brussels',
    hour12: false 
  })
  console.log(`\n⏰ [${timestamp}] Running scheduled resolution check...`)
  
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
