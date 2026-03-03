'use client'

import { useState, useEffect } from 'react'
import {
  loadStrategies,
  saveStrategy,
  deleteStrategy,
  addLiveSession,
  deleteLiveSession,
  unlinkRunFromStrategy,
  linkRunToStrategy,
  generateId,
  type SavedStrategy,
  type LiveSession,
  type LinkedRun,
} from '@/lib/strategyStore'

// ─── IndexedDB (same DB as copy-simulator) ────────────────────────────────────
const DB_NAME = 'PolyAgentDB'
const DB_VERSION = 1
const STORE_NAME = 'copyTrades'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = e => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME)
    }
  })
}

async function loadCopyTradesFromIDB(): Promise<any[]> {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get('copyTrades')
      req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : [])
      req.onerror = () => resolve([])
    })
  } catch { return [] }
}

// Recompute a snapshot from the live IDB data and update all strategies
async function refreshAllSnapshots(): Promise<number> {
  const runs: any[] = await loadCopyTradesFromIDB()
  if (!runs.length) return 0

  const runsById: Record<string, any> = {}
  for (const r of runs) runsById[r.id] = r

  const strategies = loadStrategies()
  let updated = 0

  for (const strategy of strategies) {
    let changed = false
    for (const linked of strategy.linkedRuns) {
      const live = runsById[linked.runId]
      if (!live) continue
      const closed = (live.trades ?? []).filter((t: any) => t.status !== 'open')
      const won = closed.filter((t: any) => t.status === 'won').length
      const pnl = closed.reduce((s: number, t: any) => s + (t.pnl ?? 0), 0)
      const winRate = closed.length > 0 ? (won / closed.length) * 100 : 0
      linked.snapshot = {
        totalTrades: live.trades?.length ?? 0,
        closedTrades: closed.length,
        winRate,
        pnl,
        isActive: live.isActive ?? true,
        snapshotAt: new Date().toISOString(),
      }
      changed = true
    }
    if (changed) { saveStrategy(strategy); updated++ }
  }
  return updated
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 2) {
  return (n >= 0 ? '+' : '') + n.toFixed(decimals)
}

function pct(n: number) {
  return n.toFixed(1) + '%'
}

function shortAddr(addr: string) {
  if (!addr) return '—'
  return addr.slice(0, 6) + '…' + addr.slice(-4)
}

function survivalColor(rate: number) {
  if (rate >= 90) return 'text-emerald-400'
  if (rate >= 70) return 'text-yellow-400'
  return 'text-red-400'
}

function survivalBg(rate: number) {
  if (rate >= 90) return 'bg-emerald-500/10 border-emerald-500/30'
  if (rate >= 70) return 'bg-yellow-500/10 border-yellow-500/30'
  return 'bg-red-500/10 border-red-500/30'
}

