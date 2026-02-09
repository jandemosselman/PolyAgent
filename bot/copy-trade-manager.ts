import { sendTelegramUpdate } from './telegram-notifier.js'
import { loadCopyTrades, saveCopyTrades, CopyTradeRun, updateCopyTrade, initializeCopyTradesFromConfigurations } from './trade-storage.js'
import { scanForNewTrades } from './trade-scanner.js'
import { checkResolutionsForStoredTrades } from './trade-resolver.js'
import fs from 'fs'
import path from 'path'

interface Configuration {
  id: string
  name: string
  traderAddress: string
  minTriggerAmount: number
  minPrice: number
  maxPrice: number
  initialBudget: number
  fixedBetAmount: number
}

// Get configuration file path (use persistent volume if on Railway)
function getConfigPath(): string {
  const storageDir = process.env.RAILWAY_ENVIRONMENT ? '/data' : process.cwd()
  return path.join(storageDir, 'configurations.json')
}

// Load configurations from environment or file
function loadConfigurations(): Configuration[] {
  try {
    // Try environment variable first (deprecated, kept for backwards compatibility)
    const envConfigs = process.env.CONFIGURATIONS
    if (envConfigs) {
      console.log('⚠️ Using CONFIGURATIONS env var (deprecated). Consider syncing from localhost instead.')
      return JSON.parse(envConfigs)
    }
    
    // Try file (preferred method)
    const configPath = getConfigPath()
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf-8')
      const configs = JSON.parse(data)
      console.log(`📋 Loaded ${configs.length} configuration(s) from ${configPath}`)
      return configs
    }
  } catch (error) {
    console.error('Error loading configurations:', error)
  }
  
  console.log('📋 No configurations found')
  return []
}

// Save configurations to file
export function saveConfigurations(configurations: Configuration[]): void {
  try {
    const configPath = getConfigPath()
    fs.writeFileSync(configPath, JSON.stringify(configurations, null, 2), 'utf-8')
    console.log(`💾 Saved ${configurations.length} configuration(s) to ${configPath}`)
  } catch (error) {
    console.error('Error saving configurations:', error)
    throw error
  }
}

// Load configurations from file (for API access)
export function loadConfigurationsFromFile(): Configuration[] {
  return loadConfigurations()
}

// Clear all configurations
export function clearConfigurations(): void {
  try {
    const configPath = getConfigPath()
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath)
      console.log(`🗑️ Deleted configurations file: ${configPath}`)
    }
  } catch (error) {
    console.error('Error clearing configurations:', error)
    throw error
  }
}

export function getMonitoredConfigurations(): Configuration[] {
  return loadConfigurations()
}

// Initialize copy trade runs from configurations
export function initializeCopyTrades() {
  const configurations = loadConfigurations()
  initializeCopyTradesFromConfigurations(configurations)
}

export async function performFullCheckCycle(config: Configuration) {
  console.log(`🔍 Starting full check cycle for: ${config.name}`)
  
  try {
    // Load the corresponding copy trade run
    const runs = loadCopyTrades()
    let run = runs.find(r => r.id === config.id)
    
    // If no run exists, create one
    if (!run) {
      run = {
        id: config.id,
        name: config.name,
        traderAddress: config.traderAddress,
        initialBudget: config.initialBudget,
        currentBudget: config.initialBudget,
        fixedBetAmount: config.fixedBetAmount,
        minTriggerAmount: config.minTriggerAmount,
        minPrice: config.minPrice,
        maxPrice: config.maxPrice,
        isActive: true,
        createdAt: Date.now(),
        lastChecked: Date.now(),
        trades: []
      }
      runs.push(run)
      saveCopyTrades(runs)
      console.log(`  ✨ Created new copy trade run`)
    }
    
    const initialTradeCount = run.trades.length
    const initialBudget = run.currentBudget
    
    // STEP 1: Check resolutions on open trades
    console.log(`  📊 Step 1: Checking resolutions...`)
    const { resolvedTrades: resolved1, budgetReturned: returned1 } = await checkResolutionsForStoredTrades(run)
    
    if (resolved1.length > 0) {
      run.currentBudget += returned1
      updateCopyTrade(run)
    }
    
    // STEP 2: Scan for new trades
    console.log(`  🔄 Step 2: Scanning for new trades...`)
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    const { newTrades, totalMatching } = await scanForNewTrades(run)
    
    if (newTrades.length > 0) {
      const budgetUsed = newTrades.length * run.fixedBetAmount
      run.trades = [...newTrades, ...run.trades]
      run.currentBudget -= budgetUsed
      console.log(`  ✅ Added ${newTrades.length} new trade(s)`)
    }
    
    // STEP 3: Check resolutions again
    console.log(`  📊 Step 3: Checking resolutions again...`)
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    const { resolvedTrades: resolved2, budgetReturned: returned2 } = await checkResolutionsForStoredTrades(run)
    
    if (resolved2.length > 0) {
      run.currentBudget += returned2
    }
    
    // Update last checked
    run.lastChecked = Date.now()
    updateCopyTrade(run)
    
    console.log(`  💾 Final state: ${run.trades.length} total trades, $${run.currentBudget.toFixed(2)} budget`)
    
    // Calculate stats
    const closedTrades = run.trades.filter(t => t.status !== 'open')
    const wins = closedTrades.filter(t => t.status === 'won').length
    const losses = closedTrades.filter(t => t.status === 'lost').length
    const totalPnL = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0)
    const avgPnL = closedTrades.length > 0 ? totalPnL / closedTrades.length : 0
    const winRate = closedTrades.length > 0 ? (wins / closedTrades.length) * 100 : 0
    
    // Send notifications about changes
    const totalResolved = resolved1.length + resolved2.length
    const wonNow = resolved1.filter(t => t.status === 'won').length + resolved2.filter(t => t.status === 'won').length
    const lostNow = totalResolved - wonNow
    
    if (newTrades.length > 0 || totalResolved > 0) {
      let message = `🔔 *Update: ${run.name}*\n\n`
      
      if (newTrades.length > 0) {
        message += `🆕 New Trades: *${newTrades.length}*\n`
        if (totalMatching > newTrades.length) {
          message += `⚠️ ${totalMatching - newTrades.length} skipped (no budget)\n`
        }
      }
      
      if (totalResolved > 0) {
        message += `✅ Resolved: ${totalResolved} (${wonNow}W/${lostNow}L)\n`
      }
      
      message += `\n📊 *Current Stats*\n`
      message += `Win Rate: ${winRate.toFixed(1)}%\n`
      message += `Total Trades: ${run.trades.length} (${closedTrades.length} closed)\n`
      message += `Budget: $${run.currentBudget.toFixed(2)}\n`
      message += `Total P&L: $${totalPnL.toFixed(2)}`
      
      await sendTelegramUpdate(message.trim())
    }
    
    console.log(`✅ ${run.name}: ${winRate.toFixed(1)}% WR | ${run.trades.length} trades | $${run.currentBudget.toFixed(2)} budget`)
    
  } catch (error: any) {
    console.error(`❌ Error in full check cycle for ${config.name}:`, error.message)
    await sendTelegramUpdate(`❌ *Error: ${config.name}*\n\n${error.message}`)
  }
}

// Alias for backwards compatibility
export const checkResolutionsForConfig = performFullCheckCycle
