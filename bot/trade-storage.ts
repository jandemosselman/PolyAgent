import fs from 'fs'
import path from 'path'

export interface StoredTrade {
  id: string
  // ⚡ OPTIMIZED: Only store essential fields from originalTrade (not full API response)
  originalTrade?: {
    amount?: string
    size?: string
    price?: string
    type?: string
    side?: string
  }
  // All essential fields extracted:
  timestamp: number
  market: string
  outcome: string
  price: number
  amount: number
  asset: string
  conditionId: string
  slug?: string
  transactionHash: string
  icon?: string
  status: 'open' | 'won' | 'lost'
  pnl?: number
}

export interface CopyTradeRun {
  id: string
  name: string
  traderAddress: string
  initialBudget: number
  currentBudget: number
  fixedBetAmount: number
  minTriggerAmount: number
  minPrice: number
  maxPrice: number
  isActive: boolean
  createdAt: number
  lastChecked: number
  trades: StoredTrade[]
}

// 🛡️ PERSISTENT STORAGE PATH
// Use /data for Railway persistent volume (survives crashes/restarts)
// Falls back to current directory for local development
const STORAGE_DIR = process.env.RAILWAY_ENVIRONMENT 
  ? '/data' 
  : process.cwd()

const STORAGE_FILE = path.join(STORAGE_DIR, 'copy-trades-data.json')

// Ensure storage directory exists (Railway volume mount point)
if (!fs.existsSync(STORAGE_DIR)) {
  try {
    fs.mkdirSync(STORAGE_DIR, { recursive: true })
    console.log(`📁 Created storage directory: ${STORAGE_DIR}`)
  } catch (error) {
    console.error(`❌ Failed to create storage directory:`, error)
  }
}

console.log(`💾 Storage location: ${STORAGE_FILE}`)
console.log(`🛡️ Persistent: ${process.env.RAILWAY_ENVIRONMENT ? 'YES (Railway Volume)' : 'NO (Local Dev)'}`)

export function loadCopyTrades(): CopyTradeRun[] {
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      const data = fs.readFileSync(STORAGE_FILE, 'utf-8')
      return JSON.parse(data)
    }
  } catch (error) {
    console.error('Error loading copy trades:', error)
  }
  return []
}

export function saveCopyTrades(runs: CopyTradeRun[]): void {
  try {
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(runs, null, 2), 'utf-8')
    console.log(`💾 Saved ${runs.length} copy trade run(s) to storage`)
  } catch (error) {
    console.error('Error saving copy trades:', error)
  }
}

export function getCopyTradeById(id: string): CopyTradeRun | undefined {
  const runs = loadCopyTrades()
  return runs.find(r => r.id === id)
}

export function updateCopyTrade(updatedRun: CopyTradeRun): void {
  const runs = loadCopyTrades()
  const index = runs.findIndex(r => r.id === updatedRun.id)
  
  if (index !== -1) {
    runs[index] = updatedRun
    saveCopyTrades(runs)
  } else {
    console.error(`Copy trade run ${updatedRun.id} not found`)
  }
}

export function initializeCopyTradesFromConfigurations(configurations: any[]): void {
  const existingRuns = loadCopyTrades()
  const existingIds = new Set(existingRuns.map(r => r.id))
  
  const newRuns = configurations
    .filter(config => !existingIds.has(config.id))
    .map(config => ({
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
    }))
  
  if (newRuns.length > 0) {
    const allRuns = [...existingRuns, ...newRuns]
    saveCopyTrades(allRuns)
    console.log(`✅ Initialized ${newRuns.length} new copy trade run(s)`)
  }
}
