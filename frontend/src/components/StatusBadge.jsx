const STATUS_CONFIG = {
  da_contattare: { label: 'Da contattare', cls: 'bg-muted/20 text-text-secondary' },
  contattato: { label: 'Contattato', cls: 'bg-accent/10 text-accent' },
  risposto: { label: 'Risposto', cls: 'bg-amber/10 text-amber' },
  cliente: { label: 'Cliente ✓', cls: 'bg-success/10 text-success' },
}

export default function StatusBadge({ stato }) {
  const cfg = STATUS_CONFIG[stato] || STATUS_CONFIG.da_contattare
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}
