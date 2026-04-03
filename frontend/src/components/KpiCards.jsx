import { Users, Flame, CheckCircle2, TrendingUp } from 'lucide-react'

const cards = [
  { key: 'total', label: 'Tot Leads', icon: Users, color: 'text-accent', bg: 'bg-accent/10' },
  { key: 'hot', label: 'Hot Leads', icon: Flame, color: 'text-red-400', bg: 'bg-red-400/10', tier: 'Hot' },
  { key: 'enriched', label: 'Enrichiti', icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10' },
  { key: 'response', label: 'Tasso Risposta', icon: TrendingUp, color: 'text-amber', bg: 'bg-amber/10' },
]

export default function KpiCards({ kpi, activeFilter, onFilter, loading }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {cards.map(({ key, label, icon: Icon, color, bg, tier }) => {
        const value = key === 'total' ? kpi?.total
          : key === 'hot' ? kpi?.hot
          : key === 'enriched' ? kpi?.enriched
          : `${kpi?.tassoRisposta ?? 0}%`

        const isActive = activeFilter === tier

        return (
          <button
            key={key}
            onClick={() => tier && onFilter(isActive ? null : tier)}
            className={`bg-surface border rounded-xl p-4 text-left transition-all ${
              isActive
                ? 'border-accent ring-1 ring-accent'
                : 'border-border hover:border-accent/50'
            } ${tier ? 'cursor-pointer' : 'cursor-default'}`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-text-secondary text-xs font-medium">{label}</span>
              <div className={`${bg} rounded-lg p-1.5`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
            </div>
            {loading ? (
              <div className="h-7 w-16 shimmer rounded" />
            ) : (
              <p className={`text-2xl font-bold ${color}`}>{value ?? '—'}</p>
            )}
          </button>
        )
      })}
    </div>
  )
}
