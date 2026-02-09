import express from 'express'
import { loadCopyTrades, saveCopyTrades, CopyTradeRun, initializeCopyTradesFromConfigurations } from './trade-storage.js'
import { saveConfigurations, loadConfigurationsFromFile } from './copy-trade-manager.js'

const app = express()
app.use(express.json())

// Enable CORS for localhost
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE')
  res.header('Access-Control-Allow-Headers', 'Content-Type')
  next()
})

// GET /api/copy-trades - Fetch all copy trade runs
app.get('/api/copy-trades', (req, res) => {
  try {
    const runs = loadCopyTrades()
    console.log(`📡 API: Serving ${runs.length} run(s)`)
    runs.forEach(r => console.log(`   - ${r.name}: ${r.trades.length} trades, $${r.currentBudget.toFixed(2)} budget`))
    res.json({ success: true, data: runs })
  } catch (error: any) {
    console.error('Error fetching copy trades:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// POST /api/copy-trades - Update all copy trade runs (sync from localhost)
app.post('/api/copy-trades', (req, res) => {
  try {
    const runs: CopyTradeRun[] = req.body.runs
    
    if (!runs || !Array.isArray(runs)) {
      return res.status(400).json({ success: false, error: 'Invalid data format' })
    }
    
    saveCopyTrades(runs)
    console.log(`💾 Received sync from localhost: ${runs.length} run(s)`)
    
    
    res.json({ success: true, message: 'Data synced successfully' })
  } catch (error: any) {
    console.error('Error syncing copy trades:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// GET /api/configurations - Fetch all configurations
app.get('/api/configurations', (req, res) => {
  try {
    const configs = loadConfigurationsFromFile()
    console.log(`📡 API: Serving ${configs.length} configuration(s)`)
    res.json({ success: true, data: configs })
  } catch (error: any) {
    console.error('Error fetching configurations:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// POST /api/configurations - Sync configurations from localhost
app.post('/api/configurations', (req, res) => {
  try {
    const configs = req.body.configurations
    
    if (!configs || !Array.isArray(configs)) {
      return res.status(400).json({ success: false, error: 'Invalid data format' })
    }
    
    // Save configurations to file
    saveConfigurations(configs)
    
    // Sync with existing runs or create new ones
    initializeCopyTradesFromConfigurations(configs)
    
    console.log(`💾 Synced ${configs.length} configuration(s) from localhost`)
    
    res.json({ success: true, message: `Synced ${configs.length} configuration(s)` })
  } catch (error: any) {
    console.error('Error syncing configurations:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Start server
const PORT = process.env.PORT || 3000

export function startApiServer() {
  app.listen(PORT, () => {
    console.log(`🌐 API server running on port ${PORT}`)
    console.log(`📡 Endpoints:`)
    console.log(`   GET  /api/copy-trades - Fetch all runs`)
    console.log(`   POST /api/copy-trades - Sync from localhost`)
    console.log(`   GET  /api/configurations - Fetch all configurations`)
    console.log(`   POST /api/configurations - Sync configurations from localhost`)
    console.log(`   GET  /health - Health check`)
  })
}

