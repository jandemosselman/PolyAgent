#!/usr/bin/env node

/**
 * Setup script to extract trader addresses from your browser's localStorage
 * 
 * HOW TO USE:
 * 1. Open your Copy Simulator page in your browser (http://localhost:3000/copy-simulator)
 * 2. Open browser DevTools (F12 or right-click > Inspect)
 * 3. Go to Console tab
 * 4. Paste this code and hit Enter:
 * 
 *    JSON.parse(localStorage.getItem('copyTrades') || '[]').map(ct => ct.traderAddress).filter((addr, i, arr) => arr.indexOf(addr) === i).join(',')
 * 
 * 5. Copy the output (it will be comma-separated addresses)
 * 6. Paste those addresses below when prompted
 */

import readline from 'readline'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

console.log('🔧 Bot Configuration Setup\n')
console.log('To get your trader addresses:')
console.log('1. Open http://localhost:3000/copy-simulator in your browser')
console.log('2. Press F12 to open DevTools → Console tab')
console.log('3. Paste this code and press Enter:\n')
console.log('   JSON.parse(localStorage.getItem("copyTrades") || "[]").map(ct => ct.traderAddress).filter((addr, i, arr) => arr.indexOf(addr) === i).join(",")\n')
console.log('4. Copy the output and paste it below\n')

rl.question('Paste trader addresses (comma-separated): ', (addresses) => {
  const trimmed = addresses.trim()
  
  if (!trimmed) {
    console.error('❌ No addresses provided!')
    rl.close()
    return
  }
  
  // Validate addresses
  const addressList = trimmed.split(',').map(a => a.trim()).filter(a => a)
  const validAddresses = addressList.filter(addr => /^0x[a-fA-F0-9]{40}$/.test(addr))
  
  if (validAddresses.length === 0) {
    console.error('❌ No valid Ethereum addresses found!')
    console.error('   Addresses should start with 0x and be 42 characters long')
    rl.close()
    return
  }
  
  console.log(`\n✅ Found ${validAddresses.length} valid address(es):`)
  validAddresses.forEach((addr, i) => {
    console.log(`   ${i + 1}. ${addr}`)
  })
  
  // Update .env file
  const envPath = path.join(__dirname, '.env')
  let envContent = fs.readFileSync(envPath, 'utf-8')
  
  // Replace MONITORED_TRADERS line
  envContent = envContent.replace(
    /MONITORED_TRADERS=.*/,
    `MONITORED_TRADERS=${validAddresses.join(',')}`
  )
  
  fs.writeFileSync(envPath, envContent)
  
  console.log('\n✅ Updated .env file successfully!')
  console.log('\nYou can now run:')
  console.log('  npm run dev   (to test locally)')
  console.log('  npm start     (for production)')
  
  rl.close()
})
