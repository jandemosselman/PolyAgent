const fs = require('fs');
const content = fs.readFileSync('index.ts', 'utf-8');

// Find and replace the dashboard building section
const oldCode = `      // Build dashboard
      let dashboard = \`
🏠 *POLYAGENT DASHBOARD*

📊 *Overall Statistics*
━━━━━━━━━━━━━━━━━━━━
Total Runs: \${runs.length}
Total Trades: \${totalTrades.toLocaleString()}
  • Open: \${totalOpen.toLocaleString()}
  • Closed: \${totalClosed.toLocaleString()}
  • Won: \${totalWon.toLocaleString()} (\${overallWinRate.toFixed(1)}%)
  • Lost: \${totalLost.toLocaleString()}

💰 *Budget Summary*
━━━━━━━━━━━━━━━━━━━━
Total P&L: \${totalPnL >= 0 ? '+' : ''}\$\${totalPnL.toFixed(2)}
Budget Used: \$\${totalBudgetUsed.toFixed(2)}
Available: \$\${totalBudgetAvailable.toFixed(2)}

⚙️ *Bot Settings*
━━━━━━━━━━━━━━━━━━━━
Status: \${isPaused ? '⏸️ PAUSED' : '▶️ Active'}
Interval: Every \${currentInterval} min
Trade Limit: \${maxGlobalTrades.toLocaleString()}
Largest Run: \${maxTradeRun.name} (\${maxTradeRun.trades?.length || 0} trades)

🧠 *Memory*
━━━━━━━━━━━━━━━━━━━━\`

      // Add memory info
      const mem = process.memoryUsage()
      const rssMB = mem.rss / 1024 / 1024
      const railwayLimit = 512
      const memPercent = (rssMB / railwayLimit * 100).toFixed(1)
      const memStatus = rssMB > railwayLimit * 0.85 ? '🔴 CRITICAL' : rssMB > railwayLimit * 0.7 ? '⚠️ Warning' : '✅ Healthy'
      
      dashboard += \`
\${memStatus}: \${rssMB.toFixed(0)} MB / \${railwayLimit} MB (\${memPercent}%)

📋 *Run Details*
━━━━━━━━━━━━━━━━━━━━
\`
      
      runStats.forEach((stat, i) => {
        dashboard += \`
\${i + 1}. *\${stat.name}*
   \${stat.trades} trades | \${stat.open} open | \${stat.closed} closed
   Win Rate: \${stat.winRate.toFixed(1)}% | P&L: \${stat.pnl >= 0 ? '+' : ''}\$\${stat.pnl.toFixed(2)}
   Available: \$\${stat.budgetAvailable.toFixed(2)}
\`
      })
      
      dashboard += \`
━━━━━━━━━━━━━━━━━━━━

*Quick Commands:*
/refresh - Run check cycle now
/status - Show bot status
/pause - Pause automatic checks
\`
      
      await bot!.sendMessage(chatId, dashboard.trim(), { parse_mode: 'Markdown' })`;

const newCode = `      // Get memory info first
      const mem = process.memoryUsage()
      const rssMB = mem.rss / 1024 / 1024
      const railwayLimit = 512
      const memPercent = (rssMB / railwayLimit * 100).toFixed(1)
      const memStatus = rssMB > railwayLimit * 0.85 ? '🔴 CRITICAL' : rssMB > railwayLimit * 0.7 ? '⚠️ Warning' : '✅ Healthy'
      
      // MESSAGE 1: Summary
      const summary = \`
🏠 *POLYAGENT DASHBOARD*

📊 *Overall Statistics*
━━━━━━━━━━━━━━━━━━━━
Total Runs: \${runs.length}
Total Trades: \${totalTrades.toLocaleString()}
  • Open: \${totalOpen.toLocaleString()}
  • Closed: \${totalClosed.toLocaleString()}
  • Won: \${totalWon.toLocaleString()} (\${overallWinRate.toFixed(1)}%)
  • Lost: \${totalLost.toLocaleString()}

💰 *Budget Summary*
━━━━━━━━━━━━━━━━━━━━
Total P&L: \${totalPnL >= 0 ? '+' : ''}\$\${totalPnL.toFixed(2)}
Budget Used: \$\${totalBudgetUsed.toFixed(2)}
Available: \$\${totalBudgetAvailable.toFixed(2)}

⚙️ *Bot Settings*
━━━━━━━━━━━━━━━━━━━━
Status: \${isPaused ? '⏸️ PAUSED' : '▶️ Active'}
Interval: Every \${currentInterval} min
Trade Limit: \${maxGlobalTrades.toLocaleString()}
Largest Run: \${maxTradeRun.name} (\${maxTradeRun.trades?.length || 0} trades)

🧠 *Memory*
━━━━━━━━━━━━━━━━━━━━
\${memStatus}: \${rssMB.toFixed(0)} MB / \${railwayLimit} MB (\${memPercent}%)
\`.trim()
      
      await bot!.sendMessage(chatId, summary, { parse_mode: 'Markdown' })
      
      // MESSAGE 2+: Run details in batches (5 per message to avoid length limits)
      if (runStats.length > 0) {
        const batchSize = 5
        const batches = Math.ceil(runStats.length / batchSize)
        
        for (let batch = 0; batch < batches; batch++) {
          const start = batch * batchSize
          const end = Math.min(start + batchSize, runStats.length)
          const batchStats = runStats.slice(start, end)
          
          let details = \`📋 *Run Details (\${start + 1}-\${end} of \${runStats.length})*\\n━━━━━━━━━━━━━━━━━━━━\\n\\n\`
          
          batchStats.forEach((stat, i) => {
            const runNum = start + i + 1
            details += \`\${runNum}. *\${stat.name}*\\n\`
            details += \`   \${stat.trades} trades | \${stat.open} open | \${stat.closed} closed\\n\`
            details += \`   Win: \${stat.winRate.toFixed(1)}% | P&L: \${stat.pnl >= 0 ? '+' : ''}\$\${stat.pnl.toFixed(2)}\\n\`
            details += \`   Available: \$\${stat.budgetAvailable.toFixed(2)}\\n\\n\`
          })
          
          if (batch === batches - 1) {
            details += \`━━━━━━━━━━━━━━━━━━━━\\n\\n*Quick Commands:*\\n/refresh - Run check cycle now\\n/status - Show bot status\\n/pause - Pause automatic checks\`
          }
          
          await bot!.sendMessage(chatId, details.trim(), { parse_mode: 'Markdown' })
        }
      } else {
        await bot!.sendMessage(chatId, \`📋 *Run Details*\\n━━━━━━━━━━━━━━━━━━━━\\n\\nNo active runs yet.\\n\\n*Quick Commands:*\\n/refresh - Run check cycle now\\n/status - Show bot status\`, { parse_mode: 'Markdown' })
      }`;

const newContent = content.replace(oldCode, newCode);

if (newContent === content) {
  console.log('ERROR: Pattern not found!');
  process.exit(1);
}

fs.writeFileSync('index.ts', newContent, 'utf-8');
console.log('✅ Successfully applied fix!');
