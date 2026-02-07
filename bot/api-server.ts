import express from 'express'
import { loadCopyTrades, saveCopyTrades, CopyTradeRun } from './trade-storage.js'

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
    console.log(`   GET  /health - Health check`)
  })
}
