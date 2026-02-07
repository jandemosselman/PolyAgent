import 'dotenv/config'
import cron from 'node-cron'
import { checkResolutionsForConfig, getMonitoredConfigurations } from './resolution-checker.js'
import { notifyBotStarted } from './telegram-notifier.js'

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
      await checkResolutionsForConfig(config)
      
      // Wait 3 seconds between configs to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 3000))
    } catch (error: any) {
      console.error(`❌ Error checking config ${config.name}:`, error.message)
    }
  }
  
  console.log('✅ Finished checking all configurations\n')
}

// Notify bot started
notifyBotStarted(configurations.length)

// Run once on startup
console.log('🚀 Running initial check...\n')
runCheck()

console.log('🤖 Bot is running! Press Ctrl+C to stop.')
