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

// Legacy monolithic file (kept for migration only)
const LEGACY_STORAGE_FILE = path.join(STORAGE_DIR, 'copy-trades-data.json')

// Ensure storage directory exists (Railway volume mount point)
if (!fs.existsSync(STORAGE_DIR)) {
  try {
    fs.mkdirSync(STORAGE_DIR, { recursive: true })
    console.log(`📁 Created storage directory: ${STORAGE_DIR}`)
  } catch (error) {
    console.error(`❌ Failed to create storage directory:`, error)
  }
}

console.log(`💾 Storage: ${STORAGE_DIR} | Persistent: ${process.env.RAILWAY_ENVIRONMENT ? 'YES' : 'NO (local)'}`)

// Per-run file path — each run gets its own small file
function getRunFile(runId: string): string {
  return path.join(STORAGE_DIR, `run-${runId}.json`)
}

// Slim a run's trades before writing: strip heavy fields not needed for resolution
function slimAndPrune(run: CopyTradeRun, maxTrades = 50000): CopyTradeRun {
  let trades = run.trades
  if (trades.length > maxTrades) {
    trades = [...trades].sort((a, b) => b.timestamp - a.timestamp).slice(0, maxTrades)
    console.log(`✂️  Auto-pruned ${run.name}: ${run.trades.length} → ${trades.length} trades`)
  }
  const slimTrades = trades.map(({ icon: _i, originalTrade: _o, ...t }) => t)
  return { ...run, trades: slimTrades }
}

// Write a single run to its own file — cheap, no matter how many other runs exist
function writeRunFile(run: CopyTradeRun): void {
  try {
    fs.writeFileSync(getRunFile(run.id), JSON.stringify(slimAndPrune(run)), 'utf-8')
  } catch (error) {
    console.error(`Error writing run file for ${run.name}:`, error)
  }
}

export function loadCopyTrades(): CopyTradeRun[] {
  // Try per-run files first (new format)
  try {
    const files = fs.readdirSync(STORAGE_DIR).filter(f => f.startsWith('run-') && f.endsWith('.json'))
    if (files.length > 0) {
      return files.map(f => {
        try {
          return JSON.parse(fs.readFileSync(path.join(STORAGE_DIR, f), 'utf-8')) as CopyTradeRun
        } catch { return null }
      }).filter(Boolean) as CopyTradeRun[]
    }
  } catch (error) {
    console.error('Error reading run files:', error)
  }

  // Fall back to legacy monolithic file and migrate
  try {
    if (fs.existsSync(LEGACY_STORAGE_FILE)) {
      const runs: CopyTradeRun[] = JSON.parse(fs.readFileSync(LEGACY_STORAGE_FILE, 'utf-8'))
      console.log(`📦 Migrating ${runs.length} run(s) from legacy storage to per-run files...`)
      runs.forEach(writeRunFile)
      // Keep legacy file as backup but rename it
      fs.renameSync(LEGACY_STORAGE_FILE, LEGACY_STORAGE_FILE + '.migrated')
      console.log(`✅ Migration complete`)
      return runs
    }
  } catch (error) {
    console.error('Error migrating legacy storage:', error)
  }

  return []
}

// saveCopyTrades: writes each run to its own file (used for bulk operations)
export function saveCopyTrades(runs: CopyTradeRun[]): void {
  runs.forEach(writeRunFile)
}

export function getCopyTradeById(id: string): CopyTradeRun | undefined {
  try {
    const file = getRunFile(id)
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf-8')) as CopyTradeRun
    }
  } catch (error) {
    console.error(`Error loading run ${id}:`, error)
  }
  return undefined
}

// KEY FIX: updateCopyTrade now ONLY reads + writes the ONE changed run file.
// Previously it reloaded ALL runs and re-serialized everything — OOM with 30k+ trades.
export function updateCopyTrade(updatedRun: CopyTradeRun): void {
  writeRunFile(updatedRun)
}

export function initializeCopyTradesFromConfigurations(configurations: any[]): void {
  const existingRuns = loadCopyTrades()
  const configIds = new Set(configurations.map(c => c.id))

  // Delete files for runs no longer in configurations
  let removedCount = 0
  for (const run of existingRuns) {
    if (!configIds.has(run.id)) {
      try { fs.unlinkSync(getRunFile(run.id)) } catch {}
      removedCount++
    }
  }

  // Create new run files for new configurations
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
      trades: [] as StoredTrade[]
    }))

  newRuns.forEach(writeRunFile)

  if (removedCount > 0) console.log(`🗑️ Removed ${removedCount} deleted run(s)`)
  if (newRuns.length > 0) console.log(`✅ Initialized ${newRuns.length} new copy trade run(s)`)
}
