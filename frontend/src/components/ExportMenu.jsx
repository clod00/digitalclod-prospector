import { useState, useRef, useEffect } from 'react'
import { Download, ChevronDown, FileSpreadsheet, MapPin, Mail } from 'lucide-react'
import { exportCSV, exportAddresses, exportActiveCampaign } from '../lib/api'

export default function ExportMenu({ filters }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const items = [
    { label: 'Excel completo', icon: FileSpreadsheet, action: () => exportCSV(filters) },
    { label: 'Indirizzi postali', icon: MapPin, action: () => exportAddresses(filters) },
    { label: 'ActiveCampaign', icon: Mail, action: () => exportActiveCampaign(filters) },
  ]

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(p => !p)}
        className="flex items-center gap-1.5 bg-surface-2 border border-border hover:border-accent/50 text-text-secondary hover:text-text-primary px-3 py-2 rounded-lg text-sm font-medium transition-colors"
      >
        <Download className="w-4 h-4" />
        Esporta
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-surface-2 border border-border rounded-xl shadow-xl z-30 min-w-[180px] py-1 overflow-hidden">
          {items.map(({ label, icon: Icon, action }) => (
            <button
              key={label}
              onClick={() => { action(); setOpen(false) }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:bg-surface transition-colors"
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
