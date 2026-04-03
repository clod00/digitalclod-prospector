import { useState, useRef } from 'react'
import { Upload, FileSpreadsheet, Check, X, ArrowRight, AlertTriangle } from 'lucide-react'
import { previewImport, confirmImport } from '../lib/api'
import { useNavigate } from 'react-router-dom'

const COLUMN_LABELS = {
  ragione_sociale: 'Ragione Sociale',
  piva: 'P.IVA',
  citta: 'Città',
  settore: 'Settore',
  telefono: 'Telefono',
  sito_web: 'Sito Web',
  email_trovata: 'Email',
}

export default function ImportPage() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [detectedColumns, setDetectedColumns] = useState([])
  const [totalRows, setTotalRows] = useState(0)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef(null)
  const navigate = useNavigate()

  const handleFile = async (f) => {
    if (!f) return
    setFile(f)
    setError(null)
    setResult(null)
    setPreview(null)

    try {
      const { data } = await previewImport(f)
      setPreview(data.preview)
      setDetectedColumns(data.detectedColumns)
      setTotalRows(data.total)
    } catch (err) {
      setError('Errore parsing file: ' + (err.response?.data?.error || err.message))
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  const handleConfirm = async () => {
    if (!file) return
    setImporting(true)
    setError(null)
    try {
      const { data } = await confirmImport(file)
      setResult(data)
    } catch (err) {
      setError('Errore importazione: ' + (err.response?.data?.error || err.message))
    } finally {
      setImporting(false)
    }
  }

  const missingRequired = preview && !detectedColumns.includes('ragione_sociale')

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-text-primary mb-2">Importa Leads</h1>
      <p className="text-text-secondary text-sm mb-8">
        Carica un file Excel (.xlsx) o CSV con le tue aziende target. Le colonne verranno rilevate automaticamente.
      </p>

      {/* Drop zone */}
      {!preview && (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInput.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
            dragging ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/50 bg-surface'
          }`}
        >
          <input
            ref={fileInput}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={e => handleFile(e.target.files[0])}
          />
          <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
            <Upload className="w-7 h-7 text-accent" />
          </div>
          <p className="text-text-primary font-semibold text-lg mb-1">Trascina il tuo file qui</p>
          <p className="text-text-secondary text-sm">oppure clicca per selezionare</p>
          <p className="text-text-secondary text-xs mt-3">Supporta .xlsx, .xls, .csv — max 10MB</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 bg-danger/10 border border-danger/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-danger shrink-0 mt-0.5" />
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      {/* Preview */}
      {preview && !result && (
        <div className="space-y-5">
          {/* File info */}
          <div className="bg-surface rounded-xl border border-border p-4 flex items-center gap-3">
            <FileSpreadsheet className="w-8 h-8 text-accent" />
            <div className="flex-1">
              <p className="font-medium text-text-primary">{file.name}</p>
              <p className="text-xs text-text-secondary">{totalRows} righe trovate</p>
            </div>
            <button
              onClick={() => { setFile(null); setPreview(null); setError(null) }}
              className="text-text-secondary hover:text-danger transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Column detection */}
          <div className="bg-surface rounded-xl border border-border p-4">
            <h3 className="text-sm font-semibold text-text-primary mb-3">Colonne rilevate</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.entries(COLUMN_LABELS).map(([key, label]) => {
                const found = detectedColumns.includes(key)
                return (
                  <div key={key} className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg border ${
                    found ? 'border-success/30 bg-success/5 text-success' : 'border-border bg-surface-2 text-muted'
                  }`}>
                    {found ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                    {label}
                  </div>
                )
              })}
            </div>

            {missingRequired && (
              <div className="mt-3 flex items-start gap-2 text-amber text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>La colonna "Ragione Sociale" non è stata trovata. Rinomina la colonna e riprova.</span>
              </div>
            )}
          </div>

          {/* Preview table */}
          <div className="bg-surface rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-text-primary">Anteprima (prime 5 righe)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-surface-2">
                  <tr>
                    {detectedColumns.map(col => (
                      <th key={col} className="px-3 py-2 text-left text-text-secondary font-medium whitespace-nowrap">
                        {COLUMN_LABELS[col] || col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {preview.map((row, i) => (
                    <tr key={i} className="hover:bg-surface-2">
                      {detectedColumns.map(col => (
                        <td key={col} className="px-3 py-2 text-text-secondary truncate max-w-[150px]">
                          {row[col] || '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Confirm button */}
          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-text-secondary">
              Verranno importati <strong className="text-text-primary">{totalRows} leads</strong> con deduplicazione P.IVA
            </p>
            <button
              onClick={handleConfirm}
              disabled={importing || missingRequired}
              className="flex items-center gap-2 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-xl font-medium text-sm transition-colors"
            >
              {importing ? 'Importando...' : (
                <>
                  Conferma importazione
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-4">
          <div className="bg-success/10 border border-success/30 rounded-2xl p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-3">
              <Check className="w-7 h-7 text-success" />
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-1">{result.message}</h3>
            <div className="flex items-center justify-center gap-6 mt-4 text-sm">
              <div className="text-center">
                <p className="text-2xl font-bold text-success">{result.inserted}</p>
                <p className="text-text-secondary">Importati</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-muted">{result.skipped}</p>
                <p className="text-text-secondary">Duplicati saltati</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => { setFile(null); setPreview(null); setResult(null) }}
              className="px-4 py-2 bg-surface-2 border border-border rounded-xl text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              Importa altri
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover rounded-xl text-sm text-white font-medium transition-colors"
            >
              Vai alla Dashboard
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Format guide */}
      {!preview && !result && (
        <div className="mt-8 bg-surface rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Formato file consigliato</h3>
          <p className="text-xs text-text-secondary mb-3">
            Il sistema rileva automaticamente le colonne. Usa questi nomi per il riconoscimento ottimale:
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              'Ragione Sociale', 'P.IVA', 'Città', 'Settore', 'Telefono', 'Sito Web'
            ].map(col => (
              <code key={col} className="text-xs bg-surface-2 border border-border rounded px-2 py-1 text-accent">{col}</code>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
