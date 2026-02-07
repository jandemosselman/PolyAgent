import TelegramBot from 'node-telegram-bot-api'

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID!

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
  console.error('❌ Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID environment variables!')
  process.exit(1)
}

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false })

export async function sendTelegramUpdate(message: string) {
  try {
    await bot.sendMessage(TELEGRAM_CHAT_ID, message, {
      parse_mode: 'Markdown'
    })
    console.log('📤 Telegram notification sent')
  } catch (error: any) {
    console.error('Failed to send Telegram message:', error.message)
  }
}

export async function notifyWinRateChange(
  trader: string,
  oldWinRate: number,
  newWinRate: number,
  totalTrades: number,
  wins: number,
  losses: number,
  avgPnL: number
) {
  const change = newWinRate - oldWinRate
  const emoji = change > 0 ? '📈' : '📉'
  const sign = change > 0 ? '+' : ''
  
  const message = `
${emoji} *Win Rate Update*

Trader: \`${trader.slice(0, 10)}...\`
Win Rate: *${newWinRate.toFixed(1)}%* (${sign}${change.toFixed(1)}%)
Total Trades: ${totalTrades}
W/L: ${wins}/${losses}
Avg P&L: $${avgPnL.toFixed(2)}
  `.trim()
  
  await sendTelegramUpdate(message)
}

export async function notifyNewTrades(
  trader: string,
  newTradesCount: number,
  winRate: number,
  totalTrades: number,
  avgPnL: number
) {
  const message = `
🔔 *New Trades Detected*

Trader: \`${trader.slice(0, 10)}...\`
New Trades: *${newTradesCount}*
Current Win Rate: ${winRate.toFixed(1)}%
Total Trades: ${totalTrades}
Avg P&L: $${avgPnL.toFixed(2)}
  `.trim()
  
  await sendTelegramUpdate(message)
}

export async function notifyError(trader: string, error: string) {
  const message = `
❌ *Error Checking Trader*

Trader: \`${trader.slice(0, 10)}...\`
Error: ${error}
  `.trim()
  
  await sendTelegramUpdate(message)
}

export async function notifyBotStarted(traderCount: number) {
  const message = `
🤖 *Bot Started*

Monitoring ${traderCount} trader${traderCount !== 1 ? 's' : ''}
Checking every 10 minutes
  `.trim()
  
  await sendTelegramUpdate(message)
}
