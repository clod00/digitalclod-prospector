export default function ScoreBreakdown({ breakdown, score, tier }) {
  if (!breakdown || breakdown.length === 0) return null

  const tierColor = tier === 'Hot' ? 'text-success' : tier === 'Warm' ? 'text-amber' : 'text-danger'
  const maxScore = 20

  return (
    <div className="bg-surface-2 rounded-xl p-4 border border-border">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-text-primary">Score Breakdown</h4>
        <span className={`text-2xl font-bold ${tierColor}`}>{score}/20</span>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-border rounded-full overflow-hidden mb-4">
        <div
          className={`h-full rounded-full transition-all ${
            tier === 'Hot' ? 'bg-success' : tier === 'Warm' ? 'bg-amber' : 'bg-danger'
          }`}
          style={{ width: `${(score / maxScore) * 100}%` }}
        />
      </div>

      {/* Signals */}
      <div className="space-y-2">
        {breakdown.map((item, i) => (
          <div key={i} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-text-secondary">
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </span>
            <span className="text-accent font-semibold">+{item.points}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
