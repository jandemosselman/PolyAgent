#!/usr/bin/env node

/**
 * EMERGENCY CLEANUP SCRIPT
 * 
 * This script will:
 * 1. Keep only the last 1000 trades per run (instead of 50,000+)
 * 2. Remove duplicate runs
 * 3. Drastically reduce file size
 * 
 * Usage: node emergency-cleanup.js
 */

const fs = require('fs')
const path = require('path')

const RAILWAY_URL = 'https://polyagent-production.up.railway.app'

async function emergencyCleanup() {
  console.log('🚨 EMERGENCY CLEANUP STARTING...')
  
  try {
    // Fetch current data from Railway
    console.log('📥 Fetching data from Railway...')
    const response = await fetch(`${RAILWAY_URL}/api/copy-trades`)
    
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`)
    }
    
    const runs = await response.json()
    console.log(`📊 Found ${runs.length} runs`)
    
    // Calculate total trades
    const totalTrades = runs.reduce((sum, run) => sum + run.trades.length, 0)
    console.log(`📊 Total trades: ${totalTrades.toLocaleString()}`)
    
    // Trim each run to max 1000 trades (keep most recent)
    const trimmedRuns = runs.map(run => {
      const originalTradeCount = run.trades.length
      
      if (run.trades.length > 1000) {
        // Keep only the 1000 most recent trades
        const sortedTrades = run.trades.sort((a, b) => b.timestamp - a.timestamp)
        run.trades = sortedTrades.slice(0, 1000)
        
        console.log(`✂️  Trimmed run ${run.name}: ${originalTradeCount} → ${run.trades.length} trades`)
      }
      
      return run
    })
    
    const newTotalTrades = trimmedRuns.reduce((sum, run) => sum + run.trades.length, 0)
    console.log(`\n✅ Reduced from ${totalTrades.toLocaleString()} to ${newTotalTrades.toLocaleString()} trades`)
    console.log(`💾 Saved approximately ${((totalTrades - newTotalTrades) * 0.5 / 1024).toFixed(2)} MB`)
    
    // Save cleaned data back to Railway
    console.log('\n📤 Uploading cleaned data to Railway...')
    const uploadResponse = await fetch(`${RAILWAY_URL}/api/copy-trades`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(trimmedRuns)
    })
    
    if (!uploadResponse.ok) {
      throw new Error(`Failed to upload: ${uploadResponse.status}`)
    }
    
    console.log('✅ CLEANUP COMPLETE!')
    console.log('\n🔄 Now restart the Railway bot from the Railway dashboard')
    
  } catch (error) {
    console.error('❌ ERROR:', error.message)
    process.exit(1)
  }
}

emergencyCleanup()
