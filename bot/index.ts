import 'dotenv/config'
import cron from 'node-cron'
import { checkResolutionsForTrader } from './resolution-checker.js'
import { notifyBotStarted } from './telegram-notifier.js'

// Load monitored traders from environment
const MONITORED_TRADERS = process.env.MONITORED_TRADERS?.split(',').map(a => a.trim()).filter(a => a) || []

if (MONITORED_TRADERS.length === 0) {
  console.error('⚠️  No traders configured!')
  console.error('Add trader addresses to MONITORED_TRADERS in .env file (comma-separated)')
  console.error('Example: MONITORED_TRADERS=0x1234...,0x5678...')
  process.exit(1)
}

console.log(`📊 Monitoring ${MONITORED_TRADERS.length} trader(s)`)
MONITORED_TRADERS.forEach((addr, i) => {
  console.log(`   ${i + 1}. ${addr.slice(0, 10)}...`)
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
  
  for (const trader of MONITORED_TRADERS) {
    try {
      await checkResolutionsForTrader(trader)
      
      // Wait 3 seconds between traders to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 3000))
    } catch (error: any) {
      console.error(`❌ Error checking trader ${trader}:`, error.message)
    }
  }
  
  console.log('✅ Finished checking all traders\n')
}

// Notify bot started
notifyBotStarted(MONITORED_TRADERS.length)

// Run once on startup
console.log('🚀 Running initial check...\n')
runCheck()

console.log('🤖 Bot is running! Press Ctrl+C to stop.')
