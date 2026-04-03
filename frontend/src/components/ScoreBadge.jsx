export default function ScoreBadge({ score, tier }) {
  const config = {
    Hot: { emoji: '🟢', cls: 'bg-success/10 text-success border-success/30' },
    Warm: { emoji: '🟡', cls: 'bg-amber/10 text-amber border-amber/30' },
    Cold: { emoji: '🔴', cls: 'bg-danger/10 text-danger border-danger/30' },
  }
  const { emoji, cls } = config[tier] || config.Cold

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
      {emoji} {score ?? '—'} {tier}
    </span>
  )
}
