#!/usr/bin/env node

/**
 * AGGRESSIVE CLEANUP SCRIPT
 * 
 * This will:
 * 1. Remove ALL inactive runs (isActive: false)
 * 2. Keep only last 500 trades for active runs
 * 3. Maximum file size reduction
 * 
 * ⚠️  WARNING: This will DELETE inactive run data!
 * 
 * Usage: node aggressive-cleanup.js
 */

const fs = require('fs')
const path = require('path')

const RAILWAY_URL = 'https://polyagent-production.up.railway.app'

async function aggressiveCleanup() {
  console.log('🚨 AGGRESSIVE CLEANUP STARTING...')
  console.log('⚠️  This will DELETE all inactive runs!\n')
  
  try {
    // Fetch current data from Railway
    console.log('📥 Fetching data from Railway...')
    const response = await fetch(`${RAILWAY_URL}/api/copy-trades`)
    
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`)
    }
    
    const runs = await response.json()
    console.log(`📊 Found ${runs.length} runs`)
    
    const totalTrades = runs.reduce((sum, run) => sum + run.trades.length, 0)
    console.log(`📊 Total trades: ${totalTrades.toLocaleString()}`)
    
    const activeRuns = runs.filter(run => run.isActive)
    const inactiveRuns = runs.filter(run => !run.isActive)
    
    console.log(`\n📊 Active runs: ${activeRuns.length}`)
    console.log(`📊 Inactive runs: ${inactiveRuns.length} (WILL BE DELETED)`)
    
    // Trim active runs to max 500 trades
    const trimmedRuns = activeRuns.map(run => {
      const originalTradeCount = run.trades.length
      
      if (run.trades.length > 500) {
        // Keep only the 500 most recent trades
        const sortedTrades = run.trades.sort((a, b) => b.timestamp - a.timestamp)
        run.trades = sortedTrades.slice(0, 500)
        
        console.log(`✂️  Trimmed run ${run.name}: ${originalTradeCount} → ${run.trades.length} trades`)
      }
      
      return run
    })
    
    const newTotalTrades = trimmedRuns.reduce((sum, run) => sum + run.trades.length, 0)
    console.log(`\n✅ Reduced from ${runs.length} to ${trimmedRuns.length} runs`)
    console.log(`✅ Reduced from ${totalTrades.toLocaleString()} to ${newTotalTrades.toLocaleString()} trades`)
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
    
    console.log('✅ AGGRESSIVE CLEANUP COMPLETE!')
    console.log('\n🔄 Now restart the Railway bot from the Railway dashboard')
    
  } catch (error) {
    console.error('❌ ERROR:', error.message)
    process.exit(1)
  }
}

aggressiveCleanup()
