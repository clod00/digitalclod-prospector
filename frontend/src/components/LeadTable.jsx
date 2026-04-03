import { useState } from 'react'
import { Globe, Instagram, Facebook, MapPin, Zap, ChevronUp, ChevronDown, Trash2 } from 'lucide-react'
import ScoreBadge from './ScoreBadge'
import StatusBadge from './StatusBadge'
import { deleteLead } from '../lib/api'

export default function LeadTable({ leads, loading, onSelect, onRefresh, selectedIds, onSelectionChange }) {
  const [sort, setSort] = useState({ col: 'score_totale', dir: 'desc' })

  const handleSort = (col) => {
    setSort(prev => ({ col, dir: prev.col === col && prev.dir === 'desc' ? 'asc' : 'desc' }))
  }

  const sortedLeads = [...leads].sort((a, b) => {
    const av = a[sort.col] ?? -1
    const bv = b[sort.col] ?? -1
    return sort.dir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
  })

  const toggleSelect = (id, e) => {
    e.stopPropagation()
    onSelectionChange(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === leads.length) onSelectionChange([])
    else onSelectionChange(leads.map(l => l.id))
  }

  const handleDelete = async (id, e) => {
    e.stopPropagation()
    if (!confirm('Eliminare questo lead?')) return
    try {
      await deleteLead(id)
      onRefresh()
    } catch (err) {
      alert('Errore eliminazione: ' + err.message)
    }
  }

  const SortIcon = ({ col }) => {
    if (sort.col !== col) return <ChevronUp className="w-3 h-3 text-muted opacity-30" />
    return sort.dir === 'asc'
      ? <ChevronUp className="w-3 h-3 text-accent" />
      : <ChevronDown className="w-3 h-3 text-accent" />
  }

  const Th = ({ col, children }) => (
    <th
      className="px-3 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wide cursor-pointer select-none hover:text-text-primary"
      onClick={() => handleSort(col)}
    >
      <div className="flex items-center gap-1">
        {children}
        <SortIcon col={col} />
      </div>
    </th>
  )

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-14 rounded-lg shimmer" />
        ))}
      </div>
    )
  }

  if (leads.length === 0) {
    return (
      <div className="text-center py-20 text-text-secondary">
        <Zap className="w-12 h-12 mx-auto mb-3 opacity-20" />
        <p className="text-lg font-medium">Nessun lead trovato</p>
        <p className="text-sm">Importa leads o modifica i filtri</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-surface-2 border-b border-border">
          <tr>
            <th className="px-3 py-3 w-10">
              <input
                type="checkbox"
                checked={selectedIds.length === leads.length && leads.length > 0}
                onChange={toggleSelectAll}
                className="accent-accent w-4 h-4 rounded cursor-pointer"
              />
            </th>
            <Th col="ragione_sociale">Azienda</Th>
            <Th col="settore">Settore</Th>
            <Th col="score_totale">Score</Th>
            <th className="px-3 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wide">Web</th>
            <th className="px-3 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wide">Social</th>
            <Th col="gmaps_recensioni">Maps</Th>
            <th className="px-3 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wide">Stato</th>
            <th className="px-3 py-3 w-10" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sortedLeads.map(lead => (
            <tr
              key={lead.id}
              className="lead-row cursor-pointer transition-colors"
              onClick={() => onSelect(lead)}
            >
              <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(lead.id)}
                  onChange={(e) => toggleSelect(lead.id, e)}
                  className="accent-accent w-4 h-4 rounded cursor-pointer"
                />
              </td>

              <td className="px-3 py-3">
                <div>
                  <p className="font-medium text-text-primary truncate max-w-[180px]">{lead.ragione_sociale}</p>
                  {lead.citta && <p className="text-xs text-text-secondary flex items-center gap-0.5"><MapPin className="w-3 h-3" />{lead.citta}</p>}
                </div>
              </td>

              <td className="px-3 py-3">
                <span className="text-text-secondary text-xs truncate max-w-[100px] block">{lead.settore || '—'}</span>
              </td>

              <td className="px-3 py-3">
                {lead.score_totale != null
                  ? <ScoreBadge score={lead.score_totale} tier={lead.score_tier} />
                  : <span className="text-muted text-xs">—</span>
                }
              </td>

              <td className="px-3 py-3">
                {lead.sito_web ? (
                  <a
                    href={lead.sito_web.startsWith('http') ? lead.sito_web : `https://${lead.sito_web}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="text-accent hover:underline"
                  >
                    <Globe className="w-4 h-4" />
                  </a>
                ) : (
                  <span className="text-muted text-xs">—</span>
                )}
              </td>

              <td className="px-3 py-3">
                <div className="flex items-center gap-2">
                  {lead.social_instagram_url
                    ? <a href={lead.social_instagram_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-pink-400 hover:text-pink-300"><Instagram className="w-4 h-4" /></a>
                    : <Instagram className="w-4 h-4 text-muted opacity-20" />
                  }
                  {lead.social_facebook_url
                    ? <a href={lead.social_facebook_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-blue-400 hover:text-blue-300"><Facebook className="w-4 h-4" /></a>
                    : <Facebook className="w-4 h-4 text-muted opacity-20" />
                  }
                </div>
              </td>

              <td className="px-3 py-3">
                {lead.gmaps_stelle != null ? (
                  <div className="text-xs">
                    <span className="text-amber font-medium">{'★'.repeat(Math.round(lead.gmaps_stelle))}</span>
                    {lead.gmaps_recensioni && <span className="text-text-secondary ml-1">({lead.gmaps_recensioni})</span>}
                  </div>
                ) : <span className="text-muted text-xs">—</span>}
              </td>

              <td className="px-3 py-3">
                <StatusBadge stato={lead.stato} />
              </td>

              <td className="px-3 py-3">
                <button
                  onClick={(e) => handleDelete(lead.id, e)}
                  className="text-muted hover:text-danger transition-colors p-1 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