function snapshotAge(isoDate: string) {
  const ms = Date.now() - new Date(isoDate).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function snapshotStale(isoDate: string) {
  return Date.now() - new Date(isoDate).getTime() > 2 * 60 * 60 * 1000 // > 2 hours
}

function verdictLabel(rate: number) {
  if (rate >= 90) return '✅ Safe'
  if (rate >= 70) return '⚠️ Moderate'
  return '❌ High risk'
}

// ─── sub-components ───────────────────────────────────────────────────────────

interface LogSessionFormProps {
  onAdd: (session: LiveSession) => void
  onCancel: () => void
}

function LogSessionForm({ onAdd, onCancel }: LogSessionFormProps) {
  const [durationHours, setDurationHours] = useState(24)
  const [totalTrades, setTotalTrades] = useState(0)
  const [winRate, setWinRate] = useState(50)
  const [pnl, setPnl] = useState(0)
  const [notes, setNotes] = useState('')

  const submit = () => {
    onAdd({
      id: generateId(),
      runAt: new Date().toISOString(),
      durationHours,
      totalTrades,
      winRate,
      pnl,
      notes,
    })
  }

  return (
    <div className="bg-slate-800/50 border border-indigo-500/20 rounded-xl p-4 mt-3 space-y-3">
      <p className="text-sm font-semibold text-indigo-300">📝 Log a Live Session</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-400 block mb-1">Duration (hours)</label>
          <input type="number" value={durationHours} onChange={e => setDurationHours(+e.target.value)} min="0" step="1"
            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-indigo-500" />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Total Trades</label>
          <input type="number" value={totalTrades} onChange={e => setTotalTrades(+e.target.value)} min="0" step="1"
            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-indigo-500" />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Win Rate (%)</label>
          <input type="number" value={winRate} onChange={e => setWinRate(+e.target.value)} min="0" max="100" step="0.1"
            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-indigo-500" />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Net P&L ($)</label>
          <input type="number" value={pnl} onChange={e => setPnl(+e.target.value)} step="0.01"
            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-indigo-500" />
        </div>
      </div>
      <div>
        <label className="text-xs text-slate-400 block mb-1">Notes (optional)</label>
        <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. used 2% slippage, high vol day"
          className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-indigo-500" />
      </div>
      <div className="flex gap-2">
        <button onClick={submit} className="flex-1 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-300 text-sm font-semibold rounded-lg transition-all">
          ✅ Save Session
        </button>
        <button onClick={onCancel} className="px-4 py-2 bg-slate-700/50 text-slate-400 text-sm rounded-lg hover:bg-slate-700 transition-all">
          ✕
        </button>
      </div>
    </div>
  )
}

// ─── comparison block ─────────────────────────────────────────────────────────

function LiveVsMC({ strategy }: { strategy: SavedStrategy }) {
  const sessions = strategy.liveSessions
  if (sessions.length === 0) return null

  const avgLivePnl = sessions.reduce((a, s) => a + s.pnl, 0) / sessions.length
  const avgLiveWR = sessions.reduce((a, s) => a + s.winRate, 0) / sessions.length
  const avgLiveTrades = sessions.reduce((a, s) => a + s.totalTrades, 0) / sessions.length

  const pnlDelta = avgLivePnl - strategy.mcResults.medianPnl
  const wrDelta = avgLiveWR - strategy.mcResults.avgWinRate

  return (
    <div className="mt-3 bg-slate-900/50 border border-slate-700/50 rounded-xl p-4">
      <p className="text-xs font-semibold text-slate-300 mb-3">📊 MC Predictions vs Live Results ({sessions.length} session{sessions.length !== 1 ? 's' : ''})</p>
      <div className="grid grid-cols-3 gap-3 text-center text-xs">
        <div>
          <p className="text-slate-500 mb-1">Median P&L</p>
          <p className="text-slate-300 font-mono">{fmt(strategy.mcResults.medianPnl)} MC</p>
          <p className={`font-mono font-bold ${avgLivePnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(avgLivePnl)} Live</p>
          <p className={`text-[10px] mt-0.5 ${pnlDelta >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {pnlDelta >= 0 ? '▲' : '▼'} {Math.abs(pnlDelta).toFixed(2)} vs MC
          </p>
        </div>
        <div>
          <p className="text-slate-500 mb-1">Win Rate</p>
          <p className="text-slate-300 font-mono">{pct(strategy.mcResults.avgWinRate)} MC</p>
          <p className={`font-mono font-bold ${avgLiveWR >= strategy.mcResults.avgWinRate ? 'text-emerald-400' : 'text-orange-400'}`}>{pct(avgLiveWR)} Live</p>
          <p className={`text-[10px] mt-0.5 ${wrDelta >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {wrDelta >= 0 ? '▲' : '▼'} {Math.abs(wrDelta).toFixed(1)}pp vs MC
          </p>
        </div>
        <div>
          <p className="text-slate-500 mb-1">Avg Trades</p>
          <p className="text-slate-300 font-mono">{Math.round(strategy.mcResults.avgTrades)} MC</p>
          <p className="font-mono font-bold text-cyan-400">{Math.round(avgLiveTrades)} Live</p>
          <p className="text-[10px] mt-0.5 text-slate-500">per session</p>
        </div>
      </div>
      {/* Verdict */}
      <div className={`mt-3 px-3 py-2 rounded-lg text-xs text-center ${
        Math.abs(pnlDelta) <= strategy.mcResults.medianPnl * 0.2
          ? 'bg-emerald-900/20 text-emerald-300'
          : pnlDelta < 0
          ? 'bg-red-900/20 text-red-300'
          : 'bg-cyan-900/20 text-cyan-300'
      }`}>
        {Math.abs(pnlDelta) <= Math.abs(strategy.mcResults.medianPnl) * 0.25
          ? '✅ MC simulation is accurate — live results match within 25%'
          : pnlDelta < 0
          ? '⚠️ Live underperforming vs MC — slippage/market conditions may differ'
          : '🚀 Live outperforming MC predictions'}
      </div>
    </div>
  )
}

// ─── strategy card ─────────────────────────────────────────────────────────────

interface StrategyCardProps {
  strategy: SavedStrategy
  onDelete: (id: string) => void
  onAddSession: (strategyId: string, session: LiveSession) => void
  onDeleteSession: (strategyId: string, sessionId: string) => void
  onRename: (strategyId: string, name: string) => void
  onUnlink: (strategyId: string, runId: string) => void
}

function StrategyCard({ strategy, onDelete, onAddSession, onDeleteSession, onRename, onUnlink }: StrategyCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [showSessionForm, setShowSessionForm] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(strategy.name)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [activeTab, setActiveTab] = useState<'mc' | 'settings' | 'sessions' | 'runs'>('mc')

  const linkedRuns = strategy.linkedRuns ?? []

  const sr = strategy.mcResults.survivalRate

  return (
    <div className={`bg-slate-800/40 border rounded-2xl overflow-hidden transition-all ${
      sr >= 90 ? 'border-emerald-500/20' : sr >= 70 ? 'border-yellow-500/20' : 'border-red-500/20'
    }`}>
      {/* Card header */}
      <div className="flex items-start justify-between p-4 gap-3">
        <div className="flex-1 min-w-0">
          {editingName ? (
            <div className="flex gap-2">
              <input
                autoFocus
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { onRename(strategy.id, nameInput); setEditingName(false) } if (e.key === 'Escape') setEditingName(false) }}
                className="flex-1 px-2 py-1 bg-slate-900 border border-indigo-500/50 rounded-lg text-slate-200 text-sm focus:outline-none"
              />
              <button onClick={() => { onRename(strategy.id, nameInput); setEditingName(false) }} className="px-2 py-1 text-xs text-emerald-300 bg-emerald-500/10 rounded-lg">✓</button>
              <button onClick={() => setEditingName(false)} className="px-2 py-1 text-xs text-slate-400 bg-slate-700/50 rounded-lg">✕</button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-100 truncate">{strategy.name}</h3>
              <button onClick={() => setEditingName(true)} className="text-slate-500 hover:text-slate-300 transition-colors text-xs">✏️</button>
            </div>
          )}
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="text-xs text-slate-500">
              {strategy.trader ? (
                <a
                  href={`https://polymarket.com/profile/${strategy.trader}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-500 hover:text-cyan-400 font-mono"
                >
                  {shortAddr(strategy.trader)}
                </a>
              ) : '—'}
            </span>
            <span className="text-xs text-slate-600">•</span>
            <span className="text-xs text-slate-500">{new Date(strategy.createdAt).toLocaleDateString()}</span>
            <span className="text-xs text-slate-600">•</span>
            <span className="text-xs text-slate-500">{strategy.mcResults.numSimulations} sims</span>
          </div>
        </div>

        {/* Survival rate badge */}
        <div className={`flex-shrink-0 border rounded-xl px-3 py-2 text-center ${survivalBg(sr)}`}>
          <p className={`text-xl font-black ${survivalColor(sr)}`}>{pct(sr)}</p>
          <p className="text-[10px] text-slate-500">survival</p>
          <p className={`text-[10px] font-semibold mt-0.5 ${survivalColor(sr)}`}>{verdictLabel(sr)}</p>
        </div>
      </div>

      {/* Quick stats row */}
      {(() => {
        // Aggregate live run stats for the quick strip
        const liveAvgPnl = linkedRuns.length > 0 ? linkedRuns.reduce((s, r) => s + r.snapshot.pnl, 0) / linkedRuns.length : null
        const liveAvgWR = linkedRuns.length > 0 ? linkedRuns.reduce((s, r) => s + r.snapshot.winRate, 0) / linkedRuns.length : null
        const stats = [
          { label: 'MC Median P&L', value: fmt(strategy.mcResults.medianPnl), color: strategy.mcResults.medianPnl >= 0 ? 'text-emerald-400' : 'text-red-400' },
          { label: 'Sharpe', value: strategy.mcResults.sharpe.toFixed(2), color: strategy.mcResults.sharpe >= 0.5 ? 'text-emerald-400' : strategy.mcResults.sharpe >= 0 ? 'text-yellow-400' : 'text-red-400' },
          { label: 'Consistency', value: pct(strategy.mcResults.consistency), color: strategy.mcResults.consistency >= 70 ? 'text-emerald-400' : strategy.mcResults.consistency >= 50 ? 'text-yellow-400' : 'text-red-400' },
          liveAvgPnl !== null
            ? { label: `Live Avg P&L (${linkedRuns.length})`, value: fmt(liveAvgPnl), color: liveAvgPnl >= 0 ? 'text-emerald-400' : 'text-red-400', sub: liveAvgWR !== null ? `${liveAvgWR.toFixed(1)}% WR` : '' }
            : { label: 'Linked Runs', value: String(linkedRuns.length), color: 'text-cyan-400', sub: '' },
          { label: 'MC Win Rate', value: pct(strategy.mcResults.avgWinRate), color: 'text-cyan-400', sub: `${strategy.mcResults.numSimulations} sims` },
        ]
        return (
          <div className="grid grid-cols-5 gap-px bg-slate-700/20 border-t border-slate-700/30">
            {stats.map(stat => (
              <div key={stat.label} className="bg-slate-900/40 px-3 py-2 text-center">
                <p className={`text-sm font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-[10px] text-slate-500">{stat.label}</p>
                {'sub' in stat && stat.sub && <p className="text-[10px] text-slate-600">{stat.sub}</p>}
              </div>
            ))}
          </div>
        )
      })()}

      {/* Exit target banner — show when exitAdvice exists */}
      {strategy.exitAdvice && (() => {
        const exitTarget = strategy.exitAdvice.recommendedExitPnl
        const hitsCount = linkedRuns.filter(r => r.snapshot.pnl >= exitTarget).length
        return (
          <div className="flex items-center justify-between px-4 py-2 bg-amber-900/15 border-t border-amber-500/20">
            <div className="flex items-center gap-2">
              <span className="text-sm">💡</span>
              <span className="text-xs text-amber-300 font-semibold">Pull out at </span>
              <span className="text-sm font-black text-amber-400">+${exitTarget.toFixed(2)}</span>
              <span className="text-xs text-slate-500">(avg peak +${strategy.exitAdvice.medianPeakPnl.toFixed(2)}, ~{Math.round(strategy.exitAdvice.avgTradesAtPeak)} trades)</span>
            </div>
            {linkedRuns.length > 0 && (
              <div className={`flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full ${
                hitsCount > 0 ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-700/50 text-slate-400'
              }`}>
                <span className="font-bold">{hitsCount}/{linkedRuns.length}</span>
                <span>runs hit target</span>
                {hitsCount > 0 && <span>⚡</span>}
              </div>
            )}
          </div>
        )
      })()}

      {/* Expand / collapse */}
      <div className="flex border-t border-slate-700/30">
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex-1 py-2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          {expanded ? '▲ Collapse' : '▼ Details'}
        </button>
        <a
          href={`/copy-simulator${strategy.trader ? `?trader=${strategy.trader}` : ''}`}
          className="px-4 py-2 text-xs text-cyan-400 hover:text-cyan-300 border-l border-slate-700/30 transition-colors"
        >
          ▶️ Run Live Sim
        </a>
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="px-4 py-2 text-xs text-slate-500 hover:text-red-400 border-l border-slate-700/30 transition-colors"
          >
            🗑️
          </button>
        ) : (
          <div className="flex border-l border-slate-700/30">
            <button onClick={() => onDelete(strategy.id)} className="px-3 py-2 text-xs text-red-400 hover:text-red-300 transition-colors">Delete</button>
            <button onClick={() => setConfirmDelete(false)} className="px-3 py-2 text-xs text-slate-400 hover:text-slate-300 transition-colors">Cancel</button>
          </div>
        )}
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-slate-700/30 p-4 space-y-4">
          {/* Tabs */}
          <div className="flex gap-1 bg-slate-900/50 p-1 rounded-lg">
          {(['mc', 'settings', 'sessions', 'runs'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === tab ? 'bg-slate-700 text-slate-100' : 'text-slate-500 hover:text-slate-300'}`}
              >
                {tab === 'mc' ? '🏒 MC Results' : tab === 'settings' ? '⚙️ Settings' : tab === 'sessions' ? `💻 Live Sessions (${strategy.liveSessions.length})` : `🚀 Live Runs (${linkedRuns.length})`}
              </button>
            ))}
          </div>

          {/* MC Results tab */}
          {activeTab === 'mc' && (
            <div className="space-y-3">
              {/* Primary metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-slate-900/60 rounded-lg p-3 text-center">
                  <p className="text-xs text-slate-500 mb-1">Survived</p>
                  <p className={`text-xl font-bold ${survivalColor(sr)}`}>{strategy.mcResults.survived}</p>
                  <p className="text-xs text-slate-500">of {strategy.mcResults.numSimulations}</p>
                </div>
                <div className="bg-slate-900/60 rounded-lg p-3 text-center">
                  <p className="text-xs text-slate-500 mb-1">Avg Win Rate</p>
                  <p className="text-xl font-bold text-cyan-400">{pct(strategy.mcResults.avgWinRate)}</p>
                </div>
                <div className="bg-slate-900/60 rounded-lg p-3 text-center">
                  <p className="text-xs text-slate-500 mb-1">Avg Trades</p>
                  <p className="text-xl font-bold text-slate-300">{Math.round(strategy.mcResults.avgTrades)}</p>
                </div>
                <div className="bg-slate-900/60 rounded-lg p-3 text-center">
                  <p className="text-xs text-slate-500 mb-1">Avg P&L</p>
                  <p className={`text-xl font-bold ${strategy.mcResults.avgPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(strategy.mcResults.avgPnl)}</p>
                </div>
              </div>
              {/* P&L distribution */}
              <div className="bg-slate-900/40 rounded-lg p-3">
                <p className="text-xs text-slate-400 mb-2 font-semibold">P&L Distribution</p>
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  {[
                    { label: 'Worst', value: strategy.mcResults.worstPnl, color: 'text-red-400' },
                    { label: 'P25', value: strategy.mcResults.p25Pnl, color: strategy.mcResults.p25Pnl >= 0 ? 'text-emerald-400' : 'text-orange-400' },
                    { label: 'P75', value: strategy.mcResults.p75Pnl, color: strategy.mcResults.p75Pnl >= 0 ? 'text-emerald-400' : 'text-orange-400' },
                    { label: 'Best', value: strategy.mcResults.bestPnl, color: 'text-emerald-400' },
                  ].map(d => (
                    <div key={d.label}>
                      <p className="text-slate-500 mb-0.5">{d.label}</p>
                      <p className={`font-bold font-mono ${d.color}`}>{fmt(d.value)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Live vs MC comparison */}
              <LiveVsMC strategy={strategy} />
            </div>
          )}

          {/* Settings tab */}
          {activeTab === 'settings' && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                { label: 'Budget', value: `$${strategy.settings.budget}` },
                { label: 'Bet Mode', value: strategy.settings.bettingMode === 'fixed' ? `Fixed $${strategy.settings.fixedBet}` : `${strategy.settings.percentage}% of trade` },
                { label: 'Price Range', value: `${strategy.settings.minPrice.toFixed(2)} – ${strategy.settings.maxPrice.toFixed(2)}` },
                { label: 'Min Trigger', value: `$${strategy.settings.minTrigger}` },
                { label: 'Slippage', value: `${strategy.settings.slippagePercent}%` },
                { label: 'Fee', value: `${strategy.settings.feePercent}%` },
                { label: 'Simulations', value: strategy.settings.numSimulations.toLocaleString() },
              ].map(row => (
                <div key={row.label} className="flex justify-between bg-slate-900/40 rounded-lg px-3 py-2">
                  <span className="text-slate-500">{row.label}</span>
                  <span className="text-slate-200 font-mono">{row.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Live sessions tab */}
          {activeTab === 'sessions' && (
            <div className="space-y-3">
              <button
                onClick={() => setShowSessionForm(v => !v)}
                className="w-full py-2 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 hover:border-indigo-500/50 text-indigo-300 text-sm font-semibold rounded-lg transition-all"
              >
                {showSessionForm ? '✕ Cancel' : '+ Log Live Session'}
              </button>

              {showSessionForm && (
                <LogSessionForm
                  onAdd={session => { onAddSession(strategy.id, session); setShowSessionForm(false) }}
                  onCancel={() => setShowSessionForm(false)}
                />
              )}

              {strategy.liveSessions.length === 0 && !showSessionForm && (
                <div className="text-center py-6 text-slate-500 text-sm">
                  No live sessions logged yet.<br />
                  <span className="text-slate-600">Run the copy simulator and log your results here to validate the MC prediction.</span>
                </div>
              )}

              {strategy.liveSessions.length > 0 && (
                <div className="space-y-2">
                  {strategy.liveSessions.map(session => (
                    <div key={session.id} className="bg-slate-900/50 border border-slate-700/40 rounded-lg p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className={`text-sm font-bold ${session.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(session.pnl)}</span>
                            <span className="text-xs text-slate-400">{pct(session.winRate)} WR</span>
                            <span className="text-xs text-slate-400">{session.totalTrades} trades</span>
                            <span className="text-xs text-slate-400">{session.durationHours}h</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">{new Date(session.runAt).toLocaleDateString()}{session.notes && ` — ${session.notes}`}</p>
                        </div>
                        <button
                          onClick={() => onDeleteSession(strategy.id, session.id)}
                          className="ml-2 text-slate-600 hover:text-red-400 transition-colors text-xs"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Comparison when sessions present */}
              {strategy.liveSessions.length > 0 && <LiveVsMC strategy={strategy} />}
            </div>
          )}

          {/* Live Runs tab */}
          {activeTab === 'runs' && (
            <div className="space-y-3">
              {linkedRuns.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-sm">
                  No live runs linked yet.<br />
                  <span className="text-slate-600">Go to the Copy Simulator, find a run and click </span>
                  <span className="text-indigo-400 font-semibold">🗂️ Assign →</span>
                  <span className="text-slate-600"> to link it here.</span>
                </div>
              ) : (() => {
                const mc = strategy.mcResults
                const totalLivePnl = linkedRuns.reduce((s, r) => s + r.snapshot.pnl, 0)
                const avgLivePnl = totalLivePnl / linkedRuns.length
                const avgLiveWR = linkedRuns.reduce((s, r) => s + r.snapshot.winRate, 0) / linkedRuns.length
                const totalClosed = linkedRuns.reduce((s, r) => s + r.snapshot.closedTrades, 0)
                const pnlDelta = avgLivePnl - mc.medianPnl
                const wrDelta = avgLiveWR - mc.avgWinRate
                const exitTarget = strategy.exitAdvice?.recommendedExitPnl ?? null
                const hitsCount = exitTarget !== null ? linkedRuns.filter(r => r.snapshot.pnl >= exitTarget).length : 0

                return (
                  <div className="space-y-3">
                    {/* Aggregate live vs MC block */}
                    <div className="bg-slate-900/60 border border-slate-600/40 rounded-xl p-4">
                      <p className="text-xs font-semibold text-slate-400 mb-3">📊 {linkedRuns.length} Live Runs — Combined vs MC</p>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div>
                          <p className="text-[10px] text-slate-500 mb-1">Avg P&L</p>
                          <p className="text-xs text-slate-400 font-mono">{fmt(mc.medianPnl)} MC</p>
                          <p className={`text-base font-black font-mono ${avgLivePnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(avgLivePnl)}</p>
                          <p className={`text-[10px] mt-0.5 font-semibold ${pnlDelta >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            {pnlDelta >= 0 ? '▲' : '▼'} {Math.abs(pnlDelta).toFixed(2)} vs MC
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-500 mb-1">Avg Win Rate</p>
                          <p className="text-xs text-slate-400 font-mono">{pct(mc.avgWinRate)} MC</p>
                          <p className={`text-base font-black font-mono ${avgLiveWR >= mc.avgWinRate ? 'text-emerald-400' : 'text-orange-400'}`}>{pct(avgLiveWR)}</p>
                          <p className={`text-[10px] mt-0.5 font-semibold ${wrDelta >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            {wrDelta >= 0 ? '▲' : '▼'} {Math.abs(wrDelta).toFixed(1)}pp vs MC
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-500 mb-1">Total Closed</p>
                          <p className="text-xs text-slate-400 font-mono">{Math.round(mc.avgTrades)} MC avg</p>
                          <p className="text-base font-black font-mono text-cyan-400">{totalClosed}</p>
                          <p className="text-[10px] mt-0.5 text-slate-500">across all runs</p>
                        </div>
                      </div>
                      <div className={`mt-3 px-3 py-2 rounded-lg text-xs text-center ${
                        Math.abs(pnlDelta) <= Math.abs(mc.medianPnl) * 0.25
                          ? 'bg-emerald-900/20 text-emerald-300'
                          : pnlDelta < 0
                          ? 'bg-red-900/20 text-red-300'
                          : 'bg-cyan-900/20 text-cyan-300'
                      }`}>
                        {Math.abs(pnlDelta) <= Math.abs(mc.medianPnl) * 0.25
                          ? '✅ Live results within 25% of MC prediction — simulation looks reliable'
                          : pnlDelta < 0
                          ? '⚠️ Live underperforming MC — slippage, fees, or market conditions differ from backtested period'
                          : '🚀 Live outperforming MC predictions'}
                      </div>
                    </div>

                    {/* Exit target */}
                    {strategy.exitAdvice && (
                      <div className="bg-amber-900/20 border border-amber-500/30 rounded-xl px-4 py-3 flex items-center justify-between">
                        <div>
                          <p className="text-xs text-amber-300 font-semibold">💡 Recommended exit target</p>
                          <p className="text-xl font-black text-amber-400 mt-0.5">+${exitTarget!.toFixed(2)}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            Median peak +${strategy.exitAdvice.medianPeakPnl.toFixed(2)} • ~{Math.round(strategy.exitAdvice.avgTradesAtPeak)} trades to peak • avg -{strategy.exitAdvice.avgDrawdownPostPeak.toFixed(2)} after
                          </p>
                        </div>
                        <div className="text-center">
                          <p className={`text-3xl font-black ${
                            hitsCount === linkedRuns.length ? 'text-emerald-400' : hitsCount > 0 ? 'text-yellow-400' : 'text-slate-500'
                          }`}>{hitsCount}/{linkedRuns.length}</p>
                          <p className="text-[10px] text-slate-500">runs hit target</p>
                          {hitsCount > 0 && <p className="text-[10px] text-amber-400 mt-0.5">⚠️ Consider withdrawing</p>}
                        </div>
                      </div>
                    )}

                    {/* Per-run cards */}
                    {linkedRuns.map((run: LinkedRun) => {
                      const snap = run.snapshot
                      const hitTarget = exitTarget !== null && snap.pnl >= exitTarget
                      const pnlVsMC = snap.pnl - mc.medianPnl
                      const wrVsMC = snap.winRate - mc.avgWinRate
                      const stale = snapshotStale(snap.snapshotAt)
                      const reliable = snap.closedTrades >= 30
                      const someData = snap.closedTrades >= 10
                      return (
                        <div key={run.runId} className={`bg-slate-900/50 border rounded-xl p-4 ${
                          hitTarget ? 'border-amber-500/50' : stale ? 'border-slate-600/60' : 'border-slate-700/40'
                        }`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              {/* Run name row */}
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${snap.isActive ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                                <span className="font-semibold text-slate-200 text-sm truncate">{run.runName}</span>
                                {snap.isActive && <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">Live</span>}
                                {hitTarget && <span className="text-[10px] font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full">💡 Hit target</span>}
                                {!reliable && someData && <span className="text-[10px] text-yellow-500 bg-yellow-500/10 px-1.5 py-0.5 rounded">⚠️ Low data ({snap.closedTrades} closed)</span>}
                                {!someData && <span className="text-[10px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">🔴 Insufficient data</span>}
                                {stale && <span className="text-[10px] text-slate-500 bg-slate-700/50 px-1.5 py-0.5 rounded">⏰ Stale</span>}
                              </div>

                              {/* Stats grid */}
                              <div className="grid grid-cols-4 gap-2 text-xs">
                                <div className="bg-slate-800/60 rounded-lg p-2 text-center">
                                  <p className={`font-bold ${snap.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(snap.pnl)}</p>
                                  <p className="text-slate-500 mt-0.5">P&L</p>
                                </div>
                                <div className="bg-slate-800/60 rounded-lg p-2 text-center">
                                  <p className="font-bold text-cyan-400">{snap.winRate.toFixed(1)}%</p>
                                  <p className="text-slate-500 mt-0.5">Win Rate</p>
                                </div>
                                <div className="bg-slate-800/60 rounded-lg p-2 text-center">
                                  <p className="font-bold text-slate-300">{snap.closedTrades}</p>
                                  <p className="text-slate-500 mt-0.5">Closed</p>
                                </div>
                                <div className="bg-slate-800/60 rounded-lg p-2 text-center">
                                  <p className="font-bold text-slate-300">{snap.totalTrades}</p>
                                  <p className="text-slate-500 mt-0.5">Total</p>
                                </div>
                              </div>

                              {/* vs MC row */}
                              {someData && (
                                <div className="mt-2 grid grid-cols-2 gap-2">
                                  <div className={`flex items-center justify-between px-2 py-1 rounded text-[10px] ${
                                    pnlVsMC >= 0 ? 'bg-emerald-900/20 text-emerald-400' : 'bg-red-900/20 text-red-400'
                                  }`}>
                                    <span className="text-slate-400">P&L vs MC median</span>
                                    <span className="font-bold">{pnlVsMC >= 0 ? '▲' : '▼'} {Math.abs(pnlVsMC).toFixed(2)}</span>
                                  </div>
                                  <div className={`flex items-center justify-between px-2 py-1 rounded text-[10px] ${
                                    wrVsMC >= 0 ? 'bg-emerald-900/20 text-emerald-400' : 'bg-orange-900/20 text-orange-400'
                                  }`}>
                                    <span className="text-slate-400">WR vs MC ({mc.avgWinRate.toFixed(0)}%)</span>
                                    <span className="font-bold">{wrVsMC >= 0 ? '▲' : '▼'} {Math.abs(wrVsMC).toFixed(1)}pp</span>
                                  </div>
                                </div>
                              )}

                              {/* Footer */}
                              <p className="text-[10px] text-slate-600 mt-2">
                                Snapshot {snapshotAge(snap.snapshotAt)}
                                {stale && <span className="text-yellow-600"> — use 🔄 Refresh All to update</span>}
                              </p>
                            </div>
                            <button
                              onClick={() => onUnlink(strategy.id, run.runId)}
                              className="flex-shrink-0 text-slate-600 hover:text-red-400 transition-colors text-xs px-2 py-1 rounded hover:bg-red-500/10"
                              title="Unlink this run"
                            >🗑️</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function StrategyCenterPage() {
  const [strategies, setStrategies] = useState<SavedStrategy[]>([])
  const [sortBy, setSortBy] = useState<'date' | 'survival' | 'sharpe' | 'sessions'>('date')
  const [filterMin, setFilterMin] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null)

  useEffect(() => {
    setStrategies(loadStrategies())
  }, [])

  const handleRefreshAll = async () => {
    setIsRefreshing(true)
    setRefreshMsg(null)
    try {
      const updated = await refreshAllSnapshots()
      setStrategies(loadStrategies())
      setRefreshMsg(updated > 0 ? `✅ Refreshed snapshots for ${updated} strategy/strategies` : '⚠️ No matching live runs found in local data')
    } catch (e) {
      setRefreshMsg('❌ Refresh failed — make sure you have the Copy Simulator open in this browser')
    } finally {
      setIsRefreshing(false)
      setTimeout(() => setRefreshMsg(null), 4000)
    }
  }

  const handleDelete = (id: string) => {
    deleteStrategy(id)
    setStrategies(loadStrategies())
  }

  const handleUnlink = (strategyId: string, runId: string) => {
    unlinkRunFromStrategy(strategyId, runId)
    setStrategies(loadStrategies())
  }

  const handleAddSession = (strategyId: string, session: LiveSession) => {
    addLiveSession(strategyId, session)
    setStrategies(loadStrategies())
  }

  const handleDeleteSession = (strategyId: string, sessionId: string) => {
    deleteLiveSession(strategyId, sessionId)
    setStrategies(loadStrategies())
  }

  const handleRename = (strategyId: string, name: string) => {
    const all = loadStrategies()
    const s = all.find(x => x.id === strategyId)
    if (!s) return
    s.name = name.trim() || s.name
    saveStrategy(s)
    setStrategies(loadStrategies())
  }

  const sorted = [...strategies]
    .filter(s => s.mcResults.survivalRate >= filterMin)
    .sort((a, b) => {
      if (sortBy === 'date') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      if (sortBy === 'survival') return b.mcResults.survivalRate - a.mcResults.survivalRate
      if (sortBy === 'sharpe') return b.mcResults.sharpe - a.mcResults.sharpe
      if (sortBy === 'sessions') return b.liveSessions.length - a.liveSessions.length
      return 0
    })

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-slate-100">
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-black bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              🗂️ Strategy Center
            </h1>
            <p className="text-slate-400 mt-1">
              Saved MC strategies — log live session results to validate simulations
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleRefreshAll}
              disabled={isRefreshing}
              className="px-4 py-2 bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/40 hover:border-indigo-500/60 text-indigo-300 font-semibold rounded-lg transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRefreshing ? '⏳ Refreshing…' : '🔄 Refresh All'}
            </button>
            <a href="/copy-simulator" className="px-4 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 hover:border-cyan-500/50 text-cyan-400 font-medium rounded-lg transition-all text-sm">
              🚀 Copy Simulator
            </a>
            <a href="/trader-finder" className="px-4 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 hover:border-cyan-500/50 text-cyan-400 font-medium rounded-lg transition-all text-sm">
              🎯 Trader Finder
            </a>
            <a href="/historical-analysis" className="px-4 py-2 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 hover:border-purple-500/50 text-purple-400 font-medium rounded-lg transition-all text-sm">
              📊 Historical Analysis
            </a>
          </div>
          {refreshMsg && (
            <div className="w-full mt-2 px-4 py-2 bg-slate-800/60 border border-slate-600/40 rounded-lg text-sm text-slate-300 text-center">
              {refreshMsg}
            </div>
          )}
        </div>

        {/* Stats bar */}
        {strategies.length > 0 && (
          <div className="grid grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Saved Strategies', value: strategies.length, color: 'text-indigo-400' },
              { label: 'Avg Survival Rate', value: pct(strategies.reduce((a, s) => a + s.mcResults.survivalRate, 0) / strategies.length), color: 'text-emerald-400' },
              { label: 'Avg Sharpe', value: (strategies.reduce((a, s) => a + s.mcResults.sharpe, 0) / strategies.length).toFixed(2), color: 'text-cyan-400' },
              { label: 'Live Sessions', value: strategies.reduce((a, s) => a + s.liveSessions.length, 0), color: 'text-purple-400' },
            ].map(stat => (
              <div key={stat.label} className="bg-slate-800/40 border border-slate-700/30 rounded-xl p-3 text-center">
                <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-xs text-slate-500">{stat.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Filters and sort */}
        {strategies.length > 0 && (
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="flex gap-1 bg-slate-800/50 border border-slate-700/30 rounded-lg p-1">
              {(['date', 'survival', 'sharpe', 'sessions'] as const).map(s => (
                <button key={s} onClick={() => setSortBy(s)} className={`px-3 py-1.5 text-xs rounded-md transition-all ${sortBy === s ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-500 hover:text-slate-300'}`}>
                  {s === 'date' ? '🕐 Newest' : s === 'survival' ? '🛡️ Survival' : s === 'sharpe' ? '📈 Sharpe' : '📋 Sessions'}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Min survival</span>
              <input type="number" value={filterMin} onChange={e => setFilterMin(+e.target.value)} min="0" max="100" step="5"
                className="w-16 px-2 py-1 bg-slate-900 border border-slate-600 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500" />
              <span className="text-xs text-slate-500">%</span>
            </div>
          </div>
        )}

        {/* Strategy list */}
        {sorted.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-6xl mb-4">🗂️</p>
            <h2 className="text-xl font-bold text-slate-300 mb-2">No strategies saved yet</h2>
            <p className="text-slate-500 mb-6">
              Run a Monte Carlo simulation in the Copy Simulator optimization modal,<br />
              then click <strong className="text-indigo-300">💾 Save to Strategy Center</strong>
            </p>
            <a href="/copy-simulator" className="inline-block px-6 py-3 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-300 font-semibold rounded-xl transition-all">
              Open Copy Simulator →
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            {sorted.map(strategy => (
              <StrategyCard
                key={strategy.id}
                strategy={strategy}
                onDelete={handleDelete}
                onAddSession={handleAddSession}
                onDeleteSession={handleDeleteSession}
                onRename={handleRename}
                onUnlink={handleUnlink}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
