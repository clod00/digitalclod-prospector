import { useState, useEffect, useCallback, useRef } from 'react'
import { Filter, RefreshCw, Mail } from 'lucide-react'
import KpiCards from '../components/KpiCards'
import LeadTable from '../components/LeadTable'
import LeadDrawer from '../components/LeadDrawer'
import BulkEnrichBar from '../components/BulkEnrichBar'
import ExportMenu from '../components/ExportMenu'
import { getLeads, getKpi, getSettori } from '../lib/api'

const BASE_API = import.meta.env.VITE_API_URL || 'http://localhost:3002'

export default function Dashboard() {
  const [leads, setLeads] = useState([])
  const [kpi, setKpi] = useState(null)
  const [settori, setSettori] = useState([])
  const [loading, setLoading] = useState(true)
  const [kpiLoading, setKpiLoading] = useState(true)
  const [selectedLead, setSelectedLead] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])
  const [enrichProgress, setEnrichProgress] = useState(null)
  const [emailProgress, setEmailProgress] = useState(null) // { phase, done, total, found, current, msg }

  // Filters
  const [tierFilter, setTierFilter] = useState(null)
  const [settoreFilter, setSettoreFilter] = useState('')
  const [statoFilter, setStatoFilter] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const LIMIT = 50

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, limit: LIMIT }
      if (tierFilter) params.tier = tierFilter
      if (settoreFilter) params.settore = settoreFilter
      if (statoFilter) params.stato = statoFilter
      const { data } = await getLeads(params)
      setLeads(data.data || [])
      setTotal(data.total || 0)
    } catch (err) {
      console.error('Fetch leads error:', err)
    } finally {
      setLoading(false)
    }
  }, [page, tierFilter, settoreFilter, statoFilter])

  const fetchKpi = useCallback(async () => {
    setKpiLoading(true)
    try {
      const { data } = await getKpi()
      setKpi(data)
    } catch (err) {
      console.error('KPI error:', err)
    } finally {
      setKpiLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLeads()
    fetchKpi()
    getSettori().then(r => setSettori(r.data || [])).catch(() => {})
  }, [fetchLeads, fetchKpi])

  const handleRefresh = () => {
    fetchLeads()
    fetchKpi()
  }

  const handleBulkEnrich = async () => {
    if (selectedIds.length === 0) return
    setEnrichProgress({ done: 0, total: selectedIds.length, current: '' })

    try {
      const response = await fetch(`${BASE_API}/api/enrich/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds }),
      })

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '))
        for (const line of lines) {
          try {
            const json = JSON.parse(line.replace('data: ', ''))
            if (json.error) {
              alert('Errore bulk enrichment: ' + json.error)
              break
            }
            setEnrichProgress(json)
          } catch (_) {}
        }
      }
    } catch (err) {
      alert('Errore: ' + err.message)
    } finally {
      setEnrichProgress(null)
      setSelectedIds([])
      handleRefresh()
    }
  }

  const handleFindEmailsHot = async () => {
    setEmailProgress({ phase: 'start', done: 0, total: 0, found: 0, current: '' })

    try {
      const response = await fetch(`${BASE_API}/api/email-scrape/hot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '))
        for (const line of lines) {
          try {
            const json = JSON.parse(line.replace('data: ', ''))
            if (json.error) { alert('Errore: ' + json.error); break }
            setEmailProgress(prev => {
              if (json.phase === 'start') return { ...prev, total: json.total, skipped_food: json.skipped_food, found: 0 }
              if (json.phase === 1) return { ...prev, done: json.done, total: json.total, current: json.current }
              if (json.phase === 2) return { ...prev, current: json.msg, googleBatch: true }
              if (json.phase === 'done') return { ...prev, phase: 'done', found: json.found, total: json.total }
              if (json.found_id) return { ...prev, found: (prev.found || 0) + 1 }
              return prev
            })
          } catch (_) {}
        }
      }
    } catch (err) {
      alert('Errore: ' + err.message)
    } finally {
      handleRefresh()
      setTimeout(() => setEmailProgress(null), 4000)
    }
  }

  const handleLeadUpdate = (updated) => {
    setLeads(prev => prev.map(l => l.id === updated.id ? updated : l))
    if (selectedLead?.id === updated.id) setSelectedLead(updated)
    fetchKpi()
  }

  const currentFilters = {
    ...(tierFilter && { tier: tierFilter }),
    ...(settoreFilter && { settore: settoreFilter }),
    ...(statoFilter && { stato: statoFilter }),
  }

  const totalPages = Math.ceil(total / LIMIT)

  return (
    <div>
      <KpiCards
        kpi={kpi}
        loading={kpiLoading}
        activeFilter={tierFilter}
        onFilter={(tier) => { setTierFilter(tier); setPage(1) }}
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          <Filter className="w-4 h-4 text-text-secondary shrink-0" />

          {/* Settore filter */}
          <select
            value={settoreFilter}
            onChange={e => { setSettoreFilter(e.target.value); setPage(1) }}
            className="bg-surface border border-border text-text-secondary text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-accent"
          >
            <option value="">Tutti i settori</option>
            {settori.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          {/* Stato filter */}
          <select
            value={statoFilter}
            onChange={e => { setStatoFilter(e.target.value); setPage(1) }}
            className="bg-surface border border-border text-text-secondary text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-accent"
          >
            <option value="">Tutti gli stati</option>
            <option value="da_contattare">Da contattare</option>
            <option value="contattato">Contattato</option>
            <option value="risposto">Risposto</option>
            <option value="cliente">Cliente</option>
          </select>

          {/* Tier filter pills */}
          {['Hot', 'Warm', 'Cold'].map(t => (
            <button
              key={t}
              onClick={() => { setTierFilter(tierFilter === t ? null : t); setPage(1) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                tierFilter === t
                  ? t === 'Hot' ? 'bg-success/20 border-success/50 text-success'
                    : t === 'Warm' ? 'bg-amber/20 border-amber/50 text-amber'
                    : 'bg-danger/20 border-danger/50 text-danger'
                  : 'bg-surface border-border text-text-secondary hover:border-accent/50'
              }`}
            >
              {t === 'Hot' ? '🟢' : t === 'Warm' ? '🟡' : '🔴'} {t}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-text-secondary">{total} leads</span>
          <button
            onClick={handleFindEmailsHot}
            disabled={!!emailProgress}
            title="Trova email per tutti i lead Hot (esclude food)"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-surface border border-border text-text-secondary hover:border-amber/50 hover:text-amber disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            <Mail className="w-3.5 h-3.5" />
            Trova Email Hot
          </button>
          <button
            onClick={handleRefresh}
            className="p-2 text-text-secondary hover:text-text-primary transition-colors rounded-lg hover:bg-surface-2"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <ExportMenu filters={currentFilters} />
        </div>
      </div>

      {/* Table */}
      <LeadTable
        leads={leads}
        loading={loading}
        onSelect={setSelectedLead}
        onRefresh={handleRefresh}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
            className="px-3 py-1.5 text-sm bg-surface border border-border rounded-lg disabled:opacity-40 hover:border-accent/50 transition-colors"
          >
            ←
          </button>
          <span className="text-sm text-text-secondary">{page} / {totalPages}</span>
          <button
            disabled={page === totalPages}
            onClick={() => setPage(p => p + 1)}
            className="px-3 py-1.5 text-sm bg-surface border border-border rounded-lg disabled:opacity-40 hover:border-accent/50 transition-colors"
          >
            →
          </button>
        </div>
      )}

      {/* Bulk bar */}
      <BulkEnrichBar
        selectedIds={selectedIds}
        onEnrich={handleBulkEnrich}
        onClear={() => setSelectedIds([])}
        enrichProgress={enrichProgress}
      />

      {/* Email scrape progress bar */}
      {emailProgress && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-surface-2 border border-border rounded-2xl shadow-2xl px-5 py-3 flex items-center gap-4 min-w-[380px] max-w-[520px]">
          <Mail className="w-4 h-4 text-amber shrink-0" />
          <div className="flex-1 min-w-0">
            {emailProgress.phase === 'done' ? (
              <p className="text-sm font-medium text-text-primary">
                Trovate <span className="text-amber">{emailProgress.found}</span> email su {emailProgress.total} lead Hot
                {emailProgress.skipped_food > 0 && (
                  <span className="text-text-secondary text-xs ml-1">({emailProgress.skipped_food} food saltati)</span>
                )}
              </p>
            ) : (
              <>
                <p className="text-sm font-medium text-text-primary truncate">
                  {emailProgress.current || 'Avvio ricerca email...'}
                </p>
                {emailProgress.total > 0 && (
                  <>
                    <div className="mt-1 h-1.5 bg-border rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber transition-all duration-300 rounded-full"
                        style={{ width: `${Math.round(((emailProgress.done || 0) / emailProgress.total) * 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-text-secondary mt-0.5">
                      {emailProgress.done || 0}/{emailProgress.total}
                      {emailProgress.found > 0 && <span className="text-amber ml-2">· {emailProgress.found} trovate</span>}
                    </p>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Lead drawer */}
      {selectedLead && (
        <LeadDrawer
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdate={handleLeadUpdate}
        />
      )}
    </div>
  )
}
