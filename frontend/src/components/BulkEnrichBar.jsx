import { useState } from 'react'
import { Zap, X } from 'lucide-react'

export default function BulkEnrichBar({ selectedIds, onEnrich, onClear, enrichProgress }) {
  if (selectedIds.length === 0) return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-surface-2 border border-border rounded-2xl shadow-2xl px-5 py-3 flex items-center gap-4 min-w-[340px]">
      <div className="flex-1">
        <p className="text-sm font-medium text-text-primary">
          {selectedIds.length} lead selezionati
        </p>
        {enrichProgress && (
          <div className="mt-1">
            <div className="h-1.5 bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-accent transition-all duration-300 rounded-full"
                style={{ width: `${(enrichProgress.done / enrichProgress.total) * 100}%` }}
              />
            </div>
            <p className="text-xs text-text-secondary mt-0.5">
              {enrichProgress.current ? `Analizzando: ${enrichProgress.current}` : `${enrichProgress.done}/${enrichProgress.total}`}
            </p>
          </div>
        )}
      </div>

      <button
        onClick={onEnrich}
        disabled={!!enrichProgress}
        className="flex items-center gap-1.5 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
      >
        <Zap className="w-4 h-4" />
        Arricchisci
      </button>

      <button
        onClick={onClear}
        disabled={!!enrichProgress}
        className="text-text-secondary hover:text-text-primary transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
